## 1. Migration (`group_id` + attachment soft delete)

- [x] 1.1 Add `group_id String? @db.Uuid` to the `Absence` model with an index on `[user_id, group_id]`, and `deleted_at DateTime?` to `AbsenceAttachment` (D2, D7).
- [x] 1.2 Generate the migration; confirm it is additive only — two nullable columns and one index, no backfill, safe to deploy ahead of the code (Migration Plan).
- [x] 1.3 Add `'AbsenceAttachment'` to `SOFT_DELETE_MODELS` in `server/api/src/prisma/prisma.service.ts` and extend its spec to cover the new model (D7).
- [ ] 1.4 (needs a live database) Confirm `prisma migrate deploy` runs clean against a database holding existing absence rows.

## 2. Day-status change (half-day targets) — land before Epic 6 consumes it

- [x] 2.1 Extend `DayStatusAbsence` in `packages/contracts/src/day-status/day-status.ts` with `isHalfDay?: boolean`; keep both bounds inclusive and the field optional so existing callers compile unchanged (D3).
- [x] 2.2 Add `HALF_DAY_MINUTES = 270` beside `FULL_DAY_MINUTES`, and return `targetMinutes` on `DayStatusResult`.
- [x] 2.3 Implement the target rules: no absence → 540; one half-day absence → 270; two half-day absences or any full-day absence → target 0 and status `absence` (D3). A full-day absence outranks a half-day one on the same date.
- [x] 2.4 Classify against `targetMinutes` rather than the 540 constant, so `empty` / `partial` / `full` / `excess` keep their meanings on a half-day.
- [x] 2.5 Unit-test every scenario in `specs/day-status/spec.md`, including 4h29 vs 4h30 vs 6h against a half-day target, both periods, two half-days, full-plus-half, and target reported on an ordinary day.
- [x] 2.6 Confirm every pre-existing day-status test still passes untouched — the four hour-based thresholds and full-day precedence are unchanged (Risks).
- [x] 2.7 Verify `pnpm --filter @abra/contracts test:coverage` passes the 70% gate.

## 3. Absence contracts (KAN-89)

