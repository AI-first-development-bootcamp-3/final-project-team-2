# KAN-32: Prisma Schema, Migration & Seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the data layer foundation — Prisma schema with 10 models, initial migration, seed script with demo org, and thin NestJS integration.

**Architecture:** Prisma ORM inside `server/api` with PostgreSQL. A global `PrismaModule` exposes `PrismaService` (extends `PrismaClient`) with soft-delete middleware. Env validation via zod at boot. Seed script creates demo data for parallel frontend development.

**Tech Stack:** Prisma 6, PostgreSQL 16, NestJS 10, bcrypt, zod, ts-node, Vitest

## Global Constraints

- Node 22 LTS, pnpm 9 (pinned in root `packageManager`)
- TypeScript strict mode + `noUncheckedIndexedAccess` everywhere
- API uses CommonJS modules (`"module": "commonjs"` in tsconfig)
- Vitest with 70% coverage threshold on all metrics
- All UUIDs use `@db.Uuid` Prisma annotation
- Soft-delete: `deleted_at DateTime?` on User, Client, Project, Task, TimeEntry, Absence
- No soft-delete on: TaskAssignment, AbsenceAttachment, MonthLock, AuditLog
- Working directory for all commands: `C:\Users\User.DESKTOP-CMKJMMA\Abra_Project\Final_project`
- Branch: create `feat/kan-32-prisma-schema-seed` from `dev`

---

### Task 1: Prisma Schema & Initial Migration

**Files:**

- Create: `server/api/prisma/schema.prisma`
- Create: `server/api/.env.example`
- Create: `server/api/prisma/migrations/*` (generated)

**Interfaces:**

- Consumes: nothing (first task)
- Produces: Prisma schema with 10 models and 6 enums; generated migration SQL; `@prisma/client` types available for import

- [ ] **Step 1: Create the branch**

```bash
cd "C:\Users\User.DESKTOP-CMKJMMA\Abra_Project\Final_project"
git checkout dev
git pull origin dev
git checkout -b feat/kan-32-prisma-schema-seed
```

- [ ] **Step 2: Install dependencies**

```bash
cd server/api
pnpm add @prisma/client bcrypt zod
pnpm add -D @types/bcrypt ts-node
```

- [ ] **Step 3: Create `.env.example`**

Create `server/api/.env.example`:

```env
# Database — Postgres connection string
# For local Docker: postgresql://abra:abra@localhost:5432/abra?schema=public
# For Neon (production): provided via Vercel Marketplace
DATABASE_URL="postgresql://abra:abra@localhost:5432/abra?schema=public"
```

- [ ] **Step 4: Create `.env` for local development**

Copy `.env.example` to `.env` (git-ignored) with the same content. This is needed for `prisma migrate dev`.

```bash
cp server/api/.env.example server/api/.env
```

- [ ] **Step 5: Write `schema.prisma`**

