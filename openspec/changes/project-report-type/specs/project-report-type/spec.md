# Spec: Per-Project Report Type

## ADDED Requirements

### Requirement: Report Type Schema and Enum

The system SHALL support a per-project report type configuration.

- The `Project` entity MUST contain a `reportType` enum field with values `TOTAL_HOURS` (default) and `CLOCK_IN_OUT`.
- The default report type for newly created projects SHALL be `TOTAL_HOURS`.

#### Scenario: Newly created project defaults to TOTAL_HOURS report type

- **WHEN** admin creates a new project without specifying `reportType`
- **THEN** system sets `reportType = 'TOTAL_HOURS'`.

### Requirement: Admin Reporting Settings Screen ("הגדרת דיווחי שעות")

The admin console SHALL provide a dedicated settings screen `/admin/reporting-settings` matching Figma node `1-33539`.

- The screen SHALL display a table of client names, project names, and a radio group per project for selecting `סכום שעות` (`TOTAL_HOURS`) or `כניסה / יציאה` (`CLOCK_IN_OUT`).
- Changing a radio selection SHALL trigger `PATCH /api/v1/projects/:id/report-type` and display a success status feedback message.

#### Scenario: Admin updates project report type via radio selection

- **WHEN** admin toggles report type radio button from `סכום שעות` to `כניסה / יציאה` on `/admin/reporting-settings`
- **THEN** system sends `PATCH /api/v1/projects/:id/report-type` with body `{ "reportType": "CLOCK_IN_OUT" }`, updates project record, and displays "אופן הדיווח עודכן בהצלחה".

### Requirement: Employee App Flow Switch by Report Type

The employee application SHALL inspect the `reportType` of the selected task's project when rendering time entry reporting UI.

- If `reportType === 'TOTAL_HOURS'`, the employee app SHALL present the manual total-hours entry form.
- If `reportType === 'CLOCK_IN_OUT'`, the employee app SHALL present the punch-clock timer UI.

#### Scenario: Employee opens time reporting for a project with TOTAL_HOURS report type

- **WHEN** employee selects a task belonging to a project with `reportType = 'TOTAL_HOURS'`
- **THEN** employee app displays the manual hours entry form.

#### Scenario: Employee opens time reporting for a project with CLOCK_IN_OUT report type

- **WHEN** employee selects a task belonging to a project with `reportType = 'CLOCK_IN_OUT'`
- **THEN** employee app displays the clock-in / clock-out timer interface.
