# Proposal: Employee Report Flow Switch

## Why

The per-project report type feature (`project-report-type` change) shipped the schema, API, and admin settings screen, but the employee-app half — rendering a different time-entry UI per the project's `reportType` — was never built, even though its tasks were checked and its requirements sat in that change's delta spec (PR #43 review finding). This change carries that deferred work honestly: the requirement lives here until someone actually builds it.

## What Changes

- The employee app inspects the selected task's project `reportType` when rendering time-entry UI:
  - `TOTAL_HOURS` → manual total-hours entry form.
  - `CLOCK_IN_OUT` → punch-clock (clock-in / clock-out) timer UI.
- Unit tests assert the correct flow renders per report type; a Playwright e2e verifies an admin's report-type change is reflected in the employee flow.
- Prerequisite reality check: the mobile time-entry UI these flows switch *between* barely exists — scoping that groundwork is part of planning this change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `project-report-type`: adds the employee-app flow-switch requirement (moved verbatim from the original change's delta so it could not be canonized as built).

## Impact

- `apps/mobile` (time-entries feature), `e2e` specs. No API or schema changes — `reportType` already flows through `GET /me/assignments`.
