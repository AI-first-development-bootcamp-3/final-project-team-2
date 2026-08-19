## MODIFIED Requirements

### Requirement: Absence precedence

A day covered by a **full-day** absence SHALL be reported as `absence` regardless of its hour total, so that an absence is never displayed as an unreported day. A **half-day** absence SHALL NOT claim the day; instead it reduces the day's expected hours (see the new requirement below), so the employee is still prompted for the hours they owe.

#### Scenario: Full-day absence with no entries

- **WHEN** a day is covered by a full-day absence and has no time entries
- **THEN** the status is `absence`, not `empty`

#### Scenario: Full-day absence alongside reported hours

- **WHEN** a day is covered by a full-day absence and also has time entries totalling 4 hours
- **THEN** the status is `absence` and the total hours are still reported as 4

#### Scenario: No absence data supplied

- **WHEN** the computation is given an empty set of absences
- **THEN** classification proceeds on hours alone, `absence` is never returned, and the day's target is nine hours

#### Scenario: Half-day absence does not yield absence status

- **WHEN** a day is covered by a single half-day absence
- **THEN** the status is not `absence`; the day is classified on its hours against the reduced target

## ADDED Requirements

### Requirement: A half-day absence halves the day's expected hours

A day covered by one half-day absence SHALL have an expected total of 4 hours 30 minutes rather than 9 hours, and SHALL be classified against that reduced target using the same four hour-based statuses. The computation SHALL report the day's target alongside its total.

#### Scenario: Half day with nothing reported

- **WHEN** a day has one half-day absence and no time entries
- **THEN** the status is `empty`, the total is 0 hours, and the target is 4 hours 30 minutes

#### Scenario: Half day partially reported

- **WHEN** a day has one half-day absence and entries totalling 2 hours
- **THEN** the status is `partial` and the target is 4 hours 30 minutes

#### Scenario: Half day fully reported

- **WHEN** a day has one half-day absence and entries totalling exactly 4 hours 30 minutes
- **THEN** the status is `full`

#### Scenario: Half day over-reported

- **WHEN** a day has one half-day absence and entries totalling 6 hours
- **THEN** the status is `excess`

#### Scenario: Half day just below its boundary

- **WHEN** a day has one half-day absence and entries totalling 4 hours 29 minutes
- **THEN** the status is `partial` and not `full`

#### Scenario: Target reported on an ordinary day

- **WHEN** a day has no absence
- **THEN** the target is 9 hours

#### Scenario: Target reported on a full-day absence

- **WHEN** a day is covered by a full-day absence
- **THEN** the status is `absence` and the target is 0

#### Scenario: The period does not affect the target

- **WHEN** one day has a `morning` half-day absence and another has an `afternoon` half-day absence, both with 2 hours reported
- **THEN** both are `partial` against a 4 hour 30 minute target

### Requirement: Two half-day absences cover the day

A day covered by two half-day absences SHALL be reported as `absence`, since the two halves together account for the whole day.

#### Scenario: Morning and afternoon half days

- **WHEN** a day is covered by both a morning and an afternoon half-day absence
- **THEN** the status is `absence` and the target is 0

### Requirement: A full-day absence outranks a half-day one

When a day is covered by both a full-day and a half-day absence, the full-day absence SHALL determine the outcome.

#### Scenario: Full day and half day on the same date

- **WHEN** a day is covered by a full-day absence and also by a half-day absence
- **THEN** the status is `absence` and the target is 0
