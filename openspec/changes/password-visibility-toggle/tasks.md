## 1. Mobile login password toggle

- [x] 1.1 Red — failing `InputField` tests: password type starts masked with הצג סיסמה; click reveals type=text and הסתר סיסמה; click again masks
- [x] 1.2 Green — `InputField` owns visibility state when `type="password"` (inline SVGs, `type="button"`, `aria-pressed`, RTL `end-0` + `pe-10`)
- [x] 1.3 LoginPage tests assert the same show/hide behavior on the live mobile login form without breaking existing validation tests

## 2. Admin login password toggle

- [x] 2.1 Red — failing LoginPage tests: password starts masked with הצג סיסמה; click reveals; click again masks
- [x] 2.2 Green — inline the same widget in `LoginForm` around the password input without spreading `type` over the computed type
- [x] 2.3 Confirm existing admin login validation/submit tests still pass

## 3. Verify

- [x] 3.1 Run `pnpm --filter @abra/admin test` and `pnpm --filter @abra/mobile test`
- [x] 3.2 Point e2e password locators at `getByLabel('סיסמה', { exact: true })` so they do not match הצג סיסמה
