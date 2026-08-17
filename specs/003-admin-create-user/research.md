# Research: Admin Create User

**Feature**: `003-admin-create-user` | **Date**: 2026-08-17

## 1. Auth and directory prerequisites (KAN-39, KAN-45)

**Decision**: Treat JwtGuard + RolesGuard + admin session redirect as a hard prerequisite from KAN-39, and the Users directory (`GET /api/v1/users`, `/admin/users`) as a hard prerequisite from KAN-45. This feature adds `POST /api/v1/users` on the existing users module and opens create from that Users screen. It does not re-implement login, JWT verification, or the table. On `401` during create submit, reuse `apiFetch` (clear token, send admin to `/admin/login`).

**Rationale**: Spec FR-010 / FR-013 and assumptions assign auth to KAN-39 and the directory to KAN-45. Duplicating those would violate FR-014 (no edit/reset/deactivate) and FR-013’s same-phase create slice.

**Alternatives considered**:

- Stub a public create endpoint for early UI → rejected (fails admin-only AC).
- Ship create API without the Users modal → rejected (FR-013 / SC-009).

## 2. Shared create contract (request, 201 body, VAL ids)

**Decision**: Add Zod schemas in `@abra/contracts` for `CreateUserBody` (`fullName`, `email`, `password`, `role`) and `UserCreateSuccess` (`{ data: UserListItem }`). JSON is camelCase. Reuse existing `UserListItemSchema` for the created person (same public fields as a directory row). Put VAL ids in Zod issue `message` (same pattern as `LoginSchema`): VAL-10 name, VAL-02 email format, VAL-12 role, VAL-13 missing password, VAL-04 password length. Duplicate email is **not** a Zod issue — it is 409 + VAL-11 from the service. Extend `VAL_MESSAGES` / `ValCode` with VAL-10–13 (Hebrew). `zodIssuesToDetails` must prefer a `VAL-*` issue message as `details[].rule`.

**Rationale**: Spec assumptions and GENERAL_SPEC §6.4 / §6.5 / §9.2. Reusing `UserListItem` keeps list and create projections identical and secret-free.

**Alternatives considered**:

- Separate create-response DTO with extra fields → rejected (spec: same public fields as a directory row).
- OpenAPI-only without Zod → rejected (contracts package is the shared source).
- Field name `initialPassword` → rejected; `password` matches login naming; document write-only.

## 3. Email normalize, uniqueness, and sign-in case

**Decision**: On create, trim surrounding whitespace then store email in lowercase. Uniqueness is among non-deleted people only, compared without regard to letter case: look up with a case-insensitive match (Prisma `mode: 'insensitive'`) among live rows, then insert; map Prisma `P2002` on `email` to 409 + VAL-11 for races. Soft-deleted rows do not block reuse (partial unique index `users_email_unique` where `deleted_at IS NULL`). Directory and 201 body show the stored lowercase address.

Sign-in must match that stored form: trim + lowercase the typed email before lookup. This feature does **not** add a login screen. It **does** extend `LoginSchema` so `email` is trimmed and lowercased (VAL-01 / VAL-02 still apply before/on empty). KAN-39 login must use that normalized email. Immediate sign-in with the initial password is in scope (US3); the dedicated Playwright create-then-login walk remains KAN-49.

**Rationale**: Clarifications 2026-08-17; FR-005 / FR-009; PostgreSQL unique index is case-sensitive, so lowercase storage is what makes uniqueness case-insensitive going forward. Insensitive pre-check covers any mixed-case rows already in the DB.

**Alternatives considered**:

- citext / unique index on `LOWER(email)` migration → unnecessary if all new emails are stored lowercase; seed emails are already lowercase.
- Leave login case-sensitive → rejected (clarification: mixed case must still sign in).

## 4. Password hashing and first-login behavior

**Decision**: Do not trim the password (leading/trailing spaces are part of the secret). Require non-empty (VAL-13) and length ≥ 8 (VAL-04); no extra complexity. Hash with bcrypt, **salt rounds 10**, matching `server/api/prisma/seed.ts`. Persist only `password_hash`. Never select, return, or log `password`, `password_hash`, or `token_version`. There is no must-change-password column; create must not invent one (ADR-16 / FR-009). `token_version` stays at default `0` so the new person can obtain tokens immediately once KAN-39 login exists.

**Rationale**: FR-007 / FR-008 / SC-007 / SC-008; GENERAL_SPEC §5.3 / §13.2. Same hasher as seed so created people authenticate the same way as demo users.

**Alternatives considered**:

