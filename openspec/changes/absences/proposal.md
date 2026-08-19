## Why

An employee who is on vacation, sick, or on reserve duty currently has no way to say so. Their days read as `empty` — indistinguishable from days they simply forgot to report — which makes the monthly view untrustworthy and gives the admin nothing to check before locking a month. Absences are also where the law reaches into the product: sick and reserve-duty days require a document, and the system has to hold one.

The groundwork is already in place and was deliberately built for this epic. `Absence` and `AbsenceAttachment` exist in the schema and in the initial migration. `MonthLockService` is exported from `TimeEntriesModule` with a comment naming this epic as the reason. `computeDayStatus` already accepts an `absences` argument and already returns an `absence` status that no caller can currently produce. This change fills seams that are waiting rather than cutting new ones.

It also settles two rules that Epic 6 (Monthly View) and Epic 9 (Month Close) both depend on and cannot cheaply retrofit: how a weekend-spanning range is stored, and what a half-day absence does to a day's expected hours.

## What Changes

- **New `/api/v1/absences` endpoints** — create, list (own for employees, any user for admins, filterable by month), get by id, update, soft-delete. All four absence types: `vacation` / `sick` / `military` / `other`.
- **Validation rules VAL-40 through VAL-45** enforced server-side through the existing field-level error envelope and rule IDs:
  - VAL-40 valid `AbsenceType` · VAL-41 `start_date` required · VAL-42 `end_date >= start_date` · VAL-43 Fridays and Saturdays excluded from every range · VAL-44 sick/military require a document before month lock · VAL-45 month must not be locked, **unless** the type is sick or military.
- **Weekend exclusion by row splitting (VAL-43)** — one reported range becomes one `Absence` row per contiguous run of working days. A Thursday-to-Sunday vacation stores two rows, not one row spanning the weekend. This keeps the already-merged `isCoveredByAbsence` range check correct without teaching it about weekends.
- **A new nullable `group_id` column on `Absence`** so the rows produced by one report stay one thing to the employee: `PATCH` and `DELETE` on any row in a group act on the whole group. This is the change's only migration.
- **Half-day absences reduce the day's expected hours rather than claiming the day** — a half-day sets that day's target to 4.5h instead of 9h, and the day still classifies on hours against the reduced target. Resolves **OQ-04**.
- **Absence attachments on Vercel Blob** — `POST /api/v1/files/upload-url` issues a signed upload URL, `POST /api/v1/absences/:id/attachments` registers the uploaded file, `GET /api/v1/absences/:absenceId/attachments/:id/url` issues a signed download URL. 60-minute expiry, private access, JPG/PNG/PDF, 5MB ceiling (VAL-60/61/62).
- **Attachments are writable in a locked month** (§7.1) — documents arrive late, and refusing them after lock would make the rule unusable.
- **A `missingDocument` flag on absence reads** — sick and military absences without an attachment save successfully and are marked, so Epic 9's pre-lock warning list has something to consume. The flag ships; the warning screen does not.
- **Absence Report screen** at `/absence/new` (393px, RTL) — type picker, single-day / date-range calendar, `HalfDayToggle`, `AttachmentUpload`, notes. States: default, saving, validation-error, upload-in-progress.
- **Playwright e2e** covering the weekend-spanning range, half-day period requirement, sick-without-document then completed later, and the locked-month matrix.

Not in scope: month lock/unlock endpoints, pre-lock warning screens, and audit logging — Epic 9 (Month Close). Admin editing of employee absences — also Epic 9, since it requires `writeAuditLog`, which does not exist. The monthly calendar itself — Epic 6. Where this epic must interoperate with them it defines the seam and leaves the consumer to the owning epic.

## Capabilities

### New Capabilities

