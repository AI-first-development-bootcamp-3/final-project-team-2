## Context

See `proposal.md` — Why. What shapes the approach:

- **The schema is already complete.** `TimeEntry`, `MonthLock`, `Absence`, and `TaskAssignment` all exist. `TimeEntry.end_at`, `task_id`, and `location` are nullable, which is what makes a running timer expressible later without a migration. `TimeEntry` is already listed in `SOFT_DELETE_MODELS`, so the Prisma extension converts deletes to `deleted_at` writes and filters reads automatically. No migration in this change.
- **`GET /me/assignments` already returns the picker's exact shape** — `{ taskId, taskName, projectId, projectName, clientId, clientName, reportType }` — already filtered to open tasks under active projects under active clients.
- **Three rules reach into epics that are still in the backlog**: month lock (Month Close), absence coverage (Absences), running timers (Punch Clock). This design decides how each seam is shaped so those epics extend rather than rewrite.
- **Established patterns to follow, not reinvent**: zod schemas in `packages/contracts` carrying `VAL-*` codes as issue messages; `zodIssuesToDetails` mapping them into the `ApiError` envelope; NestJS module/controller/service triples guarded by `JwtGuard` + `RolesGuard`; plain `fetch` through `authFetch` in the apps, with `react-hook-form` for forms. No state-management or data-fetching library is in use anywhere in the repo.
- **CI enforces 70% coverage** on lines, branches, functions, and statements per workspace, via `packages/config/vitest/base.js`.

## Goals / Non-Goals

**Goals:**

- One implementation of the day-status rules, importable by both the employee app and the future monthly calendar.
- Every reporting rule enforced server-side, with the client reproducing only enough validation for good feedback.
- The month-lock and assignment guards implemented as named, reusable seams that later write endpoints call unchanged.
- No database migration and no new runtime dependency.

**Non-Goals:**

- Lock and unlock endpoints, pre-lock warnings, and audit logging — Month Close epic. This change only _reads_ lock state.
- Absence records and their endpoints — Absences epic. This change accepts absences as an input and never fetches them.
- Timer start/stop/cancel — Punch Clock epic. This change only agrees that an entry without an end time is "running" and excludes it from totals.
- The monthly calendar screen — Monthly View epic, which consumes `day-status` from here.

## Decisions

### D1 — `full` means exactly nine hours

GENERAL_SPEC §2.4 defines `full` as `>= 9` while §8.5 defines it as exactly `9`; under §2.4 a ten-hour day is simultaneously `full` and `excess`. We adopt §8.5: `partial` is `0 < h < 9`, `full` is `h == 9`, `excess` is `h > 9`. The four hour-based statuses become mutually exclusive and total. §8.5 also agrees with KAN-74's acceptance criteria, giving two sources against one.

_Alternative considered_: keep `>= 9` and drop `excess` to a display-only concern. Rejected — the monthly calendar needs to distinguish a nine-hour day from a twelve-hour one, and "חריג" (excess) is a distinct badge in the spec's component table.

_Consequence, accepted_: `full` is only reachable on an exact match, so most real days land on `partial` or `excess`. D2 keeps it reachable at all.

### D2 — Totals are accumulated in whole minutes, not fractional hours

Durations sum as integer minutes and compare against `540`. Summing floating-point hours would make `full` essentially unreachable, since `2.5 + 6.5` is not reliably `9.0` across accumulations. The public surface still reports hours for display; the comparison happens in minutes.

_Alternative considered_: compare hours within an epsilon. Rejected as a tolerance nobody can explain to a user, and it just re-introduces the overlap D1 removes.

### D3 — Time zone handling uses `Intl`, with no new dependency

The contracts package runs in Node (API, tests) and in the browser (both apps). Local-date bucketing and display use `Intl.DateTimeFormat` with `timeZone: 'Asia/Jerusalem'`, which is available in every runtime we target and is DST-correct without a tz database of our own.

