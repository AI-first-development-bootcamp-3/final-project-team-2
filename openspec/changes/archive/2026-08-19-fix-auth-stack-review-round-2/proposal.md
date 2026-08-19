# Proposal: fix-auth-stack-review-round-2

## Why

Round-2 reviews on the auth stack (#16, #17, #20, #21, #22) accepted all round-1 fixes — #17 is approved and #22 is "ready to approve" — but left a short tail of small, concrete items: dead interim code in the logout handler that the now-live global guard makes redundant, two tiny extractions in the auth service, a naming/derivation nit each in constants and the admin guard, one clarifying comment in the e2e spec, several reviewer questions that need answers on the record, and spec-doc drift (`GENERAL_SPEC` no longer matches the shipped refresh contract or route convention). Clearing these unblocks approval of the remaining PRs.

## What Changes

- **#21 (`feat/kan-41-role-guards`)** — the only substantive fix: `logout` stops hand-parsing and re-verifying the Bearer token ("interim until KAN-41" — which is this PR); it reads the guard-attached `req.user` and carries an explicit `@Auth()` decorator. Removes a redundant double verification (one of them a DB hit).
- **#16 (`feat/kan-39-auth-api`)** — extract the duplicated `!user || user.deleted_at !== null || !user.is_active` check in `login()`/`refresh()` into a private `assertAccountUsable()`; rename `DAY_MS` to convey intent at call sites (ripples into #17's remember-me constants).
- **Admin (`feat/kan-41-role-guards`)** — `isAdmin()` derives its role literal from the shared `UserRole` enum options instead of hardcoding `'admin'`.
- **#22 (`feat/kan-42-login-e2e`)** — one-line comment explaining what `new URL('/', page.url()).href` resolves to.
- **Docs** — `docs/GENERAL_SPEC.md`: §5.1 updated to say refresh returns `{ accessToken, user }` (shipped, additive, in-repo consumers updated in lockstep); §10 route convention noted as app-local (`/login` per deployment — each app is its own Vercel project), superseding the literal `/admin/login`; a line documenting the fixed-window refresh cookie (maxAge not reset on refresh) as the current deliberate behavior.
- **Review replies** on #16/#20/#21/#22 answering the confirm-items: KAN-41's `JwtGuard` enforces `is_active` per request (§5.6) ✓; `DenyNonAdmin` clearing the session is intentional and moot under in-memory sessions; `bootstrapSession` already delegates to `refreshSession()` (single code path — refuting the duplication claim); `RefreshResponse` broadening is safe because all consumers live in this monorepo and moved in lockstep; `fillLoginForm` gets promoted to a shared fixture when a second spec file needs it, not before.
- **Deliberately out of scope**: the shared `packages/auth-client` (session store + refresh-retry wrapper + error classes + Tailwind preset) and migrating mobile to in-memory tokens — the reviewer's remaining structural ask. That is its own change (`extract-auth-client`), planned after the stack merges; wedging it into #21 would triple-write the interceptor and bloat an already-large PR. Branded token types are declined (ceremony without a live bug class here).

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

<!-- none — every item is a refactor, comment, docs alignment, or review reply; externally visible behavior is unchanged (skip_specs: true) -->

## Impact

- **Branches**: `feat/kan-39-auth-api` (service extraction + rename), `feat/kan-41-role-guards` (logout + isAdmin), `feat/kan-42-login-e2e` (comment), with propagation merges up the stack; `docs/GENERAL_SPEC.md` edits ride the lowest branch that owns them.
- **Code**: `server/api/src/auth/auth.service.ts`, `auth.controller.ts`, `auth.constants.ts` (+ #17's usages of the renamed constant), `apps/admin/src/lib/auth.ts`, `e2e/specs/login.spec.ts`. No API surface or behavior changes; existing tests must stay green unmodified except where they reference the renamed constant.
- **Risk**: low — the logout change swaps a hand-rolled check for the guard the route already passes through; the rest is naming, comments, docs, and replies.