- argon2 / scrypt → rejected (stack already uses bcrypt).
- Higher bcrypt cost → rejected (keep seed parity; p95 budget).
- Confirm-password field → rejected (spec assumptions).

## 5. Create persistence and default person state

**Decision**: `UsersService.create` inserts `full_name` (trimmed; whitespace-only → VAL-10), normalized email, `password_hash`, and `role`. Rely on Prisma defaults: `is_active=true`, `deleted_at=null`, `token_version=0`. No schema change. Map created row with the same select as list (`USER_LIST_SELECT`) into `UserListItem`. Return HTTP **201** with `{ data: item }`.

**Rationale**: FR-003; existing User model already matches Epic 3’s four create fields. Extra HR attributes are out of scope (FR-015).

**Alternatives considered**:

- Soft-create as inactive until first login → rejected (spec: active immediately).
- New table or profile entity → rejected (YAGNI).

## 6. HTTP errors and form UX mapping

**Decision**:

| Outcome | API | Admin form |
| ------- | --- | ---------- |
| Field validation | `400` + `details[].rule` VAL-10 / VAL-02 / VAL-12 / VAL-13 / VAL-04 | Stay open; Hebrew field errors from `VAL_MESSAGES` |
| Duplicate email | `409` + VAL-11 on `email` | Stay open; Hebrew uniqueness error that names VAL-11 |
| Expired / missing session | `401` | Existing `apiFetch` → `/admin/login` |
| Employee caller | `403` | Denied (no create control for employees; API still 403) |
| Other failure (5xx, network) | non-401/400/409 | Stay open; Hebrew retry error; keep typed values; do not treat as expiry |

While the request is in flight: saving state, submit disabled (SC-010). Empty form default role = **employee** (רגיל); admin may change to אדמין. After **201**: close modal; **do not** reset page/search/filters/sort; re-fetch the current list path only. New person appears only if that page’s query would include them.

**Rationale**: Clarifications (unavailable service; stay on current page); FR-003 / FR-011 / FR-012 / FR-017.

**Alternatives considered**:

- Jump to page 1 or open the new row after create → rejected (clarification).
- Close modal on 5xx → rejected (form stays open with Hebrew error).
- Client-only uniqueness check → rejected (must be server-enforced).

## 7. CrudModal as first shared create surface

**Decision**: Introduce shared `CrudModal` under `apps/admin/src/components/ui/` as part of this delivery (first consumer per GENERAL_SPEC §10.2), in **create mode only**. Users page owns the trigger, maps fields (full name, email, password, role), and wires submit to `POST /users`. Edit configuration is KAN-47. Implement with existing React + Tailwind (native `<dialog>` or equivalent overlay); do **not** add react-hook-form or a new dialog library for the first modal — parse with the shared Zod schema on submit, same as the API.

Visuals follow the admin console (Hebrew RTL, Users screen, loading/error). Do not pixel-match the Figma time-report file (employee app only).

**Rationale**: Matches how KAN-45 introduced `DataTable`. Shared modal unblocks later Clients/Projects/Tasks create without a one-off Users dialog.

**Alternatives considered**:

- Users-only modal with no shared primitive → rejected (GENERAL_SPEC marks CrudModal as shared).
- Add RHF + Radix dialog now → extra admin dependencies; not required for four fields.

## 8. Testing strategy for same-phase delivery

**Decision**: (1) Contract tests: create body VAL-10/02/12/13/04, email trim+lowercase, password not trimmed, success envelope has no password fields; LoginSchema lowercases email. (2) API integration: 201 employee and admin; lowercase stored email; bcrypt hash verifies initial password and is absent from body; 400 per VAL; 409 VAL-11 for live duplicate including mixed case; 201 when email belongs only to a soft-deleted person; 401/403; never return hashes. (3) Admin RTL: open form, default role employee, saving disables submit, field/conflict/unavailable Hebrew errors keep the form open, 401 redirects, success closes modal and refetches **current** page (assert page query unchanged). Seed data from KAN-32 is enough for conflicts; tests may insert a soft-deleted fixture for reuse-email.

KAN-49 Playwright create-then-login remains out of scope. US3 is proven here by: create hash verifies, and (when KAN-39 login is present) login with mixed-case email + initial password succeeds on the matching product. Role isolation (employee cannot use admin console and vice versa) remains KAN-39 route rules; this feature does not add new login UIs.

**Rationale**: FR-013 / SC-002 / SC-009; GENERAL_SPEC §14.

**Alternatives considered**:

- FE-only mocked create → rejected (same-phase requirement).
- Fold KAN-49 e2e into this branch → rejected (spec: separate delivery).
