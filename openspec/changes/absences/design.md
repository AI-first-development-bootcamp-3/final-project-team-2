## Context

See `proposal.md` — Why. What shapes the approach:

- **The schema is nearly complete.** `Absence` carries `type`, `start_date`, `end_date`, `is_half_day`, `half_day_period`, `notes`, and `deleted_at`; `AbsenceAttachment` carries `file_name`, `file_type`, `file_size`, and `blob_key`. Both are in `20260815000000_init`. `Absence` is already in `SOFT_DELETE_MODELS`. Only `group_id` (D2) and a `deleted_at` on attachments (D7) are missing.
- **Two seams were planted for this epic and are waiting.** `MonthLockService` is exported from `TimeEntriesModule` with the comment "The Month Close and Absences epics need the same guards on their own writes". `computeDayStatus` accepts an `absences` argument documented as "The Absences epic supplies these; until then callers pass an empty array". Neither needs inventing.
- **`isCoveredByAbsence` is a plain inclusive `YYYY-MM-DD` string range check.** It has no concept of weekends or half-days. That single fact drives D1 and D3.
- **Epic 9 does not exist yet.** `MonthLock` write endpoints, `writeAuditLog`, and the pre-lock warning list are all backlog. So admin-side absence editing (§7.2, audit-logged) is out of scope, and the pre-lock warning is shipped as a flag rather than a screen.
- **Established patterns to follow, not reinvent**: zod schemas in `packages/contracts` carrying `VAL-*` codes as issue messages; `zodIssuesToDetails` mapping them into the `ApiError` envelope; NestJS module/controller/service triples guarded by `JwtGuard` + `RolesGuard` with `@Roles('employee')`; `react-hook-form` with the zod resolver in the apps; `authFetch` for requests. No state-management or data-fetching library is in use anywhere in the repo.
- **The pieces this epic builds on are written but unmerged.** `MonthLockService`, the time-entries module, the daily report screen, the entry form, and the monthly calendar all exist only on an open PR stack — PR #54 → #57 → #58, with #72 (monthly view) and #69/#71 (review fixes) branching off it. None of it is on `dev`, `staging`, or `main`. So this change is based on `feat/kan-80-month-query`, the only branch carrying both seams it needs, and its PR cannot merge until that stack does (see Migration Plan).
- **KAN-80 already defined the absence row shape.** `MonthAbsenceSchema` in `packages/contracts/src/months/query.ts` carries `startDate` / `endDate` and is documented as "structurally compatible with `DayStatusAbsence`… The Absences epic extends this shape additively (type, half-day, notes)". This epic extends that schema rather than defining a parallel one, and the month query's `absences: []` starts returning real rows without its contract changing.
- **`env.ts` refuses to boot on a missing required variable.** Adding `BLOB_READ_WRITE_TOKEN` as required would break local dev, docker-compose, and the CI e2e job for every developer at once. D6 handles this.
- **CI enforces 70% coverage** on lines, branches, functions, and statements per workspace, via `packages/config/vitest/base.js`.

## Goals / Non-Goals

**Goals:**

- All four absence types reportable as a single day, a half day, or a range, with weekends excluded from what gets stored.
- The locked-month matrix enforced exactly as §7.3 states it, including the one employee-side exception, proven by integration tests rather than asserted in a comment.
- Documents attachable after the fact — including after a month locks — because that is when they actually arrive.
- One reported absence remains one thing to the employee even when it is stored as several rows.
- `day-status` stays the single authority on whether a day is settled, and stays honest about half-days.

**Non-Goals:**

- Lock and unlock endpoints, pre-lock warning screens, audit logging — Epic 9. This change only _reads_ lock state and _emits_ the flag the warning list will need.
- Admin editing and deleting of employee absences (§7.2) — Epic 9, because every such write must be audit-logged and `writeAuditLog` does not exist. Admin **read** is in scope.
- The monthly calendar screen — Epic 6, which consumes this epic's reads.
- Israeli holidays. Deliberately not handled, per GENERAL_SPEC §8.4 and the Epic 7 spec. Only Fridays and Saturdays are excluded.
- Vacation balances and accrual. Cut from the MVP.

