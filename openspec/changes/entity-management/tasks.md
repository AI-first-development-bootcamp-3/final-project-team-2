## 1. Contracts — Shared Zod Schemas

- [ ] 1.1 Create `packages/contracts/src/clients/list.ts` — ClientListQuery (page, limit, sort, order, q, isActive, includeDeleted), ClientListItem (id, name, contactInfo, isActive), ClientListResponse schemas
- [ ] 1.2 Create `packages/contracts/src/clients/create.ts` — CreateClientBodySchema (name: required non-empty VAL-20, contactInfo: optional string)
- [ ] 1.3 Create `packages/contracts/src/clients/update.ts` — UpdateClientBodySchema (name: optional, contactInfo: optional, isActive: optional boolean)
- [ ] 1.4 Create `packages/contracts/src/projects/list.ts` — ProjectListQuery (+ clientId filter), ProjectListItem (id, name, clientId, clientName, isActive), ProjectListResponse
- [ ] 1.5 Create `packages/contracts/src/projects/create.ts` — CreateProjectBodySchema (name: required VAL-22, clientId: required UUID VAL-23)
- [ ] 1.6 Create `packages/contracts/src/projects/update.ts` — UpdateProjectBodySchema (name, clientId, isActive optional)
- [ ] 1.7 Create `packages/contracts/src/tasks/list.ts` — TaskListQuery (+ projectId, status filters), TaskListItem (id, name, projectId, projectName, clientName, status, description), TaskListResponse
- [ ] 1.8 Create `packages/contracts/src/tasks/create.ts` — CreateTaskBodySchema (name: required VAL-24, projectId: required UUID VAL-25, description: optional)
- [ ] 1.9 Create `packages/contracts/src/tasks/update.ts` — UpdateTaskBodySchema (name, projectId, status, description optional)
- [ ] 1.10 Create `packages/contracts/src/assignments/list.ts` — AssignmentListQuery (page, limit, userId, taskId, q), AssignmentListItem (id, userId, userFullName, userEmail, taskId, taskName, projectName, clientName)
- [ ] 1.11 Create `packages/contracts/src/assignments/create.ts` — CreateAssignmentBodySchema (userId: required UUID, taskId: required UUID, VAL-26)
- [ ] 1.12 Create `packages/contracts/src/me/assignments.ts` — MyAssignment (taskId, taskName, projectId, projectName, clientId, clientName), MyAssignmentsResponse
- [ ] 1.13 Add VAL-20 through VAL-27 Hebrew messages to VAL_MESSAGES in enums.ts, re-export new schemas from index.ts
- [ ] 1.14 Write contract tests — Zod schema validation tests for all new schemas (valid inputs, invalid inputs, VAL code mapping)

## 2. API — Clients Module

- [ ] 2.1 Create `server/api/src/modules/clients/clients.module.ts` — NestJS module importing PrismaModule
- [ ] 2.2 Create `server/api/src/modules/clients/clients.service.ts` — list (pagination, sort, filter, search, includeDeleted), findOne, create (name uniqueness case-insensitive -> 409 VAL-21), update (re-check uniqueness), softDelete (no cascade)
- [ ] 2.3 Create `server/api/src/modules/clients/clients.controller.ts` — GET /clients, GET /clients/:id, POST /clients, PATCH /clients/:id, DELETE /clients/:id, all @Roles('admin'), Zod validation in controller, Hebrew error details
- [ ] 2.4 Register ClientsModule in app.module.ts
- [ ] 2.5 Write clients.service.spec.ts — test uniqueness check, soft delete, no cascade, pagination, search, includeDeleted
- [ ] 2.6 Write clients.controller.spec.ts — test HTTP status codes, validation errors, auth enforcement

## 3. API — Projects Module

- [ ] 3.1 Create `server/api/src/modules/projects/projects.module.ts`
- [ ] 3.2 Create `server/api/src/modules/projects/projects.service.ts` — list (with client name join, clientId filter), findOne, create (validate clientId active/non-deleted -> 422 VAL-23), update (re-validate clientId), softDelete (no cascade)
- [ ] 3.3 Create `server/api/src/modules/projects/projects.controller.ts` — CRUD endpoints, @Roles('admin'), include clientName in responses
- [ ] 3.4 Register ProjectsModule in app.module.ts
- [ ] 3.5 Write projects.service.spec.ts — test client FK validation, no cascade, join resolution
- [ ] 3.6 Write projects.controller.spec.ts — test HTTP status codes, VAL-22/VAL-23 errors

## 4. API — Tasks Module

- [ ] 4.1 Create `server/api/src/modules/tasks/tasks.module.ts`
- [ ] 4.2 Create `server/api/src/modules/tasks/tasks.service.ts` — list (with project+client name joins, projectId/status filters), findOne, create (validate projectId -> 422 VAL-25), update, softDelete (sets BOTH status=closed AND deleted_at)
- [ ] 4.3 Create `server/api/src/modules/tasks/tasks.controller.ts` — CRUD endpoints, @Roles('admin'), include projectName+clientName
- [ ] 4.4 Register TasksModule in app.module.ts
- [ ] 4.5 Write tasks.service.spec.ts — test project FK validation, delete-closes semantics, no assignment removal on delete
- [ ] 4.6 Write tasks.controller.spec.ts — test HTTP status codes, VAL-24/VAL-25 errors

## 5. API — Assignments Module

