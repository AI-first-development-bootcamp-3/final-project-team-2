## Purpose

Lets an employee record the days they were not working — vacation, sickness, reserve duty, or another reason — as a single day, a half day, or a range, and lets an admin read what every employee recorded. Absence rows are what turn an unreported day from a gap into a known, accounted-for day, so the monthly view and the month-close review can both be trusted.

## ADDED Requirements

### Requirement: Absence types

The system SHALL accept exactly four absence types — `vacation`, `sick`, `military`, and `other` — and SHALL reject any other value with VAL-40.

#### Scenario: Each of the four types is accepted

- **WHEN** an employee creates an absence with type `vacation`, `sick`, `military`, or `other`
- **THEN** each is stored and returned with the type given

#### Scenario: An unrecognised type is rejected

- **WHEN** an employee submits an absence with a type outside the four
- **THEN** the response is 400 with a `details` entry against the `type` field carrying rule VAL-40

### Requirement: Date range validity

An absence SHALL have a required `startDate`, and an `endDate` that is on or after it.

#### Scenario: Missing start date

- **WHEN** an absence is submitted with no `startDate`
- **THEN** the response is 400 with rule VAL-41 against `startDate`

#### Scenario: End date before start date

- **WHEN** an absence is submitted with `endDate` earlier than `startDate`
- **THEN** the response is 400 with rule VAL-42 against `endDate`

#### Scenario: Single day

- **WHEN** an absence is submitted with `endDate` equal to `startDate` on a working day
- **THEN** it is accepted and stored as one row covering that day

### Requirement: Weekend exclusion by row splitting

Fridays and Saturdays SHALL NOT be stored as absence days. A submitted range spanning a weekend SHALL be stored as one absence row per contiguous run of working days, and every row in the result SHALL share one `groupId`.

#### Scenario: Range spanning one weekend

- **WHEN** an employee reports a vacation from Thursday the 20th to Sunday the 23rd
- **THEN** two absence rows are stored — one covering the 20th and one covering the 23rd — both carrying the same `groupId`, and no row covers the 21st or 22nd

#### Scenario: Range spanning two weekends

- **WHEN** an employee reports a vacation covering a fifteen-day span that contains two weekends
- **THEN** three absence rows are stored, one per working-day run, all sharing one `groupId`

#### Scenario: Range entirely within a working week

- **WHEN** an employee reports a range from Sunday to Thursday
- **THEN** one absence row is stored covering Sunday through Thursday

#### Scenario: Range starting on a weekend day

- **WHEN** an employee reports a range whose `startDate` is a Friday or a Saturday
- **THEN** the response is 400 with rule VAL-43 against `startDate`, and nothing is stored

#### Scenario: Range ending on a weekend day

- **WHEN** an employee reports a range whose `endDate` is a Friday or a Saturday
- **THEN** the response is 400 with rule VAL-43 against `endDate`, and nothing is stored

#### Scenario: Range containing only weekend days

- **WHEN** an employee reports a range covering only a Friday and a Saturday
- **THEN** the response is 400 with rule VAL-43, and nothing is stored

#### Scenario: A partially failed split stores nothing

- **WHEN** the write of one row in a multi-row group fails
- **THEN** no row from that group is stored

### Requirement: Half-day absences

An absence MAY be marked as a half day, in which case a period of `morning` or `afternoon` SHALL be required. A half day SHALL apply to a single date only.

#### Scenario: Half day with a period

- **WHEN** an employee reports a half-day absence with period `morning`
- **THEN** it is stored with `isHalfDay` true and the period given

#### Scenario: Half day without a period

- **WHEN** an employee reports a half-day absence with no period
- **THEN** the response is 400 with a `details` entry against `halfDayPeriod`

#### Scenario: Period supplied without the half-day flag

- **WHEN** an employee submits a period on an absence that is not marked as a half day
- **THEN** the response is 400 with a `details` entry against `halfDayPeriod`

#### Scenario: Half day over a range

- **WHEN** an employee reports a half-day absence whose `endDate` differs from its `startDate`
- **THEN** the response is 400, because a half day describes one date

### Requirement: Overlapping absences are rejected

An employee SHALL NOT hold two absences covering the same date.

#### Scenario: Two absences on the same day

- **WHEN** an employee has an absence covering the 10th and reports another covering the 10th
- **THEN** the response is 409 with rule VAL-ABSENCE-OVERLAP

#### Scenario: A range overlapping an existing absence

- **WHEN** an employee has an absence covering the 10th and reports a range covering the 8th to the 12th
- **THEN** the response is 409 and nothing is stored

#### Scenario: Two half days on the same day

- **WHEN** an employee has a morning half-day absence on the 10th and reports an afternoon half-day absence on the 10th
- **THEN** the response is 409, because the rule is per-date

#### Scenario: Adjacent absences are accepted

- **WHEN** an employee has an absence ending on the 10th and reports one starting on the 11th
- **THEN** it is accepted

#### Scenario: Another employee's absence does not collide

- **WHEN** a different employee already has an absence covering the same date
- **THEN** the absence is accepted

#### Scenario: A soft-deleted absence does not collide

- **WHEN** the only absence covering the date has been soft-deleted
- **THEN** the absence is accepted

### Requirement: Locked-month matrix

Writes SHALL be refused when the affected month is locked, EXCEPT that creating a `sick` or `military` absence SHALL be permitted in a locked month.

