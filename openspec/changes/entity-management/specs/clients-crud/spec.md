## Purpose

Enables admins to manage the Client entity -- the top level of the Client > Project > Task work catalog hierarchy -- through API endpoints and an admin console page.

## ADDED Requirements

### Requirement: List clients with pagination, sorting, and filtering
The API SHALL expose `GET /api/v1/clients` (admin only) returning a paginated list of clients. The response SHALL follow the standard list envelope `{ data: ClientListItem[], meta: { page, limit, total } }`.

#### Scenario: Default listing
- **WHEN** an admin calls `GET /api/v1/clients` with no query params
- **THEN** the API SHALL return page 1 with limit 20, sorted by name ascending, excluding soft-deleted clients

#### Scenario: Search by name
- **WHEN** an admin calls `GET /api/v1/clients?q=acme`
- **THEN** the API SHALL return only clients whose name contains "acme" (case-insensitive)

#### Scenario: Filter by active status
- **WHEN** an admin calls `GET /api/v1/clients?isActive=false`
- **THEN** the API SHALL return only inactive clients

#### Scenario: Include deleted clients
- **WHEN** an admin calls `GET /api/v1/clients?includeDeleted=true`
- **THEN** the API SHALL include soft-deleted clients in the results

#### Scenario: Sorting
- **WHEN** an admin calls `GET /api/v1/clients?sort=name&order=desc`
- **THEN** the API SHALL return clients sorted by name in descending order

### Requirement: Get client by ID
The API SHALL expose `GET /api/v1/clients/:id` (admin only) returning a single client.

#### Scenario: Client exists
- **WHEN** an admin calls `GET /api/v1/clients/:id` with a valid UUID
- **THEN** the API SHALL return `{ data: Client }` with status 200

#### Scenario: Client not found
- **WHEN** an admin calls `GET /api/v1/clients/:id` with a non-existent or soft-deleted UUID
- **THEN** the API SHALL return status 404

### Requirement: Create client with name uniqueness
The API SHALL expose `POST /api/v1/clients` (admin only) to create a new client.

#### Scenario: Successful creation
- **WHEN** an admin sends `{ name: "New Client", contactInfo: "info@client.com" }`
- **THEN** the API SHALL create the client with `isActive: true` and return `{ data: Client }` with status 201

#### Scenario: Missing name (VAL-20)
- **WHEN** an admin sends `{ name: "" }` or omits the name field
- **THEN** the API SHALL return status 400 with error details containing rule `VAL-20`

#### Scenario: Duplicate name (VAL-21)
- **WHEN** an admin sends a name that matches an existing non-deleted client (case-insensitive)
- **THEN** the API SHALL return status 409 with error details containing rule `VAL-21`

### Requirement: Update client
The API SHALL expose `PATCH /api/v1/clients/:id` (admin only) to update a client's name, contactInfo, or isActive status.

#### Scenario: Successful update
- **WHEN** an admin sends `{ name: "Updated Name" }` to a valid client ID
- **THEN** the API SHALL update the client and return `{ data: Client }` with status 200

#### Scenario: Name uniqueness re-checked on update
- **WHEN** an admin changes a client's name to one that already exists (case-insensitive, among non-deleted)
- **THEN** the API SHALL return status 409 with rule `VAL-21`

#### Scenario: Deactivation does not cascade
- **WHEN** an admin sets `{ isActive: false }` on a client that has active projects
- **THEN** the API SHALL deactivate only the client; its projects and tasks SHALL remain unchanged

### Requirement: Soft delete client
The API SHALL expose `DELETE /api/v1/clients/:id` (admin only) to soft-delete a client.

#### Scenario: Successful soft delete
- **WHEN** an admin calls `DELETE /api/v1/clients/:id`
- **THEN** the API SHALL set `deleted_at` to the current timestamp and return status 204

#### Scenario: Soft delete does not cascade
- **WHEN** a client is soft-deleted
- **THEN** its projects and tasks SHALL NOT be soft-deleted or deactivated

### Requirement: Admin console clients page
The admin console SHALL provide a clients management page at `/admin/clients` with a data table, search, filters, and CRUD modals.

#### Scenario: Page renders client table
- **WHEN** an admin navigates to `/admin/clients`
- **THEN** the page SHALL display a DataTable with columns: name, contact info, status (active/inactive badge), project count, and action buttons

#### Scenario: Create client modal
- **WHEN** an admin clicks the "לקוח חדש" button
- **THEN** a CrudModal SHALL open with fields: name (required), contactInfo (optional textarea)

#### Scenario: Edit client modal
- **WHEN** an admin clicks the edit action on a client row
- **THEN** a modal SHALL open pre-populated with the client's current name, contactInfo, and isActive toggle

#### Scenario: Deactivate client confirmation
- **WHEN** an admin clicks the deactivate action on a client row
- **THEN** a confirmation dialog SHALL appear warning that the client will be hidden from new-entry pickers

#### Scenario: Validation error display
- **WHEN** a create or edit form submission returns a 400 or 409 error
- **THEN** the modal SHALL display the error message in Hebrew next to the relevant field
