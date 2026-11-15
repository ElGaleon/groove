# record-ownership Specification

## Purpose
Defines how the ownership of a record, shared by the whole family or belonging to one member, is shown in every view and how it can be changed.

## Requirements


### Requirement: Ownership is visible on every record
The system SHALL show the ownership of a record in the list, the grid, the shelf preview and the record detail. A shared record SHALL look different from a member's record: shared records show a group icon and the word "shared"; a member's record shows the member's name with a colour that is the same for that member in every view and in the owner filter. The information MUST NOT rely on colour alone.

#### Scenario: List and grid
- **WHEN** the collection is shown as a list or a grid containing a shared record and a record owned by Anna
- **THEN** the first shows a "shared" badge with the group icon and the second shows a badge with Anna's name and colour

#### Scenario: Shelf
- **WHEN** a member hovers or focuses a record on the shelf
- **THEN** the preview card shows who owns it, or that it is shared

#### Scenario: A member who left
- **WHEN** a member leaves the family
- **THEN** the records that were theirs are shown as shared

### Requirement: The owner can be changed at any time from the detail
The system SHALL let any member of the family change the owner of any record at any time from the record detail, choosing "shared" or any member of the family, without opening the edit form. The change SHALL be saved at once, confirmed by a short message, and shown in every view without reloading. The edit form SHALL keep its owner field.

#### Scenario: Hand a record to Bob
- **WHEN** Anna opens a shared record and chooses Bob as owner
- **THEN** the record is saved as Bob's, the detail shows Bob's badge, the list and the grid show Bob's badge and the "Bob" owner filter includes it

#### Scenario: Make a record shared again
- **WHEN** a member chooses "shared" on a record that belonged to Anna
- **THEN** the record becomes shared and shows the shared badge

#### Scenario: Refused change
- **WHEN** the server refuses the new owner (for example a person who is not in the family)
- **THEN** the owner on screen stays as it was and an error message is shown

### Requirement: The collection can be filtered by owner
The system SHALL offer an owner filter in the filter bar with the entries "all owners", "shared" and each member of the family, each showing how many records it matches, and SHALL keep the choice in the address so it survives a reload and a change of view.

#### Scenario: Only Anna's records
- **WHEN** a member picks Anna in the owner filter
- **THEN** only the records owned by Anna are shown, in every view, and the address contains `owner=` with her id

#### Scenario: Only shared records
- **WHEN** a member picks "shared"
- **THEN** only records with no owner are shown

### Requirement: Owner choices are limited to the family
The system SHALL offer only "shared" and the members of the household as owners, and the server MUST refuse an owner who is not a member of the household.

#### Scenario: Unknown owner
- **WHEN** a request sets `owner_id` to someone outside the household
- **THEN** the server answers with the coded error `invalid_owner` and the record is unchanged
