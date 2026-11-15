# Spec Delta

## Purpose

Defines the shell of the new front end: header, navigation, account menu, and the responsive collection views and filters.

## ADDED Requirements

### Requirement: Clean header with centred navigation
The header SHALL show the app name on the left, the main sections centred (Collection, Map, Family), and the account menu on the right. On phones it SHALL show a hamburger button on the left that opens the sections, the name in the centre and the account menu on the right.

#### Scenario: Desktop
- **WHEN** the window is wide
- **THEN** the sections are centred and no hamburger is shown

#### Scenario: Phone
- **WHEN** the window is narrow
- **THEN** a hamburger opens a side panel with the sections

### Requirement: Account menu
The account menu SHALL show the member's name and email and offer Settings, Family (view and manage, including invites) and Sign out, all working against the API; Settings includes the Discogs connection with its status.

#### Scenario: Open settings
- **WHEN** a member chooses Settings from the account menu
- **THEN** the settings screen opens with the Discogs connection status

#### Scenario: Sign out
- **WHEN** a member chooses Sign out
- **THEN** the session ends and the sign-in screen is shown

### Requirement: Collection views
The collection SHALL be viewable as the 3D shelf (desktop), a grid and a list, switchable from the toolbar; on phones the default is the grid. Each view shows title, artist and version summary; list and grid show price and value where known.

#### Scenario: Phone default
- **WHEN** a member opens the collection on a phone
- **THEN** the grid is shown

### Requirement: Readable filters on phones
On phones the search field SHALL be on its own row and the filters SHALL open in a bottom sheet with a count of results and clear/apply actions; on desktop they are inline.

#### Scenario: Filters on a phone
- **WHEN** a member opens the filters on a phone
- **THEN** a bottom sheet lists them with "Show N"

### Requirement: Add and edit in a modal
Adding and editing a record SHALL open a dialog on desktop and a bottom sheet on phones, with sections Disc, Version, Purchase and Current value, field errors next to the field, and touch targets of at least 44 px on phones.

#### Scenario: Validation
- **WHEN** a member saves without a title
- **THEN** the error appears next to the title field

### Requirement: Served by docker compose
`docker compose up --build` SHALL build the front end into the web image and serve it with the API and the database; no other step is required beyond the existing `.env`.

#### Scenario: Fresh start
- **WHEN** the stack is built and started with a valid `.env`
- **THEN** the app answers on the web port and a member can register, sign in and add a record
