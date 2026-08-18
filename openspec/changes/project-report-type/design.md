# Technical & UI Design: Per-Project Report Type (הגדרת דיווחי שעות)

## Overview

This specification details the technical architecture, data model, API endpoints, UI components, and mobile switching logic for **Per-Project Report Type** within Abra Timesheet (Epic 4: Entity Management, KAN-44 / KAN-63).

Figma Design Reference: [Time Report Files - Admin Web Portal (Node 1-33539)](https://figma.com/design/3CK80SB84FluVRrWCDlmaw/⏰-Time-report-files-⏰--1-?timeline=keyframe&t=ICxWwHfcx4cmY0th-0)

---

## 1. Domain Model & Validation

### Database Schema (`schema.prisma`)

```prisma
enum ReportType {
  TOTAL_HOURS
  CLOCK_IN_OUT
}

model Project {
  id          String     @id @default(uuid()) @db.Uuid
  client_id   String     @db.Uuid
  name        String     @db.VarChar(255)
  report_type ReportType @default(TOTAL_HOURS)
  is_active   Boolean    @default(true)
  created_at  DateTime   @default(now())
  updated_at  DateTime   @updatedAt
  deleted_at  DateTime?

  client Client @relation(fields: [client_id], references: [id])
  tasks  Task[]

  @@map("projects")
}
```

### Shared Contracts (`packages/contracts`)

- `ReportTypeEnum`: `z.enum(['TOTAL_HOURS', 'CLOCK_IN_OUT'])` (or lowercase equivalents aligned with project conventions).
- `UpdateProjectReportTypeSchema`: `z.object({ reportType: ReportTypeEnum })`.

---

## 2. API Architecture

### `PATCH /api/v1/projects/:id/report-type`

- **Roles**: `admin` only.
- **Body**: `{ "reportType": "TOTAL_HOURS" | "CLOCK_IN_OUT" }`
- **Response**: `200 OK` with updated project payload.

### `GET /api/v1/projects`

- **Response**: Includes `reportType` field on each project item.

### `GET /api/v1/me/assignments`

- **Response**: Includes `reportType` for each assigned task chain (`taskId`, `taskName`, `projectId`, `projectName`, `clientId`, `clientName`, `reportType`).

---

## 3. Admin UI Layout ("הגדרת דיווחי שעות")

### 3.1 Nav & Route

- Navigation Sidebar: New persistent nav item **"הגדרת דיווחי שעות"** routing to `/admin/reporting-settings` (or `/admin/projects/report-types`).

### 3.2 Page Component (`reporting-settings-page.tsx`)

1. **Header**: "הגדרת דיווחי שעות" heading.
2. **Filters**: Search input for filtering by Client Name or Project Name.
3. **DataTable**:
   - Columns: לקוח (Client Name), שם פרויקט (Project Name), סוג דיווח (Report Type - Radio Group).
   - Radio Options per row:
     - `סכום שעות` (`TOTAL_HOURS`)
     - `כניסה / יציאה` (`CLOCK_IN_OUT`)
4. **Behavior**:
   - Toggling radio option immediately triggers `PATCH /api/v1/projects/:id/report-type`.
   - Displays temporary success status toast ("אופן הדיווח עודכן בהצלחה").

---

## 4. Employee App Integration

### 4.1 Flow Switching Logic

When an employee selects a task for time reporting:

- If `reportType === 'TOTAL_HOURS'` (default): Display manual hours input form (date, hours input, description, location).
- If `reportType === 'CLOCK_IN_OUT'`: Display punch-clock timer controls (start/stop button, duration counter, location picker).
