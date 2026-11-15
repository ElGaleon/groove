## 1. Members and colours

- [x] 1.1 Move `useMembers` to `shared/lib/members.ts`, add the owner colour palette (`--owner-1..6`) and `ownerColor(index)`; re-export from `collection/filters.ts` and use it in the record dialogs
- [x] 1.2 Add the catalog texts (it/en): shared label, owner updated, owner change failed

## 2. Show ownership

- [x] 2.1 Add `OwnerBadge` (shared variant with icon, member variant with coloured dot and name, first name on narrow screens)
- [x] 2.2 Show it in the list rows, on the grid covers, on the shelf preview card and as the detail value
- [x] 2.3 Add the owner filter to the filter bar, with the owner colours and counts

## 3. Change ownership

- [x] 3.1 Add `OwnerSelect` in the record detail: PATCH only `owner_id`, update caches, toast, keep the old value on error
- [x] 3.2 Pytest: any member can change the owner of any record, to shared and to another member; an owner outside the household is refused with `invalid_owner`

## 4. Verification

- [x] 4.1 Unit tests for the badge (shared vs member, no colour-only information) and the stable colours
- [x] 4.2 Playwright: badges in list and grid, change the owner from the detail and see it in the views and in the owner filter; phone width check
- [x] 4.3 Run vitest, tsc, lint, build, pytest and the e2e suite; validate the change; rebuild the stack after a backup; archive
