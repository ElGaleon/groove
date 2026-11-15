## 1. Brand and fonts

- [x] 1.1 Add `public/favicon.svg` and a `BrandMark` component; use it in `SiteHeader` and in the auth layout wordmark
- [x] 1.2 Move the shelf cover fonts out of `index.html` into an `ensureCoverFonts()` called by the shelf before drawing covers

## 2. Auth screens

- [x] 2.1 Add `PasswordField` (show/hide, `aria-pressed`, localized label) and use it in sign-in, registration, invitation and reset; add `autoCapitalize`/`autoCorrect`/`enterKeyHint` to email fields
- [x] 2.2 Add `VinylSpinner` and a busy state on the submit buttons (label stays, disabled, no rotation under reduced motion)
- [x] 2.3 Collapse the hero band while a form field has focus on phones
- [x] 2.4 Make the footer as tall as the band so the form is centred on the viewport; centre title and subtitle on phones
- [x] 2.5 Apply the dark appearance to the auth screens when the system prefers it
- [x] 2.6 Add the catalog texts (it/en) for the new controls

## 3. Password recovery

- [x] 3.1 Add the `PasswordReset` model, the forward-only migration and the schemas
- [x] 3.2 Add `services/password_resets.py` (create, check, apply) and the three endpoints; add the coded errors `reset_not_allowed` and `reset_invalid`
- [x] 3.3 Add pytest tests: create for another member, refuse self and other household, one use only, expiry, replaced link, short password keeps the link valid, other sessions ended
- [x] 3.4 Add the `/reset-password/:token` page and route, and the "forgot your password?" hint on the sign-in screen
- [x] 3.5 Add the "reset password" button and link box to the family screen
- [x] 3.6 Add the English translations of the error codes and update the README section on addresses

## 4. Verification

- [x] 4.1 Playwright: screenshots of sign-in at phone and desktop width, a centring geometry test, and the reset-link journey
- [x] 4.2 Run pytest, ruff, vitest, tsc, build and the e2e suite; validate the change with `openspec validate --strict`
- [x] 4.3 Rebuild the Docker stack after a backup and check the sign-in screen and the reset link on the running stack
