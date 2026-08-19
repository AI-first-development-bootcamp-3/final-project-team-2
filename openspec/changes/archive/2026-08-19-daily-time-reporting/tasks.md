## 1. Shared day-status rules (KAN-74) — land first, Monthly View depends on it

- [x] 1.1 Add `packages/contracts/src/day-status/local-date.ts`: Asia/Jerusalem helpers built on `Intl.DateTimeFormat` — local `YYYY-MM-DD` for a UTC instant, and local-date equality. No new dependency (D3).
- [x] 1.2 Unit-test `local-date.ts`: an instant whose UTC date differs from its Asia/Jerusalem date, and both Israeli DST transition dates.
- [x] 1.3 Add `packages/contracts/src/day-status/day-status.ts` exporting the `DayStatus` values `empty` / `partial` / `full` / `excess` / `absence`, `minutesForDay`, and `computeDayStatus({ entries, absences })` returning status plus total minutes. Accumulate whole minutes and compare against `540` (D1, D2). Absence wins over hour count but the total is still returned (D4).
- [x] 1.4 Attribute each entry to its local start day and skip entries with no end time (D7); a night shift counts entirely on the day it started.
- [x] 1.5 Unit-test every boundary from `specs/day-status/spec.md`: 0h, 8h59, exactly 9h, 9h01, absence with and without hours, absence with an empty array, 22:00–06:00 attribution to the start day, and a day holding only a running entry.
- [x] 1.6 Export the day-status surface from `packages/contracts/src/index.ts`.
- [x] 1.7 Verify `pnpm --filter @abra/contracts test:coverage` passes the 70% gate.

## 2. Time-entry contracts (KAN-76)

- [x] 2.1 Add `packages/contracts/src/time-entries/create.ts`: `CreateTimeEntryBodySchema` covering `taskId`, `date`, `startAt`, `endAt`, `location`, optional `description`, carrying `VAL-30` / `VAL-31` / `VAL-35` / `VAL-36` / `VAL-38` as issue messages in the `CreateTaskBodySchema` style.
- [x] 2.2 Enforce VAL-31 (end strictly after start, midnight crossing allowed) and VAL-38 (`date` equals the local start day) as cross-field refinements, reusing the helpers from task 1.1.
- [x] 2.3 Add `packages/contracts/src/time-entries/update.ts` (`UpdateTimeEntryBodySchema`, all fields optional, same rules when present) and `list.ts` (single-date and date-range query schemas, `TimeEntryListItemSchema` with denormalised task, project, and client names per D10).
- [x] 2.4 Extend the `ValCode` union and `VAL_MESSAGES` in `index.ts` with Hebrew messages for `VAL-30` through `VAL-38` (D9).
- [x] 2.5 Export the time-entry schemas and types from `packages/contracts/src/index.ts`.
- [x] 2.6 Unit-test each rule's code and each accepted edge case: night shift, one-minute entry, end equal to start rejected, `date` disagreeing with `startAt` rejected.

## 3. Enforcement seams (KAN-77)

- [x] 3.1 Add `assertUserAssignedToTask(userId, taskId)` — throws forbidden with `VAL-33` when no `TaskAssignment` row exists (§8.2).
- [x] 3.2 Add `assertMonthNotLocked(year, month)` reading `MonthLock`: no row is open, `is_locked: true` is locked, `is_locked: false` is reopened. Throws forbidden with `VAL-34` (D5).
- [x] 3.3 Unit-test both guards, including the reopened-month case and the pass-through case where no lock row exists.
- [x] 3.4 Add `packages/contracts/src/time-entries/overlap.ts`: a pure `intervalsOverlap` / `findOverlap` comparison using `newStart < existingEnd && existingStart < newEnd`, skipping entries with no end time (D6, D7).
- [x] 3.5 Unit-test the overlap comparison across the full matrix — contained, containing, partial-left, partial-right, touching boundaries allowed, 22:00–06:00 vs 05:00–07:00 in both insertion orders.

## 4. Time-entries API: create and read (KAN-77)

- [x] 4.1 Scaffold `server/api/src/modules/time-entries/` (module, controller, service) following the tasks module; guard with `JwtGuard` + `RolesGuard` and `@Roles('employee')`; register in `app.module.ts`.
- [x] 4.2 Implement `POST /api/v1/time-entries`: validate through the zod pipe, force ownership to the JWT `userId`, then call `assertUserAssignedToTask` and `assertMonthNotLocked` before writing.
- [x] 4.3 Implement `GET /api/v1/time-entries` for a single date and for a date range, scoped to the caller, returning denormalised task, project, and client names (D10).
- [x] 4.4 Confirm reads and writes are rejected for the admin role and for unauthenticated requests.
- [x] 4.5 Document every endpoint in Swagger with request and response schemas and the bearer requirement.
- [x] 4.6 Test create and read against the scenarios in `specs/time-entries-api/spec.md`: ownership cannot be forged, another employee's entries are never returned, multiple entries per day, locked-month write refused but read allowed, historical entries still render after their task is closed.

