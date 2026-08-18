# entity-e2e Specification

## Purpose

End-to-end Playwright test covering the full entity catalog chain: admin creates client, project, task, assigns employee, and the employee picker endpoint returns the chain.

## Requirements

### Requirement: Full catalog chain e2e test

A Playwright e2e spec SHALL verify the complete entity management flow from creation through to employee picker visibility.

#### Scenario: Admin creates full entity chain via console UI

- **WHEN** an admin logs into the admin console and creates a client, then a project under that client, then a task under that project, then assigns an employee to that task
- **THEN** all four entities SHALL be created successfully and visible in their respective admin tables

#### Scenario: Employee picker reflects assignment

- **WHEN** the admin has created a client > project > task chain and assigned an employee
- **THEN** a `GET /api/v1/me/assignments` call authenticated as that employee SHALL return exactly that chain (clientName, projectName, taskName)

#### Scenario: E2e runs in CI

- **WHEN** the CI pipeline runs the e2e test suite
- **THEN** this spec SHALL execute as part of the required e2e check and its pass/fail status SHALL gate the pipeline
