# Research: Admin Projects CRUD

**Feature**: `006-admin-projects-crud` | **Date**: 2026-08-18

## 1. Auth, Clients catalog, and reuse of the entity-management slice

**Decision**: Treat JwtGuard + RolesGuard + admin session redirect as a hard prerequisite from KAN-39, and the Clients catalog (`GET /api/v1/clients`, `/admin/clients`) as a hard prerequisite from KAN-50. This feature owns `/api/v1/projects` (list, get, create, update, remove) and `/admin/projects`. It does not re-implement login, the sidebar, or Clients CRUD. On `401` during a Projects form submit, reuse `apiFetch` (clear token, send admin to `/login`).

An entity-management OpenSpec change already landed Prisma `Project`, Zod project schemas, Nest `projects` module, and an admin Projects page. This speckit plan **reuses that slice as the implementation base** and treats remaining work as **alignment with KAN-51**: inactive vs remove, distinguishable removed rows, client-name sort, keep-current-client on edit, Hebrew copy, and picker/history tests. Do not add a second projects module.

**Rationale**: Spec FR-013 / FR-017 and assumptions assign auth to the auth epic and Clients to KAN-50. Duplicating those would violate FR-019’s sibling-story boundary. YAGNI: the Project model already matches GENERAL_SPEC §4.3.

**Alternatives considered**:

- Greenfield projects module beside the existing one → rejected (duplicate, unjustified complexity).
- Ship API without `/admin/projects` (or vice versa) → rejected (FR-017 / SC-012).
- Stub a public list for early UI → rejected (fails admin-only AC).

## 2. Shared CRUD contract (list, get, create, update, remove)

**Decision**: Keep Zod in `@abra/contracts` as the source of truth. JSON is camelCase. Reuse `ProjectListItem` for list rows, get-one, create 201, and update 200. Envelope shapes match GENERAL_SPEC §6.4 / §6.6:

- List: `{ data: ProjectListItem[], meta: { page, limit, total } }`
- Single: `{ data: ProjectListItem }`
- Delete: **204** empty body
- Errors: `{ statusCode, message, error, details[] }` with `details[].rule` VAL ids

Extend `ProjectListItem` with `isDeleted` (boolean derived from `deleted_at != null`) so include-removed rows are distinguishable from live inactive ones. Add `clientName` to the list `sort` enum (visible column). Put VAL ids in Zod issue `message` (same pattern as Clients/Users): VAL-22 name, VAL-23 clientId uuid/required. Unusable live client is **not** a Zod issue — it is **422** + VAL-23 from the service.

**Rationale**: Spec assumptions and KAN-69 contract pattern. Reusing one item DTO keeps list and write projections identical.

**Alternatives considered**:

- OpenAPI-only without Zod → rejected (contracts package is the shared source).
- Separate create-response DTO → rejected (same public fields as a catalog row).
- Expose `deletedAt` timestamp → rejected; boolean `isDeleted` is enough for the catalog and avoids leaking internal timestamps (Users list also hid `deletedAt`).

## 3. Inactive vs removed (two operations)

**Decision**: Keep `is_active` and `deleted_at` as **independent** flags.

| Action     | API                           | Persistence                                              | Default catalog                     | New-entry picker            |
| ---------- | ----------------------------- | -------------------------------------------------------- | ----------------------------------- | --------------------------- |
| Create     | `POST /projects`              | `is_active=true`, `deleted_at=null`                      | Visible, status פעיל                | Visible (if assigned later) |
| Deactivate | `PATCH` `{ isActive: false }` | `is_active=false` only                                   | **Still visible**, status לא פעיל   | Hidden                      |
| Reactivate | `PATCH` `{ isActive: true }`  | `is_active=true`                                         | Visible, פעיל                       | Visible again               |
| Remove     | `DELETE /projects/:id`        | `deleted_at=now()`; do **not** require `is_active=false` | Hidden unless `includeDeleted=true` | Hidden                      |