### Review follow-ups (PR #54)

- [x] 4.7 Add `assertTaskAvailableForReporting` — assignment _plus_ the catalogue state `GET /me/assignments` filters on (task open and not deleted, project and client active and not deleted, `report_type = TOTAL_HOURS`), throwing forbidden with the new `VAL-33A`. `TaskAssignment` is never soft-deleted, so existence alone let a direct call write against dead or punch-clock work (D9). Applied to create and to an edit that changes the task; an edit that keeps its task stays on plain `VAL-33` so an entry can still be corrected after its task closes.
- [x] 4.8 Validate list query dates as real calendar days, not just `YYYY-MM-DD` shape — `2026-13-01` reached Prisma as an Invalid Date (500) and `2026-02-30` silently answered about March 2. Shared `isCalendarDate` now backs the list query, `TimeEntryDateSchema`, and `toYearMonth`.
- [x] 4.9 Cap the list range at `MAX_TIME_ENTRY_RANGE_DAYS` (366) in the query schema — the response is deliberately unpaged, so the range width is what bounds it.
- [x] 4.10 Accept `description: null` on create, matching the read shape and the update body, so an entry read back can be posted again.

## 5. Overlap enforcement in the API (KAN-78)

- [x] 5.1 In the service, fetch overlap candidates for the user with a start-time window widened by one day on each side of the candidate interval; name and comment the widening constant (D6).
- [x] 5.2 Reject overlapping writes with `VAL-32` via the pure comparison from task 3.4; exclude the entry being edited from its own candidate set.
- [x] 5.3 Unit-test overlap with a mocked Prisma client, including both night-shift orderings, an adjacent (touching) entry accepted, an overlap with another user's entry accepted, and an overlap with a soft-deleted entry accepted. _(Reworded from "integration-test against the database": no DB-backed test was delivered, so the soft-delete extension's filtering is asserted through the query the service builds, not through a real row. See 9.7.)_
- [x] 5.4 Add the guard test asserting the candidate window's documented bound.

## 6. Time-entries API: edit and delete (KAN-79)

- [x] 6.1 Implement `PATCH /api/v1/time-entries/:id`: owner only, re-running VAL-31, VAL-32, and VAL-33 on the updated values.
- [x] 6.2 Call `assertMonthNotLocked` for both the entry's existing month and its target month, so an edit cannot move an entry across a lock boundary (D5).
- [x] 6.3 Implement `DELETE /api/v1/time-entries/:id`: owner only, month open. Deletion is soft via the existing Prisma extension — no new delete logic.
- [x] 6.4 Return not-found for an unknown entry and reject any attempt to edit or delete another user's entry, without revealing that it exists.
- [x] 6.5 Unit-test edit and delete with a mocked Prisma client: valid edit, edit creating an overlap, edit onto an unassigned task, edit and delete refused in a locked month, deleted entries excluded from reads, totals, and overlap checks while the row is retained. _(Same rewording as 5.3 — the exclusion of deleted rows is asserted at the query, not against the database.)_
- [x] 6.6 Verify `pnpm --filter @abra/api test:coverage` passes the 70% gate.

### Review follow-ups (PR #57 and #58)

- [x] 6.6 Enforce VAL-32 in the database with a Postgres exclusion constraint (`20260819140000_time_entry_no_overlap`), and translate its violation into the same 409. The check was a read followed by an unguarded write, so two concurrent requests both passed it — a double-clicked submit stored the day twice and broke an invariant every later read assumes, with no repair path.
- [x] 6.7 Replace the ±1-day overlap candidate window with a direct predicate. Nothing caps entry duration, so a 48-hour entry fell outside its own candidate set and a request landing inside it was accepted with a 201.
- [x] 6.8 Scope the update write by owner and liveness (`updateMany` on `{id, user_id, deleted_at: null}`). The soft-delete extension rewrites reads and deletes but not updates, so a row deleted between the check and the write was silently mutated and answered 200.
- [x] 6.9 Reject a route id that is not a UUID as 404. `TimeEntry.id` is `@db.Uuid`, so a malformed value raised Prisma P2023 and, with nothing mapping Prisma errors, surfaced as a 500 where both endpoints document a 404.
- [x] 6.10 Extract `zodIssuesToHebrewDetails` and `valDetail` into contracts and delete the six duplicated `hebrewDetails` copies plus the four hand-assembled single-rule envelopes, so a change to the payload shape cannot reach one endpoint and miss another.
- [x] 6.11 Reword tasks 5.3 and 6.5 to describe the mocked unit tests actually delivered, and add 9.7/9.8 for the database-backed coverage they claimed.

