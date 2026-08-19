# Design: monthly-view

## Context

See `proposal.md` — Why. Current state that shapes the design:

- `packages/contracts` (PR #49, `feat/kan-74-day-status`) already ships `computeDayStatus`, `DayStatusEntry`, `DayStatusAbsence`, `minutesForDay`, and the Asia/Jerusalem `local-date` helpers. The rules are complete — including absence coverage and the exactly-540-minutes FULL boundary — and are deliberately client-consumable (tolerant of string dates, no server-only deps).
- `server/api/src/modules/time-entries/` (stack tip `feat/kan-79-edit-delete`) already has `MonthLockService` with real read semantics against a `MonthLock` table (no row → open), plus the time-entries Prisma model and assignment scoping.
- Absences do not exist anywhere yet (Epic 7 is backlog).
- The employee app is `apps/mobile`; its entry edit form (Epic 5, KAN-73) is in review on its own branch.

## Goals / Non-Goals

**Goals**

- A single read endpoint the monthly screen can render from, shaped so Epic 7 (absences) and Epic 9 (lock writes) plug in without contract changes.
- Day-status truth stays in `@abra/contracts` — one implementation, exercised by both the daily quota bar and the monthly calendar.
- Test-first throughout: every task below starts from a failing test (red-green-refactor; run the implementation under `/tdd`).

**Non-Goals**

- No absence model, endpoints, or UI (Epic 7).
- No lock/unlock writes, warnings, or admin screens (Epic 9).
- No changes to DayStatus rules or month-lock enforcement — this change only consumes them.
- No punch-clock/running-timer treatment beyond what `computeDayStatus` already does (running entries contribute 0 minutes).

## Decisions

1. **Endpoint: `GET /api/v1/months/:year/:month`, new `months` module.**
   A neutral resource name because the response is not just time entries — it aggregates entries + absences + lock. Living beside (not inside) `time-entries` keeps that module write-focused; the months module injects `MonthLockService` and the Prisma client directly.
   _Alternative rejected:_ `GET /time-entries?month=...` — wrong home once absences join the payload, and it invites clients to assemble months from parts.

2. **Day statuses computed client-side; the API returns raw data.**
   The screen needs the raw entries anyway (drill-down lists them), so shipping statuses from the server would duplicate data the client can derive in one pure call. `computeDayStatus` was written for exactly this consumption.
   _Alternative rejected:_ server-computed statuses — a second serialization of the same truth, and every rule tweak would need an API deploy.

3. **Response schema lives in `packages/contracts` as `MonthQueryResponse` (zod).**
   Entries carry what `DayStatusEntry` + the drill-down need: `startAt`, `endAt`, duration, client/project/task **names** (denormalized at query time so soft-deleted rows still render, §8.3), location, description. Absences are typed as the existing `DayStatusAbsence` shape (`startDate`/`endDate`, room for Epic 7 to extend additively). Lock is `{ isLocked: boolean, lockedAt: string | null }`.

4. **Month boundaries: convert the Asia/Jerusalem month to a UTC instant range server-side.**
   Query `startAt >= utc(monthStart 00:00 local)` and `< utc(nextMonthStart 00:00 local)`, DST-aware (Israel observes DST — do not hardcode +02/+03). Attribution-by-start (VAL-38) then falls out of the query itself; no post-filtering.
   _Alternative rejected:_ fetch a padded range and filter by `toLocalDateOrNull` in JS — correct but hides the contract in app code; the boundary conversion is small and testable on its own.

5. **Branch from the stack tip (`feat/kan-79-edit-delete`).**
   Everything this change reads lives on the stack. Re-target to `dev` when the stack merges. KAN-82's edit round-trip additionally reuses the Epic 5 entry form (KAN-73 branch, in review) — sequence the client tasks so the calendar/drill-down _view_ ships first and the edit hook-up lands once KAN-73 merges, rather than stacking on two review branches at once.

6. **e2e absence coverage deferred to unit level.**
   KAN-84's absence-day case can't be seeded end-to-end before Epic 7 (no absence writes exist). The ABSENCE rendering is proven at component level with fixture data through `computeDayStatus`; the e2e spec gains the absence case when Epic 7 lands (noted in that epic's DoD).

## Risks / Trade-offs

- [Stack rebase churn — #49–#58 are still moving under review] → the change is read-only over those modules; rebases touch imports, not logic. Propagate bottom-up as with the auth stack.
- [KAN-73 (entry form) unmerged blocks the edit round-trip] → task ordering isolates it: KAN-82's _view_ half has no dependency; the edit hook-up is the last client task and can wait for the merge.
- [DST boundary bugs in the UTC range conversion] → dedicated unit tests pinned to the two Israeli DST transition months, written first (red) before the conversion exists.
- [Future absence shape diverges from `DayStatusAbsence`] → Epic 7 extends the contract additively; `computeDayStatus` only reads `startDate`/`endDate`, so extensions cannot break status computation.

## Migration Plan

No data migration (the `MonthLock` table already exists on the stack; this change adds no tables). Deploy is additive: new endpoint + new screen. Rollback = revert; nothing depends on the new surface.

## Open Questions

- Exact Figma color tokens per status for the calendar cells (מסך ראשי frame) — resolvable during KAN-81 implementation without affecting specs or tasks.
- Whether forward navigation should cap at some horizon (spec says future months are navigable and empty; an unbounded cap is fine for MVP).