#### Scenario: Vacation creation in a locked month

- **WHEN** an employee creates a `vacation` absence dated inside a locked month
- **THEN** the response is 403 with rule VAL-45

#### Scenario: Other creation in a locked month

- **WHEN** an employee creates an `other` absence dated inside a locked month
- **THEN** the response is 403 with rule VAL-45

#### Scenario: Sick creation in a locked month

- **WHEN** an employee creates a `sick` absence dated inside a locked month
- **THEN** it is accepted and stored

#### Scenario: Military creation in a locked month

- **WHEN** an employee creates a `military` absence dated inside a locked month
- **THEN** it is accepted and stored

#### Scenario: Update in a locked month

- **WHEN** an employee updates any absence, of any type, dated inside a locked month
- **THEN** the response is 403 with rule VAL-45

#### Scenario: Delete in a locked month

- **WHEN** an employee deletes any absence, of any type, dated inside a locked month
- **THEN** the response is 403 with rule VAL-45

#### Scenario: Read in a locked month

- **WHEN** an employee lists absences in a locked month
- **THEN** the absences are returned

#### Scenario: A reopened month accepts writes again

- **WHEN** a month has a lock record whose locked flag is false
- **THEN** writes into that month are accepted as if no record existed

#### Scenario: A range reaching into a locked month

- **WHEN** an employee reports a `vacation` range that begins in a locked month and ends in an open one
- **THEN** the response is 403 with rule VAL-45 and nothing is stored, rather than storing only the rows falling in the open month

### Requirement: Group semantics on update and delete

An update or delete addressed to any absence row SHALL apply to every row sharing its `groupId`.

#### Scenario: Deleting one row of a split group

- **WHEN** an employee deletes the absence row covering Thursday from a Thursday-and-Sunday group
- **THEN** both rows are soft-deleted and neither is returned by subsequent reads

#### Scenario: Editing a split group's range

- **WHEN** an employee changes the range of an absence belonging to a two-row group so that it no longer spans a weekend
- **THEN** the group's previous rows are replaced by one row covering the new range, under the same `groupId`

#### Scenario: A single-row absence

- **WHEN** an employee deletes an absence that is the only row in its group
- **THEN** it is soft-deleted

#### Scenario: A row with no group

- **WHEN** an absence row carries no `groupId`
- **THEN** it is treated as a group of one for update and delete

### Requirement: Ownership and role scoping

An employee SHALL read and write only their own absences. An admin SHALL read any employee's absences and SHALL NOT create absences.

#### Scenario: Employee reads own absences

- **WHEN** an employee lists absences
- **THEN** only their own are returned

#### Scenario: Employee cannot read another employee's absence

- **WHEN** an employee requests an absence belonging to somebody else by id
- **THEN** the response is 404, without revealing that the absence exists

#### Scenario: Employee cannot forge ownership

- **WHEN** an employee submits an absence naming a different user
- **THEN** the absence is stored against the authenticated user, not the user named

#### Scenario: Admin reads a specific employee's absences

- **WHEN** an admin lists absences filtered to a given user
- **THEN** that user's absences are returned

#### Scenario: Admin cannot create an absence

- **WHEN** an admin attempts to create an absence
- **THEN** the response is 403

#### Scenario: Unauthenticated request

- **WHEN** an unauthenticated caller requests any absence endpoint
- **THEN** the response is 401

### Requirement: Listing and filtering

The list endpoint SHALL support filtering by month, and SHALL return each row's type, dates, half-day state, notes, `groupId`, and whether a required document is missing.

#### Scenario: Filter by month

- **WHEN** absences are listed for a given year and month
- **THEN** only rows overlapping that month are returned

#### Scenario: Soft-deleted absences are excluded

- **WHEN** an absence has been soft-deleted
- **THEN** it does not appear in any list or single-item read

### Requirement: Missing-document flag

A `sick` or `military` absence with no registered attachment SHALL be returned with a flag marking the document as missing. Absences of other types SHALL never be flagged.

#### Scenario: Sick absence without a document

- **WHEN** a `sick` absence has no attachment
- **THEN** it is returned with the missing-document flag set

#### Scenario: Sick absence with a document

- **WHEN** a `sick` absence has at least one attachment
- **THEN** it is returned with the missing-document flag unset

#### Scenario: Military absence without a document

- **WHEN** a `military` absence has no attachment
- **THEN** it is returned with the missing-document flag set

#### Scenario: Vacation absence without a document

- **WHEN** a `vacation` absence has no attachment
- **THEN** the missing-document flag is unset, because no document is expected

#### Scenario: Saving is not blocked

- **WHEN** a `sick` absence is created with no attachment
- **THEN** it is stored successfully rather than rejected

### Requirement: Soft delete

Deleting an absence SHALL retain the row and exclude it from every read.

#### Scenario: Deleted absence is retained

- **WHEN** an absence is deleted
- **THEN** the row remains in storage with a deletion timestamp and is absent from reads, totals, and overlap checks

### Requirement: Documented endpoints

Every absence endpoint SHALL appear in the API documentation with its request and response schemas and its bearer-token requirement.

#### Scenario: Endpoints documented

- **WHEN** the API documentation is served
- **THEN** the create, list, get, update, and delete absence endpoints are present with their schemas
