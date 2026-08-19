## Why

The employee app can log in and then does nothing: `/` renders a placeholder screen. Reporting hours is the product — every other employee-facing epic (monthly view, absences, punch clock, month close) reads the data this epic produces. The schema, auth, assignment scoping, and the admin catalog that feeds the pickers are all already shipped, so daily reporting is the first feature that turns the deployed system into something an employee can actually use.

It also settles two rules that later epics depend on and cannot cheaply retrofit: the day-status computation shared with the monthly calendar, and the month-lock guard that every future write endpoint must call.

## What Changes

- **New `/api/v1/time-entries` endpoints** — create, list (by day and by range), update, soft-delete. Employee-only, own entries only.
- **Validation rules VAL-30 through VAL-38** enforced server-side with the existing field-level error envelope and rule IDs:
  - VAL-30 `start_at` required · VAL-31 `end_at` after `start_at`, midnight crossing allowed · VAL-32 no overlapping entries for the same user, checked across dates · VAL-33 user must be assigned to the task · VAL-34 month must not be locked · VAL-35 task required · VAL-36 location required · VAL-38 `date` equals the local start day.
- **Two enforcement seams planted now**, both called by every time-entry write:
  - `assertUserAssignedToTask(userId, taskId)` (§8.2)
  - `assertMonthNotLocked(year, month)` (§8.1) — reads the existing `MonthLock` table; absence of a row means open. The lock/unlock _write_ endpoints stay with the Month Close epic, but the guard ships here as specified ("must be planted on day one").
- **Shared DayStatus computation in `packages/contracts`** — one implementation consumed by both this epic's quota bar and the monthly calendar. Statuses: `empty` (0h), `partial` (0 < h < 9), `full` (exactly 9h), `excess` (> 9h), `absence` (day covered by an absence).
  - **Resolves a spec conflict**: GENERAL_SPEC §2.4 defines `full` as `>= 9` while §8.5 defines it as exactly `9`, leaving `full` and `excess` overlapping for any day above nine hours. This change adopts **exactly 9** per §8.5, making the four hour-based statuses mutually exclusive. §2.4's table is superseded.
- **Employee daily report screen** at `/` (393px, RTL) — today's entries, add/edit/delete actions, and a 9-hour quota bar driven by the shared DayStatus. States: empty, populated, loading, month-locked.
- **Entry form** serving `/entry/new` and `/entry/:id` from one component via a `mode` prop, with a cascading Client → Project → Task picker scoped to the employee's assignments. Manual entry is offered only for `TOTAL_HOURS` projects; `CLOCK_IN_OUT` projects are reserved for the punch-clock epic.
- **Playwright e2e** covering the create → list → quota round trip, picker scoping, edit/delete, and the locked-month 403.
- **Removal**: `apps/mobile/src/features/time-entries/task-picker.tsx` is replaced. Its `filterOpenAssignments` tests fields (`status`, `deletedAt`) that do not exist on `MyAssignment`, so both predicates are unconditionally true and the filter is a no-op; the API already excludes closed and deleted rows.

Not in scope: running timers (punch clock epic), absence records (absences epic), month lock/unlock endpoints and audit logging (month close epic). Where this epic must interoperate with them, it defines the seam and leaves the implementation to the owning epic.

## Capabilities

### New Capabilities

- `day-status`: Shared, computed-not-stored day classification and daily hour totals, in `packages/contracts` — the single source of truth for the quota bar and the monthly calendar. Covers status boundaries, midnight-crossing attribution, and Asia/Jerusalem date bucketing.
- `time-entries-api`: Employee CRUD over own time entries, with VAL-30…38, assignment scoping, month-lock enforcement, and soft delete.
- `daily-reporting-ui`: The employee daily report screen and entry form — quota bar, entry list, cascading assignment-scoped picker, new/edit modes, and locked-month read-only behaviour.

### Modified Capabilities

<!-- None. The existing specs in openspec/specs/ (api-docs, auth, dev-runtime, env-validation) keep their current requirements; this change adds endpoints that follow the api-docs Swagger requirement rather than altering it. -->

## Impact

**New code**

- `packages/contracts/src/time-entries/` — create/update/list schemas, VAL messages
- `packages/contracts/src/day-status/` — `computeDayStatus`, `hoursForDay`
- `server/api/src/modules/time-entries/` — controller, service, module
- `server/api/src/common/guards/` or module-local — `assertMonthNotLocked`, `assertUserAssignedToTask`
- `apps/mobile/src/features/time-entries/` — daily report screen, entry form, quota bar
- `e2e/specs/daily-reporting.spec.ts`

**Modified code**

- `packages/contracts/src/index.ts` — new exports, `ValCode` union and `VAL_MESSAGES` extended with VAL-30…38
- `server/api/src/app.module.ts` — register `TimeEntriesModule`
- `apps/mobile/src/App.tsx` — replace `DashboardPlaceholder`, add `/entry/new` and `/entry/:id` routes
- `server/api/prisma/seed.ts` — may need a locked month and an unassigned task to support e2e scenarios

**Unchanged**

- Prisma schema. `TimeEntry`, `MonthLock`, and the nullable `end_at` / `task_id` / `location` columns already exist; `TimeEntry` is already in `SOFT_DELETE_MODELS`, so soft delete needs no new code. No migration.
- `GET /me/assignments`, which already returns the exact client/project/task/reportType shape the cascading picker needs.

**Downstream**

- Monthly View epic consumes `day-status` rather than reimplementing it.
- Month Close epic implements lock/unlock against the `assertMonthNotLocked` seam this change introduces.
- Absences epic fills the `absences` argument that `computeDayStatus` already accepts.

**Tracking**: KAN-64 (epic), KAN-71 + subtasks KAN-76/77/78/79, KAN-72, KAN-73, KAN-74, KAN-75.
