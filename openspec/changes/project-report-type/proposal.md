# Proposal: Per-Project Report Type (הגדרת דיווחי שעות)

## Why

Projects in Abra Timesheet support two different time reporting modes: manual total-hours reporting (`סכום שעות` / `TOTAL_HOURS`) and punch-clock timer (`כניסה / יציאה` / `CLOCK_IN_OUT`). Administrators need a dedicated settings screen in the management portal ("הגדרת דיווחי שעות", Figma node `1-33539`) to set each project's reporting mode. This flag dictates whether employees reporting time against a project's tasks use the manual entry form or the clock-in/out timer UI in the Mobile App (KAN-63 / Epic 4: Entity Management).

## What Changes

- **Database & Prisma Schema (`server/api/prisma/schema.prisma`)**:
  - Add `ReportType` enum (`TOTAL_HOURS` | `CLOCK_IN_OUT`, default `TOTAL_HOURS`).
  - Add `report_type` field on the `Project` model with `@default(TOTAL_HOURS)`.
  - Migration script to add column and enum to PostgreSQL database.
- **Shared Contracts (`packages/contracts/`)**:
  - Export `ReportType` enum and `ReportTypeSchema` Zod validation schema.
  - Update `ProjectListItemSchema` and `UpdateProjectReportTypeSchema`.
- **Backend API (`server/api/src/modules/projects/`)**:
  - Expose `reportType` in `GET /api/v1/projects` and `GET /api/v1/me/assignments`.
  - Add admin-only endpoint `PATCH /api/v1/projects/:id/report-type` to update a project's reporting mode.
- **Admin UI (`apps/admin/src/features/projects/`)**:
  - Build the "הגדרת דיווחי שעות" screen (`/admin/reporting-settings` / `/admin/projects/report-types`) matching Figma node `1-33539`.
  - Features data table with Client, Project Name, and a radio button pair (`סכום שעות` vs `כניסה / יציאה`) per project row.
  - Supports client/project search filtering, inline instant/save feedback, pagination, and empty state.
- **Employee App (`apps/mobile/src/`)**:
  - Dynamically switch employee reporting UI for a task based on its parent project's `reportType` (`TOTAL_HOURS` → manual input form, `CLOCK_IN_OUT` → clock-in/out timer controls).

## Capabilities

### New Capabilities

- `project-report-type`: Full support for per-project reporting type configuration -- Prisma enum/field, API endpoint `PATCH /api/v1/projects/:id/report-type`, shared Zod contracts, and admin "הגדרת דיווחי שעות" settings screen.
- `employee-report-type-switch`: Employee App flow selection driven by project `reportType` (manual total hours vs clock-in/out).

### Modified Capabilities

- `projects-crud`: Added `reportType` field to project queries and DTOs.

## Impact

- **Database**: Add enum `ReportType` and `report_type` column on `projects` table.
- **API (`server/api/`)**: `ProjectsService`, `ProjectsController`, `MeController` updated to expose and handle `reportType`.
- **Admin UI (`apps/admin/`)**: New `reporting-settings-page.tsx` component, updated sidebar navigation with "הגדרת דיווחי שעות" nav item.
- **Employee UI (`apps/mobile/`)**: Reporting view switches conditionally based on project `reportType`.
- **Contracts (`packages/contracts/`)**: New exports in `src/enums.ts` and `src/projects/`.
- **Figma Design Compliance**: Models Figma node `1-33539` (`https://figma.com/design/3CK80SB84FluVRrWCDlmaw/...`).
