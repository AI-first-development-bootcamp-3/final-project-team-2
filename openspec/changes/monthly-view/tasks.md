# Tasks: monthly-view

Every implementation task is TDD (red-green-refactor): the ".a" task writes failing tests pinned to the spec scenario, the ".b" task makes them pass, refactor before checking off. Run the apply phase under `/tdd`.

## 1. Branch and contract

- [ ] 1.1 Branch `feat/kan-80-month-query` off the stack tip `feat/kan-79-edit-delete`; note the re-target-to-`dev` follow-up for when the stack merges
- [ ] 1.2a RED: `packages/contracts` — failing zod tests for `MonthQueryResponse`: entries (startAt/endAt, duration, client/project/task names, location, description), absences (`DayStatusAbsence`-compatible, defaults to empty array), lock `{ isLocked, lockedAt: string | null }`; reject a payload missing the absences key
- [ ] 1.2b GREEN: implement `MonthQueryResponse` schema + types in `packages/contracts`, exported beside `day-status`

## 2. Month query API (KAN-80)

- [ ] 2.1a RED: failing unit tests for the Asia/Jerusalem month→UTC range conversion, including both Israeli DST transition months and a midnight-crossing entry that starts on the month's last local day (belongs to this month, not the next)
- [ ] 2.1b GREEN: implement the boundary conversion in the new `server/api/src/modules/months/` module
- [ ] 2.2a RED: failing service tests — month with data returns entries + empty absences + lock; empty month returns empty collections not an error; entries scoped to the requesting user only; deleted client/project/task names still present (denormalized); lock reflects MonthLock (no row → open, `is_locked` → locked with timestamp)
- [ ] 2.2b GREEN: implement `MonthsService.getMonth(userId, year, month)` using Prisma + `MonthLockService`
- [ ] 2.3a RED: failing controller/e2e-style tests — `GET /api/v1/months/:year/:month` requires auth (401 bare), validates year/month params, returns the contract shape
- [ ] 2.3b GREEN: implement the controller with `@Auth()` guard wiring and Swagger annotations, matching the repo's existing module conventions

## 3. Calendar grid screen (KAN-81)

- [ ] 3.1a RED: failing component tests for the calendar grid — Sunday-first layout, RTL, cells colored via `computeDayStatus` including exactly-9h FULL, >9h EXCESS, and an absence-covered day (fixture absences through the contracts types)
- [ ] 3.1b GREEN: implement `/monthly` calendar grid in `apps/mobile` consuming the month query
- [ ] 3.2a RED: failing tests for month navigation — opens on current Asia/Jerusalem month, back/forward, future month renders all-EMPTY without error
- [ ] 3.2b GREEN: implement month navigation state + query refetch
- [ ] 3.3a RED: failing tests for loading and empty-month states
- [ ] 3.3b GREEN: implement both states

## 4. Day drill-down (KAN-82)

- [ ] 4.1a RED: failing tests — tapping a day lists its entries (time range, duration, client/project/task, location, description) in Asia/Jerusalem times; midnight-crossing entry listed on start day only; deleted catalog names render
- [ ] 4.1b GREEN: implement drill-down using the home screen's entries-list contract
- [ ] 4.2a RED (after KAN-73 merges): failing test — editing an entry from the drill-down opens the standard entry form and a save that crosses the 9h boundary updates the calendar cell to FULL without manual refresh
- [ ] 4.2b GREEN: wire the edit round-trip (query invalidation on save)

## 5. Locked-month read-only (KAN-83)

- [ ] 5.1a RED: failing tests — locked month shows `LockStatusIndicator` (year, month, lockedAt) + read-only banner; drill-down renders entries with no edit/delete/create affordances; open month unaffected
- [ ] 5.1b GREEN: implement `LockStatusIndicator` and the read-only gating driven by the month query's lock status

## 6. Playwright e2e (KAN-84)

- [ ] 6.1 Seed fixtures: a month containing an exactly-9h day, an EXCESS day, a PARTIAL day, and a locked prior month (MonthLock row) — absence-day case stays at component level until Epic 7 (design decision 6)
- [ ] 6.2 e2e spec: calendar renders the seeded statuses; drill-down lists the seeded entries; edit round-trip updates the calendar; locked month is read-only with the lock indicator

## 7. Wrap-up

- [ ] 7.1 Full test suites green (`packages/contracts`, `server/api`, `apps/mobile`, e2e); lint + build pass
- [ ] 7.2 Move KAN-80–KAN-84 through In Progress → In Review as PRs open; link PRs to tickets
- [ ] 7.3 If the time-entry stack merged mid-work: re-target branches to `dev` and drop the stacking note
