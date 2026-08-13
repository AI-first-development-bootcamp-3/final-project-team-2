# Contract: Demo organization invariants

**Feature**: `001-domain-data-seed`  
**After**: successful `prisma db seed`

## Minimum counts

| Entity | Minimum | Notes |
|--------|---------|-------|
| User (admin) | 1 | known email + password (hashed at rest) |
| User (employee) | 2 | known emails + passwords |
| Client | 2 | active, not soft-deleted |
| Project | 3 | each linked to a Client |
| Task | ≥1 per project | status `open` |
| TaskAssignment | ≥1 linking employees into each of the 3 projects | unique `(user_id, task_id)` |
| TimeEntry (full week) | 5 completed days (Sun–Thu), 9h each, for **one** employee | open month |
| TimeEntry (partial) | ≥1 completed entry totaling < full week for **other** employee | same week context |
| Absence | ≥1 | belongs to partial employee; no attachment rows |
| MonthLock (locked) | 1 | past month ≠ demo week month |
| MonthLock for demo week month | 0 locked | month remains open |
| AuditLog | 0 required | |
| AbsenceAttachment | 0 required | |

## Credentials contract

| Role | Email | Password (local docs only) |
|------|-------|----------------------------|
| admin | stable demo email (documented in quickstart) | ≥8 chars, bcrypt in DB |
| employee 1 | stable demo email | ≥8 chars, bcrypt in DB |
| employee 2 | stable demo email | ≥8 chars, bcrypt in DB |

Exact email/password strings are implementation constants; they MUST be stable across re-seeds and documented in `quickstart.md`.

## Wipe invariants

- Re-seed deletes/recreates **only** records in the demo identity set (stable emails / fixed UUIDs).
- Any row whose identity is outside the demo set MUST remain unchanged after re-seed.
- After re-seed, minimum counts above MUST hold again.

## Soft-delete / status defaults for seeded rows

- `deleted_at` = null on soft-deletable demo rows
- User/Client/Project `is_active` = true
- Task `status` = `open`
- TimeEntries completed (`end_at` not null)