- [ ] 5.1 Create `server/api/src/modules/assignments/assignments.module.ts`
- [ ] 5.2 Create `server/api/src/modules/assignments/assignments.service.ts` — list (with user+task+project+client joins, userId/taskId/q filters), create (validate userId+taskId exist -> 422 VAL-26, unique pair -> 409 VAL-27), hardDelete
- [ ] 5.3 Create `server/api/src/modules/assignments/assignments.controller.ts` — GET /assignments, POST /assignments, DELETE /assignments/:id, @Roles('admin')
- [ ] 5.4 Register AssignmentsModule in app.module.ts
- [ ] 5.5 Write assignments.service.spec.ts — test uniqueness enforcement, hard delete, FK validation, search
- [ ] 5.6 Write assignments.controller.spec.ts — test 409 on duplicate, 422 on invalid refs, 204 on delete

## 6. API — Employee Picker Endpoint

- [ ] 6.1 Create `server/api/src/modules/me/me.module.ts`
- [ ] 6.2 Create `server/api/src/modules/me/me.controller.ts` — GET /me/assignments, @Roles('employee'), returns flat list of assigned tasks with parent names, filtered to open tasks + active projects + active clients only
- [ ] 6.3 Register MeModule in app.module.ts
- [ ] 6.4 Write me.controller.spec.ts — test active-entity filtering, admin gets 403, empty assignments returns []

## 7. Admin UI — Sidebar and Layout

- [ ] 7.1 Create `apps/admin/src/components/layout/admin-sidebar.tsx` — vertical nav with links (users, clients, projects, tasks, assignments), active state, logout button, RTL Hebrew
- [ ] 7.2 Create `apps/admin/src/components/layout/admin-layout.tsx` — sidebar + content area wrapper using CSS grid/flex
- [ ] 7.3 Update `apps/admin/src/App.tsx` — wrap all admin routes in AdminLayout, add routes for /admin/clients, /admin/projects, /admin/tasks, /admin/assignments
- [ ] 7.4 Write admin-sidebar.spec.tsx — test all nav links render, active state, logout clears session

## 8. Admin UI — Clients Page

- [ ] 8.1 Create `apps/admin/src/features/clients/clients-columns.tsx` — column definitions (name, contactInfo, status badge, projectCount, actions)
- [ ] 8.2 Create `apps/admin/src/features/clients/clients-page.tsx` — DataTable with search, isActive filter, includeDeleted checkbox, pagination, sort, create/edit/deactivate modals
- [ ] 8.3 Create `apps/admin/src/features/clients/client-create-form.tsx` — CrudModal with name (required) + contactInfo (optional), Zod validation, 409 error handling
- [ ] 8.4 Create `apps/admin/src/features/clients/client-edit-modal.tsx` — pre-populated form with name, contactInfo, isActive toggle
- [ ] 8.5 Write clients-page.spec.tsx — test table render, search, create flow, edit flow, deactivate confirmation, 409 duplicate name

## 9. Admin UI — Projects Page

- [ ] 9.1 Create `apps/admin/src/features/projects/projects-columns.tsx` — columns (name, clientName, status, taskCount, actions including "View Tasks")
- [ ] 9.2 Create `apps/admin/src/features/projects/projects-page.tsx` — DataTable with client filter dropdown, search, create/edit modals
- [ ] 9.3 Create `apps/admin/src/features/projects/project-create-form.tsx` — CrudModal with name + clientId dropdown (active clients only), Zod validation
- [ ] 9.4 Create `apps/admin/src/features/projects/project-edit-modal.tsx` — pre-populated form with name, clientId, isActive toggle
- [ ] 9.5 Write projects-page.spec.tsx — test client filter, "View Tasks" navigation to /admin/tasks?projectId=, create with client picker, 422 error

## 10. Admin UI — Tasks Page

- [ ] 10.1 Create `apps/admin/src/features/tasks/tasks-columns.tsx` — columns (name, projectName, clientName, status badge, description truncated, actions)
- [ ] 10.2 Create `apps/admin/src/features/tasks/tasks-page.tsx` — DataTable with projectId URL pre-filter, project dropdown filter, status filter, search, create/edit modals
- [ ] 10.3 Create `apps/admin/src/features/tasks/task-create-form.tsx` — CrudModal with name + projectId dropdown (pre-selected from URL if present) + description textarea
- [ ] 10.4 Create `apps/admin/src/features/tasks/task-edit-modal.tsx` — pre-populated form with name, projectId, status toggle, description
- [ ] 10.5 Write tasks-page.spec.tsx — test URL pre-filter, project pre-selection in create modal, status filter, 422 error

## 11. Admin UI — Assignments Page

- [ ] 11.1 Create `apps/admin/src/features/assignments/assignments-columns.tsx` — columns (userFullName, userEmail, taskName, projectName, clientName, remove action)
- [ ] 11.2 Create `apps/admin/src/features/assignments/assignments-page.tsx` — DataTable with user/task filter dropdowns, search, create modal, remove confirmation
- [ ] 11.3 Create `apps/admin/src/features/assignments/assignment-create-form.tsx` — CrudModal with userId dropdown (active users) + taskId dropdown (open tasks), 409 duplicate handling
- [ ] 11.4 Write assignments-page.spec.tsx — test create, remove confirmation, 409 duplicate display, filter by user/task

## 12. E2E Test

- [ ] 12.1 Create `e2e/specs/entity-chain.spec.ts` — Playwright spec: admin login -> create client -> create project under client -> create task under project -> assign employee to task -> verify GET /api/v1/me/assignments returns the chain
