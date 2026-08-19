# monthly-view

## Purpose

The employee's month-at-a-glance calendar (`/monthly`, 393px RTL): every day colored by its computed status, drill-down into any day's entries with edit round-trip, and read-only rendering for locked months. Per ADR-14 this screen is also the report history — there is no separate history screen.

## ADDED Requirements

### Requirement: Calendar renders computed day statuses

The monthly screen SHALL render a calendar grid (week starting Sunday) where each day's status is computed from the month's entries and absences using the shared DayStatus rules in `@abra/contracts` — never stored, never re-implemented locally. The five statuses render distinguishably: EMPTY (0h) · PARTIAL (under 9h, חסר) · FULL (exactly 9h, מלא) · EXCESS (over 9h, חריג) · ABSENCE (day covered by an absence, which outranks hours).

#### Scenario: Exactly nine hours reads FULL

- **WHEN** a day's entries total exactly 9 hours
- **THEN** its cell renders the FULL status

#### Scenario: Over nine hours reads EXCESS

- **WHEN** a day's entries total more than 9 hours
- **THEN** its cell renders the EXCESS status

#### Scenario: Absence outranks hours

- **WHEN** a day is covered by an absence, even if entries were also reported on it
- **THEN** its cell renders the ABSENCE status

### Requirement: Month navigation defaults to the current month

The screen SHALL open on the current Asia/Jerusalem month and allow navigating back and forward one month at a time. Future months are navigable and render as empty.

#### Scenario: Navigating to a future month

- **WHEN** the user navigates forward past the current month
- **THEN** the calendar renders with all days EMPTY and no error

### Requirement: Day drill-down lists the day's entries

Tapping a day SHALL open that day's entries — time range, duration, client/project/task, location, description — using the same entries-list contract as the home screen, with times displayed in Asia/Jerusalem. A midnight-crossing entry appears on the day it started (VAL-38). Absences covering the day are shown inline.

#### Scenario: Midnight-crossing entry appears on its start day

- **WHEN** an entry runs 22:00–06:00 across two days and the user opens the start day
- **THEN** the entry is listed there in full, and the following day does not list it

#### Scenario: Deleted catalog names still render

- **WHEN** the user opens a day whose entry references a since-deleted client, project, or task
- **THEN** the entry renders those names rather than blanks or errors

### Requirement: Editing from the view round-trips to the calendar

From the drill-down, an entry SHALL open in the standard entry edit form (Epic 5), and after a successful save the calendar and the day's list SHALL reflect the updated data without a manual refresh.

#### Scenario: Edit changes a day's status

- **WHEN** the user extends an entry so the day's total crosses from under 9h to exactly 9h
- **THEN** returning to the calendar shows that day as FULL

### Requirement: Locked months render read-only

When the displayed month is locked, the screen SHALL show a lock indicator (year, month, locked-at) and a read-only banner, and SHALL offer no write affordances — no edit, delete, or create actions — while all data remains readable (§7.1).

#### Scenario: Locked month hides write affordances

- **WHEN** the user views a locked month and drills into a day
- **THEN** the entries are readable but no edit or delete action is rendered, and the lock indicator is visible

### Requirement: Loading and empty states

The screen SHALL render a loading state while the month query is in flight and an empty-month state when the month has no entries and no absences.

#### Scenario: Empty month

- **WHEN** the month query resolves with no entries and no absences for an open month
- **THEN** the calendar renders all days EMPTY with the empty-month treatment, not an error
