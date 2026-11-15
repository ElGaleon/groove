# Spec Delta

## Purpose

Shows where the family bought its records: a map of physical places, a separate list of online purchases, with totals and a period filter.

## ADDED Requirements

### Requirement: Places endpoint for the map
The system SHALL serve, for an optional purchase year, the places that have purchases split in three groups: physical with coordinates, physical without coordinates, and online. Each place carries the number of records, the spend per currency and the records (id, title, artist, amount). A `both` location appears in the group matching each purchase's channel.

#### Scenario: Grouping
- **WHEN** purchases exist at a shop with coordinates, a shop without and a website
- **THEN** the three groups each contain the matching place

#### Scenario: Year filter
- **WHEN** the year 2025 is requested
- **THEN** only purchases dated in 2025 are counted

### Requirement: Map shows physical places
The system SHALL show a map with one numbered marker per physical place that has coordinates and purchases, fitted to include all markers, with an empty state when there are none.

#### Scenario: Three markers
- **WHEN** purchases exist in three cities
- **THEN** three markers are visible and the view contains them all

### Requirement: Place detail
The system SHALL show for a place its name, address or site, number of records, total spent and the records with links to their pages, from the map marker or from the list.

#### Scenario: Select a marker
- **WHEN** a member selects a marker
- **THEN** the place detail opens

### Requirement: Online purchases list
The system SHALL list online places with records count and spend, separately from the map, and physical places without coordinates in a "no position" list.

#### Scenario: Online list
- **WHEN** purchases exist at an online shop
- **THEN** it appears in the online list with count and spend

### Requirement: Map usable on phone and keyboard
The system SHALL let a member use the map on a phone without it capturing page scroll (dragging is opt-in) and SHALL provide a list of the same places reachable by keyboard, with markers that open the detail on Enter or Space.

#### Scenario: Keyboard
- **WHEN** a member focuses a marker and presses Enter
- **THEN** the place detail opens

### Requirement: Map data stays private
The system SHALL send only an address to the geocoder and only tile requests to the map provider; prices and titles MUST NOT be sent to them.

#### Scenario: Browsing the map
- **WHEN** a member uses the map
- **THEN** no request to a third party contains a price or a title