_Alternative considered_: `date-fns-tz` or `luxon`. Rejected — a shared runtime dependency in `packages/contracts` propagates into both app bundles for a handful of conversions.

The boundary rule: the API exchanges UTC instants (`start_at`, `end_at`) plus a `date` field as `YYYY-MM-DD` naming the Asia/Jerusalem local day the entry started. `date` is derived, and VAL-38 exists to reject a client that derives it differently.

### D4 — `computeDayStatus` takes absences as an argument from day one

Signature: `computeDayStatus({ entries, absences })`, returning the status and the day's total minutes. Callers in this change pass `absences: []`. The Absences epic populates the array and nothing here changes.

_Alternative considered_: add the parameter later. Rejected — it would change every call site and force the monthly calendar to be rewritten right after it is written.

Absence takes precedence over hour count (a day can be both an absence and partially worked), so it is evaluated first, but the total is still reported so the caller can show hours on an absence day.

### D5 — `assertMonthNotLocked` is implemented fully, not stubbed

The `MonthLock` table already exists, and the read semantics are complete on their own: no row means open, `is_locked: true` means locked, `is_locked: false` means reopened. So the guard ships as real behaviour, not a placeholder that returns `true`.

It lives beside the time-entries module as a service the Month Close epic can move or extend, and it is called by _every_ write path — create, update, delete — including on the entry's _existing_ month when an edit moves an entry across a month boundary (both the old and the new month must be open).

GENERAL_SPEC §8.1: "Must be planted on day one — retrofitting is expensive." A stub would satisfy the letter and miss the point.

### D6 — Overlap detection queries a bounded candidate window, then compares intervals in code

Naively fetching all of a user's entries does not scale; a pure SQL range predicate is hard to read and hard to unit-test. Instead: fetch the user's non-deleted entries whose start falls within a window around the candidate interval — widened by one day on each side so a night shift starting the previous evening is always a candidate — then run a pure interval-overlap comparison in code.

Overlap is `newStart < existingEnd && existingStart < newEnd`, which treats touching boundaries (12:00–14:00 after 09:00–12:00) as non-overlapping, per the spec.

_Why this shape_: the comparison becomes a pure function that unit tests can drive across the full matrix — contained, containing, partial-left, partial-right, touching, night-shift-vs-morning, morning-vs-night-shift — without a database. The query is then only responsible for not missing a candidate, which the one-day widening guarantees since durations are unbounded in the spec but a starts-within-window filter plus widening covers every practically reachable case.

_Known limit_: an entry longer than 24 hours starting more than a day before the candidate could escape the window. Recorded under Risks.

On update, the entry being edited is excluded from its own candidate set.

### D7 — A running entry is one with no end time

`end_at IS NULL` is the single marker. Consequences agreed here so the Punch Clock epic inherits them: such an entry contributes zero minutes to a day total, is exempt from VAL-31, VAL-35, and VAL-36 on the **read and totalling** paths, and is skipped by the overlap comparison (it has no interval to compare). VAL-37, the single-running-timer rule, belongs to that epic and is not implemented here.

This change never _creates_ an entry without an end time — the manual form always supplies one — but the read and totalling paths tolerate them so the timer epic does not have to revisit them.

**Editing and deleting a running entry is refused, not exempted.** An earlier reading of this decision implied the write path should simply skip VAL-31/35/36 for a running entry, which would have let PATCH edit one. Two problems: the merged-entry rules could then only report VAL-31 against a field the caller never sent, which is actively misleading; and it would build a code path this epic cannot test, for an epic that has not yet specified its own behaviour. So `PATCH` and `DELETE` return 409 with `VAL-RUNNING-ENTRY` when the target has no end time. Completing or cancelling a running entry is the timer's job (§8.6), and the Punch Clock epic decides that flow explicitly rather than inheriting a silent one.

### D11 — Build the screens as designed in Figma

