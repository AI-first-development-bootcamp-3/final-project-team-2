## Context

See proposal.md for motivation. Admin login uses a raw `<input type="password">` in `apps/admin/src/features/auth/LoginForm.tsx`. Mobile login uses `InputField` with `type="password"`. Neither app has an icon library; existing icons are inline SVGs. Both apps are Hebrew RTL. Playwright and unit tests locate the field via `getByLabel('סיסמה')`.

## Goals / Non-Goals

**Goals:**

- Place a `type="button"` toggle inside the password field on both login screens.
- Keep `autocomplete="current-password"` and the סיסמה label so existing tests keep working.

**Non-Goals:**

- Shared UI package or new icon dependency.
- Toggles on create-user / reset-password fields.
- Caps Lock indicator or password-strength UI.

## Decisions

### 1. Mobile toggle lives in `InputField`; admin toggle is inlined in `LoginForm`

`InputField` already wraps the mobile password input. When `type === "password"` it owns `visible` state and switches the input between `password` and `text`. Admin has no shared input component, so the same widget is inlined there.

**Alternatives considered:** duplicating the widget only in both `LoginForm`s (more copy-paste on mobile); adding lucide-react (new dependency for two SVGs).

### 2. Inline eye / eye-off SVGs, Hebrew `aria-label`

Labels: הצג סיסמה / הסתר סיסמה. `aria-pressed` reflects the revealed state. Button sits at inline-end (`end-0`) with `pe-10` so it stays on the visual left in RTL and does not cover typed text.

### 3. No e2e changes

Playwright already fills via `getByLabel('סיסמה')`. Behavior is covered by unit tests on `InputField` and both LoginPages.

## Risks / Trade-offs

- [Duplicated admin/mobile markup] → Acceptable: two apps, no shared UI package; keep icons and labels identical.
- [Revealed password visible on a shared screen] → Default stays masked; user opts in per field instance.
