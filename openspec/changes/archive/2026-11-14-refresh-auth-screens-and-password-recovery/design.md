## Context

The auth screens already share one layout (`features/auth/components/AuthLayout.tsx`) with a decorative record (`VinylArt`). Accounts, invitations and sessions follow one pattern: a random token is shown once and only its SHA-256 hash is stored (`core/security.py`), and rows carry `expires_at` / `used_at`. The app has no email service and runs on the family's own machine, so recovery cannot rely on mail. `.dark` colour tokens exist in `index.css` but nothing ever applies the class.

## Goals / Non-Goals

**Goals:** a phone-first polish of the auth screens; a recovery path with no new infrastructure; one brand mark; lighter first load; tests that would have caught the centring problem.
**Non-Goals:** email delivery, two-factor, a dark theme for the whole app, an admin role.

## Decisions

- **Reset links reuse the invitation pattern.** New table `password_resets` (`id`, `user_id`, `created_by`, `token_hash` unique, `expires_at`, `used_at`, `created_at`). Creating a link deletes the unused ones of that member, so only the newest works. Alternative considered: a temporary password chosen by the helper; rejected because the helper would know the member's password.
- **Any member of the household may create a link for another member.** The app has no admin role and the family is small and trusted; the link is shown only to its creator and expires in 24 hours. Refusals use new coded errors `reset_not_allowed` (self or other household) and `reset_invalid` (bad, used, expired or replaced link).
- **Endpoints** (English, under existing prefixes): `POST /api/household/members/{id}/password-reset` (authenticated) returns `{token, expires_at}`; `GET /api/auth/password-reset/check?token=` returns `{status, display_name}` with status `valid|used|expired|invalid`; `POST /api/auth/password-reset` with `{token, new_password}` applies the password rules, ends every session of the member, marks the link used and creates a new session (cookie), like registration does.
- **Layering.** New `services/password_resets.py` owns the rules; routers stay thin; `schemas/accounts.py` gets the request and response models; `models/accounts.py` gets `PasswordReset`; migration `e3b6c8d0f2a4`.
- **Password field**: a new `PasswordField` in `shared/components` wraps `Field` with an eye button (`aria-pressed`, label from the catalog). `type` toggles between `password` and `text`.
- **Loading record**: a small `VinylSpinner` (the same SVG as `VinylArt`, reduced) shown inside the button while busy; rotation uses the `motion-reduce:animate-none` utility already used by `VinylArt`. The label stays, the button is disabled.
- **Keyboard**: on phones the hero band collapses when a form field has focus. Implemented with `focusin` / `focusout` on the form container toggling a data attribute, not with `visualViewport` hacks, so it works on every browser. The band keeps the brand name.
- **Centring**: the footer under the form takes the same height as the band above it, so the form is centred on the viewport and not only in the space between them. A test asserts the centre within 2 px.
- **Theme**: `AuthLayout` adds the `dark` class on its own root when `prefers-color-scheme: dark` matches (media query listener), so only these screens change. Alternative considered: a full app theme switch; deferred.
- **Brand mark**: `public/favicon.svg` (record with amber label) and a `BrandMark` component used by the header and the auth layout. The header's bag icon is replaced.
- **Fonts**: the Google Fonts `<link>` for Anton, Yellowtail and IBM Plex Mono moves out of `index.html` into the shelf module, which injects it once (`ensureCoverFonts()`) before drawing covers. Inter stays: the covers also use it and the cost is small, but it is injected with the others.
- **Visual tests**: Playwright screenshots of sign-in at 375 x 812 and 1280 x 800 with stored baselines under `e2e/__screenshots__`, the animation frozen by `reducedMotion: 'reduce'`, and a geometry test for centring.

## Risks / Trade-offs

- Any member can reset another's password: acceptable for a trusted household, mitigated by one-time, hashed, 24-hour links and by ending the other sessions on use. A future admin role would tighten it.
- Screenshot baselines depend on the font rendering of the machine that made them: the test is limited to Chromium in the e2e project and is regenerated with a documented command.
- Moving the font loading could flash fallback fonts on the first covers: covers are redrawn when the fonts are ready (`document.fonts.load`).

## Migration Plan

Forward-only Alembic migration adding `password_resets`; no data change. Back up with `scripts/backup.sh`, rebuild the images, the API applies the migration on start. Rollback: restore the backup.
