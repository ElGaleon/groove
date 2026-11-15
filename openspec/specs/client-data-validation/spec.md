# client-data-validation Specification

## Purpose
Defines how the web app checks the data it receives from the API, reads from the address bar or from a file, and sends from a form, so that wrong data is caught at the edge with a clear message instead of breaking a screen later.

## Requirements


### Requirement: API responses are checked against a schema
The system SHALL check every JSON response of the API against a schema before the data reaches a screen, and the TypeScript type used by the code MUST be derived from that schema. Fields not described by the schema SHALL be ignored.

#### Scenario: Unexpected shape
- **WHEN** the API answers with a record whose `year` is a text instead of a number
- **THEN** the call fails with a coded response error, the screen shows the generic error message and the problem is logged with the endpoint and the failing field, without a crash

#### Scenario: New field on the server
- **WHEN** the API adds a field the app does not know
- **THEN** the screen keeps working and the field is ignored

### Requirement: Forms validate before sending
The system SHALL validate form input with a schema before it is sent, applying the same limits as the server (for example the minimum password length), and SHALL show each message in the member's language next to the field. The server MUST still validate everything it receives.

#### Scenario: Short password
- **WHEN** a member types a 6-character password in the registration form and submits
- **THEN** no request is sent and the field shows the "at least 10 characters" message in their language

#### Scenario: Valid input
- **WHEN** every field satisfies its schema
- **THEN** the request is sent and the server's own answer (including its coded errors) is shown as today

### Requirement: Address-bar parameters are parsed with a schema
The system SHALL read the collection filters and view from the address bar through a schema that supplies defaults and ignores values it does not understand.

#### Scenario: Garbage in the address
- **WHEN** a member opens `/?view=banana&year=abc&sort=title`
- **THEN** the collection opens in the default view without a year filter and sorted by title

### Requirement: Uploaded files are validated
The system SHALL validate a backup file before importing it and SHALL tell the member what is wrong when it is not a valid backup.

#### Scenario: Not a backup
- **WHEN** a member selects a JSON file that is not a collection backup
- **THEN** nothing is imported and a message says the file is not a valid backup

### Requirement: Schemas stay in step with the API
The system SHALL keep the response schemas aligned with the API's OpenAPI document and the build MUST fail when they differ.

#### Scenario: Server model changes
- **WHEN** a field is renamed in a Pydantic model and the schemas are not regenerated
- **THEN** the drift check fails with the name of the changed shape
