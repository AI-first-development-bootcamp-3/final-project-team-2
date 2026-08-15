import { PrismaClient, UserRole, TaskStatus, WorkLocation } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Clean existing data in reverse FK order
  await prisma.auditLog.deleteMany();
  await prisma.monthLock.deleteMany();
  await prisma.absenceAttachment.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();

  // ─── Users ──────────────────────────────────────────
  const SALT_ROUNDS = 10;

  await prisma.user.create({
    data: {
      email: 'admin@abra.co',
      full_name: 'Admin User',
      password_hash: await bcrypt.hash('Admin123!', SALT_ROUNDS),
      role: UserRole.admin,
    },
  });

  const emp1 = await prisma.user.create({
    data: {
      email: 'employee1@abra.co',
      full_name: 'Alice Cohen',
      password_hash: await bcrypt.hash('Employee123!', SALT_ROUNDS),
      role: UserRole.employee,
    },
  });

  const emp2 = await prisma.user.create({
    data: {
      email: 'employee2@abra.co',
      full_name: 'Bob Levi',
      password_hash: await bcrypt.hash('Employee123!', SALT_ROUNDS),
      role: UserRole.employee,
    },
  });

  // ─── Clients ────────────────────────────────────────
  const acme = await prisma.client.create({
    data: { name: 'Acme Corp', contact_info: 'contact@acme.example.com' },
  });

  const globex = await prisma.client.create({
    data: { name: 'Globex Ltd', contact_info: 'info@globex.example.com' },
  });

  // ─── Projects ───────────────────────────────────────
  const websiteRedesign = await prisma.project.create({
    data: { name: 'Website Redesign', client_id: acme.id },
  });

  const mobileApp = await prisma.project.create({
    data: { name: 'Mobile App', client_id: acme.id },
  });

  const crmIntegration = await prisma.project.create({
    data: { name: 'CRM Integration', client_id: globex.id },
  });

  // ─── Tasks ──────────────────────────────────────────
  const uiDesign = await prisma.task.create({
    data: {
      name: 'UI Design',
      project_id: websiteRedesign.id,
      status: TaskStatus.open,
    },
  });

  const frontendDev = await prisma.task.create({
    data: {
      name: 'Frontend Dev',
      project_id: websiteRedesign.id,
      status: TaskStatus.open,
    },
  });

  const apiIntegration = await prisma.task.create({
    data: {
      name: 'API Integration',
      project_id: mobileApp.id,
      status: TaskStatus.open,
    },
  });

  const testing = await prisma.task.create({
    data: {
      name: 'Testing',
      project_id: mobileApp.id,
      status: TaskStatus.open,
    },
  });

  const dataMigration = await prisma.task.create({
    data: {
      name: 'Data Migration',
      project_id: crmIntegration.id,
      status: TaskStatus.open,
    },
  });

  const userTraining = await prisma.task.create({
    data: {
      name: 'User Training',
      project_id: crmIntegration.id,
      status: TaskStatus.open,
    },
  });

  // ─── Task Assignments ───────────────────────────────
  // Employee 1: UI Design, Frontend Dev, API Integration
  await prisma.taskAssignment.createMany({
    data: [
      { user_id: emp1.id, task_id: uiDesign.id },
      { user_id: emp1.id, task_id: frontendDev.id },
      { user_id: emp1.id, task_id: apiIntegration.id },
    ],
  });

  // Employee 2: Testing, Data Migration, User Training
  await prisma.taskAssignment.createMany({
    data: [
      { user_id: emp2.id, task_id: testing.id },
      { user_id: emp2.id, task_id: dataMigration.id },
      { user_id: emp2.id, task_id: userTraining.id },
    ],
  });

  // ─── Time Entries — one fully reported week ─────────
  // Sun 2026-08-09 to Thu 2026-08-13 (Israeli work week)
  // Employee 1: 5 days, 8-9h each
  const emp1Entries = [
    {
      date: '2026-08-09',
      start: '08:00',
      end: '17:00',
      task_id: uiDesign.id,
      location: WorkLocation.office,
      description: 'Homepage wireframes and mockups',
    },
    {
      date: '2026-08-10',
      start: '09:00',
      end: '18:00',
      task_id: uiDesign.id,
      location: WorkLocation.home,
      description: 'Component library setup',
    },
    {
      date: '2026-08-11',
      start: '08:30',
      end: '17:00',
      task_id: frontendDev.id,
      location: WorkLocation.office,
      description: 'Navigation and routing implementation',
    },
    {
      date: '2026-08-12',
      start: '08:00',
      end: '17:00',
      task_id: frontendDev.id,
      location: WorkLocation.client_site,
      description: 'Client review and feedback session',
    },
    {
      date: '2026-08-13',
      start: '09:00',
      end: '17:30',
      task_id: apiIntegration.id,
      location: WorkLocation.office,
      description: 'REST API client setup',
    },
  ];

  // Employee 2: 4 days
  const emp2Entries = [
    {
      date: '2026-08-09',
      start: '08:00',
      end: '16:30',
      task_id: testing.id,
      location: WorkLocation.office,
      description: 'Test plan creation',
    },
    {
      date: '2026-08-10',
      start: '09:00',
      end: '17:00',
      task_id: dataMigration.id,
      location: WorkLocation.home,
      description: 'Legacy data analysis',
    },
    {
      date: '2026-08-11',
      start: '08:00',
      end: '17:00',
      task_id: dataMigration.id,
      location: WorkLocation.office,
      description: 'Migration script development',
    },
    {
      date: '2026-08-12',
      start: '09:00',
      end: '17:30',
      task_id: userTraining.id,
      location: WorkLocation.client_site,
      description: 'Training materials preparation',
    },
  ];

  function toDateTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00.000+03:00`);
  }

  for (const entry of emp1Entries) {
    await prisma.timeEntry.create({
      data: {
        user_id: emp1.id,
        task_id: entry.task_id,
        date: new Date(entry.date),
        start_at: toDateTime(entry.date, entry.start),
        end_at: toDateTime(entry.date, entry.end),
        location: entry.location,
        description: entry.description,
      },
    });
  }

  for (const entry of emp2Entries) {
    await prisma.timeEntry.create({
      data: {
        user_id: emp2.id,
        task_id: entry.task_id,
        date: new Date(entry.date),
        start_at: toDateTime(entry.date, entry.start),
        end_at: toDateTime(entry.date, entry.end),
        location: entry.location,
        description: entry.description,
      },
    });
  }

  console.log('Seed complete:');
  console.log(`  Users: 3 (1 admin, 2 employees)`);
  console.log(`  Clients: 2`);
  console.log(`  Projects: 3`);
  console.log(`  Tasks: 6`);
  console.log(`  Assignments: 6`);
  console.log(`  Time entries: ${emp1Entries.length + emp2Entries.length}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
