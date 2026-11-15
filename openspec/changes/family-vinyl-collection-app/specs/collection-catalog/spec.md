# Spec Delta

## Purpose

Defines the shared catalogue of records the household owns: what is stored for each record, who owns it, how members add, change and remove records by hand, and how they find records, so the family always knows what it already has.

## ADDED Requirements

### Requirement: Record data
The system SHALL store for each record a title, an artist and a cover image. It SHOULD also hold the release year, label, genres, format and an optional free-text note.

#### Scenario: Record without cover
- **WHEN** a record has no cover image
- **THEN** the system shows a neutral placeholder cover with the title and artist

### Requirement: Optional owner
The system SHALL let a record have an optional owner chosen from the household's members. A record with no owner MUST be treated as shared by the family.

#### Scenario: Record with an owner
- **WHEN** a member sets Anna as the owner of a record
- **THEN** the record is shown as owned by Anna

#### Scenario: Record without an owner
- **WHEN** a record has no owner
- **THEN** it is shown as shared

#### Scenario: Change or clear the owner
- **WHEN** any member changes the owner of a record to another member or clears it
- **THEN** the change is saved and the record is shown with the new owner or as shared

### Requirement: Add a record by hand
The system SHALL let any member add a record by typing its data, without needing a Discogs account. Title and artist are required.

#### Scenario: Add with typed data
- **WHEN** a member enters a title and an artist and saves
- **THEN** the record is added with a placeholder cover and no owner unless one is chosen

#### Scenario: Missing required data
- **WHEN** a member saves a record without a title or without an artist
- **THEN** the system does not save it and says which field is missing

### Requirement: Upload a cover
The system SHALL let a member attach their own image as the cover of a record, in JPEG, PNG or WebP up to 5 MB.

#### Scenario: Upload a valid image
- **WHEN** a member uploads a 1 MB JPEG as the cover of a record
- **THEN** the record shows that image as its cover

#### Scenario: Invalid file
- **WHEN** a member uploads a file that is not a supported image or is larger than 5 MB
- **THEN** the system rejects it with a message and keeps the previous cover

### Requirement: Edit and remove records
The system SHALL let any member edit any field of a record and remove a record from the collection.

#### Scenario: Remove with confirmation
- **WHEN** a member removes a record
- **THEN** the system asks for confirmation and, once confirmed, removes the record for all members

#### Scenario: Undo a removal
- **WHEN** a member removes a record and chooses to undo within 10 seconds
- **THEN** the record is restored with all its data

### Requirement: Duplicate warning
The system SHALL warn when a record being added has the same title and artist as an existing record, or the same Discogs release, and let the member cancel or add it anyway as another copy.

#### Scenario: Adding an existing record
- **WHEN** a member adds a record whose title and artist match one already in the collection
- **THEN** the system shows the existing record and offers to cancel or to add another copy

### Requirement: Search, filter and sort
The system SHALL let members search by title or artist, filter by owner (including shared), genre, decade and label, and sort by title, artist, year or date added. Results MUST appear in under one second for a collection of 500 records.

#### Scenario: Search by text
- **WHEN** a member types part of an artist name
- **THEN** only records whose artist or title contains that text are shown

#### Scenario: Filter by owner
- **WHEN** a member filters by Anna
- **THEN** only the records owned by Anna are shown, and a "shared" filter shows only records with no owner

#### Scenario: Combine filters
- **WHEN** a member selects a genre and a decade
- **THEN** only records matching both are shown, with the count of matching records

#### Scenario: No results
- **WHEN** no record matches the search or filters
- **THEN** the system shows an empty-result message with a way to clear the filters

### Requirement: Quick check while shopping
The system SHALL offer a search reachable in one tap from every screen, answering whether the collection already contains a record, with the matching records and their owners.

#### Scenario: Record is already owned
- **WHEN** a member searches for an album that is in the collection
- **THEN** the matching records are shown with their owner or "shared"

#### Scenario: Record is not owned
- **WHEN** a member searches for an album that is not in the collection
- **THEN** the system says nothing matches and offers to add it

### Requirement: Collection stays current on reload
The system SHALL show other members' changes the next time the collection is loaded or refreshed. Live updates without reloading are not required.

#### Scenario: Another member added a record
- **WHEN** one member adds a record and another reloads the collection
- **THEN** the second member sees the new record
