# KAN-32 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address Nadav's valid review findings on PR #12 — add missing contract enums, add Absence/MonthLock seed data, and fix misleading 8.5h time entries.

**Architecture:** Three independent fixes: (1) extend `packages/contracts` with 4 missing Zod enums matching Prisma schema, (2) add Absence + MonthLock records to seed, (3) bump Alice's two 8.5h days to 9h.

**Tech Stack:** Zod, Prisma, TypeScript, Vitest

## Global Constraints

- Branch: `feat/kan-32-prisma-schema-seed`
- Enum values must match Prisma schema exactly (see `server/api/prisma/schema.prisma`)
- Spec §2 defines canonical enum values — contracts must mirror them
- 9h quota is a soft target (not hard cap), but seed should demonstrate "full" days for clarity

---

### Task 1: Add missing Zod enums to contracts

**Files:**

- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/contracts/src/index.spec.ts`

**Interfaces:**

- Consumes: Spec §2.3 (AbsenceType), §2.5 (HalfDayPeriod), §2.6 (TaskStatus), §2.9 (AuditAction)
- Produces: `AbsenceType`, `HalfDayPeriod`, `TaskStatus`, `AuditAction` — Zod enums + inferred types, exported from `@abra/contracts`

- [ ] **Step 1: Write failing tests for the 4 new enums**

Add to `packages/contracts/src/index.spec.ts`:

```typescript
import {
  UserRole,
  WorkLocation,
  AbsenceType,
  HalfDayPeriod,
  TaskStatus,
  AuditAction,
} from './index';

describe('AbsenceType', () => {
  it('accepts valid types', () => {
    expect(AbsenceType.parse('vacation')).toBe('vacation');
    expect(AbsenceType.parse('sick')).toBe('sick');
    expect(AbsenceType.parse('military')).toBe('military');
    expect(AbsenceType.parse('other')).toBe('other');
  });

  it('rejects invalid types', () => {
    expect(() => AbsenceType.parse('holiday')).toThrow();
  });
});

describe('HalfDayPeriod', () => {
  it('accepts valid periods', () => {
    expect(HalfDayPeriod.parse('morning')).toBe('morning');
    expect(HalfDayPeriod.parse('afternoon')).toBe('afternoon');
  });

  it('rejects invalid periods', () => {
    expect(() => HalfDayPeriod.parse('evening')).toThrow();
  });
});

describe('TaskStatus', () => {
  it('accepts valid statuses', () => {
    expect(TaskStatus.parse('open')).toBe('open');
    expect(TaskStatus.parse('closed')).toBe('closed');
  });

  it('rejects invalid statuses', () => {
    expect(() => TaskStatus.parse('archived')).toThrow();
  });
});

describe('AuditAction', () => {
  it('accepts valid actions', () => {
    expect(AuditAction.parse('create')).toBe('create');
    expect(AuditAction.parse('update')).toBe('update');
    expect(AuditAction.parse('delete')).toBe('delete');
    expect(AuditAction.parse('lock_month')).toBe('lock_month');
    expect(AuditAction.parse('unlock_month')).toBe('unlock_month');
  });

  it('rejects invalid actions', () => {
    expect(() => AuditAction.parse('archive')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/contracts && npx vitest run`
Expected: FAIL — `AbsenceType`, `HalfDayPeriod`, `TaskStatus`, `AuditAction` not exported

- [ ] **Step 3: Add the 4 enum definitions to index.ts**

Append to `packages/contracts/src/index.ts`:

```typescript
export const AbsenceType = z.enum(['vacation', 'sick', 'military', 'other']);
export type AbsenceType = z.infer<typeof AbsenceType>;

export const HalfDayPeriod = z.enum(['morning', 'afternoon']);
export type HalfDayPeriod = z.infer<typeof HalfDayPeriod>;

export const TaskStatus = z.enum(['open', 'closed']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const AuditAction = z.enum(['create', 'update', 'delete', 'lock_month', 'unlock_month']);
export type AuditAction = z.infer<typeof AuditAction>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/contracts && npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/index.ts packages/contracts/src/index.spec.ts
git commit -m "feat(contracts): add AbsenceType, HalfDayPeriod, TaskStatus, AuditAction enums"
```

---

### Task 2: Fix Alice's 8.5h entries and add Absence + MonthLock to seed

**Files:**

- Modify: `server/api/prisma/seed.ts`

**Interfaces:**

- Consumes: Prisma schema models `Absence`, `MonthLock`, enums `AbsenceType`, `HalfDayPeriod`
- Produces: Updated seed with all 10 models exercised

- [ ] **Step 1: Fix Alice's two 8.5h days to 9h**

In `server/api/prisma/seed.ts`, update emp1Entries:

- Aug 11: change `start: '08:30'` → `start: '08:00'` (8.5h → 9h)
- Aug 13: change `end: '17:30'` → `end: '18:00'` (8.5h → 9h)

- [ ] **Step 2: Add Absence record for Bob (vacation day, Thu Aug 13)**

After the time entry creation loops, add:

```typescript
// ─── Absences ─────────────────────────────────────────
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
```

Note: Bob has no time entry for Aug 13 (Thu) — he only has Sun–Wed entries. This absence fills that gap.

- [ ] **Step 3: Add locked MonthLock for July 2026**

```typescript
// ─── Month Locks ──────────────────────────────────────
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
```

- [ ] **Step 4: Update the summary log at the end of seed**

```typescript
console.log('Seed complete:');
console.log(`  Users: 3 (1 admin, 2 employees)`);
console.log(`  Clients: 2`);
console.log(`  Projects: 3`);
console.log(`  Tasks: 6`);
console.log(`  Assignments: 6`);
console.log(`  Time entries: ${emp1Entries.length + emp2Entries.length}`);
console.log(`  Absences: 1`);
console.log(`  Month locks: 1 (July 2026 locked)`);
```

- [ ] **Step 5: Run typecheck**

Run: `cd server/api && npx tsc --noEmit`
Expected: PASS — no type errors

- [ ] **Step 6: Commit**

```bash
git add server/api/prisma/seed.ts
git commit -m "fix(db): bump Alice to 9h days, add Absence + MonthLock to seed"
```

---