## 7. Entry form (KAN-73)

- [x] 7.1 Delete `apps/mobile/src/features/time-entries/task-picker.tsx` and its spec; its `filterOpenAssignments` predicates are unconditionally true and the API already filters closed and deleted rows (D8).
- [x] 7.2 Add an assignments hook fetching `GET /me/assignments` once through `authFetch`, exposing loading, error, and empty states.
- [x] 7.3 Build the cascading Client → Project → Task picker by grouping that one response; changing the client clears the project and task selections; offer only `TOTAL_HOURS` projects (D8).
- [x] 7.4 Build `EntryForm` with a `mode` prop serving `/entry/new` and `/entry/:id`, using `react-hook-form` with the zod resolver over the contracts schemas: start and end times, location from office / client site / home, optional description. An end time earlier in the clock than the start is submitted as the following day.
- [x] 7.5 Convert between the Asia/Jerusalem values shown to the employee and the UTC instants sent to the API, deriving `date` with the shared helper so VAL-38 is satisfied (D3).
- [x] 7.6 Render server `details[]` against their fields in Hebrew from `VAL_MESSAGES`, preserving entered values on rejection (D9).
- [x] 7.7 Render read-only with no save action when the entry's month is locked.
- [x] 7.8 Component-test the scenarios in `specs/daily-reporting-ui/spec.md`: picker scoping, cascade reset, closed and deactivated work hidden, no-assignments state, clock-in/clock-out project excluded, night-shift entry, overlap message shown against its field, read-only locked mode, edit mode pre-filled.

## 8. Daily report screen (KAN-72)

- [x] 8.1 Replace `DashboardPlaceholder` in `apps/mobile/src/App.tsx` with the daily report at `/`, and add the `/entry/new` and `/entry/:id` routes behind `ProtectedRoute`.
- [x] 8.2 Build the entries list for today at 393px RTL: time range, task, project, client, location, description, with edit and delete actions per row.
- [x] 8.3 Build the quota bar consuming `computeDayStatus` from contracts — never its own thresholds — showing total hours against the 9-hour target, styled per status, and updating after every add, edit, or delete. Pass `absences: []` for now (D4).
- [x] 8.4 Implement the empty, loading, error, and month-locked states; in a locked month show the entries, mark the month closed, and withhold add, edit, and delete.
- [x] 8.5 Add delete confirmation, refreshing the list and quota bar on success.
- [x] 8.6 Component-test the quota bar across all five statuses including exactly 9h, plus each screen state and the confirm-versus-dismiss delete paths.
- [x] 8.7 Verify `pnpm --filter @abra/mobile test:coverage` passes the 70% gate.

## 9. End-to-end (KAN-75)

- [x] 9.1 Extend `prisma/seed.ts` with a task the seeded employee is **not** assigned to, and a locked month placed well away from the seeded working week and the current month (Migration Plan).
- [x] 9.2 Add `e2e/specs/daily-reporting.spec.ts`: the seeded employee signs in, creates an entry through the picker, and sees it in the list with the quota bar updated.
- [x] 9.3 Assert the unassigned task never appears in the picker.
- [x] 9.4 Assert an edit and a delete both round-trip.
- [x] 9.5 Assert a write into the locked month is refused with 403 and the screen shows the locked state, scoping assertions to entries dated inside that month.
- [x] 9.6 Confirm the spec runs in the required CI e2e job.
- [x] 9.7 Cover the soft-delete extension against a real database, since 5.3 and 6.5 assert it only through the queries the service builds: delete an entry, re-report the same slot, and confirm it is accepted rather than refused with VAL-32. An extension refactor or a Prisma upgrade that changed operation names would otherwise put deleted rows back in the overlap set with every test still green.
- [x] 9.8 Cover the `time_entries_no_overlap` exclusion constraint against a real database: two concurrent writes for the same slot, one accepted and one answered with VAL-32.

## 10. Close out

- [x] 10.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, and `pnpm build` across the workspace.
- [x] 10.2 Verify each requirement in the three delta specs against the running system on `dev`, both apps.
- [x] 10.3 Move KAN-71 through KAN-79 to Done and close the KAN-64 epic; close the subtasks rather than leaving them dangling under completed parents.
- [x] 10.4 Run `/opsx:sync` to fold `day-status`, `time-entries-api`, and `daily-reporting-ui` into `openspec/specs/`, then `/opsx:archive` this change.