## Decisions

### D1 — VAL-43 is enforced by splitting the range into rows, not by excluding weekends at read time

A reported range becomes one `Absence` row per contiguous run of working days. Thursday 20th → Sunday 23rd stores two rows: `20→20` and `23→23`.

```
Reported:  Thu 20 ─────────────────▶ Sun 23

           ┌──────┬──────┬──────┬──────┐
           │ Thu  │ Fri  │ Sat  │ Sun  │
           │  20  │  21  │  22  │  23  │
           └──────┴──────┴──────┴──────┘
              │       ✗      ✗      │
              ▼                     ▼
        Absence A1            Absence A2
        20 → 20               23 → 23
        group_id: G7          group_id: G7
```

_Alternative considered_: store one row spanning `20→23` and filter Fridays and Saturdays wherever absences are read. Rejected because `isCoveredByAbsence` in the already-merged `day-status.ts` does a plain inclusive string range check — under that reading it would report Friday and Saturday as `absence`, which is wrong, and fixing it means every future consumer of absence rows must remember to apply the weekend filter itself. Splitting makes the stored rows literally true, so no consumer can get it wrong by omission. The rows say what they mean.

_Consequence, accepted_: writes fan out. One `POST` can create several rows, and an edit re-splits. D2 keeps that invisible to the employee.

**A range whose `start_date` or `end_date` is itself a Friday or Saturday is rejected with VAL-43, not silently snapped inward.** Snapping would save something the employee did not ask for, and every other rule in the registry rejects rather than corrects. A range that contains _only_ weekend days is likewise rejected — there is nothing to store.

### D2 — One nullable `group_id` keeps a split absence a single thing to the employee

Every row produced by one report shares a `group_id` (UUID). `PATCH` and `DELETE` on any row in a group act on **the whole group**: a delete soft-deletes every row, and an edit re-splits the new range and replaces the group's rows. Reads return rows, each carrying its `group_id`, so a client can present a group as one item.

Migration: `group_id UUID NULL`, indexed. Nullable so the column is additive and pre-existing rows (there are none in production, but seeds and previews may hold some) stay valid; a row with a null `group_id` is treated as a group of one.

_Alternative considered_: independent rows with no grouping. Rejected — an employee who reported Thursday-to-Sunday and then cancelled it would delete Thursday and leave Sunday behind, and no UI copy makes that comprehensible.

_Alternative considered_: group implicitly on read by `(user, type, adjacency across a weekend)`. Rejected as ambiguous by construction: two genuinely separate vacation requests that happen to sit either side of one weekend become indistinguishable from one four-day request, so neither can be deleted independently. An explicit column costs one additive migration and removes the ambiguity entirely.

_Consequence, accepted_: this is the only migration in the change, and it means the epic cannot claim the "no migration" property the previous three changes had. Worth it — the alternative is a permanent UX defect.

### D3 — A half-day absence reduces the day's expected minutes; it does not cover the day

`computeDayStatus` gains a target: a full-day absence keeps its current absolute precedence and returns `absence`, but a **half-day** absence sets `targetMinutes` to 270 instead of 540 and the day then classifies on hours against that reduced target.

```
                    │ target │ reported │ status
────────────────────┼────────┼──────────┼──────────
full-day sick       │   —    │    0h    │ absence
full-day sick       │   —    │    4h    │ absence   (total still reported)
half-day sick       │  4.5h  │    0h    │ empty     ← still owes 4.5h
half-day sick       │  4.5h  │    2h    │ partial
half-day sick       │  4.5h  │   4.5h   │ full
half-day sick       │  4.5h  │    6h    │ excess
no absence          │   9h   │    9h    │ full
```

This resolves **OQ-04** (half-day hour split): the split is 4.5h, expressed as a target rather than as phantom reported hours.

_Alternative considered_: let a half-day return `absence` like a full day. Rejected — the day would read as settled, the employee would never be prompted for the 4.5h they still owe, and the pre-lock warning could not catch it either because nothing is "missing". A half-day absence that hides half a day of unreported work defeats the purpose of the quota bar.

