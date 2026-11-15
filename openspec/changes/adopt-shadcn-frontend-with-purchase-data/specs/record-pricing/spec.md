# Spec Delta

## Purpose

Lets a family keep the version of each record, what was paid, what it is worth now and the gain or loss, so the same title in different pressings can be told apart and valued.

## ADDED Requirements

### Requirement: Record has version details
The system SHALL store for each record, besides label, year, format and note, the catalogue number and the country of the pressing. All version fields SHALL be optional except title and artist.

#### Scenario: Two pressings of one album
- **WHEN** a member adds "Abbey Road" first as UK 1969 PCS 7088 and then as a 2019 reissue
- **THEN** both records exist, each with its own version details

#### Scenario: Incomplete version
- **WHEN** a record has no label, year, country or format
- **THEN** it is flagged as having an incomplete version in lists and detail

### Requirement: Duplicate check respects the version
The system SHALL treat a new record as a duplicate only when artist and title match and, if either record has a catalogue number, the catalogue numbers match too; a Discogs release already in the collection SHALL always be a duplicate. The member MAY save anyway.

#### Scenario: Different pressing is not a duplicate
- **WHEN** a member adds an album already present but with a different catalogue number
- **THEN** the record is saved without a duplicate warning

#### Scenario: Same pressing
- **WHEN** a member adds an album with the same artist, title and catalogue number
- **THEN** the system answers with the duplicate warning and the existing record

### Requirement: Purchase price
The system SHALL store the purchase of a record as an optional amount in minor units (cents) with an ISO currency, an optional date and an optional place. The amount MUST NOT be negative.

#### Scenario: Price saved
- **WHEN** a member enters 24,90 EUR and a date
- **THEN** the record keeps 2490 cents, EUR and the date, and shows 24,90 €

#### Scenario: Negative amount
- **WHEN** a member sends a negative amount
- **THEN** the system rejects it with a validation error

### Requirement: Current value with source
The system SHALL store a current value (minor units, currency) with its source (`manual` or `discogs`), the date it was set and, for Discogs, the measure used and the number of copies for sale. A value entered by hand MUST NOT be replaced by a Discogs value unless the member confirms.

#### Scenario: Manual value
- **WHEN** a member enters a value by hand
- **THEN** it is saved with source `manual` and today's date

#### Scenario: Discogs value does not overwrite a manual one
- **WHEN** a Discogs value is proposed for a record whose value is manual
- **THEN** the manual value stays until the member confirms the replacement

### Requirement: Gain and loss
The system SHALL show the difference between current value and purchase price, in amount and percent, only when both exist in the same currency; otherwise it SHALL show "n/d". Gain and loss MUST be conveyed with an icon and text, not colour alone.

#### Scenario: Gain
- **WHEN** price is 20 EUR and value 35 EUR
- **THEN** the record shows +15 EUR (+75%) with a gain indicator

#### Scenario: Different currencies
- **WHEN** price is in USD and value in EUR
- **THEN** the difference is shown as n/d

### Requirement: Collection totals cover the whole collection
The system SHALL serve, per currency, the total spent, total current value and total difference over all matching records that have both amounts in that currency, plus how many records were left out for missing data. Totals MUST NOT depend on how many records the client has loaded.

#### Scenario: Totals beyond one page
- **WHEN** the collection has 200 records and the list shows 48
- **THEN** the totals are computed on all 200

#### Scenario: Records left out
- **WHEN** 8 of 10 records have price and value in the same currency
- **THEN** totals use 8 and report 2 left out

### Requirement: Filters and options by version
The system SHALL let members filter records by country, format and year as well as by label, genre, decade and owner, and SHALL list the available values in the options endpoint.

#### Scenario: Combined filters
- **WHEN** a member filters country "UK" and format "LP"
- **THEN** only records with both are listed
