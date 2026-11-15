# Proposal

## Why

A family collects vinyl records in several hands and nobody has the full list in mind. The result is duplicates bought by mistake and records that are forgotten. The family needs one shared place where everyone can add, change and look up records, quickly, from a phone while standing in a shop.

Many members already keep their collection on Discogs, so the app should let each person connect their own Discogs account to import it and to search Discogs directly, while still working fully by hand for anyone who does not.

## What Changes

- New web app, essentially a CRUD application for a shared family vinyl catalogue, with a React front end and a Python back end.
- Each member can connect their own Discogs account from Settings. Connecting unlocks importing their Discogs collection and searching Discogs when adding a record. Without a connection, everything can be done manually.
- Each record can have an optional owner (a family member). A record with no owner is shared.
- Three ways to look at the collection: a 3D shelf that shows 8 randomly chosen records (with a way to draw 8 new ones), a grid, and a list. Grid and list support search and filters for easy reading, because the collection is expected to exceed 150 records.
- Quick lookup meant for shopping: search that answers "do we already have this?", and, when Discogs is connected, Discogs results flagged as already in the collection.
- Family access by invitation with email and password; every member has the same rights.
- The existing Three.js shelf prototype is reused for the 3D shelf, loading real covers.

Out of scope: native mobile apps, audio playback, prices or marketplace, multiple households per person, different permission levels per member, live multi-user updates, two-way sync back to Discogs.

## Capabilities

### New Capabilities

- `family-sharing`: the household, invitations, sign-in with email and password, and equal rights for all members.
- `collection-catalog`: records with an optional owner, adding, editing and removing them by hand, search, filters and sorting, and duplicate warnings.
- `discogs-integration`: connecting and disconnecting each member's own Discogs account in Settings, importing their collection, searching Discogs when adding, and the manual-only behaviour when not connected.
- `collection-views`: the 3D shelf of 8 random records, the grid and the list, the filters shared by them, the record detail, and behaviour on phone and desktop.

### Modified Capabilities

None. The project has no existing specs.

## Impact

- New application code in this repository: a React front end (based on the Three.js prototype for the shelf) and a Python API with a PostgreSQL database.
- New external dependency: the Discogs API, accessed on behalf of each member through their own authorisation. The application's Discogs credentials and members' access tokens are secrets kept on the server.
- Covers imported from Discogs are stored privately on the server for the family's use only, because Discogs limits how its images may be used.
- Needs hosting for a small API, a database and static files, chosen at deploy time.
