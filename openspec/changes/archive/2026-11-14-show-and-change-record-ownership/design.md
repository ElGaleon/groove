## Context

`records.owner_id` is nullable (null = shared) and `PATCH /api/records/{id}` already changes it, refusing owners outside the household (`invalid_owner`). The server filters by owner (`owner=any|shared|<member id>`) and the edit form has an owner field, but the filter bar has no owner control. What is missing is visibility: `RecordViews` (list, grid), `ShelfHoverCard` and the filter show nothing about the owner, and the detail shows a plain badge. Members come from `GET /api/household`, ordered by creation date, and each feature fetches them on its own (`useMembers` in `collection/filters.ts`, ad-hoc queries in the record dialogs).

## Goals / Non-Goals

**Goals:** ownership readable at a glance on phone and desktop; changeable in two taps; one definition of "who is who" shared by all screens.
**Non-Goals:** per-member permissions, bulk reassignment, statistics per owner, changing the 3D sleeves.

## Decisions

- **One source of members.** `useMembers()` moves to `shared/lib/members.ts` (it only needs `api` and the household schema) and returns the members plus helpers; `collection/filters.ts` re-exports it and the record dialogs use it, so the query key `['household']` is shared and cached once.
- **Stable colour per member.** A member's colour is the palette entry at their position in the household order (creation date), from a fixed palette of six hues defined as CSS variables in `index.css` (`--owner-1..6`, light and readable on white and on the dark shelf card). The same function colours the badge dot and the owner filter. Alternative considered: a colour stored on the user; rejected, it needs a migration and a picker for little value.
- **Not colour alone.** The badge always carries text: the member's name, or "shared" with a group icon. On narrow screens the name is shortened to its first word.
- **Badge component.** `OwnerBadge({ ownerId })` in `features/records/components` reads the members itself, renders the shared variant (outline, `UsersIcon`, "Condiviso") or the member variant (secondary, coloured dot, name) and renders nothing while members are loading, to avoid flashing the wrong state. In the grid it sits on the bottom-left corner of the cover as a small pill with a translucent backdrop; in the list it joins the meta row; in the shelf card it closes the card; in the detail it is the value of the owner row.
- **Quick change.** `OwnerSelect` replaces the static badge in the detail's owner row: a compact select (items: shared, then members) that sends `PATCH /api/records/{id}` with only `owner_id`, using the shared `Select` already used by the edit form. On success it updates the `['record', id]` cache from the response, invalidates `['records']` (lists, grid, summary, options counts) and shows a toast; on error it keeps the old value and shows the coded message. The change is applied optimistically only through the response, not before it, so the screen never shows an owner the server refused.
- **Owner filter control.** A new field in the filter bar, built from `GET /api/records/options` (`owners` with counts, `shared_count`) and the members, with the same dots; the default `any` is the "all owners" entry, and the choice lives in the address as `owner=`.
- **No server change.** The rules (any member may change any record, owner must be in the household) already exist; a pytest pins them so they cannot regress.

## Risks / Trade-offs

- Six colours repeat with more than six members: acceptable for a family; the name is always shown.
- Colours depend on member order, so a member who leaves shifts the colours of the later ones: acceptable, and consistent within a session.
- The extra badge adds height to list rows and grid cards: checked at 375 px.

## Migration Plan

Web only; rebuild the web image. Rollback: revert the web code. No data change.
