# Contract: Users Create (KAN-46)

**Feature**: `003-admin-create-user` | **Date**: 2026-08-17  
**Endpoint**: `POST /api/v1/users`  
**Auth**: Bearer access token; **Admin** role only (401 if missing/invalid; 403 if employee)  
**Implementation target**: Zod schemas in `packages/contracts` (consumed by API validation and admin client)

## Request body

Content-Type: `application/json`

| Field      | Type                  | Required | Notes                                                                                            |
| ---------- | --------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `fullName` | string                | yes      | Trim; empty after trim → VAL-10                                                                  |
| `email`    | string                | yes      | Trim, then lowercase for storage; format → VAL-02                                                |
| `password` | string                | yes      | Write-only initial password; **not** trimmed; empty → VAL-13; shorter than 8 characters → VAL-04 |
| `role`     | `employee` \| `admin` | yes      | VAL-12. Empty form **UI** defaults to `employee`; API still validates                            |

```json
{
  "fullName": "Nadav Cohen",
  "email": "Nadav@Org.com",
  "password": "secret123",
  "role": "employee"
}
```

After normalize, stored email is `nadav@org.com`.

## Success response — `201 Created`

Reuse `UserListItem` inside a single-resource envelope:

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "fullName": "Nadav Cohen",
    "email": "nadav@org.com",
    "role": "employee",
    "isActive": true
  }
}
```

`isActive` is always `true` for a newly created person.

**Forbidden fields** in this body (and in later list rows): `password`, `passwordHash`, `password_hash`, `tokenVersion`, `token_version`, `deletedAt`.

## Error responses

Standard envelope (GENERAL_SPEC §6.5):

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [{ "field": "fullName", "rule": "VAL-10", "message": "שם מלא הוא שדה חובה" }]
}
```

| Status | When                                                              | `details[].rule`                            |
| ------ | ----------------------------------------------------------------- | ------------------------------------------- |
| `400`  | Missing/whitespace name                                           | VAL-10                                      |
| `400`  | Missing or malformed email (including spaces-only)                | VAL-02 (format / required-as-invalid-email) |
| `400`  | Invalid or missing role                                           | VAL-12                                      |
| `400`  | Missing password                                                  | VAL-13                                      |
| `400`  | Password shorter than 8 characters                                | VAL-04                                      |
| `409`  | Email already used by a **non-deleted** person (case-insensitive) | VAL-11 on `email`                           |
| `401`  | Missing/invalid token                                             | —                                           |
| `403`  | Authenticated non-admin                                           | —                                           |

409 example:

```json
{
  "statusCode": 409,
  "message": "Conflict",
  "error": "Conflict",
  "details": [
    { "field": "email", "rule": "VAL-11", "message": "כתובת האימייל כבר בשימוש (VAL-11)" }
  ]
}
```

Hebrew `message` values must name the uniqueness rule for VAL-11 (include the rule id in the text or via `details[].rule` shown in the UI). Field errors use `VAL_MESSAGES`.

## Zod schema outline (to implement in `@abra/contracts`)

```text
CreateUserBodySchema
  fullName  — trim, min 1 → VAL-10
  email     — trim, email format → VAL-02, then lowercase
  password  — min 1 → VAL-13, min 8 → VAL-04, no trim
  role      — UserRole → VAL-12

UserCreateSuccessSchema   # { data: UserListItem }

ValCode                   # add VAL-10 | VAL-11 | VAL-12 | VAL-13
VAL_MESSAGES              # Hebrew strings for those ids
LoginSchema.email         # trim + lowercase so sign-in matches stored email
```

Export from package `index` for Nest pipes and admin parse/type inference.

Admin client: `POST` JSON to `/users` (same `VITE_API_URL` + `apiFetch` as list). `apiFetch` already redirects to sign-in on 401.

## Out of scope for this contract

`GET /users/:id`, `PATCH /users/:id`, `DELETE /users/:id`, `POST .../reset-password` — sibling stories. No confirm-password field. No HR attributes.
