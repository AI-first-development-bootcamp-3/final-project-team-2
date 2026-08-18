# Proposal: Fix Report-Type Review Findings

## Why

The adversarially-verified code review of PR #43 (staging → main promotion) surfaced 10 findings in the per-project report-type feature and its surroundings: two user-facing bugs in the new admin settings screen, three correctness gaps in the new API endpoint, a contract-schema design flaw, a duplicated guard/user-shape layer that already caused one authorization bug, and OpenSpec artifacts claiming an employee-app flow that was never built. These must land before the promotion is trusted in production.

## What Changes

- **Admin reporting-settings screen** (`apps/admin/src/features/projects/reporting-settings-page.tsx`):
  - A failed report-type PATCH no longer blanks the projects table — the table stays rendered and the error is shown as a dismissible banner that clears on the next action.
  - Search input is debounced and guarded against out-of-order responses (a stale slow response can no longer overwrite newer results).
  - The hand-rolled table/pagination is replaced with the shared `DataTable` component used by every other admin listing page.
- **Projects API** (`server/api/src/modules/projects/`):
  - `:id` route params on the projects controller are validated as UUIDs → malformed ids return 400, not 500.
  - Invalid `reportType` values return a proper VAL code with a Hebrew message instead of the bogus `VAL-QUERY` + raw English zod text.
  - `updateReportType()` delegates to the generic `update()` path — one write path for the column; the public `PATCH /api/v1/projects/:id/report-type` URL is unchanged.
- **Contracts** (`packages/contracts`): `reportType` becomes required in response schemas (`ProjectListItemSchema`, `MyAssignmentSchema`) — the `.default('TOTAL_HOURS')` masked missing-field contract violations as silent wrong data.
- **Auth guards consolidation** (`server/api/src`): the duplicate `common/guards/jwt.guard.ts` / `roles.guard.ts` and their `AuthUser { id }` type are deleted; all modules (assignments, clients, me, projects, tasks) use the real `auth/` guards and a single `AuthenticatedUser { userId, role }` shape. This removes the root cause of the `req.user.id → undefined` filter-dropping bug class.
- **OpenSpec hygiene** (`openspec/changes/project-report-type/`): tasks 4.2 / 4.3 / 5.3 (employee punch-clock flow switch + its tests + e2e) are unchecked — the flow is unbuilt; the corresponding SHALL requirements move out of the delta spec into a deferred follow-up change so `/opsx:sync` cannot promote unbuilt behavior into the canonical specs.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `project-report-type`: validation behavior of the report-type endpoint (UUID and enum errors become well-formed 400s with Hebrew messages), resilience requirements for the reporting-settings screen (failed updates keep the table; search results reflect the latest query), `reportType` required in list/assignment responses, and the employee-app flow-switch requirement is deferred out of this capability's delta until it is actually built. (The capability currently lives as a delta in the active `project-report-type` change, not yet in `openspec/specs/`.)

## Impact

- **Code**: `apps/admin` (reporting-settings page, shared DataTable usage), `server/api` (projects controller/service, validation tables, guard files across five modules), `packages/contracts` (two response schemas).
- **Behavior**: admin clients relying on the wrong `VAL-QUERY` rule for bad enum values will see the corrected code (no known consumers). Response schemas become stricter — a missing `reportType` now fails parsing where schemas are enforced instead of silently defaulting.
- **Process**: ships as two PRs into `staging` — PR-A (UI + API + contracts correctness fixes), PR-B (guard consolidation + DataTable refactor) — so review stays tractable and the risky refactor is isolated.
- **Not breaking**: no public API URL, method, or success-payload shape changes.