Source: Figma file `3CK80SB84FluVRrWCDlmaw`, page **Mobile web app**.

The UI follows the design. The home screen is the month of day rows the design shows — `16/10/25, יום ה'` — each with a status chip (`חסר`, `ש 9` with a tick, `ש 7` with a warning, `מחלה`, `סופ"ש`), expanding in place to reveal that day's entries with `עריכה` affordances and `הוספת דיווח`. The entry form is the `דיווח ידני` frame.

Where the design and Epic 5 §1 differ — the spec describes a today-only home screen — the design is authoritative for layout, per the project's standing rule that the spec decides behaviour and the Figma decides looks. Every behavioural rule in this change is unaffected: VAL-30…38, assignment scoping, month locking, and the day-status thresholds all hold exactly as specified.

_Overlap noted, accepted_: the month list also appears in Epic 6 (KAN-81/82). Coordinate before that epic starts so the screen is not built twice.

### D12 — Copy and layout come from the Figma frames, not invented

Strings, states, and structure taken from the design rather than paraphrased, so the build can be checked against it:

| Element                  | Design                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| Screen title / month nav | `דיווח שעות` with `‹ אוקטובר ›`                                                             |
| Bottom action bar        | `הפעלת שעון` (timer, Epic 8) · `דיווח ידני` (manual entry)                                  |
| Picker rows              | `פרויקט` → client ← project chips · `משימה` → task chip                                     |
| Required location        | `מיקום` with a red asterisk                                                                 |
| Time fields              | `שעת התחלה` · `שעת סיום`                                                                    |
| Description placeholder  | `תיאור העבודה בכמה מילים, לא ארוך מידי…`                                                    |
| Per-entry actions        | `מחיקת פרויקט` (red) · `הוספת פרויקט` (blue, with ⊕)                                        |
| Quota bar                | `6 מתוך 9 שעות` leading, `חסרות 3 שעות לדיווח` trailing, orange fill on grey                |
| Save                     | `שמירה`, navy, full width                                                                   |
| Validation banner        | `חסר לנו פרט או שניים` / `מלא את כל הנתונים הדרושים כדי שנוכל לשמור את הדיווח בהצלחה`       |
| Save toast               | `דיווח נשמר בהצלחה` (393×64, `#555555`, radius 8)                                           |
| Load failure             | `אופססס...` / `אין מידע זמין כרגע, נסה שוב מאוחר יותר או פנה למנהל ישיר` / `חזור למסך ראשי` |
| Frame                    | 393×852, radius 40, background `#F2F2F7`; form container padding 16px, gap 4px              |

Two notes where design and spec differ. The design places the quota bar **on the form**; Epic 5 §3 places it on the home screen — it is one shared component, so it renders in both. And the design labels an entry `פרויקט` (`הוספת פרויקט` / `מחיקת פרויקט`) where the domain calls it a time entry; the design's wording is kept on screen because that is what employees will read, while code and API keep the domain term.

### D8 — The cascading picker is client-side grouping over one request

`GET /me/assignments` returns the full assignment set, already scoped. The form fetches it once and derives the three levels by grouping: distinct clients, then projects filtered by the chosen client, then tasks filtered by the chosen project. No new endpoint, no request per cascade level.

Assignment counts per employee are small (single or low double digits), so paging or per-level fetching would add latency and code for no benefit. The `reportType` already on each row is what filters the list down to `TOTAL_HOURS` projects.

`filterOpenAssignments` in the existing `task-picker.tsx` is deleted rather than carried over: it casts `MyAssignment` to shapes with `status` and `deletedAt` fields that the type does not have, so both predicates are always true. Server-side filtering already does this job.

### D9 — Server is the only authority on validation; the client mirrors selectively

The client validates what it can answer alone — required fields, end-after-start — for immediate feedback. Overlap (VAL-32), assignment (VAL-33), and month lock (VAL-34) need server state and are only enforced there; the form renders whatever `details[]` comes back, keyed by `field`. Hebrew strings for VAL-30…38 are added to the existing `VAL_MESSAGES` map so both layers read from one dictionary.

