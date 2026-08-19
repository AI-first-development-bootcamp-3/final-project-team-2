# Design: fix-auth-stack-review-findings

## Context

Five stacked PRs (`#16 → #17 → #20 → #21 → #22`) carry the whole auth story; every fix must land on the branch that owns the file and be merged upward, bottom-first, or the stack diverges. The server side already provides everything the client work needs: `POST /auth/refresh` validated against `token_version` (#16), 1-day/30-day cookie TTL (#17), and role guards with a mobile 401 interceptor (#21). The admin client is the only consumer still persisting its access token and lacking 401 handling. See proposal.md — Why.

## Goals / Non-Goals

**Goals**

- Retire the two substantive review findings (web-storage JWT, missing admin 401 interceptor) with one mechanism, not two patches.
- Land every mechanical review item on its owning branch; leave each PR green after its own merge.

**Non-Goals**

- No server-side behavior changes (the #16 review round already fixed those).
- No unbundling of the KAN-70 visual redesign from #21 — churn outweighs benefit mid-stack.
- No shared `packages/auth-client` extraction yet; mobile keeps its current session model until its own ticket (the admin refactor is written so the store is liftable later).
- Mobile app behavior unchanged.

## Decisions

**D1 — In-memory token + refresh bootstrap (option b) over a minimal 401-redirect interceptor (option a).**
Option (a) would close the AC-4 gap but leave the reviewer's top security finding open with an IOU, and "remember me" would stay client-side-dead. Option (b) removes the whole class: the refresh cookie (httpOnly, XSS-proof) becomes the only durable credential, which is what the KAN-39/40 server design was built for. Cost is bounded: the store, a bootstrap gate, and a fetch wrapper.

**D2 — Session store shape.** The existing `subscribeToAuthChanges`/`useSyncExternalStore` mechanism from #20 stays; only the backing store changes from web storage to a module-level variable. `getAuthSession`/`setAuthSession`/`clearAuthSession` keep their signatures (minus the `rememberMe` storage-target parameter, which becomes server-cookie-only). Cross-tab sync via the `storage` event is dropped — with nothing in storage there is nothing to sync; logout-everywhere is already served by `token_version` bump on the server.

**D3 — Bootstrap gate.** `App` renders a loading state until the initial `POST /auth/refresh` settles (success → session seeded; failure → logged out). This is a one-shot promise kicked off at module init so route guards never see an "unknown" state; guards keep their current synchronous reads.

**D4 — 401 handling lives in the API layer, not components.** A single `authFetch` wrapper: attach in-memory token → on 401, `await refreshOnce()` (deduplicated so concurrent 401s share one refresh) → retry once → on second failure, `clearAuthSession()` + redirect. Components never see 401s. The mobile interceptor from #21 is the pattern reference but is not shared code yet (Non-Goal).

**D5 — `@Auth()` becomes meaningful.** Instead of setting `ROLES_KEY` to `undefined`, `@Auth()` sets an explicit authenticated-marker metadata key that `RolesGuard` treats as "any authenticated user, no role restriction". Routes with neither decorator behave as today (JwtGuard still applies globally), so this is additive, not breaking.

**D5b — `RefreshResponse` gains a `user` field (additive).** Discovered during implementation: the bootstrap needs the user summary, but refresh returned only `accessToken`. Alternatives — decoding role claims out of the JWT client-side (leaks token structure into the client, still no name/email) or a new `/me` endpoint (more surface) — lose to simply returning `user` from refresh: the service already loads the full user row to validate `token_version`/`is_active`. Additive, so the mobile client's existing `RefreshResponse.parse` keeps working unchanged. This narrows the "no server-side behavior changes" non-goal to "no behavioral changes"; the response shape gains one field.

**D6 — Fix placement across the stack.** Each fix commits to the branch whose PR owns the file: guard/decorator work on `feat/kan-41-role-guards`; admin session refactor on `feat/kan-41-role-guards` too (it satisfies KAN-41's AC-4, and #20's storage-split tests would be rewritten twice otherwise — noted in both PRs); e2e fixes on `feat/kan-42-login-e2e`; the dev-conflict merge on `feat/kan-39-auth-api` first, then propagation merges upward in order.

## Risks / Trade-offs

- **#20's remember-me tests asserted storage locations**; they are rewritten as cookie-TTL + bootstrap behavior tests on the #21 branch. Interim state: after #20 merges but before #21, the storage-based behavior briefly exists on `dev` — acceptable inside one stack.
- **Bootstrap adds one `/auth/refresh` round-trip on every cold load**, including logged-out visitors (a guaranteed 401). Mitigation: skip the call when the app has never seen a login on this browser is not possible without storage; we accept the single cheap 401.
- **Vitest coverage gates** on the four packages must stay ≥70% through the refactor — new store/wrapper code needs tests as it lands, not after.
- Stacked propagation merges can conflict (contracts, lockfile are the usual suspects); resolved bottom-up, lockfile regenerated per branch.
