# Spec Delta: Employee Report Flow Switch

<!-- Moved verbatim from the project-report-type change's delta: the flow
     switch was specified there but never implemented (PR #43 review
     finding), so the requirement travels with this deferred change. -->

## ADDED Requirements

### Requirement: Employee App Flow Switch by Report Type

The employee application SHALL inspect the `reportType` of the selected task's project when rendering time entry reporting UI.

- If `reportType === 'TOTAL_HOURS'`, the employee app SHALL present the manual total-hours entry form.
- If `reportType === 'CLOCK_IN_OUT'`, the employee app SHALL present the punch-clock timer UI.

#### Scenario: Employee opens time reporting for a project with TOTAL_HOURS report type

- **WHEN** employee selects a task belonging to a project with `reportType = 'TOTAL_HOURS'`
- **THEN** employee app displays the manual hours entry form.

#### Scenario: Employee opens time reporting for a project with CLOCK_IN_OUT report type

- **WHEN** employee selects a task belonging to a project with `reportType = 'CLOCK_IN_OUT'`
- **THEN** employee app displays the clock-in / clock-out timer interface.