- `absences-api`: Employee CRUD over own absence records — four types, weekend-split ranges, half-days, group semantics, VAL-40…45, the locked-month matrix with its sick/military exception, and soft delete.
- `absence-attachments`: Signed upload and download of absence documents on Vercel Blob, with type and size enforcement, locked-month writability, owner-plus-admin download scoping, and the `missingDocument` flag.
- `absence-reporting-ui`: The employee absence report screen — type picker, single-day and range calendar, half-day toggle with period, attachment upload, and the four screen states.

### Modified Capabilities

- `day-status`: Half-day absences now reduce a day's expected minutes instead of covering the day outright, and the computation returns the day's target alongside its total. Full-day absence precedence is unchanged. Epic 6's `calendar-grid.tsx` (PR #72) already calls `computeDayStatus` and destructures only `status`, so adding `targetMinutes` is additive for it — but the half-day rule is a genuine behaviour change, which is why it lands alongside that PR rather than after it merges.

## Impact

**New code**

- `packages/contracts/src/absences/` — create/update/list schemas, the weekend-splitting helper, half-day rules
- `packages/contracts/src/attachments/` — file type and size schemas
- `server/api/src/modules/absences/` — controller, service, module
- `server/api/src/modules/absences/attachments.*` — signed URL issuing, registration, download scoping
- `server/api/src/common/blob/` — the Vercel Blob client wrapper
- `apps/mobile/src/features/absences/` — absence report screen, `HalfDayToggle`, `AttachmentUpload`, calendar
- `e2e/specs/absences.spec.ts`

**Modified code**

- `packages/contracts/src/index.ts` — new exports, `ValCode` union and `VAL_MESSAGES` extended with VAL-40…45 and VAL-60…62
- `packages/contracts/src/day-status/day-status.ts` — half-day target reduction, `targetMinutes` on the result
- `server/api/prisma/schema.prisma` — `Absence.group_id`, nullable UUID, indexed
- `server/api/src/prisma/prisma.service.ts` — add `AbsenceAttachment` to `SOFT_DELETE_MODELS` (see design D7)
- `server/api/src/env.ts` and `.env.example` — `BLOB_READ_WRITE_TOKEN`, optional, with a clear runtime failure when an upload is attempted without it
- `server/api/src/app.module.ts` — register `AbsencesModule`
- `apps/mobile/src/App.tsx` — add the `/absence/new` route behind `ProtectedRoute`
- `server/api/prisma/seed.ts` — absence fixtures for e2e, including a sick absence with no document

**Migration**

- One additive migration: `Absence.group_id` (nullable UUID, indexed) and a `deleted_at` column on `absence_attachments`. Both are additive and safe to deploy ahead of the code.

**Unchanged**

- `Absence` and `AbsenceAttachment` tables otherwise — every other column this change needs already exists in `20260815000000_init`.
- `MonthLockService` — consumed exactly as exported, no change to its read semantics.
- `TimeEntry` and its endpoints.

**Downstream**

- Epic 6 (Monthly View) consumes `absences-api` reads and the modified `day-status` rather than reimplementing either.
- Epic 9 (Month Close) consumes the `missingDocument` flag for its pre-lock warning list, and adds admin edit-with-audit on top of these endpoints.

**Tracking**: KAN-66 (epic), KAN-85 + subtasks KAN-89/90, KAN-86 + subtasks KAN-91/92, KAN-87, KAN-88.

**Base branch**: `feat/kan-85-absences-api`, cut from `feat/kan-80-month-query` — the only branch carrying both `MonthLockService` and `MonthAbsenceSchema`, neither of which has reached `dev`. This change's PR therefore sits sixth in the open stack and cannot merge until PRs #54, #57, #58, and #72 land.

**Board state**, corrected 2026-08-19 as part of this change: KAN-74 and KAN-76 → Done (merged to `dev`); KAN-77, KAN-78, KAN-79 → In Review (complete, PRs open); KAN-75 → To Do (`daily-time-reporting/tasks.md` §9 is 0/8, no e2e spec exists on any branch). KAN-71, KAN-72, KAN-73 and KAN-80…84 were already accurate and were left alone.