Create `server/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────

enum UserRole {
  employee
  admin
}

enum WorkLocation {
  office
  client_site
  home
}

enum AbsenceType {
  vacation
  sick
  military
  other
}

enum TaskStatus {
  open
  closed
}

enum HalfDayPeriod {
  morning
  afternoon
}

enum AuditAction {
  create
  update
  delete
  lock_month
  unlock_month
}

// ─── Models ──────────────────────────────────────────────

model User {
  id            String   @id @default(uuid()) @db.Uuid
  email         String   @db.VarChar(255)
  full_name     String   @db.VarChar(255)
  password_hash String   @db.VarChar(255)
  role          UserRole
  is_active     Boolean  @default(true)
  token_version Int      @default(0)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  deleted_at    DateTime?

  task_assignments TaskAssignment[]
  time_entries     TimeEntry[]
  absences         Absence[]
  locked_months    MonthLock[]      @relation("LockedBy")
  unlocked_months  MonthLock[]      @relation("UnlockedBy")
  audit_logs       AuditLog[]

  // Partial unique index handled via raw SQL in migration (Step 6a)
  @@map("users")
}

model Client {
  id           String   @id @default(uuid()) @db.Uuid
  name         String   @db.VarChar(255)
  contact_info String?  @db.Text
  is_active    Boolean  @default(true)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  deleted_at   DateTime?

  projects Project[]

  @@map("clients")
}

model Project {
  id         String   @id @default(uuid()) @db.Uuid
  client_id  String   @db.Uuid
  name       String   @db.VarChar(255)
  is_active  Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
  deleted_at DateTime?

  client Client @relation(fields: [client_id], references: [id])
  tasks  Task[]

  @@map("projects")
}

model Task {
  id          String     @id @default(uuid()) @db.Uuid
  project_id  String     @db.Uuid
  name        String     @db.VarChar(255)
  description String?    @db.Text
  status      TaskStatus @default(open)
  created_at  DateTime   @default(now())
  updated_at  DateTime   @updatedAt
  deleted_at  DateTime?

  project          Project          @relation(fields: [project_id], references: [id])
  task_assignments TaskAssignment[]
  time_entries     TimeEntry[]

  @@map("tasks")
}

model TaskAssignment {
  id         String   @id @default(uuid()) @db.Uuid
  user_id    String   @db.Uuid
  task_id    String   @db.Uuid
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id])
  task Task @relation(fields: [task_id], references: [id])

  @@unique([user_id, task_id])
  @@map("task_assignments")
}

model TimeEntry {
  id          String        @id @default(uuid()) @db.Uuid
  user_id     String        @db.Uuid
  task_id     String?       @db.Uuid
  date        DateTime      @db.Date
  start_at    DateTime
  end_at      DateTime?
  location    WorkLocation?
  description String?       @db.Text
  created_at  DateTime      @default(now())
  updated_at  DateTime      @updatedAt
  deleted_at  DateTime?

  user User  @relation(fields: [user_id], references: [id])
  task Task? @relation(fields: [task_id], references: [id])

  @@map("time_entries")
}

model Absence {
  id              String        @id @default(uuid()) @db.Uuid
  user_id         String        @db.Uuid
  type            AbsenceType
  start_date      DateTime      @db.Date
  end_date        DateTime      @db.Date
  is_half_day     Boolean       @default(false)
  half_day_period HalfDayPeriod?
  notes           String?       @db.Text
  created_at      DateTime      @default(now())
  updated_at      DateTime      @updatedAt
  deleted_at      DateTime?

  user        User                @relation(fields: [user_id], references: [id])
  attachments AbsenceAttachment[]

  @@map("absences")
}

model AbsenceAttachment {
  id         String   @id @default(uuid()) @db.Uuid
  absence_id String   @db.Uuid
  file_name  String   @db.VarChar(255)
  file_type  String   @db.VarChar(50)
  file_size  Int
  blob_key   String   @db.VarChar(500)
  created_at DateTime @default(now())

  absence Absence @relation(fields: [absence_id], references: [id])

  @@map("absence_attachments")
}

model MonthLock {
  id          String    @id @default(uuid()) @db.Uuid
  year        Int
  month       Int
  locked_by   String    @db.Uuid
  locked_at   DateTime
  is_locked   Boolean   @default(true)
  unlocked_by String?   @db.Uuid
  unlocked_at DateTime?

  locker   User  @relation("LockedBy", fields: [locked_by], references: [id])
  unlocker User? @relation("UnlockedBy", fields: [unlocked_by], references: [id])

  @@unique([year, month])
  @@map("month_locks")
}

model AuditLog {
  id          String      @id @default(uuid()) @db.Uuid
  actor_id    String      @db.Uuid
  action      AuditAction
  entity_type String      @db.VarChar(50)
  entity_id   String      @db.Uuid
  before      Json?
  after       Json?
  created_at  DateTime    @default(now())

  actor User @relation(fields: [actor_id], references: [id])

  @@map("audit_logs")
}
```

- [ ] **Step 6: Start Postgres and generate the migration**

Ensure a Postgres 16 instance is running locally (Docker or docker-compose if KAN-31 is merged). Then:

```bash
cd server/api
npx prisma migrate dev --name init
```

This creates `prisma/migrations/<timestamp>_init/migration.sql` and generates the Prisma client.

- [ ] **Step 6a: Edit the generated migration for partial unique index on User.email**

Open the generated file `server/api/prisma/migrations/<timestamp>_init/migration.sql`. Find the line that creates a unique index on `users.email` (if Prisma generated one) and **replace it** with a partial unique index. If Prisma did not generate a unique constraint (since we removed `@@unique` from the schema), **add** this line at the end of the migration:

```sql
-- Partial unique index: allow same email if previous user is soft-deleted
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email") WHERE "deleted_at" IS NULL;
```

This ensures two users can have the same email only if the older one is soft-deleted.

- [ ] **Step 7: Verify the migration applied**

```bash
cd server/api
npx prisma db push --force-reset
npx prisma migrate deploy
```

