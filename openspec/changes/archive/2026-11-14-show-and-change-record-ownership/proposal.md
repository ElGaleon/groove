# Proposal

## Why

Every record is either shared by the family or belongs to one member, and the data model, the filter and the edit form already know it. But the screens do not show it: the owner appears only inside the record detail, so in the list, the grid and on the shelf a shared record looks the same as one that belongs to Anna or Bob. Changing the owner is possible only by opening the full edit form. The filter bar has no owner control either, although the server filters by owner. Families want to see at a glance whose record it is and to hand a record over (or make it shared) whenever they like.

## What Changes

- Show the owner on every record: a badge in the list rows, on the cover in the grid, on the shelf preview card and in the detail. A shared record has its own look (icon and the word "shared"); a member's record shows their name with a colour that is the same for that member everywhere.
- Let any member change the owner at any time, directly from the record detail (a menu on the owner row), without opening the edit form; the change applies at once and every view updates.
- Add an owner filter to the filter bar (the address and the server already understood `owner=`, but the screen had no control for it): "all owners", "shared" and each member, with the same colours and the number of records. The edit form keeps its owner field.
- No change to who may edit: any member of the family can change the owner of any record, as they can already edit it.

## Capabilities

### New Capabilities
- `record-ownership`: how the ownership of a record (shared by the family or belonging to one member) is shown in every view and how it is changed.

### Modified Capabilities

None.

## Impact

- Web: new `OwnerBadge` and `OwnerSelect` components in `features/records`; `RecordViews` (list, grid), `ShelfHoverCard`, `RecordDetail`, the owner filter; a shared `useMembers` hook with a stable colour per member; catalog texts (it/en).
- API: none (`PATCH /api/records/{id}` already accepts `owner_id`); one extra test that pins the rules.
- Out of scope: ownership of the 3D sleeves themselves, bulk reassignment of many records at once, per-member statistics.
