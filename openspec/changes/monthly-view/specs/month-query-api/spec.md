# month-query-api

## Purpose

One authenticated request returns everything the monthly screen needs for a given month: the employee's own time entries, the absences overlapping the month, and the month's lock status — so the client never assembles a month from multiple calls or computes lock state itself.

## ADDED Requirements

### Requirement: One request returns a full month of reporting data

The API SHALL expose an authenticated endpoint that, for a given year and month, returns in a single response: the requesting employee's time entries attributed to that month, the absences overlapping that month, and the month's lock status (`isLocked`, and `lockedAt` when locked). Until the absence capability ships, the absences collection SHALL be present and empty — the response shape does not change when absences arrive.

#### Scenario: Month with data

- **WHEN** an authenticated employee requests a month in which they have time entries
- **THEN** the response contains those entries, an absences array, and the month's lock status in one payload

#### Scenario: Empty month

- **WHEN** an authenticated employee requests a month with no entries and no absences
- **THEN** the response contains empty entry and absence collections and the lock status, not an error

#### Scenario: Absences are contract-present before Epic 7

- **WHEN** any month is requested before the absence model exists
- **THEN** the response carries an empty absences array conforming to the documented shape

### Requirement: Month attribution follows local dates and start instants

Month boundaries SHALL be evaluated per Asia/Jerusalem local dates, and an entry SHALL belong to the month of its local start date (VAL-38) — a midnight-crossing entry that starts on the last local day of a month belongs entirely to that month.

#### Scenario: Midnight-crossing entry on the month boundary

- **WHEN** an entry starts 22:00 local on the last day of a month and ends 06:00 the next day
- **THEN** it is returned for the month it started in and not for the following month

### Requirement: The query is scoped to the requesting employee

The endpoint SHALL return only the requesting user's own data. It SHALL reject unauthenticated requests with 401 and SHALL NOT accept a parameter that returns another user's month.

#### Scenario: Unauthenticated request

- **WHEN** the endpoint is called without a valid access token
- **THEN** the response is 401 and contains no reporting data

#### Scenario: Data isolation

- **WHEN** two employees have entries in the same month and one of them queries that month
- **THEN** the response contains only the requester's entries

### Requirement: Lock status reflects the MonthLock record

The lock status in the response SHALL be derived from the MonthLock record for that (year, month): no record or `is_locked = false` reads as open; `is_locked = true` reads as locked and includes when it was locked.

#### Scenario: Never-locked month

- **WHEN** a month with no MonthLock record is requested
- **THEN** the response reports the month as open

#### Scenario: Locked month

- **WHEN** a month whose MonthLock record has `is_locked = true` is requested
- **THEN** the response reports the month as locked with its lock timestamp

### Requirement: Historical entries keep the names of deleted catalog rows

Entries SHALL include the display names of their client, project, and task even when those rows have since been soft-deleted (§8.3), so past months always render.

#### Scenario: Entry referencing a deleted project

- **WHEN** a returned entry references a project that was soft-deleted after the entry was created
- **THEN** the entry still carries the project's name for display
