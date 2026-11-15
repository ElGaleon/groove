# Proposal

## Why

The sign-in, registration and invitation screens were bare. They now have a new look (a record on a dark band on phones, a split layout on wide screens), but the work around it is unfinished: typing a password on a phone is error-prone, the app has no brand mark (the favicon points to a file that does not exist), the login page downloads fonts it never uses, and a member who forgets their password has no way back in. The family has no email service, so recovery must work without one.

## What Changes

- Auth screens: a show/hide control on password fields, keyboard hints on the fields, a record that spins as the loading state of the submit button, a hero band that collapses while the keyboard is open, centring of the form on the screen, and a dark appearance that follows the system theme on these screens.
- Brand: a record mark used as favicon, in the app header and on the auth screens.
- Performance: the fonts used only by the covers of the 3D shelf are loaded when the shelf is opened, not on every page.
- Password recovery without email: a signed-in member generates a one-time link for a family member who forgot their password; the link opens a page where the new password is set. New table, three endpoints, one page, one button in the family screen.
- Quality: visual (screenshot) tests of the auth screens at phone and desktop width, and a check that the form is centred.

## Capabilities

### New Capabilities
- `auth-screens`: how the sign-in, registration, invitation and reset screens look and behave on phones and wide screens (layout, password field, loading state, keyboard, theme, brand).
- `password-recovery`: how a member who forgot the password gets back in, by a one-time link created by another member.

### Modified Capabilities

None. The existing capabilities do not change their requirements.

## Impact

- API: new table `password_resets` (forward-only migration), new service `password_resets`, endpoints `POST /api/household/members/{id}/password-reset`, `GET /api/auth/password-reset/check`, `POST /api/auth/password-reset`; new error codes `reset_invalid`.
- Web: `features/auth` (layout, fields, new `ResetPassword` page, route `/reset-password/:token`), `features/family` (button and link box), `app/SiteHeader.tsx` (brand mark), `index.html` and `public/favicon.svg`, shelf font loading, `i18n` catalogs (it/en), Playwright tests.
- No new runtime dependency. Out of scope: email delivery, two-factor, a dark theme for the rest of the app.
