## Purpose

The screen an employee uses to say they were not at work. It has to make the common cases fast — one day off, half a Thursday, a week in the summer — while collecting the document a sick day or reserve-duty day requires, and it has to explain in Hebrew why a submission was refused without losing what the employee typed.

## ADDED Requirements

### Requirement: Absence report screen

The employee app SHALL provide an absence report screen at `/absence/new`, reachable only when authenticated, laid out for a 393px viewport in right-to-left Hebrew.

#### Scenario: Unauthenticated access

- **WHEN** an unauthenticated visitor navigates to the absence report screen
- **THEN** they are redirected to the login screen

#### Scenario: Screen renders

- **WHEN** an authenticated employee opens the absence report screen
- **THEN** the type picker, date selection, half-day toggle, attachment upload, and notes field are present

### Requirement: Type selection

The screen SHALL offer the four absence types by their Hebrew names and SHALL require one to be chosen before submission.

#### Scenario: Types offered

- **WHEN** the type picker is opened
- **THEN** חופשה, מחלה, מילואים, and אחר are offered

#### Scenario: Submission without a type

- **WHEN** the employee submits with no type chosen
- **THEN** the form is not submitted and the type field is marked as required

### Requirement: Single-day and range selection

The screen SHALL support reporting a single date or a date range through a calendar.

#### Scenario: Single day

- **WHEN** the employee picks one date
- **THEN** the submission carries that date as both start and end

#### Scenario: Date range

- **WHEN** the employee picks a start date and a later end date
- **THEN** the submission carries both

#### Scenario: Weekend days are not selectable

- **WHEN** the calendar is open
- **THEN** Fridays and Saturdays cannot be chosen as the start or end of a range

#### Scenario: Range spanning a weekend is previewed as working days

- **WHEN** the employee selects a range from a Thursday to the following Sunday
- **THEN** the screen shows that two working days will be recorded, and does not present the Friday and Saturday as absence days

### Requirement: Half-day toggle

The screen SHALL provide a half-day toggle which, when on, requires a period of morning or afternoon and restricts the selection to a single date.

#### Scenario: Half day requires a period

- **WHEN** the half-day toggle is on and no period is chosen
- **THEN** the form is not submitted and the period field is marked as required

#### Scenario: Period chosen

- **WHEN** the half-day toggle is on and a period is chosen
- **THEN** the submission carries the half-day flag and the period

#### Scenario: Half day restricts to one date

- **WHEN** the half-day toggle is switched on while a range is selected
- **THEN** the selection collapses to a single date

#### Scenario: Toggle off clears the period

- **WHEN** the half-day toggle is switched off after a period was chosen
- **THEN** the period is cleared and is not submitted

### Requirement: Attachment upload

The screen SHALL let the employee attach a JPG, PNG, or PDF of up to 5MB, and SHALL show the upload's progress and outcome.

#### Scenario: Upload in progress

- **WHEN** a file is being uploaded
- **THEN** the screen shows the upload as in progress and the save action is unavailable until it settles

#### Scenario: Upload completes

- **WHEN** an upload completes
- **THEN** the attached file is listed by name

#### Scenario: Disallowed type chosen

- **WHEN** the employee selects a file that is not a JPG, PNG, or PDF
- **THEN** the file is refused before upload with the Hebrew message for VAL-60

#### Scenario: Oversized file chosen

- **WHEN** the employee selects a file larger than 5MB
- **THEN** the file is refused before upload with the Hebrew message for VAL-61

#### Scenario: Upload fails

- **WHEN** an upload fails
- **THEN** the screen reports the failure and the employee can retry without losing the rest of the form

### Requirement: Sick and military absences are savable without a document

The screen SHALL allow a sick or military absence to be saved with no attachment, while making clear that a document is still expected.

#### Scenario: Sick absence saved without a document

- **WHEN** the employee saves a sick absence with no file attached
- **THEN** the absence is saved and the screen indicates that a document is still required

#### Scenario: Vacation absence needs no document

- **WHEN** the employee chooses חופשה
- **THEN** no document is requested

### Requirement: Notes

The screen SHALL offer an optional notes field.

#### Scenario: Notes omitted

- **WHEN** the employee saves without notes
- **THEN** the absence is saved

### Requirement: Screen states

The screen SHALL present distinct default, saving, validation-error, and upload-in-progress states.

#### Scenario: Saving

- **WHEN** a submission is in flight
- **THEN** the save action is unavailable and the screen shows that it is saving

#### Scenario: Validation error

- **WHEN** a submission is refused
- **THEN** the screen shows the validation-error state and the save action becomes available again

### Requirement: Server validation messages are rendered against their fields

Refusals SHALL be rendered in Hebrew from the shared message registry, keyed to the field each rule names, and SHALL NOT discard what the employee entered.

#### Scenario: Weekend range refused by the server

- **WHEN** the server refuses a submission with rule VAL-43 against the start date
- **THEN** the Hebrew message for VAL-43 is shown against the start date field and every entered value is preserved

#### Scenario: Locked month refused by the server

- **WHEN** the server refuses a vacation submission with rule VAL-45
- **THEN** the Hebrew message for VAL-45 is shown and every entered value is preserved

#### Scenario: Overlapping absence refused by the server

- **WHEN** the server refuses a submission because the dates overlap an existing absence
- **THEN** the message is shown against the date field and every entered value is preserved

### Requirement: Locked-month behaviour on the screen

When the selected dates fall in a locked month, the screen SHALL offer only the types that a locked month accepts.

#### Scenario: Locked month restricts the types

- **WHEN** the selected dates fall inside a locked month
- **THEN** the screen indicates the month is closed and offers only מחלה and מילואים

#### Scenario: Open month offers every type

- **WHEN** the selected dates fall inside an open month
- **THEN** all four types are offered

### Requirement: Successful save

A saved absence SHALL confirm and return the employee to where they came from.

#### Scenario: Save succeeds

- **WHEN** an absence is saved successfully
- **THEN** the employee sees a confirmation and is returned to the screen they navigated from