Admin UI must expose both: edit form toggles active/inactive; a separate remove flow uses Hebrew confirmation **ביטול** / **מחיקה**. Do not map the row action השבת to `DELETE`. Include-removed control is labeled as including **removed** rows, not as “כולל מושבתים”.

**Rationale**: FR-003 / FR-010 / FR-012. Clients already deactivate via `PATCH isActive` and remove via `DELETE`. The current Projects page calling `DELETE` from השבת collapses the two states and fails US4 vs US5.

**Alternatives considered**:

- Users-style deactivate that sets both `is_active=false` and `deleted_at` → rejected (Users combine them; KAN-51 explicitly separates inactive catalog rows from removed ones).
- Physical `DELETE FROM` → rejected (§6.10 / §8.3).

## 4. VAL-22 / VAL-23 and keep-current-client on edit

**Decision**:

| Input                                                                    | HTTP          | Rule                                                          |
| ------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------- |
| Missing / whitespace-only name                                           | `400`         | VAL-22                                                        |
| Missing clientId or not a UUID                                           | `400`         | VAL-23                                                        |
| UUID of inactive, removed, or unknown client **when assigning/changing** | `422`         | VAL-23                                                        |
| Duplicate project name                                                   | `201` / `200` | Allowed — names are **not** unique (unlike VAL-21 on clients) |

Create always validates the chosen client is active and not removed (`validateClientId`). Update re-applies VAL-23 **only when `clientId` is present and different from the project’s current `client_id`**. Saving name or `isActive` without a client change MUST succeed even if the current parent client was later deactivated. If the payload sends the same `clientId` as stored, treat it as no change (do not 422).

Create/edit client pickers list `GET /clients?limit=100&isActive=true` (middleware already drops `deleted_at`). On edit, if the current client is missing from that active list, still show it as the selected option (label = current `clientName`) so the admin can save other fields without being forced to pick a different client.

**Rationale**: FR-008 / FR-009 / FR-010; US4 scenario 5; GENERAL_SPEC §6.6 (422 = business rule). Edit modal today always PATCHes `clientId`, which would incorrectly 422 after a later client deactivation.

**Alternatives considered**:

- Re-validate client on every PATCH → rejected (fails keep-current-client).
- Unique project names → rejected (spec edge case; KAN-51 AC does not require uniqueness).

## 5. List conventions (pagination, search, filter, sort)

**Decision**: Match Users/Clients catalogs.

- Default: `page=1`, `limit=20`, `sort=name`, `order=asc`, `includeDeleted=false`
- UI always sends `limit=20` and offers **no** page-size control
- Past-last page: **200** with `data: []` and real `meta.total`
- `q`: trim; empty after trim = no text filter; case-insensitive partial match on **project name only**
- `clientId`: optional UUID; exact parent filter
- `isActive`: optional boolean on `is_active` (independent of removed)
- `includeDeleted=true`: bypass soft-delete middleware (`deleted_at: {}` pattern already used by Users/Clients)
- Sortable fields: `name`, `clientName` (order by related `client.name`), `isActive`
- Changing search, filters, or sort resets UI to page 1; successful create refreshes the **current** page of the same query (does not jump to page 1)

**Rationale**: FR-002 / FR-004 / FR-007; US1 scenario 10 (sort by a visible column including client name). Current `ProjectsListSortSchema` is only `name | isActive` and the client column is not sortable — that is a KAN-51 gap.

**Alternatives considered**:

- Client-only sort of the current page → rejected (wrong across pages).
- Search client name in `q` → rejected (spec: search by project name; client is a filter).

## 6. Historical rendering and new-entry picker hide

**Decision**: TimeEntry stores `task_id` only (no denormalized `projectName`). Historical display joins `TimeEntry → Task → Project`. Soft-delete middleware **would hide** a removed Project on naïve nested `include`. Future TimeEntry read endpoints (out of this feature) MUST bypass the filter on related Project/Task/Client (`deleted_at` explicitly set in nested `where`, or equivalent) so the stored name still renders. Deactivating a project does not touch TimeEntry rows.

