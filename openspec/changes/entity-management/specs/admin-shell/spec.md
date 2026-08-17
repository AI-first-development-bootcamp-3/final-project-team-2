## Purpose

Provides persistent sidebar navigation and layout wrapper for the admin console, enabling access to all admin management pages from a single shell.

## ADDED Requirements

### Requirement: Admin layout with sidebar navigation
The admin console SHALL render an `AdminLayout` component that wraps all authenticated admin routes. The layout SHALL display a persistent vertical sidebar on the right side (RTL) containing navigation links to all admin pages, and a content area on the left that renders the active page.

#### Scenario: Sidebar renders all navigation links
- **WHEN** an authenticated admin visits any admin route
- **THEN** the sidebar SHALL display navigation links for: users (משתמשים), clients (לקוחות), projects (פרויקטים), tasks (משימות), assignments (שיוכים)

#### Scenario: Active route is highlighted
- **WHEN** an admin is on `/admin/clients`
- **THEN** the "לקוחות" link in the sidebar SHALL have a visually distinct active state

#### Scenario: Navigation between pages
- **WHEN** an admin clicks a sidebar navigation link
- **THEN** the browser SHALL navigate to the corresponding route without a full page reload

### Requirement: Sidebar logout action
The sidebar SHALL include a logout button at the bottom that clears the admin session and redirects to the login page.

#### Scenario: Admin logs out via sidebar
- **WHEN** an admin clicks the logout button in the sidebar
- **THEN** the session SHALL be cleared and the browser SHALL redirect to `/admin/login`

### Requirement: Admin route registration
The `App.tsx` router SHALL register routes for `/admin/clients`, `/admin/projects`, `/admin/tasks`, and `/admin/assignments`, each wrapped in the `AdminLayout` and protected by the existing `RequireAdminSession` guard.

#### Scenario: Unauthenticated access to entity routes
- **WHEN** an unauthenticated user visits `/admin/clients`
- **THEN** the browser SHALL redirect to `/admin/login`

#### Scenario: Root redirect
- **WHEN** an authenticated admin visits `/`
- **THEN** the browser SHALL redirect to `/admin/users`