Expected: migration applies cleanly with no errors.

- [ ] **Step 8: Commit**

```bash
git add server/api/prisma/schema.prisma server/api/prisma/migrations/ server/api/.env.example server/api/package.json server/api/pnpm-lock.yaml
git commit -m "feat(db): add Prisma schema with 10 models and initial migration

KAN-32: User, Client, Project, Task, TaskAssignment, TimeEntry,
Absence, AbsenceAttachment, MonthLock, AuditLog — all matching
GENERAL_SPEC §4. Soft-delete on 6 models. Single init migration."
```

---

### Task 2: PrismaService, PrismaModule & Env Validation

**Files:**

- Create: `server/api/src/prisma/prisma.service.ts`
- Create: `server/api/src/prisma/prisma.module.ts`
- Create: `server/api/src/config/env.validation.ts`
- Modify: `server/api/src/main.ts`
- Modify: `server/api/src/app.module.ts`
- Create: `server/api/src/prisma/prisma.service.spec.ts`
- Create: `server/api/src/config/env.validation.spec.ts`

**Interfaces:**

- Consumes: `@prisma/client` types from Task 1
- Produces: `PrismaService` (injectable, extends `PrismaClient`), `PrismaModule` (global), `validateEnv()` function

- [ ] **Step 1: Write the env validation test**

Create `server/api/src/config/env.validation.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('accepts a valid DATABASE_URL', () => {
    const env = { DATABASE_URL: 'postgresql://user:pass@localhost:5432/db' };
    expect(() => validateEnv(env)).not.toThrow();
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow('DATABASE_URL');
  });

  it('rejects a non-postgres URL', () => {
    const env = { DATABASE_URL: 'mysql://user:pass@localhost:3306/db' };
    expect(() => validateEnv(env)).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd server/api
npx vitest run src/config/env.validation.spec.ts
```

Expected: FAIL — module `./env.validation` not found.

- [ ] **Step 3: Implement env validation**

Create `server/api/src/config/env.validation.ts`:

```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().startsWith('postgres', {
    message: 'DATABASE_URL must be a PostgreSQL connection string',
  }),
});

export function validateEnv(env: Record<string, unknown> = process.env): void {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${formatted}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd server/api
npx vitest run src/config/env.validation.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Write the PrismaService test**

Create `server/api/src/prisma/prisma.service.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('is defined and extends PrismaClient', async () => {
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const service = module.get(PrismaService);
    expect(service).toBeDefined();
    expect(service).toHaveProperty('$connect');
    expect(service).toHaveProperty('user');
    expect(service).toHaveProperty('client');
    expect(service).toHaveProperty('timeEntry');
  });

  it('has soft-delete models listed', async () => {
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    const service = module.get(PrismaService);
    expect(service.softDeleteModels).toEqual(
      expect.arrayContaining(['User', 'Client', 'Project', 'Task', 'TimeEntry', 'Absence']),
    );
    expect(service.softDeleteModels).toHaveLength(6);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
cd server/api
npx vitest run src/prisma/prisma.service.spec.ts
```

Expected: FAIL — module `./prisma.service` not found.

- [ ] **Step 7: Implement PrismaService**

Create `server/api/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  readonly softDeleteModels: Prisma.ModelName[] = [
    'User',
    'Client',
    'Project',
    'Task',
    'TimeEntry',
    'Absence',
  ];

  constructor() {
    super();

    this.$use(async (params, next) => {
      const model = params.model as Prisma.ModelName | undefined;
      if (!model || !this.softDeleteModels.includes(model)) {
        return next(params);
      }

      // Intercept delete → soft delete
      if (params.action === 'delete') {
        params.action = 'update';
        params.args['data'] = { deleted_at: new Date() };
        return next(params);
      }

      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        if (params.args['data'] === undefined) {
          params.args['data'] = { deleted_at: new Date() };
        } else {
          params.args['data']['deleted_at'] = new Date();
        }
        return next(params);
      }

      // Intercept reads → filter out soft-deleted
      const readActions = [
        'findFirst',
        'findFirstOrThrow',
        'findMany',
        'findUnique',
        'findUniqueOrThrow',
        'count',
        'aggregate',
        'groupBy',
      ];

      if (readActions.includes(params.action)) {
        if (params.args === undefined) {
          params.args = {};
        }
        if (params.args['where'] === undefined) {
          params.args['where'] = {};
        }
        // Only add filter if deleted_at is not explicitly set in the query
        if (params.args['where']['deleted_at'] === undefined) {
          params.args['where']['deleted_at'] = null;
        }
        return next(params);
      }

      return next(params);
    });
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to database...');
    await this.$connect();
    this.logger.log('Database connected');
  }
}
```

- [ ] **Step 8: Run the PrismaService test to verify it passes**

```bash
cd server/api
npx vitest run src/prisma/prisma.service.spec.ts
```

Expected: 2 tests PASS.

- [ ] **Step 9: Create PrismaModule**

Create `server/api/src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 10: Wire PrismaModule into AppModule**

