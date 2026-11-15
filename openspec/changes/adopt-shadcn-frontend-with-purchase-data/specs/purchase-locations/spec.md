# Spec Delta

## Purpose

Lets a family record where records are bought (shops, markets, websites) once and reuse the place across purchases and members.

## ADDED Requirements

### Requirement: Locations are shared by the household
The system SHALL keep locations per household, visible and editable by every member, with a kind: `physical`, `online` or `both`. A physical or `both` location MUST have an address; an online or `both` location MUST have a valid http(s) URL. Coordinates are optional.

#### Scenario: Physical shop
- **WHEN** a member creates "Disco Club" as physical with an address
- **THEN** the location is saved and visible to the other members

#### Scenario: Invalid URL
- **WHEN** a member creates an online location with "not a url"
- **THEN** the system rejects it with a validation error on the URL

### Requirement: Link a purchase to a location
The system SHALL let a record's purchase point to a location of the same household. For a `both` location the purchase MUST state its channel (`physical` or `online`); for other kinds the channel is implied.

#### Scenario: Online purchase at a shop with a store
- **WHEN** a purchase at a `both` location has channel `online`
- **THEN** it counts as an online purchase and not as a physical one

#### Scenario: Location of another household
- **WHEN** a purchase points to a location that is not in the member's household
- **THEN** the system rejects it

### Requirement: Locations in use cannot be deleted
The system SHALL refuse to delete a location used by records, answering with the number of records, and SHALL offer to move those purchases to another location and then delete it.

#### Scenario: Delete in use
- **WHEN** a member deletes a location used by 3 records
- **THEN** the system answers 409 with count 3 and deletes nothing

#### Scenario: Reassign and delete
- **WHEN** a member reassigns the 3 purchases to another location and deletes the first
- **THEN** the 3 records point to the new location and the old one is gone

### Requirement: Reuse and search locations
The system SHALL list locations sorted by name, searchable by name, so a member picks an existing one instead of typing it again.

#### Scenario: Pick existing
- **WHEN** a member types "Disco" while adding a purchase
- **THEN** locations whose name contains "Disco" are offered
