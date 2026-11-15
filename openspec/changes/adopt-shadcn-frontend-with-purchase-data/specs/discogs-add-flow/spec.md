# Spec Delta

## Purpose

Makes adding a record frictionless for members who connected Discogs: search first, pick the exact pressing, and get its details and market value filled in.

## ADDED Requirements

### Requirement: Search-first adding
When the member has an active Discogs connection, the add action SHALL open on a Discogs search with the field focused; choosing a result SHALL open the form already filled, leaving purchase data to enter. An explicit "Enter by hand" action SHALL be always available, and without a connection the form SHALL open directly.

#### Scenario: Connected member adds
- **WHEN** a connected member chooses Add
- **THEN** the search field is shown and focused

#### Scenario: Manual entry
- **WHEN** a connected member chooses "Enter by hand"
- **THEN** an empty form opens that can be saved without Discogs

#### Scenario: Not connected
- **WHEN** a member without a connection chooses Add
- **THEN** the manual form opens with an invitation to connect Discogs

### Requirement: Live search with barcode and catalogue number
The system SHALL search while the member types, after a short pause and from three characters, and SHALL ignore responses of superseded queries. Digits only (8-14) SHALL be searched as a barcode; other text as free text, which includes artist, title and catalogue number.

#### Scenario: Fast typing
- **WHEN** a member types "abbey road" quickly
- **THEN** only the last text is searched and its results shown

#### Scenario: Barcode
- **WHEN** a member types a 12-digit code
- **THEN** the search is by barcode

### Requirement: Results, paging and ownership markers
The API SHALL return release id, title, artist, label, catalogue number, country, year, format, cover and, when the release or title is already in the household, who owns it, plus paging information. The client SHALL offer "show more" and mark results already in the collection.

#### Scenario: More results
- **WHEN** Discogs has more pages
- **THEN** the member can load the next page keeping the previous results

### Requirement: Version and value on selection
On selecting a release the system SHALL fill title, artist, label, catalogue number, country, year, format and cover, and SHALL fetch the release's current market value (lowest price for sale and number of copies) in the member's currency, saving it as a Discogs value; with no copies for sale it SHALL leave the value empty.

#### Scenario: Value imported
- **WHEN** a member selects a release with copies for sale
- **THEN** the form shows the lowest price, the number of copies and the source Discogs

#### Scenario: No copies for sale
- **WHEN** the release has no copies for sale
- **THEN** no value is invented and the field stays empty

### Requirement: Refresh values on demand
The system SHALL let a member refresh the value of one record, or of all records with a Discogs release, showing updated, unchanged, to-confirm (manual value present) and failed counts, and stopping cleanly on rate limits.

#### Scenario: Partial failure
- **WHEN** Discogs fails for 2 records
- **THEN** the others are updated and the 2 are listed with a retry

### Requirement: Errors keep the member moving
On errors, rate limits or empty results the search SHALL show a clear message with "Retry" and "Enter by hand".

#### Scenario: Discogs down
- **WHEN** the search fails
- **THEN** the message, Retry and Enter by hand are shown
