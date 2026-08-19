# Data Model: Fix Admin Logout Relogin

**Feature**: `008-fix-admin-logout` | **Date**: 2026-08-19

## Overview

No Prisma schema change. This feature **observes and transitions** the existing admin console session. Durable identity after a remount is the httpOnly refresh cookie plus `User.token_version` (KAN-39). The in-memory admin session is not persisted in web storage.

## Entities

### Admin console session (client, in-memory)

| Field       | Meaning                               | Persistence |
| ----------- | ------------------------------------- | ----------- |
| accessToken | Short-lived access JWT (~15 min)      | Memory only |
| user        | `{ id, email, fullName, role }`       | Memory only |
| role        | Must be `admin` for console admission | On `user`   |

Validation:

- `getAuthSession() === null` means signed out for routing guards.
- `isAdmin(session)` is the only role `RequireAdmin` / `RedirectIfAdmin` admit.
- Web storage must never authenticate (existing KAN-70 rule).

### Refresh cookie (browser, httpOnly)

| Field    | Value                                       |
| -------- | ------------------------------------------- |
| Name     | `refresh_token` (existing `REFRESH_COOKIE`) |
| Contents | Refresh JWT `{ userId, tokenVersion }`      |
| Flags    | httpOnly, Secure, SameSite=Strict, path `/` |
| Lifetime | 1 day, or 30 days if remember-me            |

Validation:

- Present + matching `token_version` → `POST /auth/refresh` may rebuild the in-memory session (`bootstrapSession`).
- Missing, expired, tampered, or version mismatch → refresh 401, session stays null.
- After Logout, this cookie MUST be expired/cleared so bootstrap cannot rebuild.

### User token version (existing Prisma `User.token_version`)

| Field         | Role                                               |
| ------------- | -------------------------------------------------- |
| token_version | Integer; refresh JWT must match; logout increments |

Logout that identified a user increments by 1. Outstanding refresh JWTs fail refresh. Access JWTs still die at their own expiry (unchanged).

## Session state machine

```text
signed_in  --Logout (sidebar or Users)-->  signing_out  -->  signed_out
signed_in  --401 + dead refresh---------->  signed_out
signed_out --valid credentials----------->  signed_in
signed_out --bootstrap / refresh--------->  signed_out   (must NOT return to signed_in)
```

| State       | In-memory session                | Refresh cookie       | Console UI                          |
| ----------- | -------------------------------- | -------------------- | ----------------------------------- |
| signed_in   | admin session                    | valid, version match | Authenticated shell                 |
| signing_out | clearing; refresh must not write | revoke in flight     | May still show shell until redirect |
| signed_out  | `null`                           | cleared or revoked   | Admin sign-in screen                |

Illegal transition (the bug): `signed_in → clear memory only → remount → bootstrap → signed_in`.

## Validation rules (from spec)

| Rule                                  | Source | Check                                                    |
| ------------------------------------- | ------ | -------------------------------------------------------- |
| Logout ends the session immediately   | FR-001 | After Logout, session is signed_out                      |
| No automatic re-admission             | FR-002 | Refresh/bootstrap after Logout must not `setAuthSession` |
| Protected pages require sign-in       | FR-003 | `RequireAdmin` with null session → `/login`              |
| Reload stays signed out               | FR-004 | Cookie cleared/revoked before remount                    |
| Intentional sign-in still works       | FR-005 | New login issues a new cookie + session                  |
| Remember-me does not override Logout  | FR-006 | 30-day cookie still cleared/revoked                      |
| Same browser does not inherit session | FR-007 | Next visitor sees sign-in                                |

## Fixture (checks only)

| Field    | Value                               |
| -------- | ----------------------------------- |
| email    | `admin@abra.co` (`E2E_ADMIN_EMAIL`) |
| password | `Admin123!` (`E2E_ADMIN_PASSWORD`)  |
| role     | admin                               |

Not created by this feature. Missing seed → logout journey fails fast on sign-in.
