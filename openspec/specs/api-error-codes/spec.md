# api-error-codes Specification

## Purpose
Defines how the API reports errors so that clients can show them in the member's language: a stable code instead of a sentence in one language.

## Requirements


### Requirement: Errors carry a stable code
The system SHALL answer every error with a JSON body that has a stable English `code` (for example `invalid_credentials`, `duplicate`, `invite_expired`), an English `detail` meant for developers and logs, and, for validation errors, the `field` concerned. A code MUST NOT change meaning between versions.

#### Scenario: Wrong password
- **WHEN** a sign-in fails because of a wrong email or password
- **THEN** the response has `code` `invalid_credentials` and a generic English `detail`, with no hint about which of the two was wrong

#### Scenario: Missing required field
- **WHEN** a record is created without a title
- **THEN** the response is a validation error with `code` `required` and `field` `title`

### Requirement: The client shows errors in the member's language
The system SHALL show every API error to the member in the active language by translating its `code`, and SHALL fall back to a generic translated message when the code is unknown.

#### Scenario: Same error in two languages
- **WHEN** the duplicate warning is triggered by a member using Italian and by one using English
- **THEN** each reads the warning in their own language, and both receive the same `code` from the API

#### Scenario: Unknown code
- **WHEN** the API returns a code the client has no translation for
- **THEN** the member sees the generic translated error message
