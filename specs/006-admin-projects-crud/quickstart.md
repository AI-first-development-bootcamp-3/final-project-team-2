# Quickstart: Admin Projects CRUD

**Feature**: `006-admin-projects-crud` | **Date**: 2026-08-18

Validate that the shared project contract, `/api/v1/projects`, and `/admin/projects` work together in one delivery. Details: [data-model.md](./data-model.md), [contracts/projects.md](./contracts/projects.md). Clients catalog (picker source) is KAN-50.

## Prerequisites

- Node ≥ 22, pnpm 9
- PostgreSQL available (docker compose or Neon) with migrations + seed applied
- **KAN-39 auth** available: admin can sign in; API enforces Jwt + admin role
- **KAN-50 Clients** available: at least one active client (seed **Acme Corp** / **Globex Ltd**)
- Seed projects from KAN-32 present (e.g. Website Redesign, Mobile App, CRM Integration)

## Setup

```bash
pnpm install
# start DB per repo docs, then:
pnpm --filter @abra/api exec prisma migrate deploy
pnpm --filter @abra/api exec prisma db seed
pnpm dev   # or start API + admin apps per turbo scripts
```

Package names may match workspace filters in root `package.json` / `pnpm-workspace.yaml` — adjust if local packages differ (`server/api`, `apps/admin`).

## Automated checks

```bash
pnpm --filter @abra/contracts test          # Projects list/create/update Zod: VAL-22/23, isDeleted, clientName sort
pnpm --filter @abra/api test                # /projects 201/400/422/204; no cascade; picker hide; history name
pnpm --filter @abra/admin test              # Projects screen: table, create/edit/remove, stay-on-page, Hebrew errors
pnpm test:coverage                          # monorepo gate ≥ 70%
```

## Manual validation scenarios

### 1. Browse the catalog (P1)

1. Sign in as admin → open Projects (`/admin/projects`).
2. Expect Hebrew RTL table columns: project name, client name, status (פעיל / לא פעיל); at most 20 rows; default sort name A–Z.
3. Loading state appears before rows. If no live projects (and include-removed off), empty copy **אין מידע קיים עד כה**.
4. Search by part of a unique name → only matches. Filter to one client → only that client’s projects.
5. Sort by client name or status → rows reorder; page resets to 1.
6. A removed project is absent until include-removed is on; then it is distinguishable from live rows. Inactive (not removed) projects stay in the default list.

### 2. Create under an active client (P1)

1. Open create. Expect title **יצירת פרויקט**, required **שם הפרויקט** and **שם הלקוח**, primary action **צור פרויקט**. Client picker lists active, non-removed clients only.
2. Submit a unique name + an active client → form closes; stay on the **same** page/search/filters/sort; that page refreshes; new row is **פעיל**.
3. If the current filter would hide the new project, the page still refreshes successfully and the new row is absent — not an error.

### 3. VAL-22 / VAL-23 (P1)

1. Empty or whitespace-only name → Hebrew VAL-22; no project created.
2. No client chosen → Hebrew VAL-23; no project created.
3. Crafted inactive/removed/unknown `clientId` on POST → 422 VAL-23; no project created.
4. Second project with a name already in use → **succeeds**.

### 4. Edit name, client, active/inactive (P1)

1. Open edit on a live project → pre-filled name, client, status.
2. Change name → catalog shows the new name.
3. Move to another active client → catalog shows the new client name.
4. Move to an inactive/removed client → Hebrew VAL-23; client unchanged.
5. If the current client was later deactivated: save name or status **without** changing client → succeeds.
6. Set inactive → row stays in the default catalog as לא פעיל; child tasks unchanged (still open / not removed).

### 5. Soft-remove and history (P1)

1. Confirm remove: Hebrew **ביטול** / **מחיקה**. Cancel leaves the row. Confirm hides it from the default list (not physically destroyed).
2. Include-removed still shows name and client.
3. New-entry picker (`GET /api/v1/me/assignments` as an assigned employee) omits inactive and removed projects.
4. A seeded time entry that named that project still resolves the project name after deactivate/remove (integration assertion; full employee report UI is a later epic).
5. Child tasks are not closed or removed.

### 6. Loading, session, unavailable (P1)

1. Slow submit: saving state; cannot double-submit.
2. Expire the admin session with a form open and submit → sent to admin sign-in.
3. Service unavailable (API down or 5xx): form stays open with a Hebrew error; typed values remain; retry works; not treated as expiry.
4. Employee token against `/api/v1/projects` → 403. Unsigned-in → 401.

### 7. Edge API checks

```bash
# 201 — default active; body includes clientName
curl -s -D - -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Kan51 Project","clientId":"'"$ACTIVE_CLIENT_ID"'"}' \
  http://localhost:3000/api/v1/projects

# 400 — VAL-22
curl -s -D - -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"   ","clientId":"'"$ACTIVE_CLIENT_ID"'"}' \
  http://localhost:3000/api/v1/projects

# 422 — VAL-23 (inactive or unknown client)
curl -s -D - -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Bad Client","clientId":"'"$INACTIVE_OR_FAKE_CLIENT_ID"'"}' \
  http://localhost:3000/api/v1/projects

# 204 — soft remove
curl -s -D - -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/v1/projects/$PROJECT_ID
```

Confirm list `meta.limit` is 20 from the UI, past-last page is empty with a real total, and DELETE does not cascade to tasks ([contracts/projects.md](./contracts/projects.md)).

## Done when

- [ ] Contract, API, and admin tests above pass in one branch/PR
- [ ] Manual scenarios 1–6 succeed against seeded data
- [ ] Inactive and removed are distinct operations; pickers hide both; history still shows the name
- [ ] No lead-manager/dates/description fields, combined assignment table, or tasks CRUD shipped as this feature
