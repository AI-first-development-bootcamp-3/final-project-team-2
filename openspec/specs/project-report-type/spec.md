# project-report-type Specification

## Purpose

Per-project configuration of how employees report time: each project carries a `reportType` (`TOTAL_HOURS` manual entry or `CLOCK_IN_OUT` punch-clock) that admins manage from the reporting-settings screen and the API exposes to both apps. This spec currently captures the review-hardening contracts (validation, screen resilience, response-field integrity); the base feature's requirements merge in when the active `project-report-type` change is archived, and the employee-app flow switch lives in the deferred `employee-report-flow-switch` change.

## Requirements

### Requirement: Report-Type Update Input Validation

The report-type update endpoint SHALL reject malformed input with a well-formed 400 response instead of surfacing an internal error.

- A `:id` path parameter that is not a valid UUID MUST yield HTTP 400 (not 500) without reaching the database.
- An invalid `reportType` body value MUST yield HTTP 400 whose error details carry a dedicated validation rule code for `reportType` and a Hebrew message, consistent with the API's existing Hebrew validation-error contract. The generic search-query rule code (`VAL-QUERY`) MUST NOT appear for `reportType` errors.

#### Scenario: Malformed project id is rejected as a client error

- **WHEN** an admin calls `PATCH /api/v1/projects/not-a-uuid/report-type` with a valid body
- **THEN** the API responds 400 with validation details for the `id` parameter, and no 500 is produced.

#### Scenario: Invalid report type value gets a dedicated Hebrew validation error

- **WHEN** an admin calls `PATCH /api/v1/projects/<valid-id>/report-type` with body `{ "reportType": "INVALID" }`
- **THEN** the API responds 400 with details naming field `reportType`, a dedicated `VAL-*` rule code for report type, and a Hebrew message — not `VAL-QUERY` and not raw English validator text.

### Requirement: Reporting Settings Screen Resilience

The admin reporting-settings screen SHALL remain usable when a report-type update fails and SHALL always reflect the latest search input.

- A failed report-type update MUST NOT hide the projects table; the error SHALL be presented as a dismissible message alongside the still-rendered table, and it SHALL clear on the next successful action or dismissal.
- Search requests SHALL be debounced, and a response belonging to an older query MUST NOT overwrite the results of a newer query.

#### Scenario: Failed update keeps the table interactive

- **WHEN** a report-type PATCH fails (network error or concurrent deletion)
- **THEN** the projects table stays rendered with current data, an error message appears with a dismiss control, and the admin can retry immediately.

#### Scenario: Stale search response does not clobber newer results

- **WHEN** the admin types a query whose earlier, shorter prefix request resolves after the full query's request
- **THEN** the table shows results for the full query only; the stale response is discarded.

### Requirement: Report Type Field Integrity in Responses

API responses that include projects or assignment items MUST include `reportType` as a required field.

- The projects list response and the employee assignments response SHALL always carry `reportType` for every item.
- Consumers' schemas MUST treat a missing `reportType` as a contract violation rather than silently defaulting it to `TOTAL_HOURS`.

#### Scenario: Missing report type is a contract violation, not a silent default

- **WHEN** a response item lacks `reportType` and is validated against the shared contracts schemas
- **THEN** schema validation fails loudly instead of substituting `TOTAL_HOURS`.
