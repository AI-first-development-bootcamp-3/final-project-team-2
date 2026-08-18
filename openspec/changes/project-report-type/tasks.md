# Task Checklist: Per-Project Report Type (הגדרת דיווחי שעות)

## 1. Database & Shared Contracts (`packages/contracts` & `prisma`)

- [x] 1.1 Add `ReportType` enum and `report_type` field to `Project` model in `schema.prisma` (`TOTAL_HOURS | CLOCK_IN_OUT`, default `TOTAL_HOURS`).
- [x] 1.2 Export `ReportType` enum and `ReportTypeSchema` in `packages/contracts/src/enums.ts` and `src/index.ts`.
- [x] 1.3 Add `reportType` to `ProjectListItemSchema` and `MyAssignmentSchema` in `packages/contracts`.
- [x] 1.4 Verify contracts unit tests (`pnpm --filter @abra/contracts test`).

## 2. API Endpoints & Service Logic (`server/api`)

- [x] 2.1 Update `ProjectsService` to select and handle `reportType` in `findAll`, `findOne`, `create`, `update`.
- [x] 2.2 Add `updateReportType(id, reportType)` method in `ProjectsService` and endpoint `PATCH /api/v1/projects/:id/report-type` in `ProjectsController`.
- [x] 2.3 Update `MeController.myAssignments` to include `reportType` in the response payload.
- [x] 2.4 Add unit tests for `ProjectsController`, `ProjectsService`, and `MeController` covering report type updates and coverage >70% (`pnpm --filter @abra/api test:coverage`).

## 3. Admin UI "הגדרת דיווחי שעות" Screen (`apps/admin`)

- [x] 3.1 Create `/admin/reporting-settings` page matching Figma node `1-33539` (`reporting-settings-page.tsx`).
- [x] 3.2 Add "הגדרת דיווחי שעות" navigation item to `AdminSidebar` (`admin-sidebar.tsx`).
- [x] 3.3 Implement client/project data table with `TOTAL_HOURS` vs `CLOCK_IN_OUT` radio button options per row.
- [x] 3.4 Implement inline save API call on radio toggle with Hebrew status message feedback ("אופן הדיווח עודכן בהצלחה").
- [x] 3.5 Add unit tests in `apps/admin/src/features/projects/*.spec.tsx` and `reporting-settings-page.spec.tsx` reaching >70% coverage.

## 4. Employee App Reporting Flow Switch (`apps/mobile`)

- [x] 4.1 Update `MyAssignment` model usage in employee app to read `reportType`.
- [ ] 4.2 Add conditional rendering logic switching between manual total-hours reporting (`TOTAL_HOURS`) and punch-clock timer (`CLOCK_IN_OUT`). _Deferred to the `employee-report-flow-switch` change — no flow switch exists in `apps/mobile` (review finding on PR #43)._
- [ ] 4.3 Add unit tests in `apps/mobile` asserting that selected task's project `reportType` correctly renders the matching UI flow. _Deferred to `employee-report-flow-switch` (see 4.2)._

## 5. Verification & E2E

- [x] 5.1 Run full workspace typechecks and linters (`pnpm lint && pnpm typecheck`).
- [x] 5.2 Run workspace coverage tests (`pnpm test:coverage`) ensuring all projects exceed 70% threshold.
- [ ] 5.3 Run Playwright E2E verification specs for project report type changes reflected in employee app flow. _Deferred to `employee-report-flow-switch` — depends on the unbuilt flow switch (4.2)._
