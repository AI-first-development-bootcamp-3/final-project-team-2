## Purpose

The employee's home screen and entry form — where an employee sees the hours they have reported today against the nine-hour target and adds, corrects, or removes entries, choosing only from the work they are actually assigned to.

## ADDED Requirements

### Requirement: Daily report is the employee home screen

The employee application SHALL present the daily report as the landing screen after sign-in, replacing the placeholder screen. The screen SHALL be laid out for a 393-pixel phone viewport in right-to-left Hebrew.

#### Scenario: Signed-in employee lands on the daily report

- **WHEN** an employee signs in
- **THEN** the daily report screen for today is shown

#### Scenario: Signed-out visitor is redirected

- **WHEN** a visitor without a session opens the daily report
- **THEN** they are redirected to sign in

### Requirement: Today's entries are listed

The daily report SHALL list the current day's entries, each showing its time range, task, project, client, work location, and description where present, and each offering edit and delete actions.

#### Scenario: Day with entries

- **WHEN** the employee has reported hours today
- **THEN** each entry is listed with its times, task, project, client, and location

#### Scenario: Day without entries

- **WHEN** the employee has reported no hours today
- **THEN** an empty state is shown together with the action to add an entry

#### Scenario: Entries are still loading

- **WHEN** the day's entries have been requested but not yet received
- **THEN** a loading state is shown instead of an empty state

#### Scenario: Entries could not be loaded

- **WHEN** the request for the day's entries fails
- **THEN** an error message is shown and the empty state is not mistaken for a day with no work

### Requirement: Nine-hour quota bar

The daily report SHALL display a quota bar showing the day's total reported hours against a nine-hour target, coloured by the day's computed status. The bar SHALL update as soon as an entry is added, edited, or deleted. The quota SHALL be advisory: exceeding or falling short of it SHALL never prevent an entry from being saved.

#### Scenario: Bar reflects the day total

- **WHEN** the day's entries total 6 hours
- **THEN** the bar shows 6 hours against the 9-hour target in the `partial` styling

#### Scenario: Bar on a complete day

- **WHEN** the day's entries total exactly 9 hours
- **THEN** the bar shows the `full` styling

#### Scenario: Bar over quota

- **WHEN** the day's entries total more than 9 hours
- **THEN** the bar shows the `excess` styling and no entry is rejected for it

#### Scenario: Bar on an empty day

- **WHEN** the day has no entries
- **THEN** the bar shows 0 hours in the `empty` styling

#### Scenario: Bar on a day covered by an absence

- **WHEN** the day is covered by an absence
- **THEN** the bar shows the `absence` styling

#### Scenario: Bar updates after a change

- **WHEN** the employee adds, edits, or deletes an entry
- **THEN** the total and styling update without a manual page reload

#### Scenario: Statuses come from the shared rules

- **WHEN** the quota bar determines a day's status
- **THEN** it uses the shared day-status rules rather than its own thresholds

### Requirement: Times are shown in local time

The application SHALL present all times to the employee in Asia/Jerusalem local time, while exchanging instants with the API in UTC. Weeks SHALL be treated as starting on Sunday.

#### Scenario: Entry displayed in local time

- **WHEN** an entry is returned by the API as a UTC instant
- **THEN** it is displayed as its Asia/Jerusalem clock time

#### Scenario: Entry submitted from local time

- **WHEN** an employee enters a start and end time
- **THEN** the values sent to the API are the corresponding UTC instants

### Requirement: One entry form for creating and editing

The application SHALL serve both the new-entry and edit-entry flows from a single form. In edit mode the form SHALL be pre-filled with the existing entry's values.

#### Scenario: New entry

- **WHEN** the employee chooses to add an entry
- **THEN** an empty form is shown, defaulted to the current day

#### Scenario: Edit an existing entry

- **WHEN** the employee chooses to edit an entry
- **THEN** the form opens pre-filled with that entry's task, times, location, and description

#### Scenario: Saving returns to the daily report

- **WHEN** the employee saves the form successfully
- **THEN** they are returned to the daily report and the new or updated entry is visible

#### Scenario: Cancelling discards changes

- **WHEN** the employee leaves the form without saving
- **THEN** no entry is created or modified

