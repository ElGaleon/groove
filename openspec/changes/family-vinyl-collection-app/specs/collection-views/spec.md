# Spec Delta

## Purpose

Defines how members see the collection: a 3D shelf that shows a random pick of 8 records, and a grid and a list for browsing, searching and filtering the whole collection, on phone and desktop.

## ADDED Requirements

### Requirement: Shelf shows 8 random records
The system SHALL show on the 3D shelf 8 records chosen at random from the collection, arranged on two shelves of four sleeves, each showing the record's cover. It MUST NOT try to show the whole collection on the shelf.

#### Scenario: Open the shelf
- **WHEN** a member opens the shelf view of a collection with more than 8 records
- **THEN** 8 randomly chosen records appear on two shelves with a short entrance animation

#### Scenario: Collection with fewer than 8 records
- **WHEN** the collection has fewer than 8 records
- **THEN** the shelf shows all of them and leaves the other slots empty

#### Scenario: Empty collection
- **WHEN** the collection has no records
- **THEN** the shelf shows an empty state with an action to add a record, and an import action if the member has connected Discogs

### Requirement: Draw another 8
The system SHALL let a member draw a new random set of 8 records, which MUST NOT repeat the records just shown while enough other records exist.

#### Scenario: Shuffle
- **WHEN** a member chooses "Show 8 others" on a collection of 150 records
- **THEN** the shelf is replaced by 8 records that were not in the previous set

#### Scenario: Collection of 8 or 9 records
- **WHEN** the collection has too few records to avoid repeats
- **THEN** the system allows repeats rather than showing fewer than 8 records

### Requirement: Shelf follows the filters
The system SHALL draw the 8 random records from the records that match the active filters, such as a given owner.

#### Scenario: Shelf for one owner
- **WHEN** a member filters by Anna and opens the shelf
- **THEN** the 8 records are drawn only from Anna's records

### Requirement: Select a record on the shelf
The system SHALL let a member select a sleeve to bring it to the centre of the screen, enlarged, with the rest of the shelf blurred and the title, artist, year and owner beside it. Selecting again, pressing Escape or choosing outside the sleeve MUST return it to its place.

#### Scenario: Select and return
- **WHEN** a member selects a sleeve and then presses Escape
- **THEN** the sleeve moves to the centre with its details and then returns to its slot

#### Scenario: Switch to another record
- **WHEN** a member selects a second sleeve while one is selected
- **THEN** the first returns to its slot and the second moves to the centre

### Requirement: Flip a record
The system SHALL let a member flip the selected sleeve to see its back, which shows the record's data and the track list when it is known.

#### Scenario: Flip and flip back
- **WHEN** a member flips the selected sleeve and flips it back
- **THEN** the back and then the front are shown, and the sleeve ends facing front

#### Scenario: No track list available
- **WHEN** the back is shown for a record without a track list
- **THEN** it shows the record's data and a note that no track list is available

### Requirement: Edit from the selected record
The system SHALL let a member edit or remove the selected record from its detail, and open its full detail page.

#### Scenario: Edit from the shelf
- **WHEN** a member chooses to edit the selected record
- **THEN** the system opens its editable fields without losing the shelf state

### Requirement: Grid view
The system SHALL offer a grid view of the collection showing cover, title and artist for each record, with the search, filters and sorting of the catalogue applied, and loading more records as the member scrolls.

#### Scenario: Browse the grid
- **WHEN** a member opens the grid on a collection of 200 records
- **THEN** the first records appear immediately and more appear as the member scrolls

### Requirement: List view
The system SHALL offer a list view of the collection with cover thumbnail, title, artist, year and owner on each row, with the search, filters and sorting of the catalogue applied and with sortable columns.

#### Scenario: Sort the list
- **WHEN** a member sorts the list by year
- **THEN** the rows are ordered by year, with a clear order indicator

### Requirement: Views share filters
The system SHALL keep the same search, filters and sorting when the member switches between shelf, grid and list.

#### Scenario: Switch view
- **WHEN** a member has filtered by genre and switches from the list to the grid
- **THEN** the grid shows the same filter applied

### Requirement: Record detail page
The system SHALL show a page for each record with all its data, its cover, its owner, its note, and actions to edit or remove it.

#### Scenario: Open a record
- **WHEN** a member selects a row in the list or a card in the grid
- **THEN** the record's detail page opens

### Requirement: Phone and desktop
The system SHALL be usable on a phone and on a desktop browser. On a phone, the shelf MUST fit the screen width, selection MUST work by tap, and no feature may depend on hover.

#### Scenario: Tap on a phone
- **WHEN** a member taps a sleeve on a phone
- **THEN** it is selected exactly as on desktop

#### Scenario: Desktop pointer
- **WHEN** a member moves the mouse over a sleeve on desktop
- **THEN** the sleeve lifts slightly as a hover cue

### Requirement: Performance and fallbacks
The system SHALL load only the covers it displays, and MUST fall back to the grid view with a message when 3D graphics are unavailable. It SHALL respect the system setting for reduced motion by skipping the entrance and transition animations.

#### Scenario: Large collection
- **WHEN** the collection holds 500 records
- **THEN** the shelf loads only the 8 covers it shows, and grid and list load covers as rows come into view

#### Scenario: 3D unavailable
- **WHEN** the browser cannot create a 3D graphics context
- **THEN** the system shows the grid view and a short message

#### Scenario: Reduced motion
- **WHEN** the member's system asks for reduced motion
- **THEN** the shelf appears and selections happen without animated transitions
