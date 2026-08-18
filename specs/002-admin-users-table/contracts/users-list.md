# Contract: Users List (KAN-69)

**Feature**: `002-admin-users-table` | **Date**: 2026-08-17  
**Endpoint**: `GET /api/v1/users`  
**Auth**: Bearer access token; **Admin** role only (401 if missing/invalid; 403 if employee)  
**Implementation target**: Zod schemas in `packages/contracts` (consumed by API validation and admin client)

## Query parameters

| Param            | Type                                          | Required | Default    | Description                                                   |
| ---------------- | --------------------------------------------- | -------- | ---------- | ------------------------------------------------------------- |
| `page`           | integer                                       | no       | `1`        | 1-based page index                                            |
| `limit`          | integer                                       | no       | `20`       | Page size; max `100`                                          |
| `q`              | string                                        | no       | —          | Trimmed; case-insensitive partial match on full name or email |
| `role`           | `employee` \| `admin`                         | no       | —          | Exact role filter                                             |
| `isActive`       | boolean                                       | no       | —          | Filter by active flag                                         |
| `includeDeleted` | boolean                                       | no       | `false`    | When true, include soft-deleted users                         |
| `sort`           | `fullName` \| `email` \| `role` \| `isActive` | no       | `fullName` | Sort field                                                    |
| `order`          | `asc` \| `desc`                               | no       | `asc`      | Sort direction                                                |

### Query validation failures → `400`

Use standard error envelope (§6.5) with `details[].field` / `details[].rule` where applicable (e.g. invalid `limit`, unknown `sort`).

## Success response — `200`

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "fullName": "Alice Cohen",
      "email": "employee1@abra.co",
      "role": "employee",
      "isActive": true
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 3
  }
}
```

### `UserListItem` fields

| Field      | Type                  | Notes                              |
| ---------- | --------------------- | ---------------------------------- |
| `id`       | uuid string           |                                    |
| `fullName` | string                | From `full_name`                   |
| `email`    | string                |                                    |
| `role`     | `employee` \| `admin` |                                    |
| `isActive` | boolean               | UI status label: active / inactive |

**Forbidden fields**: `passwordHash`, `password_hash`, `tokenVersion`, `token_version`, `deletedAt` (not exposed; includeDeleted only affects membership).

### Past-last page

If `page` is beyond the last page but otherwise valid: `200` with `data: []` and `meta.total` equal to the real match count; `meta.page` echoes the requested page.

## Error responses

| Status | When                                        |
| ------ | ------------------------------------------- |
| `401`  | Missing/invalid token                       |
| `403`  | Authenticated non-admin                     |
| `400`  | Invalid query (page/limit/sort/order/enums) |

Error body shape (GENERAL_SPEC §6.5):

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [{ "field": "limit", "rule": "VAL-LIMIT", "message": "…" }]
}
```

## Zod schema outline (to implement in `@abra/contracts`)

```text
UserListItemSchema
UsersListQuerySchema          # coerce page/limit/booleans from query strings
UsersListSuccessSchema        # { data: UserListItem[], meta: { page, limit, total } }
ApiErrorSchema                # shared if not already present
```

Export from package `index` for Nest pipes and admin parse/type inference.

## Out of scope for this contract

`GET /users/:id`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`, `POST .../reset-password` — sibling stories.