_Alternative considered_: add a sixth `half_absence` status. Rejected — it carries no hour information, so the quota bar still has to special-case it, and it widens an enum that Epic 6, Epic 8, and Epic 9 all switch on. Every exhaustive switch in three unwritten epics would need revisiting to gain nothing.

_Consequence, accepted_: `computeDayStatus`'s return type grows a `targetMinutes` field and its input's absence shape grows `isHalfDay`. This is a change to already-merged, already-reviewed code (KAN-74) — which is exactly why it belongs here, before Epic 6 consumes it. Two half-day absences on one day is treated as a full day (target 0, status `absence`); the API rejects the second one as an overlap.

### D4 — The locked-month matrix lives in one table-driven guard, not scattered conditionals

§7.3 is a matrix, so it is implemented as one:

| Operation       | Type            | Month open | Month locked   |
| --------------- | --------------- | ---------- | -------------- |
| Create          | vacation, other | allow      | **403 VAL-45** |
| Create          | sick, military  | allow      | **allow**      |
| Update          | any             | allow      | 403 VAL-45     |
| Delete          | any             | allow      | 403 VAL-45     |
| Attach document | any             | allow      | **allow** (D5) |
| Read            | any             | allow      | allow          |

The guard is a single method taking `(operation, type, year, month)` and consulting the existing `MonthLockService.isMonthLocked`. `assertMonthNotLocked` is reused unchanged for the rows where the answer is a plain 403.

_Why this shape_: the exception is narrow and easy to get wrong, and the matrix is the requirement. A table-driven guard can be unit-tested by iterating the matrix, so a future edit that breaks one cell fails one named test rather than passing silently.

**A split group can straddle a lock boundary.** A range from a locked month into an open one produces rows in both. The rule applied is per-row-month, per the matrix above — so a vacation range reaching back into a locked month is rejected outright rather than partially stored, because storing half of what the employee asked for is worse than refusing it.

### D5 — Attachment writes are exempt from the lock; attachment reads are scoped to owner plus admin

Registering a document on an existing absence is permitted regardless of lock state (§7.1 exception 2). This is deliberate and not an oversight of D4: the entire point of VAL-44 is that the document may arrive after the fact, and the month may well have locked in between.

Download URLs are issued to the absence's owner and to any admin. Not to other employees — a sick note is medical information, and the default read scope elsewhere in the API (`findOwnEntryOrFail`) is already owner-only.

An attachment referencing a non-existent or soft-deleted absence is rejected with VAL-62, reported as not-found rather than forbidden so a caller cannot probe for other employees' absence ids — matching the existing `findOwnEntryOrFail` precedent.

### D6 — `BLOB_READ_WRITE_TOKEN` is optional in `env.ts`, and its absence fails at the upload call

`env.ts` throws `EnvValidationError` and refuses to boot on any missing required variable. Adding the Blob token as required would break every developer's local dev, docker-compose, and the CI e2e job the moment this change merges — for a feature most of the API does not touch.

So the token is optional in the schema. The Blob client wrapper throws a clear, named error when an upload or download URL is requested without it, and the three attachment endpoints are the only paths that can reach it. Everything else — absence CRUD included — boots and runs without the token.

_Alternative considered_: require it and add it to `.env.example` with a placeholder. Rejected — a placeholder that is not a real token fails at the same point anyway, but only after making the whole API unbootable for anyone who has not updated their `.env`.

_Consequence_: absence CRUD is testable and runnable with no Blob credential at all, which is what makes the sequencing in the Migration Plan possible.

### D7 — `AbsenceAttachment` becomes a soft-delete model

`AbsenceAttachment` is absent from `SOFT_DELETE_MODELS` and has no `deleted_at` column, so deleting one today would be a hard delete — the only hard delete in a schema whose stated decision is soft delete everywhere.

A sick note is the evidence behind a locked month's payroll. Hard-deleting it leaves an `AuditLog` entry (once Epic 9 exists) pointing at a row that no longer exists. So: add `deleted_at` to `absence_attachments`, add the model to `SOFT_DELETE_MODELS`, and the existing Prisma extension handles the rest with no new delete logic.

