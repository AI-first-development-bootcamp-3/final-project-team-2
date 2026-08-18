# Task Checklist: Fix Report-Type Review Findings

## 1. PR-A — API correctness (`server/api`, `packages/contracts`)

- [x] 1.1 Add a dedicated `VAL-*` rule code and Hebrew message for `reportType` in `FIELD_RULES` / `VAL_MESSAGES`; unit test asserts the 400 details for `{ reportType: "INVALID" }` carry the new code and Hebrew text (not `VAL-QUERY` / English).
- [x] 1.2 Validate `:id` as UUID on the projects controller's parameterized routes (ParseUUIDPipe wired to the API's 400 details shape); unit test asserts `PATCH /projects/not-a-uuid/report-type` → 400, not 500.
- [x] 1.3 Collapse `updateReportType()` into the generic `update()` write path (public URL unchanged); existing report-type tests still pass unmodified.
- [x] 1.4 Make `reportType` required in `ProjectListItemSchema` and `MyAssignmentSchema` (drop `.default('TOTAL_HOURS')`); contracts tests assert missing field fails parsing.
- [x] 1.5 Run API + contracts gates: `pnpm --filter @abra/api test:coverage && pnpm --filter @abra/contracts test && pnpm lint && pnpm typecheck && pnpm format:check`.

## 2. PR-A — Admin reporting-settings resilience (`apps/admin`)

- [x] 2.1 Keep the table rendered on PATCH failure: render `error` as a dismissible banner above the table; clear it on dismiss, successful PATCH, and refetch. Tests: failed PATCH keeps rows visible + banner dismisses.
- [x] 2.2 Add `useDebouncedValue` hook in `apps/admin/src/lib` and debounce the search input (~300ms) with a latest-request guard so stale responses never commit. Tests: rapid typing issues one trailing request; out-of-order resolution keeps newest results.
- [x] 2.3 Run admin gates: `pnpm --filter @abra/admin test:coverage && pnpm lint && pnpm typecheck && pnpm format:check`.
- [ ] 2.4 Open PR-A into `staging` (sections 1–2 plus this change's artifacts), reference the review findings, and confirm CI green.

## 3. PR-B — Guard consolidation (`server/api`)

- [ ] 3.1 Export a single `AuthenticatedUser { userId, role }` type alongside the `auth/` guards; delete `common/guards/jwt.guard.ts`, `common/guards/roles.guard.ts`, their specs, and the `AuthUser { id }` type.
- [ ] 3.2 Repoint assignments, clients, me, projects, and tasks modules (`@UseGuards`, imports, module providers, controller specs) at the `auth/` guards and the unified user type; adapt affected controller specs to the real guard's test helpers.
- [ ] 3.3 Run API gates: `pnpm --filter @abra/api test:coverage && pnpm lint && pnpm typecheck`.

## 4. PR-B — DataTable refactor (`apps/admin`)

- [ ] 4.1 Rebuild the reporting-settings table on the shared `DataTable` with a `columns[]` definition (radio group as a cell renderer, à la `projects-columns.tsx`); drop the hand-rolled table and page math.
- [ ] 4.2 Update `reporting-settings-page` tests for the DataTable markup; coverage stays >70%.
- [ ] 4.3 Open PR-B into `staging` (sections 3–4), confirm CI green.

## 5. OpenSpec hygiene (`openspec/changes/project-report-type`)

- [ ] 5.1 Uncheck tasks 4.2 / 4.3 / 5.3 in `project-report-type/tasks.md` with a note pointing at the deferred change.
- [ ] 5.2 Move the "Employee App Flow Switch by Report Type" requirement (and its scenarios) out of `project-report-type/specs/project-report-type/spec.md` into a new deferred change `employee-report-flow-switch` (proposal + delta spec stub, no tasks yet).
- [ ] 5.3 Validate both changes: `openspec validate --change project-report-type && openspec validate --change fix-report-type-review-findings`.
