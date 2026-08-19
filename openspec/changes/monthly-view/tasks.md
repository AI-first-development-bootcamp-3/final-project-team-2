# Tasks: monthly-view

Every implementation task is TDD (red-green-refactor): the ".a" task writes failing tests pinned to the spec scenario, the ".b" task makes them pass, refactor before checking off. Run the apply phase under `/tdd`.

## 1. Branch and contract

- [x] 1.1 Branch `feat/kan-80-month-query` off the stack tip `feat/kan-79-edit-delete`; note the re-target-to-`dev` follow-up for when the stack merges (worktree at `.claude/worktrees/kan-80-month-query`; main tree keeps the uncommitted Figma work)
- [x] 1.2a RED: `packages/contracts` — failing zod tests for `MonthQueryResponse`: entries (startAt/endAt, duration, client/project/task names, location, description), absences (`DayStatusAbsence`-compatible, required key), lock `{ isLocked, lockedAt: string | null }`; reject a payload missing the absences key
- [x] 1.2b GREEN: implement `MonthQueryResponse` schema + types in `packages/contracts`, exported beside `day-status` (reuses `TimeEntryListItemSchema` — entries shape identical to the daily read)

## 2. Month query API (KAN-80)

- [x] 2.1a RED: failing unit tests for the month→local-date-range helper (`monthDateRange(year, month)` → first/last `YYYY-MM-DD`), covering 31/30-day months, February, and a leap-year February (revised: entries store the VAL-38 local start day in the `date` column, so no DST/UTC conversion exists — see design decision 4)
- [x] 2.1b GREEN: implement the helper in the new `server/api/src/modules/months/` module
- [x] 2.2a RED: failing service tests — month with data returns entries + empty absences + lock; empty month returns empty collections not an error; entries scoped to the requesting user only; deleted client/project/task names still present (denormalized); lock reflects MonthLock (no row → open, `is_locked` → locked with timestamp)
- [x] 2.2b GREEN: implement `MonthsService.getMonth(userId, year, month)` delegating to `TimeEntriesService.list` + new `MonthLockService.getLockStatus` (stale `locked_at` on reopened rows is not leaked)
- [x] 2.3a RED: failing controller/e2e-style tests — `GET /api/v1/months/:year/:month` requires auth (mocked guard refuses; real 401 proven in the auth suite), validates year/month params, returns the contract shape, employee-only (admin refused per ADR-26)
- [x] 2.3b GREEN: implement the controller with guard wiring and Swagger annotations, matching the repo's existing module conventions; `MonthsModule` registered in `AppModule`; `TimeEntriesService` exported for delegation

## 3. Calendar grid screen (KAN-81)

- [x] 3.1a RED: failing component tests for the calendar grid — Sunday-first layout, RTL, cells colored via `computeDayStatus` including exactly-9h FULL, >9h EXCESS, and an absence-covered day (fixture absences through the contracts types)
- [x] 3.1b GREEN: implement `CalendarGrid` (pure component) in `apps/mobile/src/features/monthly/`
- [x] 3.2a RED: failing tests for month navigation — opens on current Asia/Jerusalem month, back/forward, future month renders all-EMPTY without error, December→January year rollover
- [x] 3.2b GREEN: implement `MonthlyPage` with navigation state + query refetch
- [x] 3.3a RED: failing tests for loading and empty-month states
- [x] 3.3b GREEN: implement both states

## 4. Day drill-down (KAN-82)

- [x] 4.1a RED: failing tests — tapping a day lists its entries (time range, duration, client/project/task, location, description) in Asia/Jerusalem times; midnight-crossing entry listed on start day only; deleted catalog names render
- [x] 4.1b GREEN: implement drill-down (`DayDetail`, filtered by the stored VAL-38 `date` column)
- [x] 4.2a RED (after KAN-73 merges): failing test — editing an entry from the drill-down opens the standard entry form and a save that crosses the 9h boundary updates the calendar cell to FULL without manual refresh (revised on port: each drill-down entry links to the merged `/entry/:id` form; the monthly page refetches on remount, tested as a navigate-away-and-back round-trip)
- [x] 4.2b GREEN: wire the edit round-trip (refetch on mount covers the return from the edit form)

## 5. Locked-month read-only (KAN-83)

- [x] 5.1a RED: failing tests — locked month shows `LockStatusIndicator` (year, month, lockedAt) + read-only banner; drill-down renders entries with no edit/delete/create affordances; open month unaffected
- [x] 5.1b GREEN: implement `LockStatusIndicator` and the read-only gating driven by the month query's lock status

## 6. Playwright e2e (KAN-84)

- [ ] 6.1 Seed fixtures: a month containing an exactly-9h day, an EXCESS day, and a PARTIAL day (revised on port: `server/api/prisma/seed.ts` on the current base already seeds a locked 2026-07 and an absence for employee2 on 2026-08-13, so both the locked-month and absence cases ARE covered end-to-end against the seed; Epics 9/7 replace the seed dependency with real writes). Status seeding is written into the spec itself (admin console + API); PENDING EXECUTION against a live stack running this branch
- [ ] 6.2 e2e spec: calendar renders the seeded statuses; drill-down lists the seeded entries with an edit link; seeded absence day renders ABSENCE; seeded locked month is read-only with the lock indicator (written as `e2e/specs/monthly-view.spec.ts`; PENDING EXECUTION — to be run by the orchestrator)

## 7. Wrap-up

- [ ] 7.1 Full test suites green — unit suites after the port onto the current base are: contracts 318, api 366, mobile 82; lint/typecheck/build pass. OPEN: the e2e run (see 6.2)
- [x] 7.2 Jira updated: KAN-80/81/83 → In Review, KAN-82/84 → In Progress; draft PR #72 opened onto `feat/kan-79-edit-delete` (ticket keys in the PR title/commits for the Jira link)
- [ ] 7.3 If the time-entry stack merged mid-work: re-target branches to `dev` and drop the stacking note