The Blob object itself is **not** deleted when the record is. Orphaned blobs are accepted for now — deleting the object would make the soft delete unrecoverable, which defeats the point. A reconciliation job is out of scope and noted under Risks.

### D8 — Attachment upload is client-direct with a server-registered record

The flow is the one GENERAL_SPEC §8.7 specifies, and it is worth restating why it has three steps rather than one:

```
  ┌────────┐  1. POST /files/upload-url        ┌─────┐
  │ Client │ ────────────────────────────────▶ │ API │
  │        │ ◀──────── signed URL (60min) ──── └─────┘
  │        │                                      │
  │        │  2. PUT file ──────────▶ ┌──────────┐│
  │        │                          │  Vercel  ││
  │        │                          │   Blob   ││
  │        │                          └──────────┘│
  │        │  3. POST /absences/:id/attachments   │
  │        │ ────────────────────────────────────▶│
  └────────┘        (blob_key, name, type, size)  ▼
                                          AbsenceAttachment row
```

The file never transits the API, which matters on Vercel where function request-body limits are well under 5MB and every megabyte through a function is billed compute. Type and size are enforced **twice**: in the schema before the URL is issued (step 1), and again on registration (step 3) against the metadata the client reports. Step 3 is the authority for what the database records.

_Known gap, accepted_: a client that lies in step 3 about a file it uploaded in step 2 could register mismatched metadata. Recorded under Risks with its mitigation.

### D9 — The absence screen reuses the entry form's error-rendering contract

Server `details[]` are rendered against their fields in Hebrew from `VAL_MESSAGES`, entered values are preserved on rejection, and the client validates only what it can answer alone (type present, end ≥ start, half-day period present). VAL-43's weekend rejection, VAL-45's lock check, and overlap are server-only because they need server state or a calendar the client should not duplicate.

This is D9 of the daily-reporting change applied unchanged, not a new decision — recorded here so the absence form is built to the same contract rather than inventing a second error convention.

### D10 — Absence overlap is rejected, consistent with time entries

Two absences covering the same day for the same employee are rejected. The spec's validation registry does not name a rule for this, so it reuses the shape of VAL-32 under a new code `VAL-ABSENCE-OVERLAP`, following the `VAL-DATE-RANGE` / `VAL-RUNNING-ENTRY` precedent for rules the registry omits.

Without it, "am I on vacation that day" has no single answer, and a half-day plus a full-day on the same date makes D3's target arithmetic meaningless. Comparison is on local dates, not instants, so it is a simpler check than the time-entry version: no candidate window is needed because a `@db.Date` range query is exact.

## Risks / Trade-offs

- **`day-status` is already merged and KAN-74 is in review (D3)** → Changing it now means re-reviewing code that was just reviewed. Mitigation: the change is additive to the result type (`targetMinutes`) and to the absence input shape (`isHalfDay`); full-day precedence and all four hour-based thresholds are untouched, so every existing test stays valid. Doing it later means Epic 6 builds the calendar against the wrong rule and rebuilds it.

- **Row splitting fans one write out into several (D1, D2)** → A create can write several rows and an edit deletes-and-recreates a group, so both must be transactional or a failure leaves a half-stored absence. Mitigation: wrap group writes in `prisma.$transaction`, and integration-test a mid-write failure. The alternative reading of VAL-43 avoided this but broke `isCoveredByAbsence` instead.

- **`group_id` is nullable, so "a group of one" has two representations** → A single-day absence may have a `group_id` or `null`. Mitigation: the service always assigns a `group_id`, even for one row, so null only ever appears on rows predating this change; the read path treats null as a singleton group. Making it non-nullable would have required backfilling rows the migration cannot see.

- **Blob credentials cannot be provisioned by the agent** → The token reads back as `[SENSITIVE]` in this environment, so the store must be created and the token set by a human, and KAN-86's "proven against real signed URLs in staging" cannot be automated. Mitigation: D6 makes everything else work without it, so this gates only the three attachment endpoints and their e2e assertion.

- **Client-reported file metadata is trusted at registration (D8)** → A malicious client could upload a 20MB file and register it as 2MB. Mitigation: the signed upload URL is issued with Blob's own content-length and content-type constraints where the SDK supports it, and registration re-validates. Accepted residual risk: the blob may not match its record. Both users are authenticated employees, and the blast radius is storage cost, not data exposure.

