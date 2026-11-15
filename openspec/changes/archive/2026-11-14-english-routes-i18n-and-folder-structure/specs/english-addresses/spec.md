# Spec Delta

## Purpose
Defines the English names of the app's browser addresses and API paths and keeps the former Italian addresses working during a transition, so links already shared do not break.

## ADDED Requirements

### Requirement: Browser addresses are in English
The system SHALL serve each screen at an English address: `/sign-in`, `/register`, `/invite/:token`, `/records/new`, `/records/:id`, `/map`, `/family`, `/settings` and `/import`, with `/` for the collection. Filters and the view stay in the query string with English names.

#### Scenario: Open a screen by its address
- **WHEN** a signed-in member opens `/map`
- **THEN** the purchase map is shown

#### Scenario: Navigation uses the new addresses
- **WHEN** a member moves between screens from the header, the account menu or a button
- **THEN** the address bar shows the English address of the screen

### Requirement: Former Italian addresses redirect
The system SHALL redirect each former Italian address to its English one, keeping the path parameters and the query string, for as long as the transition lasts: `/accedi`→`/sign-in`, `/registrati`→`/register`, `/invito/:token`→`/invite/:token`, `/dischi/nuovo`→`/records/new`, `/dischi/:id`→`/records/:id`, `/mappa`→`/map`, `/famiglia`→`/family`, `/impostazioni`→`/settings`, `/importa`→`/import`.

#### Scenario: An invitation link sent earlier
- **WHEN** someone opens `/invito/abc123` from a link shared before the change
- **THEN** they land on `/invite/abc123` and can join the family with the same token

#### Scenario: Return from Discogs
- **WHEN** Discogs sends the browser back after authorisation
- **THEN** the member lands on `/settings` with the result of the connection

### Requirement: API paths and fields are English
The system MUST name every API path segment, query parameter, JSON key and error code in English, and MUST NOT use Italian words in them.

#### Scenario: Audit of the API surface
- **WHEN** the list of API routes, parameters and error codes is checked
- **THEN** none contains an Italian word, and the former name of any renamed item is still accepted for the transition period
