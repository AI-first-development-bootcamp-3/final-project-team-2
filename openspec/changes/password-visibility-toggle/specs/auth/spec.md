## ADDED Requirements

### Requirement: Login password fields offer a visibility toggle

The admin portal and mobile app login screens SHALL present a show/hide control on the password field. The field SHALL start masked. Revealing or hiding the typed value SHALL not change the credentials submitted to the login endpoint, client-side validation, or the field's accessible name.

#### Scenario: Password starts masked

- **WHEN** a user opens the admin or mobile login screen
- **THEN** the password field is masked and a control labeled הצג סיסמה is available

#### Scenario: User reveals then hides the password

- **WHEN** the user activates the show control and then activates the hide control
- **THEN** the typed password is first shown in clear text with the control labeled הסתר סיסמה, then masked again with the control labeled הצג סיסמה

#### Scenario: Toggle does not change submitted credentials

- **WHEN** the user reveals the password and submits valid credentials
- **THEN** the same email, password, and remember-me values are posted as when the field was masked