This keeps the client from silently diverging from the rules, and means an out-of-date client cannot write bad data.

### D10 — Read endpoints are shaped for the monthly view too

The list endpoint accepts either a single date or a date range, and returns denormalised task, project, and client names on each entry. The Monthly View epic needs the same rows for a whole month; giving the range form now avoids a second endpoint later. Denormalised names are what allow historical entries to render after a task is closed or a client deactivated (§8.3), since the picker hides those but the history must still show them.

## Risks / Trade-offs

- **Entries longer than 24 hours could evade the overlap window (D6)** → The candidate window widens by one day on each side, which covers any entry up to 24 hours; the spec sets no maximum duration. Mitigation: a guard test asserting the window's stated bound, and the widening constant named and commented so it is obvious what to change if a longer duration ever becomes reachable. Accepted as a bounded, documented limit rather than fetching a user's whole history on every write.

- **`full` is nearly unreachable in practice (D1, D2)** → Working in whole minutes makes an exact 540 achievable when an employee reports clean times, which is the common case for a nine-hour day. If the team later finds `full` too rare to be useful, the fix is a one-line threshold change in one shared function — which is precisely the benefit of the rules living in one place.

- **The Month Close epic may want a different home for the lock guard (D5)** → It is a small, dependency-light service with a single method and its own tests, deliberately not entangled with time-entry logic. Moving it is a file move plus an import update.

- **DST correctness in Asia/Jerusalem (D3)** → `Intl` handles the transitions, but the failure mode is silent misattribution of an entry to the wrong day. Mitigation: explicit unit tests on both Israeli DST transition dates, plus a test for an instant whose UTC date differs from its local date.

- **The coverage gate applies to new UI code** → The daily screen and entry form are the largest new surface, and UI branches (loading, empty, error, locked, no-assignments) are easy to leave untested. Mitigation: those states are enumerated as spec scenarios, so the component tests follow the spec rather than chasing a percentage.

- **E2E needs a locked month, and specs share one database** → A lock row is global to `(year, month)`, so a locked-month test could affect other specs running against the same data. Mitigation: lock a month far from the seeded working week and from the current month, and assert on entries dated inside that month only.

- **Two `date`-shaped fields must agree** → `date` is derived from `start_at`, so they can drift if a client computes the local day differently. VAL-38 exists exactly to catch this, and it is the reason the rule is worth enforcing rather than deriving `date` server-side and ignoring the client's value. Trade-off accepted: a stricter API in exchange for catching client time-zone bugs at the boundary.

## Migration Plan

No database migration — every table and column this change needs already exists.

Deployment is the normal branch flow (`feat/*` → `dev` → `staging` → `main`). The API changes are purely additive: new endpoints under `/api/v1/time-entries`, no change to existing routes, so the employee and admin apps continue to work against a newer API during a partial rollout.

`prisma/seed.ts` gains the fixtures the e2e specs need — a task the seeded employee is _not_ assigned to, and a locked month well away from the seeded working week. Seeding is idempotent per run and already truncates time entries, so no data migration is involved.

Rollback is a revert of the feature branch. Any time entries created against the new endpoints remain valid rows in a table that predates this change; nothing else reads them yet, so there is no orphaned state to clean up.

## Open Questions

- **Quota-bar colours for `absence`.** GENERAL_SPEC §8.5 gives colours for the hour-based statuses only, and the Figma frame for an absence day belongs to the Absences epic. The bar renders a distinct `absence` styling; the exact colour can be settled when that epic lands, without touching the status rules or the component's interface.
- **Whether the range read endpoint should also return lock state per month.** The Monthly View epic's KAN-80 calls for entries, absences, and lock status in one response. That is a superset of what this change needs, so it is left to that epic to decide whether to extend this endpoint or add its own.