### Requirement: Assignment-scoped cascading picker

The entry form SHALL offer a cascading Client, then Project, then Task selection restricted to the tasks the employee is assigned to, together with those tasks' parent projects and clients. Choosing a client SHALL narrow the projects offered, and choosing a project SHALL narrow the tasks offered. Tasks the employee is not assigned to SHALL never be selectable.

#### Scenario: Only assigned work is offered

- **WHEN** the employee opens the picker
- **THEN** only clients, projects, and tasks reachable from their own assignments are listed

#### Scenario: Selection cascades

- **WHEN** the employee selects a client and then a project
- **THEN** the project list is limited to that client and the task list is limited to that project

#### Scenario: Changing the client resets the narrower selections

- **WHEN** the employee changes the selected client after choosing a project and task
- **THEN** the project and task selections are cleared

#### Scenario: Closed and deactivated work is hidden

- **WHEN** a task is closed, or its project or client has been deactivated
- **THEN** it does not appear in the picker for a new entry

#### Scenario: Employee has no assignments

- **WHEN** the employee holds no task assignments
- **THEN** the form explains that no work is available to report against, rather than showing an empty picker

### Requirement: Manual entry is limited to total-hours projects

The manual entry flow SHALL be offered only for projects configured to report total hours. Projects configured for clock-in/clock-out reporting SHALL NOT be selectable in the manual entry form.

#### Scenario: Total-hours project is selectable

- **WHEN** a project is configured to report total hours
- **THEN** its tasks can be selected in the manual entry form

#### Scenario: Clock-in/clock-out project is excluded

- **WHEN** a project is configured for clock-in/clock-out reporting
- **THEN** its tasks are not offered in the manual entry form

### Requirement: Entry form captures times, location, and description

The entry form SHALL capture a start time, an end time, a work location chosen from office, client site, or home, and an optional free-text description. An end time earlier in the clock than the start time SHALL be understood as a night shift ending the following day rather than rejected outright.

#### Scenario: Complete submission

- **WHEN** the employee supplies a task, start and end times, and a location
- **THEN** the entry is submitted

#### Scenario: Night shift entered

- **WHEN** the employee enters a start of 22:00 and an end of 06:00
- **THEN** the entry is submitted as ending on the following day

#### Scenario: Description is optional

- **WHEN** the employee submits without a description
- **THEN** the entry is accepted

### Requirement: Validation messages are shown against their fields

The form SHALL display each validation failure returned by the API next to the field it concerns, in Hebrew. Validation failures SHALL leave the employee's input in place so it can be corrected rather than re-entered.

#### Scenario: Overlapping entry rejected

- **WHEN** the API rejects the submission because it overlaps an existing entry
- **THEN** a Hebrew message explaining the overlap is shown and the entered values are preserved

#### Scenario: Missing location

- **WHEN** the employee submits without choosing a location
- **THEN** a message is shown against the location field

#### Scenario: End not after start

- **WHEN** the API rejects the submission for an end time that is not after the start
- **THEN** a message is shown against the time fields

### Requirement: Deleting an entry is confirmed

The daily report SHALL ask the employee to confirm before deleting an entry, and SHALL remove the entry from the list and update the quota bar once deletion succeeds.

#### Scenario: Deletion confirmed

- **WHEN** the employee confirms deletion of an entry
- **THEN** the entry is removed from the list and the quota bar updates

#### Scenario: Deletion dismissed

- **WHEN** the employee dismisses the confirmation
- **THEN** the entry remains

### Requirement: Locked months are read-only

When the displayed day falls in a locked month, the daily report SHALL indicate that the month is closed and SHALL withhold the add, edit, and delete actions. The entry form SHALL render read-only for an entry in a locked month.

#### Scenario: Daily report in a locked month

- **WHEN** the employee views a day inside a locked month
- **THEN** the entries are visible, the month is shown as closed, and no add, edit, or delete action is offered

#### Scenario: Entry form in a locked month

- **WHEN** the employee opens an entry belonging to a locked month
- **THEN** the form is shown read-only with no save action

#### Scenario: Lock applied while the screen is open

- **WHEN** a write is refused because the month is locked
- **THEN** the screen explains that the month has been closed rather than showing a generic failure
