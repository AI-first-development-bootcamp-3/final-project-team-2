import { PrismaClient, UserRole, TaskStatus, WorkLocation, EmploymentType } from '@prisma/client';
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

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@abra.co',
      full_name: 'Admin User',
      password_hash: await bcrypt.hash('Admin123!', SALT_ROUNDS),
      role: UserRole.admin,
      employee_number: 'E-1001',
      role_title: 'System Administrator',
      employment_type: EmploymentType.manager,
      employment_percent: 100,
      org_unit: 'IT',
    },
  });

  const emp1 = await prisma.user.create({
    data: {
      email: 'employee1@abra.co',
      full_name: 'Alice Cohen',
      password_hash: await bcrypt.hash('Employee123!', SALT_ROUNDS),
      role: UserRole.employee,
      employee_number: 'E-1002',
      role_title: 'Frontend Developer',
      employment_type: EmploymentType.worker,
      employment_percent: 100,
      org_unit: 'R&D Solutions',
    },
  });

  const emp2 = await prisma.user.create({
    data: {
      email: 'employee2@abra.co',
      full_name: 'Bob Levi',
      password_hash: await bcrypt.hash('Employee123!', SALT_ROUNDS),
      role: UserRole.employee,
      employee_number: 'E-1003',
      role_title: 'UX Designer',
      employment_type: EmploymentType.worker,
      employment_percent: 80,
      org_unit: 'R&D Solutions',
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
    data: {
      name: 'Website Redesign',
      client_id: acme.id,
      lead_manager_id: adminUser.id,
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-12-31'),
      description: 'Full redesign of the Acme marketing site',
    },
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

  // Open task on a project Alice already reports against, but with no
  // assignment to her — the daily-reporting e2e asserts this label never
  // appears in the picker (KAN-75 / 9.1).
  await prisma.task.create({
    data: {
      name: 'Unassigned Seed Task',
      project_id: websiteRedesign.id,
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
  // Employee 1: 5 days, 9h each
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
      start: '08:00',
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
      end: '18:00',
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

  // ─── Absences ─────────────────────────────────────────
  // Bob takes a vacation day on Thu Aug 13 (he has no time entry for that day)
  await prisma.absence.create({
    data: {
      user_id: emp2.id,
      type: 'vacation',
      start_date: new Date('2026-08-13'),
      end_date: new Date('2026-08-13'),
      is_half_day: false,
      notes: 'Day off',
    },
  });

  // ─── Month Locks ──────────────────────────────────────
  // July 2026 is locked by admin (previous month closed).
  // January 2025 is a second lock placed well away from the seeded working
  // week (2026-08-09..13) and from the current month, so the daily-reporting
  // e2e can write into it without colliding with other specs (KAN-75 / 9.1).
  const admin = await prisma.user.findFirstOrThrow({ where: { role: UserRole.admin } });

  await prisma.monthLock.create({
    data: {
      year: 2026,
      month: 7,
      locked_by: admin.id,
      locked_at: new Date('2026-08-01T09:00:00.000+03:00'),
      is_locked: true,
    },
  });

  await prisma.monthLock.create({
    data: {
      year: 2025,
      month: 1,
      locked_by: admin.id,
      locked_at: new Date('2025-02-01T09:00:00.000+02:00'),
      is_locked: true,
    },
  });

  console.log('Seed complete:');
  console.log(`  Users: 3 (1 admin, 2 employees)`);
  console.log(`  Clients: 2`);
  console.log(`  Projects: 3`);
  console.log(`  Tasks: 7`);
  console.log(`  Assignments: 6`);
  console.log(`  Time entries: ${emp1Entries.length + emp2Entries.length}`);
  console.log(`  Absences: 1`);
  console.log(`  Month locks: 2 (July 2026, January 2025)`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
