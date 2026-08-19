# Change: Password visibility toggle on login screens (KAN-117)

## Why

Users typing a password on the admin and mobile login screens cannot check what they entered, which leads to avoidable failed logins. A show/hide control on those fields lets them confirm the value without changing how credentials are submitted.

## What Changes

- Add a Hebrew show/hide control inside the password field on the **admin** login screen.
- Add the same control on the **mobile** login screen (owned by `InputField` when `type="password"`).
- The field stays masked by default; toggling does not change submitted credentials, validation, or e2e selectors.

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `auth`: Login password fields on admin and mobile SHALL offer a show/hide control that starts masked and does not change submitted credentials.

## Impact

- `apps/admin/src/features/auth/LoginForm.tsx` and its LoginPage tests
- `apps/mobile/src/components/ui/InputField.tsx` and LoginPage tests
- No API, contract, or dependency changes
- Create-user and reset-password fields are out of scope
