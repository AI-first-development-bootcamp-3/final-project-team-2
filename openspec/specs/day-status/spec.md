# day-status Specification

## Purpose

Classifies a single calendar day of an employee's reported work into one of five statuses and totals its hours. The rules are computed rather than stored and are shared by every surface that colours a day — the daily quota bar and the monthly calendar — so that no two screens can disagree about whether a day is full.

## Requirements

### Requirement: Day status classification

The system SHALL classify each day into exactly one of five statuses: `empty`, `partial`, `full`, `excess`, or `absence`. The four hour-based statuses SHALL be mutually exclusive, with `full` meaning a total of exactly nine hours.

#### Scenario: No entries on the day

- **WHEN** a day has no time entries and no absence
- **THEN** the status is `empty` and the total is 0 hours

#### Scenario: Fewer than nine hours reported

- **WHEN** a day's entries total more than 0 and less than 9 hours
- **THEN** the status is `partial`

#### Scenario: Exactly nine hours reported

- **WHEN** a day's entries total exactly 9 hours
- **THEN** the status is `full`

#### Scenario: More than nine hours reported

- **WHEN** a day's entries total more than 9 hours
- **THEN** the status is `excess`

#### Scenario: Just above and just below the boundary

- **WHEN** a day totals 8 hours 59 minutes, and another day totals 9 hours 1 minute
- **THEN** the first is `partial` and the second is `excess`, and neither is `full`

### Requirement: Absence precedence

A day covered by an absence SHALL be reported as `absence` regardless of its hour total, so that an absence is never displayed as an unreported day.

#### Scenario: Absence with no entries

- **WHEN** a day is covered by an absence and has no time entries
- **THEN** the status is `absence`, not `empty`

#### Scenario: Absence alongside reported hours

- **WHEN** a day is covered by an absence and also has time entries totalling 4 hours
- **THEN** the status is `absence` and the total hours are still reported as 4

#### Scenario: No absence data supplied

- **WHEN** the computation is given an empty set of absences
- **THEN** classification proceeds on hours alone and `absence` is never returned

### Requirement: Midnight-crossing attribution

An entry SHALL contribute its full duration to the day on which it started, even when it ends on the following day. No portion of a night shift SHALL be attributed to the day it ends on.

#### Scenario: Night shift counted on its start day

- **WHEN** an entry runs 22:00 on the 10th to 06:00 on the 11th
- **THEN** all 8 hours count toward the 10th and 0 hours count toward the 11th

#### Scenario: Night shift alone makes a partial day

- **WHEN** the 10th contains only that 22:00–06:00 entry
- **THEN** the 10th is `partial` and the 11th is `empty`

### Requirement: Local-date bucketing

Days SHALL be bucketed by their Asia/Jerusalem local date, while entry timestamps are carried as UTC instants. An entry SHALL be attributed to the local day of its start instant.

#### Scenario: Late-evening entry near the UTC date boundary

- **WHEN** an entry starts at an instant that is a different calendar date in UTC than in Asia/Jerusalem
- **THEN** it is attributed to its Asia/Jerusalem date

#### Scenario: Consistent bucketing across DST

- **WHEN** days on either side of an Israeli daylight-saving transition are classified
- **THEN** each entry is attributed to its correct local date and no day is double-counted or skipped

### Requirement: Running entries excluded from totals

An entry without an end time represents work still in progress and SHALL contribute zero hours to the day total, so that a running timer does not inflate the day's status.

#### Scenario: Only a running entry on the day

- **WHEN** a day contains a single entry with no end time
- **THEN** the total is 0 hours and the status is `empty`

#### Scenario: Running entry alongside completed work

- **WHEN** a day contains a completed 5-hour entry and one entry with no end time
- **THEN** the total is 5 hours and the status is `partial`

### Requirement: Single shared implementation

The day-status rules SHALL be exported from the shared contracts package and consumed by every surface that displays day status. No consumer SHALL reimplement the thresholds, the midnight-crossing rule, or the local-date bucketing.

#### Scenario: Quota bar and monthly calendar agree

- **WHEN** the daily quota bar and the monthly calendar are given the same day's entries and absences
- **THEN** both display the same status
