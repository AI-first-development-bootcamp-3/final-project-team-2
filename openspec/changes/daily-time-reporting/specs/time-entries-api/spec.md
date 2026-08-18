## Purpose

Lets an employee record, read, correct, and remove their own hours against the tasks they are assigned to, enforcing every reporting rule server-side so that no client can write data that violates the timesheet's integrity.

## ADDED Requirements

### Requirement: Employee creates a time entry

The system SHALL allow an authenticated employee to create a time entry against a task, recording start time, end time, work location, and an optional description. Created entries SHALL belong to the requesting employee; the caller SHALL NOT be able to create entries for another user.

#### Scenario: Valid entry is created

- **WHEN** an employee submits an entry with a start time, a later end time, an assigned task, and a work location
- **THEN** the entry is persisted, owned by that employee, and returned with its identifier

#### Scenario: Ownership cannot be forged

- **WHEN** a request attempts to specify a different owner for the entry
- **THEN** the entry is still recorded against the authenticated employee

#### Scenario: Administrator is not an employee reporter

- **WHEN** a user with the admin role calls the employee time-entry endpoints
- **THEN** the request is rejected as forbidden

#### Scenario: Unauthenticated request

- **WHEN** a request carries no valid access token
- **THEN** the request is rejected as unauthorised

### Requirement: Multiple entries per day

The system SHALL allow an employee to record any number of non-overlapping entries on the same day, across different tasks or the same task.

#### Scenario: Two entries on one day

- **WHEN** an employee records 09:00–12:00 and then 13:00–17:00 on the same day
- **THEN** both entries are stored and both are returned for that day

### Requirement: Start time is required

The system SHALL reject an entry without a start time, reporting rule `VAL-30` against the start-time field.

#### Scenario: Missing start time

- **WHEN** an entry is submitted with no start time
- **THEN** the request is rejected with rule `VAL-30`

### Requirement: End time must follow start time

The system SHALL reject an entry whose end time is not strictly after its start time, reporting rule `VAL-31`. An end time on the following calendar day SHALL be accepted, so that night shifts can be reported.

#### Scenario: End before start

- **WHEN** an entry is submitted ending earlier than it starts
- **THEN** the request is rejected with rule `VAL-31`

#### Scenario: End equal to start

- **WHEN** an entry is submitted whose end time equals its start time
- **THEN** the request is rejected with rule `VAL-31`

#### Scenario: Night shift accepted

- **WHEN** an entry is submitted running from 22:00 to 06:00 the next morning
- **THEN** the entry is accepted

#### Scenario: One-minute entry accepted

- **WHEN** an entry is submitted spanning a single minute
- **THEN** the entry is accepted, as no minimum duration applies

### Requirement: Entries must not overlap

The system SHALL reject an entry whose interval overlaps any existing entry of the same employee, reporting rule `VAL-32`. Overlap SHALL be evaluated across calendar dates so that midnight-crossing entries are compared correctly. Two entries that merely touch at a boundary SHALL NOT be treated as overlapping.

#### Scenario: Simple overlap on the same day

- **WHEN** an employee with an existing 09:00–12:00 entry submits 11:00–13:00 on the same day
- **THEN** the request is rejected with rule `VAL-32`

#### Scenario: Adjacent entries are allowed

- **WHEN** an employee with an existing 09:00–12:00 entry submits 12:00–14:00
- **THEN** the entry is accepted

#### Scenario: New entry overlaps a night shift from the previous day

- **WHEN** an employee has an entry running 22:00 on the 10th to 06:00 on the 11th and submits 05:00–07:00 on the 11th
- **THEN** the request is rejected with rule `VAL-32`

#### Scenario: New night shift overlaps an existing entry on the next day

- **WHEN** an employee has an entry of 05:00–07:00 on the 11th and submits 22:00 on the 10th to 06:00 on the 11th
- **THEN** the request is rejected with rule `VAL-32`

#### Scenario: Fully contained entry

- **WHEN** an employee with an existing 08:00–18:00 entry submits 10:00–11:00
- **THEN** the request is rejected with rule `VAL-32`

#### Scenario: Overlap check ignores deleted entries

- **WHEN** an employee submits an entry whose interval matches a previously deleted entry
- **THEN** the entry is accepted

#### Scenario: Overlap is scoped to the owner

- **WHEN** an employee submits an entry whose interval matches another employee's entry
- **THEN** the entry is accepted

### Requirement: Employee must be assigned to the task

The system SHALL reject an entry against a task the employee is not assigned to, reporting rule `VAL-33`. Assignment SHALL be verified on both create and update.

#### Scenario: Unassigned task

- **WHEN** an employee submits an entry against a task they hold no assignment for
- **THEN** the request is rejected with rule `VAL-33`

#### Scenario: Assigned task

- **WHEN** an employee submits an entry against a task they are assigned to
- **THEN** the entry is accepted

#### Scenario: Assignment re-checked when the task is changed

- **WHEN** an employee edits an existing entry to point at a task they are not assigned to
- **THEN** the request is rejected with rule `VAL-33`

### Requirement: Month lock blocks writes

The system SHALL reject any create, update, or delete of a time entry falling in a locked month, reporting rule `VAL-34` as a forbidden response. A month SHALL be considered open when no lock record exists for it, and open again once a lock record has been reopened. Reading entries SHALL remain permitted in a locked month.