Modify `server/api/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 11: Add env validation to main.ts**

Modify `server/api/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation';

async function bootstrap() {
  validateEnv(process.env);
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();
```

- [ ] **Step 12: Run all API tests**

```bash
cd server/api
npx vitest run
```

Expected: all tests pass (AppController + env validation + PrismaService).

- [ ] **Step 13: Run typecheck**

```bash
cd server/api
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 14: Commit**

```bash
git add server/api/src/prisma/ server/api/src/config/ server/api/src/main.ts server/api/src/app.module.ts
git commit -m "feat(db): add PrismaService with soft-delete middleware and env validation

KAN-32: Global PrismaModule, soft-delete middleware for 6 models,
zod env validation at boot (DATABASE_URL required)."
```

---

### Task 3: Seed Script

**Files:**

- Create: `server/api/prisma/seed.ts`
- Modify: `server/api/package.json` (add `prisma.seed` config)

**Interfaces:**

- Consumes: `@prisma/client` types, `bcrypt` for password hashing
- Produces: idempotent seed script runnable via `npx prisma db seed`

- [ ] **Step 1: Add the prisma seed config to package.json**

Edit `server/api/package.json` — add the `prisma` key at the top level (sibling of `scripts`):

```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

- [ ] **Step 2: Write the seed script**

Create `server/api/prisma/seed.ts`:

```typescript
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

  const admin = await prisma.user.create({
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
```

- [ ] **Step 3: Run the seed against a local database**

```bash
cd server/api
npx prisma db push --force-reset
npx prisma db seed
```

Expected: seed completes with the summary output and no errors.

- [ ] **Step 4: Verify seeded data**

```bash
cd server/api
npx prisma studio
```

Open the Prisma Studio browser tab and verify:

- 3 users (1 admin, 2 employees)
- 2 clients
- 3 projects
- 6 tasks
- 6 task assignments
- 9 time entries (5 + 4)

Close Prisma Studio when done.

- [ ] **Step 5: Run the seed a second time to verify idempotency**

```bash
cd server/api
npx prisma db seed
```

Expected: completes without errors, same row counts (deleteMany wipes then re-creates).

- [ ] **Step 6: Run full test suite and typecheck**

```bash
cd server/api
npx vitest run && pnpm typecheck
```

Expected: all tests pass, no type errors.

- [ ] **Step 7: Run lint from repo root**

```bash
pnpm lint && pnpm format:check
```

Expected: no lint or format errors. If Prettier reports issues, fix with `pnpm format`.

- [ ] **Step 8: Commit**

```bash
git add server/api/prisma/seed.ts server/api/package.json
git commit -m "feat(db): add seed script with demo org and one reported week

KAN-32: 1 admin, 2 employees, 2 clients, 3 projects, 6 tasks,
6 assignments, 9 time entries (Sun-Thu week). Idempotent — safe
to re-run. Configured via prisma.seed in package.json."
```

- [ ] **Step 9: Push and open PR**

```bash
git push -u origin feat/kan-32-prisma-schema-seed
```

Open a PR targeting `dev` with title: `feat(db): Prisma schema, migration & seed (KAN-32)`

---

## Verification Checklist

After all tasks complete, verify the acceptance criteria:

1. **Fresh migration:** `npx prisma migrate deploy` against an empty Postgres 16 succeeds
2. **Seed creates demo org:** `npx prisma db seed` produces 3 users, 2 clients, 3 projects, 6 tasks, 6 assignments, 9 time entries
3. **API boots:** `DATABASE_URL` set → `pnpm --filter @abra/api dev` starts on port 3000, `/health` returns `{ status: "ok" }`
4. **API rejects missing env:** unset `DATABASE_URL` → process exits with clear error
5. **All CI checks pass:** lint, typecheck, unit tests (70% gate), build, e2e
