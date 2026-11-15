# CLAUDE.md — web/src/

- `app/` is the shell: `main.tsx` (entry), `App.tsx` (router table using `routes`/`patterns`),
  `Layout.tsx`, `SiteHeader.tsx`, `RequireAuth.tsx`, `LanguageProvider.tsx`,
  `LegacyRedirect.tsx` (old Italian URLs → English ones; keep `legacyRedirects` working).
- New page: create it in the owning feature's `pages/`, export it from the feature `index.ts`,
  add its address to `shared/lib/routes.ts`, then wire it in `app/App.tsx`.
- `architecture.test.ts` enforces the import rules (see `../CLAUDE.md`). If it fails, move code
  to `shared/` or expose it via the feature's `index.ts` — don't weaken the test.
- `index.css` holds Tailwind and shadcn theme variables (light/dark).
- `test-setup.ts` configures vitest + Testing Library. Tests sit next to the code as
  `*.test.ts(x)`.