- **Orphaned blobs accumulate after soft deletes (D7)** → No reconciliation job. Accepted: attachments are small, rare, and 5MB-capped; a sweep can be added when there is anything to sweep. Deleting the object on soft delete would make the soft delete a lie.

- **This change's PR is sixth in an open stack** → `MonthLockService` and `MonthAbsenceSchema` are both unmerged, so the base is `feat/kan-80-month-query` and merging waits on PRs #54, #57, #58, and #72. Mitigation: none available — reimplementing the seams on a `dev` base would duplicate exactly the code those PRs are reviewing. Accepted, with the rebase cost noted: if the stack is squashed or reordered, this branch rebases onto whatever lands on `dev`.

- **The locked-month e2e test shares one database with every other spec** → A `MonthLock` row is global to `(year, month)`. Mitigation: reuse the locked month that daily-reporting task 9.1 seeds rather than locking a second one, and scope assertions to absences dated inside it. If task 9.1 has not landed, this change adds the fixture.

- **The absence screen may duplicate work with the entry form** → Both need a date input, a bottom sheet picker, and the `details[]` error renderer. Mitigation: the base branch already carries `picker-sheet.tsx`, `entry-form.tsx`, `field-details.ts`, and `quota-bar.tsx` from KAN-72/73, so the absence screen reuses them rather than inventing a second set. Any primitive it has to widen is widened in place, not forked.

## Migration Plan

**Database.** One additive migration: `absences.group_id UUID NULL` with an index, and `absence_attachments.deleted_at TIMESTAMP NULL`. Both are additive, so the migration is safe to deploy ahead of the code and needs no backfill — production holds no absence rows. Rollback is a column drop; nothing else references either column.

**Sequencing.** The backend is unblocked today; the frontend is not. Land in this order:

1. **Contracts and API (KAN-89, KAN-90)** and the `day-status` change — fully unblocked. No Blob credential, no mobile shell, no Epic 9. This is the bulk of the change and it can start immediately.
2. **The `missingDocument` flag (half of KAN-92)** — pure query logic, no Blob involved.
3. **Blob wiring (KAN-91, rest of KAN-92)** — gated on a human provisioning a Vercel Blob store and setting `BLOB_READ_WRITE_TOKEN` in Vercel env and local `.env`. D6 means this gates nothing else.
4. **The screen (KAN-87)** — unblocked on this base: the router, `picker-sheet`, `entry-form`, and `field-details` are all present from KAN-72/73. It reuses them rather than inventing a second set.
5. **E2E (KAN-88)** — last, minus the monthly-view assertion.

**Deployment** is the normal branch flow (`feat/*` → `dev` → `staging` → `main`). API changes are purely additive: new routes under `/api/v1/absences` and `/api/v1/files`, no change to existing routes, so both apps keep working against a newer API during a partial rollout. The `day-status` change ships in `packages/contracts` and is consumed only by code in this repo, all of which is updated in the same change.

**Rollback** is a revert of the feature branch plus, if it has already run, a drop of the two added columns. Absence rows created against the new endpoints remain valid rows in a table that predates this change; only this epic's endpoints read them.

## Open Questions

- **Whether the absence list endpoint should return groups or rows.** It returns rows carrying `group_id`, which lets the client group them and lets Epic 6 consume them per-day without ungrouping. Epic 6's `GET /month` (KAN-80, PR #72) already returns an `absences` array typed by `MonthAbsenceSchema`, so it consumes rows today and needs no ungrouping. If it later wants groups it can shape its own response — noted rather than pre-decided.
- **The `absence` chip's appearance for a half-day.** The Figma frames show full-day chips (`מחלה`, `סופ״ש`); a half-day chip is not in the design. The screen renders type plus period and the exact treatment can be settled with the designer without touching the status rules or `computeDayStatus`'s interface.
- **Whether `other` absences should require notes.** The spec makes notes optional for every type, but an unexplained "אחר" is not useful to an admin reviewing a month. Left as specified — optional — because tightening it is a one-line schema change once there is evidence it matters.
