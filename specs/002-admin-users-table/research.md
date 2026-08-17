# Research: Admin Users Table

**Feature**: `002-admin-users-table` | **Date**: 2026-08-17

## 1. Auth dependency (KAN-39)

**Decision**: Treat JwtGuard + RolesGuard + admin sign-in as a hard prerequisite from KAN-39. This feature wires `GET /api/v1/users` and `/admin/users` to those guards; it does not implement login. On `401` while the Users screen is open, redirect to admin sign-in (clarification session).

**Rationale**: Spec FR-010 / SC-006 and GENERAL_SPEC §5 / §7.2 already assign auth to the auth epic. Duplicating login here would violate FR-015 scope and FR-014’s “directory only” boundary.

**Alternatives considered**:
- Stub public list endpoint for early UI → rejected (fails admin-only AC).
- Inline minimal JWT in this story → rejected (duplicates KAN-39, risks inconsistent session behavior).

## 2. Soft-delete listing (`includeDeleted`)

**Decision**: Default list queries rely on existing Prisma soft-delete middleware (`deleted_at: null`). When `includeDeleted=true`, pass an explicit `deleted_at` condition that includes both null and non-null rows (middleware skips auto-filter when `deleted_at` is set). Map removed users’ table status to **inactive**. `isActive` filter still applies to the `is_active` column (includeDeleted + `isActive=true` excludes removed inactive people).

**Rationale**: Matches GENERAL_SPEC §6.10 / §8.3 and existing `applySoftDeleteMiddleware` behavior in `server/api/src/prisma/prisma.service.ts`. Aligns with FR-005 / FR-008 and clarification on inactive-vs-removed.

**Alternatives considered**:
- Separate “deactivated” table or flag only → rejected (`deleted_at` is the product convention).
- Always return deleted rows and filter in the UI → rejected (leaks removed people; breaks default hide rule).

## 3. Shared list contract shape (KAN-69)

**Decision**: Add Zod schemas in `@abra/contracts` for: `UsersListQuery`, `UserListItem`, success list envelope `{ data, meta }`, and standard error envelope. JSON uses **camelCase** (`fullName`, `isActive`, `includeDeleted`, `sort`, `order`). DB remains snake_case via Prisma mapping in the service layer.

**Rationale**: GENERAL_SPEC §6.4 / §6.8 already use camelCase in examples (`createdAt`, `isActive`). Contracts package is enums-only today; this feature is the first list consumer and must establish the pattern for later admin tables.

**Alternatives considered**:
- snake_case JSON matching Prisma → rejected (inconsistent with GENERAL_SPEC examples and typical Nest DTOs).
- OpenAPI-only without Zod → rejected (GENERAL_SPEC requires Zod in `packages/contracts/`).

## 4. Pagination past last page and page size

**Decision**: Out-of-range page returns **200** with `data: []` and real `meta.total` (not clamp, not 400). Validate `page ≥ 1`, `1 ≤ limit ≤ 100`; reject otherwise with 400 + VAL-style details. Admin UI always sends `limit=20` and offers no page-size control.

**Rationale**: Clarification session answers; GENERAL_SPEC §6.7 max limit 100.

**Alternatives considered**: Clamp to last page → rejected (hides bad bookmarks). Error on past-last page → rejected (noisy for stale next clicks).

## 5. Search whitespace and sort

**Decision**: Trim `q`; empty after trim means no text filter. Sortable API fields: `fullName`, `email`, `role`, `isActive`. Default `sort=fullName`, `order=asc`. Invalid `sort`/`order` → 400. Changing sort/filters/search resets UI to page 1.

**Rationale**: Clarifications + FR-006 / FR-017 / FR-009.

**Alternatives considered**: Fixed sort only → rejected (user chose clickable column sort). Client-only sort of current page → rejected (wrong across pages).

## 6. Admin DataTable and screen states

**Decision**: Introduce shared `DataTable` under `apps/admin/src/components/ui/` as part of this delivery (first consumer per GENERAL_SPEC §10.2). Users page owns search/filter/includeDeleted controls and maps list item → columns. Distinct loading, empty, and Hebrew error states; create/edit modal deferred to KAN-46/47.

**Rationale**: DataTable does not exist yet; building it here unblocks Users and future lists without inventing a one-off table.

**Alternatives considered**: One-off Users table without shared DataTable → rejected (GENERAL_SPEC marks DataTable as shared). Pixel-match Figma time-report → rejected (no user-mgmt frames; employee app only).

## 7. Secrets and response projection

**Decision**: `UserListItem` includes only `id`, `fullName`, `email`, `role`, `isActive` (and optionally `createdAt` only if needed later — **out of scope**; stick to four display fields + `id` for row key). Never select/return `password_hash` or `token_version`.

**Rationale**: FR-011, SC-007, GENERAL_SPEC §13.2.

**Alternatives considered**: Return full Prisma User and strip in controller → weaker; prefer explicit select + Zod parse.

## 8. Testing strategy for same-phase delivery

**Decision**: (1) Contract tests for Zod query/item/envelope. (2) API integration tests: happy path, auth 401/403, validation 400, search/filter/includeDeleted, past-last page, limit>100. (3) Admin RTL tests: loading/empty/error, columns, filter reset to page 1. Seed data from KAN-32 sufficient; add soft-deleted fixture in tests when needed.

**Rationale**: FR-014 / SC-009; GENERAL_SPEC §14.

**Alternatives considered**: FE-only Storybook mocks → rejected (same-phase requirement). E2E-only → too slow for CI gate; keep Playwright optional smoke later.
