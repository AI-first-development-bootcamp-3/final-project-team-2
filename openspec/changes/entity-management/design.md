## Context

See proposal.md for motivation. The project has a working monorepo scaffold, Prisma schema with all entity models (Client, Project, Task, TaskAssignment), and a User Management implementation (PRs #19, #23, #24) that establishes clear patterns across all three layers (contracts, API, admin UI). Entity Management follows these patterns exactly.

Key constraints:
- Prisma schema already exists -- no migration needed
- Soft-delete middleware already handles read/write filtering globally
- DataTable and CrudModal shared components already exist from User Management
- API client (`apiFetch`) and auth guards (`@Roles`, JwtGuard, RolesGuard) already exist
- All UI is RTL Hebrew, admin console minimum 1024px viewport
- 70% test coverage gate enforced by CI
- No Figma designs for admin console -- uses shadcn/ui patterns established in User Management

## Goals / Non-Goals

**Goals:**
- Full CRUD for Client, Project, Task entities via API + admin UI
- Assignment create/remove for user-to-task via API + admin UI
- Employee picker endpoint (`GET /api/v1/me/assignments`) for cascading picker data
- Admin sidebar navigation for all management pages
- E2E test covering the full entity chain

**Non-Goals:**
- Per-project report type (KAN-63) -- deferred to Daily Time Reporting spec
- Employee-facing cascading picker UI component -- built in Daily Time Reporting spec
- Audit logging for entity CRUD -- not required for MVP per GENERAL_SPEC section 8.4
- shadcn/ui component installation -- uses existing Tailwind + HTML patterns from User Management

## Decisions

### D1: One NestJS module per entity domain
**Decision:** Create separate `clients`, `projects`, `tasks`, `assignments` modules under `server/api/src/modules/`.

**Rationale:** Matches the existing `users` module pattern. Each module is self-contained (controller + service + module file) and registers in `app.module.ts`. Keeps files small and testable.

**Alternative considered:** A single `entities` module with sub-services. Rejected because it creates a large, coupled module and doesn't match the established pattern.

### D2: Employee picker as a separate controller, not part of assignments module
**Decision:** Create `server/api/src/modules/me/me.controller.ts` with `GET /me/assignments` instead of adding it to the assignments module.

**Rationale:** The `me/` namespace is employee-scoped (`@Roles('employee')`), while the assignments module is admin-scoped (`@Roles('admin')`). Mixing roles in one module creates confusing guard configuration. The `me/` controller also serves as the natural home for future employee-self endpoints (e.g., `GET /me/profile`).

**Alternative considered:** Adding to assignments controller with per-route role override. Rejected for clarity.

### D3: Contracts organized per entity domain
**Decision:** Create `packages/contracts/src/clients/`, `projects/`, `tasks/`, `assignments/`, `me/` directories, each with `list.ts`, `create.ts`, `update.ts` (as applicable).

**Rationale:** Mirrors the `users/` contracts pattern exactly. Each file exports Zod schemas and inferred TypeScript types.

### D4: Denormalized list item responses (include parent names)
**Decision:** List endpoints return joined parent names: `ProjectListItem` includes `clientName`, `TaskListItem` includes `projectName` + `clientName`, `AssignmentListItem` includes all four names.

**Rationale:** The admin DataTable needs to display parent entity names. Requiring the frontend to resolve UUIDs to names would create N+1 queries or require a separate lookup. A single Prisma `include` with `select` is cheap and simple.

**Alternative considered:** Return only UUIDs and have the frontend batch-fetch names. Rejected -- unnecessary complexity for a paginated admin list.

### D5: Simple navigation for "add task from project"
**Decision:** The Projects page has a "View Tasks" action button per row that navigates to `/admin/tasks?projectId={id}`. The Tasks page reads `projectId` from the URL to pre-filter the table and pre-select the project dropdown in the create modal.

**Rationale:** Satisfies the PRD requirement ("a task can also be created from its project's screen") without building a nested/expandable UI pattern. Reuses existing DataTable + CrudModal components. Zero new components.

**Alternative considered:** Expandable project rows with inline task sub-table. Rejected -- high complexity, not in any Figma design, and the simple navigation approach is better UX (consistent task management in one place).

### D6: AdminLayout wraps all admin routes
**Decision:** Create an `AdminLayout` component that renders sidebar + content area. All admin routes (users, clients, projects, tasks, assignments) are children of this layout in the router.

**Rationale:** Single place for navigation, consistent page structure, and the sidebar always visible. Follows standard React Router nested layout pattern.

### D7: Hard delete for TaskAssignment
**Decision:** `DELETE /api/v1/assignments/:id` physically removes the row. No soft delete.

**Rationale:** The Prisma schema has no `deleted_at` on TaskAssignment. The spec (section 8.3) explicitly states that removing an assignment never touches historical TimeEntries. The assignment itself has no business value once removed -- it's a pure link table.

### D8: Validation error status code conventions
**Decision:**
- Missing/invalid field format -> 400 Bad Request (Zod validation failures)
- Uniqueness violation (duplicate name, duplicate assignment) -> 409 Conflict
- Foreign key references inactive/deleted/non-existent entity -> 422 Unprocessable Entity

**Rationale:** Matches GENERAL_SPEC section 6.6 and the User Management precedent (409 for duplicate email). Distinguishing 400 (format) from 422 (business rule) from 409 (conflict) lets the frontend show appropriate error messages.

## Risks / Trade-offs

**[Risk] Auth module not yet merged** -> Entity Management endpoints use `@Roles('admin')` which depends on the auth guards. The guards already exist on dev (PR #19), but the full auth module (PR #16, #17) is still in review. **Mitigation:** The guards are already in `server/api/src/common/guards/` from the Users table PR. Entity Management can use them directly. If the auth module changes the guard API, the refactor is minimal (decorator-level).

**[Risk] Employee picker endpoint tested before Daily Time Reporting exists** -> The `GET /api/v1/me/assignments` endpoint will exist but has no frontend consumer yet. **Mitigation:** The E2E test (KAN-54) verifies the endpoint directly via API call. The employee app will consume it when Daily Time Reporting ships.

**[Trade-off] No cascade on deactivation** -> Deactivating a client leaves its projects and tasks active. An admin might deactivate a client but forget to deactivate its projects. **Accepted:** This is an explicit spec decision (section 8.3). The admin console shows project and task counts per entity, making orphaned active entities visible.

**[Trade-off] No audit logging for entity CRUD** -> Entity create/update/delete operations are not recorded in the AuditLog table. **Accepted:** Explicit spec decision (section 8.4) -- entity management CRUD is in the "Not logged (MVP)" category.
