# Contract: Projects CRUD (KAN-51)

**Feature**: `006-admin-projects-crud` | **Date**: 2026-08-18  
**Base path**: `/api/v1/projects`  
**Auth**: Bearer access token; **Admin** role only (401 if missing/invalid; 403 if employee)  
**Implementation target**: Zod schemas in `packages/contracts` (consumed by API validation and admin client)

Related: [data-model.md](../data-model.md). List conventions match Users (KAN-69) and Clients (KAN-50).

## `ProjectListItem`

Used in list rows, `GET :id`, create `201`, and update `200`.

| Field        | Type        | Notes                                                     |
| ------------ | ----------- | --------------------------------------------------------- |
| `id`         | uuid string |                                                           |
| `name`       | string      |                                                           |
| `clientId`   | uuid string | Parent client                                             |
| `clientName` | string      | Joined from parent client                                 |
| `isActive`   | boolean     | UI: פעיל / לא פעיל                                        |
| `isDeleted`  | boolean     | `true` when `deleted_at` is set; always `false` on create |

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Website Redesign",
  "clientId": "550e8400-e29b-41d4-a716-446655440000",
  "clientName": "Acme Corp",
  "isActive": true,
  "isDeleted": false
}
```

**Forbidden fields**: `deletedAt`, `createdAt`, `updatedAt` (membership of removed rows is gated by `includeDeleted` + `isDeleted`).

---

## `GET /api/v1/projects`

### Query parameters

| Param            | Type                                 | Required | Default | Description                                         |
| ---------------- | ------------------------------------ | -------- | ------- | --------------------------------------------------- |
| `page`           | integer                              | no       | `1`     | 1-based page index                                  |
| `limit`          | integer                              | no       | `20`    | Page size; max `100`                                |
| `q`              | string                               | no       | —       | Trimmed; case-insensitive partial match on **name** |
| `clientId`       | uuid                                 | no       | —       | Exact parent client filter                          |
| `isActive`       | boolean                              | no       | —       | Filter by `is_active`                               |
| `includeDeleted` | boolean                              | no       | `false` | When true, include soft-removed projects            |
| `sort`           | `name` \| `clientName` \| `isActive` | no       | `name`  | Sort field                                          |
| `order`          | `asc` \| `desc`                      | no       | `asc`   | Sort direction                                      |

Invalid query (page/limit/sort/order/uuid) → `400` with standard error envelope.

### Success — `200`

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "Website Redesign",
      "clientId": "550e8400-e29b-41d4-a716-446655440000",
      "clientName": "Acme Corp",
      "isActive": true,
      "isDeleted": false
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3 }
}
```

Past-last page: `200` with `data: []` and `meta.total` equal to the real match count; `meta.page` echoes the requested page.

---

## `GET /api/v1/projects/:id`

### Success — `200`

```json
{
  "data": {
    "id": "…",
    "name": "…",
    "clientId": "…",
    "clientName": "…",
    "isActive": true,
    "isDeleted": false
  }
}
```

### Errors

| Status        | When                                            |
| ------------- | ----------------------------------------------- |
| `404`         | Unknown id, or soft-removed (default read path) |
| `401` / `403` | Auth                                            |

---

## `POST /api/v1/projects`

### Request body

| Field      | Type   | Required | Notes                                               |
| ---------- | ------ | -------- | --------------------------------------------------- |
| `name`     | string | yes      | Trim; empty after trim → VAL-22                     |
| `clientId` | uuid   | yes      | Must be an active, non-removed client → else VAL-23 |

```json
{
  "name": "New Project",
  "clientId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Names need not be unique. `isActive` is **not** accepted on create (always true).

### Success — `201 Created`

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440099",
    "name": "New Project",
    "clientId": "550e8400-e29b-41d4-a716-446655440000",
    "clientName": "Acme Corp",
    "isActive": true,
    "isDeleted": false
  }
}
```

---

## `PATCH /api/v1/projects/:id`

### Request body (all fields optional)

| Field      | Type    | Notes                                                 |
| ---------- | ------- | ----------------------------------------------------- |
| `name`     | string  | Trim; empty after trim → VAL-22                       |
| `clientId` | uuid    | VAL-23 **only if different** from current `client_id` |
| `isActive` | boolean | Deactivate/reactivate; does not cascade to tasks      |

```json
{ "name": "Updated Project", "isActive": false }
```

### Success — `200`

`{ "data": ProjectListItem }`

Same-client `clientId` in the payload is a no-op for VAL-23 (keep-current-client).

Unknown or removed id → `404`.

---

## `DELETE /api/v1/projects/:id`

Soft-remove: set `deleted_at`. Do not physically destroy. Do not cascade to tasks.

### Success — `204 No Content`

Empty body.

Unknown id → `404`.

---

## Error responses

Standard envelope (GENERAL_SPEC §6.5):

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [{ "field": "name", "rule": "VAL-22", "message": "שם הפרויקט הוא שדה חובה" }]
}
```

| Status | When                                                                | `details[].rule`     |
| ------ | ------------------------------------------------------------------- | -------------------- |
| `400`  | Missing / whitespace name                                           | VAL-22 on `name`     |
| `400`  | Missing or non-UUID `clientId`                                      | VAL-23 on `clientId` |
| `422`  | Client inactive, removed, or unknown (create or **changed** client) | VAL-23 on `clientId` |
| `401`  | Missing/invalid token                                               | —                    |
| `403`  | Authenticated non-admin                                             | —                    |
| `404`  | Get/update/remove unknown (or removed on get/update)                | —                    |

422 example:

```json
{
  "statusCode": 422,
  "message": "Validation failed",
  "error": "Unprocessable Entity",
  "details": [{ "field": "clientId", "rule": "VAL-23", "message": "יש לבחור לקוח תקין ופעיל" }]
}
```

Hebrew `message` values come from `VAL_MESSAGES`. The admin UI shows `details[].rule` / `VAL_MESSAGES` so VAL-22 and VAL-23 are named.

---

## Zod schema outline (to implement / extend in `@abra/contracts`)

```text
ProjectsListQuerySchema     # coerce page/limit/booleans; sort name|clientName|isActive
ProjectListItemSchema       # id, name, clientId, clientName, isActive, isDeleted
ProjectsListSuccessSchema   # { data: ProjectListItem[], meta }
ProjectGetSuccessSchema     # { data: ProjectListItem }

CreateProjectBodySchema     # name → VAL-22; clientId uuid → VAL-23
ProjectCreateSuccessSchema  # { data: ProjectListItem }

UpdateProjectBodySchema     # optional name (VAL-22), clientId (VAL-23 uuid), isActive
ProjectUpdateSuccessSchema  # { data: ProjectListItem }

ValCode / VAL_MESSAGES      # VAL-22, VAL-23 already present
```

Export from package `index` for Nest pipes and admin parse/type inference.

Admin client: `VITE_API_URL` + `apiFetch` as other catalogs. `apiFetch` already redirects to sign-in on 401.

Employee picker (prove hide rule; not an admin Projects endpoint): `GET /api/v1/me/assignments` already returns `{ data: [{ taskId, taskName, projectId, projectName, clientId, clientName }] }` excluding inactive/removed projects.

## Out of scope for this contract

Task CRUD, assignments, per-project hour-report type, lead manager / dates / description on the project body, combined clients/projects assignment table, TimeEntry write APIs. `GET /me/assignments` is owned by the employee-picker slice; this feature only **asserts** it hides inactive/removed projects.