For **this** feature’s tests (spec assumption: prove against picker data and stored display, not a full employee reporting screen):

1. **Picker hide**: after `PATCH isActive=false` or `DELETE`, `GET /api/v1/me/assignments` as an assigned employee MUST omit that `projectId`. Implementation already filters `project.is_active=true` and `deleted_at=null`.
2. **History keep**: after deactivate or remove, a seeded or fixture TimeEntry still resolves `project.name` when the read **explicitly includes** deleted related rows. Assert at API/service/integration level; do not wait for mobile report UI (later epic).

Do not cascade: deactivate/remove MUST NOT close or soft-delete child tasks (`Task.status` and `Task.deleted_at` unchanged).

**Rationale**: FR-011 / FR-012 / SC-006 / SC-007; GENERAL_SPEC §8.3 / ADR-15.

**Alternatives considered**:

- Denormalize `projectName` onto TimeEntry in this story → rejected (schema change out of scope; join is the product model).
- Full Playwright employee report screen → rejected (spec: later epic).

## 7. Admin Projects screen (Hebrew RTL)

**Decision**: `/admin/projects` on existing `DataTable` + `CrudModal`. Columns: project name, client name, status (פעיל / לא פעיל). When `includeDeleted`, removed rows are visually distinct (e.g. הוסר) using `isDeleted`. Catalog client filter may list non-deleted clients (active and inactive). Create modal copy matches the portal Figma create-project modal: title **יצירת פרויקט**, fields **שם הפרויקט** and **שם הלקוח**, primary action **צור פרויקט**. Empty state copy **אין מידע קיים עד כה**. Loading state while the list fetches. Remove confirmation: ביטול / מחיקה. Out of scope on the form: lead manager, start/end dates, description (FR-018). Do not treat “View Tasks” / task-count as KAN-51 acceptance (FR-019); do not add those as this feature’s requirements.

While create/edit/remove is in flight: saving state, submit disabled (SC-010). Field errors stay on the open form. Non-401/400/422 failures: Hebrew retry error, keep typed values, do not redirect to sign-in.

**Rationale**: FR-014 / FR-015 / FR-016 / FR-018; screen inventory §11.2.

**Alternatives considered**:

- Pixel-match extra Figma fields → rejected (not in KAN-51 AC or §4.3).
- Combined ניהול לקוחות/פרויקטים table → rejected (KAN-53).

## 8. Testing strategy for same-phase delivery

**Decision**:

1. **Contracts**: list query defaults, `clientName` sort, `isDeleted` on item, VAL-22/VAL-23 on create body, whitespace name, names not unique (schema allows duplicate strings), update optional fields.
2. **API integration**: 200 list with `clientName` join; page size 20 / past-last empty + real total; search/filter/`includeDeleted`; 201 default `isActive=true`; 400 VAL-22; 400/422 VAL-23; PATCH keep-current-client when parent later inactive; PATCH `isActive=false` does not change tasks; DELETE 204 does not change tasks; 401/403; employee `/me/assignments` omits inactive and removed projects; TimeEntry fixture still resolves project name after remove when the read includes deleted relations.
3. **Admin RTL**: columns, loading, empty copy, client filter, include-removed distinction, create fields and צור פרויקט, saving disables submit, VAL Hebrew errors keep form open, 401 redirects, 5xx keeps form + typed values, success create stays on current page query, remove confirmation ביטול/מחיקה, deactivate via PATCH not DELETE.

Seed Acme/Globex projects from KAN-32 are enough for list/filter; tests insert extra fixtures for VAL-23, cascade, and history.

**Rationale**: FR-017 / SC-012; GENERAL_SPEC §14.

**Alternatives considered**:

- FE-only mocked CRUD → rejected (same-phase requirement).
- Fold KAN-54 entity-chain e2e into this branch → rejected (sibling story).
