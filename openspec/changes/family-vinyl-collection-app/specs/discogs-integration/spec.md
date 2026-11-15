# Spec Delta

## Purpose

Lets each family member connect their own Discogs account from Settings, which unlocks importing their Discogs collection and searching Discogs when adding records. Members who do not connect can still use the whole app by hand.

## ADDED Requirements

### Requirement: Connect a Discogs account in Settings
The system SHALL let each member connect their own Discogs account from the Settings screen, by authorising the app on Discogs. The connection MUST belong to that member only.

#### Scenario: Connect successfully
- **WHEN** a member chooses "Connect to Discogs" in Settings and authorises the app on Discogs
- **THEN** Settings shows the member as connected with their Discogs username

#### Scenario: Authorisation refused or interrupted
- **WHEN** the member cancels on Discogs or the authorisation fails
- **THEN** Settings shows that the account was not connected and the member can retry

#### Scenario: Another member's connection is separate
- **WHEN** one member is connected and another is not
- **THEN** the second member sees the Discogs features as locked and the first sees them unlocked

### Requirement: Disconnect a Discogs account
The system SHALL let a member disconnect their Discogs account in Settings, which MUST remove the stored authorisation. Records already imported SHALL stay in the collection.

#### Scenario: Disconnect
- **WHEN** a connected member chooses "Disconnect" and confirms
- **THEN** the Discogs features are locked again for that member and their imported records remain

### Requirement: Features locked without a connection
The system SHALL show Discogs import and Discogs search as unavailable to a member without a connection, with a pointer to Settings, and MUST NOT make any other feature depend on a connection.

#### Scenario: Not connected
- **WHEN** a member without a connection opens the add-record screen
- **THEN** only manual entry is offered, with a note that connecting Discogs in Settings unlocks search and import

#### Scenario: Manual use stays complete
- **WHEN** a member without a connection adds, edits, searches and removes records
- **THEN** all of these work normally

### Requirement: Import the member's Discogs collection
The system SHALL let a connected member import their own Discogs collection, bringing in for each release the title, artist, year, label, genres, format and cover. Imported records get the importing member as owner by default, and the member MAY choose to import them as shared.

#### Scenario: First import
- **WHEN** a connected member starts an import
- **THEN** the system adds their releases to the collection with them as owner and shows how many were added

#### Scenario: Import as shared
- **WHEN** the member chooses to import as shared
- **THEN** the imported records have no owner

#### Scenario: Private or empty collection
- **WHEN** the member's Discogs collection is private or has no releases
- **THEN** the system explains why nothing was imported

### Requirement: Import progress and continuity
The system SHALL show import progress and SHALL finish an import of 500 releases without the member keeping the page open or restarting it.

#### Scenario: Progress shown
- **WHEN** an import is running
- **THEN** the member sees how many releases have been processed out of the total

#### Scenario: Member closes the app mid-import
- **WHEN** the member closes the app while an import is running
- **THEN** the import still completes and the records are there the next time the collection is opened

### Requirement: Re-import without duplicates
The system SHALL treat a repeated import as an update: releases already imported from that Discogs collection MUST NOT be added again, new releases are added, and edits made by members MUST be kept.

#### Scenario: Re-import after buying a record
- **WHEN** the member imports again after adding one release on Discogs
- **THEN** only that release is added

#### Scenario: Edited record is preserved
- **WHEN** a member changed a record's note or owner and the import runs again
- **THEN** the note and owner are unchanged

#### Scenario: Release removed on Discogs
- **WHEN** a release is no longer in the member's Discogs collection
- **THEN** the system does not delete it from the household collection

### Requirement: Search Discogs when adding a record
The system SHALL let a connected member search Discogs by text while adding a record and create the record from a chosen result, taking title, artist, year, label, genres, format and cover from it.

#### Scenario: Add from a search result
- **WHEN** a connected member searches an album and chooses a result
- **THEN** the add form is filled with that release's data and can be saved, with the owner defaulting to nobody (shared)

#### Scenario: No results
- **WHEN** the search finds nothing
- **THEN** the system says so and offers manual entry

### Requirement: Discogs results show what is already owned
The system SHALL mark a Discogs search result that matches a record in the collection, so a member can tell whether the family already has it.

#### Scenario: Result already in the collection
- **WHEN** a Discogs result is the same release as a record in the collection
- **THEN** it is marked "already in the collection" with the owner or "shared"

### Requirement: Discogs limits and failures
The system SHALL cope with Discogs rate limits and temporary failures by waiting and retrying, and MUST report a failure clearly if an import cannot finish. Records already imported MUST be kept.

#### Scenario: Rate limit reached
- **WHEN** Discogs answers that too many requests were made
- **THEN** the import waits and continues automatically

#### Scenario: Discogs unavailable
- **WHEN** Discogs stays unavailable after the retries
- **THEN** the import stops with a message, keeps the records already imported and can be run again

#### Scenario: Authorisation no longer valid
- **WHEN** Discogs rejects the member's stored authorisation
- **THEN** Settings shows the connection as expired and asks the member to reconnect

### Requirement: Discogs secrets stay on the server
The system MUST NOT expose the application's Discogs credentials or any member's Discogs authorisation to a browser, to other members, or to the repository.

#### Scenario: Member inspects network traffic
- **WHEN** a member inspects what the app sends and receives in the browser
- **THEN** no Discogs credential or authorisation token appears

### Requirement: Covers are kept with the record
The system SHALL keep a copy of each cover brought in from Discogs so the app still shows it if Discogs is slow or unavailable.

#### Scenario: Discogs unavailable after import
- **WHEN** Discogs is unreachable and a member opens the collection
- **THEN** previously imported covers are still displayed
