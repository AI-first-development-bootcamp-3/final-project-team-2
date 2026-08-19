# Proposal: monthly-view

## Why

Epic 6 (KAN-65, Confluence "Epic 6 Spec - Monthly View") gives an employee their whole month at a glance — which days are full, partial, missing or absent — with drill-down into any day to view and fix its entries; per ADR-14 this screen doubles as היסטוריית דיווחים (report history). All five stories (KAN-80–KAN-84) are To Do, and the prerequisites just landed on the time-entry stack: the shared DayStatus rules ship in `packages/contracts` (PR #49, KAN-74) and `MonthLockService` already answers `isMonthLocked` against a real `MonthLock` table (PR #58 tip). Building now, against those, means no rework when Epics 7/9 arrive.

## What Changes

- **Month query API (KAN-80)** — one authenticated endpoint returning everything the screen needs for a `(year, month)`: the employee's time entries for that month (attributed by start instant, VAL-38), absences overlapping it, and the month's lock status. Lock status is real (`MonthLockService`); **absences are an empty array until Epic 7 ships the absence model** — the response shape includes them from day one so Epic 7 fills data in without changing the contract.
- **Calendar grid screen `/monthly` (KAN-81)** — employee app (393px RTL, week starts Sunday). Each day cell is colored by `computeDayStatus` from `@abra/contracts` — computed client-side, never stored; the API response stays raw data. Month back/forward navigation, current month default, future months navigable but empty. States: default, loading, empty-month, month-locked.
- **Day drill-down (KAN-82)** — tapping a day lists its entries (same data contract as the home screen's EntriesTable: time range, duration, client/project/task, location, description); editing opens Epic 5's standard entry form and round-trips back to an updated calendar. Historical entries render names of since-deleted clients/projects/tasks (§8.3).
- **Locked-month read-only (KAN-83)** — a locked month renders a read-only banner via a `LockStatusIndicator` (year, month, isLocked, lockedAt) and hides all write affordances; lock status stays readable per §7.1.
- **Playwright e2e (KAN-84)** — statuses proven on a seeded month (exactly-9h FULL, EXCESS, absence-covered once Epic 7 exists — until then the absence case is covered at unit level via the contracts fixture), drill-down edit round-trip, locked-month read-only.
- **Timezone rules throughout**: display timezone Asia/Jerusalem, month boundaries per local dates, midnight-crossing entries belong to the day they started (VAL-38) — all already encoded in `computeDayStatus`/`local-date` from PR #49; this change consumes them, never re-implements them.

## Capabilities

### New Capabilities

- `month-query-api`: the API contract for fetching one month of an employee's reporting data — entries, absences, and lock status in a single response.
- `monthly-view`: the employee-facing monthly calendar screen — day statuses, month navigation, day drill-down with edit round-trip, and locked-month read-only behavior.

### Modified Capabilities

<!-- none — DayStatus rules (contracts) and month-lock enforcement are owned by the time-entry stack's tickets; this change only consumes them -->

## Impact

- **Depends on the unmerged time-entry stack** (#49 → #54 → #57 → #58): `computeDayStatus`, the time-entries module, and `MonthLockService` all live there. Branch strategy: branch from the stack tip (`feat/kan-79-edit-delete`) and re-target to `dev` once the stack merges — or start after the merge if it lands first. This is the same stacking pattern the auth work used; the risk is bounded because this change only *reads* those modules.
- **Code**: `server/api/src/modules/` (new month-query endpoint beside time-entries), `packages/contracts/src/` (month query response schema), `apps/mobile/src/features/` (monthly screen, drill-down, LockStatusIndicator), `e2e/specs/` (+ seeded fixtures).
- **Implementation discipline**: TDD throughout (red-green-refactor) — each task starts from a failing test; the DoD in the epic spec is already phrased as test cases.
- **Risk**: low-medium — new read-only surface; no writes, no schema migrations (MonthLock table already exists on the stack). The absence stub is contract-shaped, so Epic 7 is additive.