- [x] 3.1 Add `packages/contracts/src/absences/create.ts`: `CreateAbsenceBodySchema` over `type`, `startDate`, `endDate`, `isHalfDay`, `halfDayPeriod`, optional `notes`, carrying VAL-40/41/42/43 as issue messages in the `CreateTimeEntryBodySchema` style.
- [x] 3.2 Enforce as cross-field refinements: `endDate >= startDate` (VAL-42); neither bound on a Friday or Saturday and the range not weekend-only (VAL-43); `isHalfDay` and `halfDayPeriod` required together and only over a single date (D1, D3).
- [x] 3.3 Add `packages/contracts/src/absences/split.ts`: a pure `splitIntoWorkingRuns(startDate, endDate)` returning one `{ startDate, endDate }` per contiguous working-day run, built on the existing Asia/Jerusalem helpers in `day-status/local-date.ts` — no new dependency (D1).
- [x] 3.4 Unit-test the splitter across the matrix: within one week, one weekend, two weekends, single day, Sunday start, Thursday end, a fifteen-day span, and both weekend-boundary rejections.
- [x] 3.5 Add `update.ts` (all fields optional, same rules when present) and `list.ts` (month filter, optional `userId` for admins, `AbsenceListItemSchema` carrying `groupId` and `missingDocument`).
- [x] 3.5a `AbsenceListItemSchema` declares `startDate` / `endDate` / `isHalfDay` as exactly the shape `DayStatusAbsence` reads. **Superseded**: this change is now based on `dev`, where `MonthAbsenceSchema` does not exist (PR #72 is still open). Whichever of the two lands second must make one derive from the other rather than leaving two hand-maintained copies of the bounds.
- [ ] 3.5b **Blocked on PR #72** — add `isHalfDay` to `MonthAbsenceSchema` and have `months.service` populate `absences` from these rows. Cannot be done from a `dev` base; belongs to whichever branch merges second.
- [ ] 3.6 Add `packages/contracts/src/attachments/`: file type and size schemas carrying VAL-60/61 (D8).
- [x] 3.7 Extend the `ValCode` union and `VAL_MESSAGES` in `index.ts` with Hebrew messages for VAL-40…45, VAL-60…62, and `VAL-ABSENCE-OVERLAP` (D10).
- [x] 3.8 Export the absence and attachment surface from `packages/contracts/src/index.ts`.
- [x] 3.9 Unit-test each rule's code and each accepted edge case; verify the contracts coverage gate still passes.

## 4. Absences API (KAN-90)

- [x] 4.1 Scaffold `server/api/src/modules/absences/` (module, controller, service) following the time-entries module; guard with `JwtGuard` + `RolesGuard`; register in `app.module.ts`. Import `MonthLockService` from `TimeEntriesModule`, which already exports it for this epic.
- [x] 4.2 Implement the table-driven locked-month guard from D4 as one method taking `(operation, type, year, month)`, delegating to `MonthLockService.isMonthLocked` and throwing 403 with VAL-45 where the matrix says so.
- [x] 4.3 Unit-test the guard by iterating the D4 matrix cell by cell, including the reopened-month row and both sick/military create exceptions.
- [x] 4.4 Implement `POST /api/v1/absences`: validate through the zod pipe, force ownership to the JWT `userId`, run the locked-month guard against every month the split touches, reject the whole request if any row's month refuses it (D4), then write all rows in one `prisma.$transaction` under a fresh `groupId` (D1, D2).
- [x] 4.5 Implement the absence-overlap check (`VAL-ABSENCE-OVERLAP`): a date-range query against the user's non-deleted absences, excluding the group being edited (D10).
- [x] 4.6 Implement `GET /api/v1/absences` with a month filter, employee-scoped to the caller and admin-scoped by optional `userId`; and `GET /api/v1/absences/:id` returning 404 for another user's absence.
- [x] 4.7 Compute `missingDocument` on reads: true only for `sick` / `military` with no non-deleted attachment (D5, Epic 9 seam).
- [x] 4.8 Implement `PATCH /api/v1/absences/:id`: owner only, month open, re-running every rule on the merged values, replacing the whole group's rows under the same `groupId` in one transaction (D2).
- [x] 4.9 Implement `DELETE /api/v1/absences/:id`: owner only, month open, soft-deleting every row in the group via the existing Prisma extension — no new delete logic (D2).
- [ ] 4.10 Confirm admin create is rejected with 403, admin read is permitted, and unauthenticated requests are 401.
- [x] 4.11 Document every endpoint in Swagger with request and response schemas and the bearer requirement.
- [ ] 4.12 Integration-test every scenario in `specs/absences-api/spec.md` against the database, including a mid-transaction failure storing nothing, a range reaching into a locked month storing nothing, group delete removing both rows, and group edit re-splitting.
- [ ] 4.13 Verify `pnpm --filter @abra/api test:coverage` passes the 70% gate.

## 5. Blob wiring and attachments (KAN-91, KAN-92)

**Gated on a human provisioning a Vercel Blob store and setting `BLOB_READ_WRITE_TOKEN` — see Migration Plan. Task 5.1 is what keeps the gate from blocking anything else.**

- [ ] 5.1 Add `BLOB_READ_WRITE_TOKEN` to `env.ts` as **optional**, and document it in `.env.example` as required only for attachment endpoints. Verify the API still boots, and absence CRUD still works end to end, with the variable absent (D6).
- [ ] 5.2 Add `@vercel/blob` to `server/api/package.json` and write `server/api/src/common/blob/` — a thin wrapper issuing signed upload and download URLs with 60-minute expiry and private access, throwing a named configuration error when the token is missing (D6, D8).
- [ ] 5.3 Unit-test the wrapper against a stubbed SDK: expiry passed through, private access set, and the named error thrown when unconfigured.
- [ ] 5.4 Implement `POST /api/v1/files/upload-url`: validate declared type and size (VAL-60/61) before issuing anything.
- [ ] 5.5 Implement `POST /api/v1/absences/:id/attachments`: re-validate type and size, confirm the absence exists, is not deleted, and belongs to the caller (VAL-62, 404 not 403), then write the `AbsenceAttachment` row. **Exempt from the month-lock guard** (D5).
- [ ] 5.6 Implement `GET /api/v1/absences/:absenceId/attachments/:id/url`: owner or admin only, 404 for anyone else (D5).
- [ ] 5.7 Confirm a soft-deleted attachment re-flags its absence as missing its document, and that the blob object is left in place (D7).
- [ ] 5.8 Test every scenario in `specs/absence-attachments/spec.md`, including both rejection points for type and size, the 5MB boundary accepted, attachment accepted in a locked month, and multiple attachments per absence.
- [ ] 5.9 Provision the Blob store and set `BLOB_READ_WRITE_TOKEN` in Vercel env for staging and production, and locally. **Human action** — the agent cannot read the token back.
- [ ] 5.10 Verify upload and download against real signed URLs in staging (KAN-86 definition of done).

## 6. Absence report screen (KAN-87)

**Unblocked on this base — KAN-72/73 already landed the router, `picker-sheet.tsx`, `entry-form.tsx`, and `field-details.ts` here. Reuse them; do not fork a second set.**

- [ ] 6.1 Add the `/absence/new` route behind `ProtectedRoute` in `apps/mobile/src/App.tsx`, reachable from the bottom nav KAN-72 introduces.
- [ ] 6.2 Build the type picker over the four Hebrew names, reusing the picker-sheet primitive from the entry form rather than a second implementation (Risks).
- [ ] 6.3 Build single-day and range selection on a calendar that cannot select a Friday or Saturday as either bound, and preview a weekend-spanning range as its working days only (D1).
- [ ] 6.4 Build `HalfDayToggle`: requires a period when on, collapses a range to one date, clears the period when switched off.
- [ ] 6.5 Build `AttachmentUpload` over the three-step flow — request URL, upload direct to Blob, register — with client-side type and size refusal before upload, and progress, success, and retry states (D8).
- [ ] 6.6 Wire the form with `react-hook-form` and the zod resolver over the contracts schemas; render server `details[]` against their fields in Hebrew from `VAL_MESSAGES`, preserving entered values on rejection (D9).
- [ ] 6.7 Implement the default, saving, validation-error, and upload-in-progress states, and restrict the offered types to מחלה and מילואים when the selected dates fall in a locked month.
- [ ] 6.8 Show that a sick or military absence saved without a document is still expecting one, without blocking the save.
- [ ] 6.9 Component-test every scenario in `specs/absence-reporting-ui/spec.md`.
- [ ] 6.10 Verify `pnpm --filter @abra/mobile test:coverage` passes the 70% gate.

## 7. End-to-end (KAN-88)

- [ ] 7.1 Extend `prisma/seed.ts` with absence fixtures: a sick absence with no document, and a vacation range spanning a weekend. Reuse the locked month that daily-reporting task 9.1 seeds rather than locking a second one; add it here if that task has not landed (Risks).
- [ ] 7.2 Add `e2e/specs/absences.spec.ts`: the seeded employee reports a vacation range spanning a weekend and only the working days are stored.
- [ ] 7.3 Assert a half-day absence requires a period and saves with one.
- [ ] 7.4 Assert a sick absence saves with no document and is flagged, then a document added later clears the flag — including when the month has locked in between.
- [ ] 7.5 Assert the locked-month matrix: vacation refused with 403, sick accepted.
- [ ] 7.6 Assert the weekend days of a split range are **not** reported as absence days, and assert a reported range renders as ABSENCE in the monthly calendar — `e2e/specs/monthly-view.spec.ts` and `apps/mobile/src/features/monthly/` exist on this branch, so this assertion can be written for real rather than stubbed.
- [ ] 7.7 Confirm the spec runs in the required CI e2e job.

## 8. Close out

- [ ] 8.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, and `pnpm build` across the workspace.
- [ ] 8.2 Verify each requirement in the four delta specs against the running system on `dev`.
- [ ] 8.3 Record the OQ-04 resolution (half-day is a 4.5h target, not phantom hours) wherever the project's open-questions list lives, and close it.
- [ ] 8.4 Move KAN-85/86/87/88 and KAN-89…92 to Done and close the KAN-66 epic. (The wider board was already corrected when this change was written — see proposal.)
- [ ] 8.5 Run `/opsx:sync` to fold `absences-api`, `absence-attachments`, `absence-reporting-ui`, and the `day-status` modification into `openspec/specs/`, then `/opsx:archive` this change.
- [ ] 8.6 Coordinate the `day-status` change with PR #72 before either merges — both touch `packages/contracts`, and `calendar-grid.tsx` is a live consumer of `computeDayStatus`.
