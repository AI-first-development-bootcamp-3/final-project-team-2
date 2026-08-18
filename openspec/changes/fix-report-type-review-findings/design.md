# Design: Fix Report-Type Review Findings

## Context

See proposal.md — Why. Relevant current state:

- `reporting-settings-page.tsx` renders its table only under `!loading && !error && result`, sets `error` in the PATCH catch, and never clears it except via `fetchProjects` (which only re-runs when `page`/`q` change). Search fires a request per keystroke straight from a `useEffect` on `q`.
- `apps/admin/src/components/ui/data-table.tsx` is the shared listing table used by the five other admin pages, driven by a `columns[]` definition (see `projects-columns.tsx`).
- The API has two parallel guard stacks: `server/api/src/auth/jwt.guard.ts` + `roles.guard.ts` (the real ones — the JWT guard is registered globally and attaches `{ userId, role }`) and `server/api/src/common/guards/jwt.guard.ts` + `roles.guard.ts` (presence-check lookalikes whose exported `AuthUser` type declares `id`). Five modules import the lookalikes via `@UseGuards`.
- Validation errors go through `zodIssuesToDetails` → `ruleFromIssueMessage(msg) ?? FIELD_RULES[field] ?? 'VAL-QUERY'` with Hebrew text looked up in `VAL_MESSAGES`; `reportType` is missing from both tables.
- `ProjectsService.updateReportType()` is a line-for-line subset of `update()`, which this same feature branch extended to accept `reportType`.
- Work happens in the staging-based worktree at `C:\Users\danie\.claude\jobs\654045d2\tmp\proxy-branch`; changes ship as PRs into `staging` (direct pushes are blocked by repo rules).

## Goals / Non-Goals

**Goals**

- Every fix is behavior-preserving for the success paths: same URLs, same success payloads, same UI happy path.
- Kill the *bug class*, not just the instance (guard consolidation; single write path).
- Keep review tractable: two independently revertable PRs.

**Non-Goals**

- Building the employee punch-clock flow (deferred to a follow-up change; the mobile time-entry UI it would switch between does not exist yet).
- Fixing the same un-debounced search pattern in `projects-page.tsx` (pre-existing; noted for a later cleanup, out of scope here).
- Runtime zod-parsing of responses in `apiFetch` (contract enforcement stays schema-side for now).

## Decisions

1. **Keep the `PATCH /projects/:id/report-type` URL; collapse the implementation.**
   `updateReportType(id, reportType)` becomes a thin call into the generic `update(id, { reportType })` path (or is inlined at the controller). Alternative — deleting the endpoint and having the UI call `PATCH /projects/:id` — was rejected: it churns the admin UI, Swagger docs, and existing tests for zero behavioral gain.

2. **UUID validation via Nest's `ParseUUIDPipe` on the projects controller's `:id` params**, mapped to the API's 400 shape. Alternative — a global pipe or Prisma P2023 exception filter — is broader-risk and touches every module; the finding is scoped to routes the diff added/touched. Applying it controller-wide (all `:id` routes in projects) covers the inherited instances without a cross-cutting change.

3. **`reportType` gets a real entry in `FIELD_RULES` and `VAL_MESSAGES`** (new `VAL-*` code + Hebrew message), following the existing table-driven pattern rather than special-casing in the controller.

4. **Error banner + table coexist.** The page's render condition changes from `!error && result` to `result`-driven, with `error` rendered as a dismissible banner above the table. `error` clears on: dismiss, successful PATCH, and any refetch. Alternative — auto-retry — rejected as scope creep.

5. **Debounce + monotonic request guard.** A ~300ms debounce on `q` plus a request-sequence counter (or `AbortController`) so only the latest response commits state. Implemented as a small local hook (`useDebouncedValue`) in `apps/admin/src/lib` so other pages can adopt it later.

6. **DataTable refactor rides PR-B, not PR-A.** The radio group moves into a `columns[]` cell renderer like `projects-columns.tsx`. Kept out of PR-A so the correctness fixes aren't hostage to a markup refactor.

7. **Guard consolidation direction: `common/guards/*` dies, `auth/*` wins.** The global guard is the source of truth for the request-user shape. A single exported `AuthenticatedUser { userId, role }` type lives with the auth guards; `common/guards/jwt.guard.ts`, `common/guards/roles.guard.ts`, their specs, and the `AuthUser { id }` type are deleted; the five consuming modules' `@UseGuards`/imports are repointed. Alternative — keeping both and aligning the type — rejected: two lookalike guards is exactly what produced the `req.user.id` bug.

8. **OpenSpec hygiene edits the original change in place.** Uncheck 4.2/4.3/5.3 in `project-report-type/tasks.md`, move the "Employee App Flow Switch by Report Type" requirement out of its delta spec into a new deferred change (`employee-report-flow-switch`) so an archive/sync of the original change cannot canonize unbuilt behavior.

## Risks / Trade-offs

- [Guard repoint breaks a controller test that hand-builds the lookalike guard] → the deleted guards' specs are removed with them; consuming controllers' specs are updated to the real guard's test helpers (`auth.testing.ts` pattern already exists).
- [ParseUUIDPipe's default 400 body differs from the API's Hebrew validation shape] → wrap with the existing exception factory/details mapper so the response matches the contract asserted in specs.
- [Making `reportType` required breaks a consumer that relied on the default] → repo-wide search shows only the admin page and mobile task-picker consume it, both always receive it from the API select; contracts unit tests updated accordingly.
- [Two PRs into staging double the review/merge overhead under the Vercel deploy quota] → PR-event deploys are already skipped (cd.yml); only the two staging pushes deploy.

## Migration Plan

PR-A (UI + API + contracts) → merge into staging → CD preview → verify. PR-B (guards + DataTable) → same. Both land before staging → main promotion; each is independently revertable. No data migration; no API surface change.

## Open Questions

- Exact `VAL-*` code number for `reportType` (pick the next free one in `FIELD_RULES` at implementation time).