#### Scenario: Write into a locked month

- **WHEN** an employee submits an entry dated inside a locked month
- **THEN** the request is rejected as forbidden with rule `VAL-34`

#### Scenario: Write into a month with no lock record

- **WHEN** an employee submits an entry dated in a month that has never been locked
- **THEN** the entry is accepted

#### Scenario: Write into a reopened month

- **WHEN** an employee submits an entry dated in a month whose lock has been reopened
- **THEN** the entry is accepted

#### Scenario: Editing an entry in a locked month

- **WHEN** an employee attempts to update or delete an entry that falls in a locked month
- **THEN** the request is rejected as forbidden with rule `VAL-34`

#### Scenario: Reading a locked month

- **WHEN** an employee lists entries for a locked month
- **THEN** the entries are returned normally

### Requirement: Task and location are required for completed entries

The system SHALL reject a completed entry without a task, reporting rule `VAL-35`, and without a work location, reporting rule `VAL-36`. Location SHALL be one of `office`, `client_site`, or `home`. These two rules SHALL NOT apply to an entry that has no end time, which represents work still in progress.

#### Scenario: Missing task

- **WHEN** a completed entry is submitted with no task
- **THEN** the request is rejected with rule `VAL-35`

#### Scenario: Missing location

- **WHEN** a completed entry is submitted with no work location
- **THEN** the request is rejected with rule `VAL-36`

#### Scenario: Unrecognised location

- **WHEN** a completed entry is submitted with a location outside the permitted set
- **THEN** the request is rejected with rule `VAL-36`

### Requirement: Entry date matches its start day

The system SHALL reject an entry whose recorded date does not equal the Asia/Jerusalem local date of its start time, reporting rule `VAL-38`, so that an entry always belongs to the day it began.

#### Scenario: Date disagrees with start time

- **WHEN** an entry is submitted with a date that differs from the local date of its start time
- **THEN** the request is rejected with rule `VAL-38`

#### Scenario: Night shift keeps its start date

- **WHEN** an entry starting at 22:00 on the 10th and ending at 06:00 on the 11th is submitted with the date of the 10th
- **THEN** the entry is accepted

### Requirement: Employee reads own entries

The system SHALL return an employee's own entries for a requested single day or date range, including for each entry enough task, project, and client information to display it without a further request. Entries SHALL NOT be returned to any user other than their owner.

#### Scenario: Entries for a single day

- **WHEN** an employee requests entries for a given date
- **THEN** only their own entries attributed to that local date are returned

#### Scenario: Entries for a range

- **WHEN** an employee requests entries between two dates
- **THEN** only their own entries within that range are returned

#### Scenario: Another employee's entries are not visible

- **WHEN** an employee requests entries
- **THEN** no entry belonging to a different employee is included

#### Scenario: Historical entries survive catalogue changes

- **WHEN** an entry references a task, project, or client that has since been closed or deactivated
- **THEN** the entry is still returned with its task, project, and client names intact

### Requirement: Employee edits own entries

The system SHALL allow an employee to update their own entry while its month is open, re-applying the end-after-start, overlap, and assignment rules to the updated values. An employee SHALL NOT be able to edit an entry belonging to another user.

#### Scenario: Valid edit

- **WHEN** an employee changes the times, task, location, or description of their own entry in an open month
- **THEN** the entry is updated and returned

#### Scenario: Edit creating an overlap

- **WHEN** an employee edits an entry so that it would overlap another of their entries
- **THEN** the request is rejected with rule `VAL-32`

#### Scenario: Edit of another user's entry

- **WHEN** an employee attempts to update an entry they do not own
- **THEN** the request is rejected

#### Scenario: Edit of an entry that does not exist

- **WHEN** an employee attempts to update an unknown entry
- **THEN** the request is rejected as not found

### Requirement: Employee deletes own entries

The system SHALL allow an employee to delete their own entry while its month is open. Deletion SHALL be soft: the record SHALL be retained and excluded from all subsequent reads, day totals, and overlap checks.

#### Scenario: Entry is deleted

- **WHEN** an employee deletes their own entry in an open month
- **THEN** the entry no longer appears in listings or day totals

#### Scenario: Deleted entry is retained

- **WHEN** an entry has been deleted
- **THEN** the underlying record still exists and is marked as deleted rather than removed

#### Scenario: Delete of another user's entry

- **WHEN** an employee attempts to delete an entry they do not own
- **THEN** the request is rejected

### Requirement: Field-level validation errors

The system SHALL report validation failures with a field-level error payload naming the offending field and its rule identifier, so that a client can attach each message to the right input. Where a request violates several rules, all violations SHALL be reported together.

#### Scenario: Single field violation

- **WHEN** a submission violates one rule
- **THEN** the response identifies the field and its rule identifier

#### Scenario: Several field violations

- **WHEN** a submission omits both the task and the location
- **THEN** the response reports both `VAL-35` and `VAL-36`

### Requirement: Endpoints are documented

The system SHALL publish every time-entry endpoint in the generated API documentation, including request and response shapes and the authentication requirement.

#### Scenario: Documentation lists the endpoints

- **WHEN** the API documentation is served
- **THEN** the time-entry endpoints appear with their schemas and are marked as requiring authentication
