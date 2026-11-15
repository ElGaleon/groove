# CLAUDE.md — web/src/i18n/

Languages: **Italian (`it`, default and fallback)** and English (`en`).

- `locales/it.ts` is the complete catalog and defines the `Catalog` type; `en.ts` must match it
  (the compiler reports missing keys). Add every new key to **both**.
- Use `t.<section>.<key>` in components; functions in the catalog handle plurals/values
  (e.g. `t.errors.passwordTooShort(n)`).
- API error codes map to `t.errors.codes[code]`; field names to `t.errors.fields[field]`.
  Adding an error code on the API means adding its message here.
- Dates, numbers, currency: use helpers in `format.ts`, never `toLocaleString` with a hard-coded
  locale.
- The member's language is saved on the server (`users.language`); browser language is the
  fallback before sign-in.
- Adding a language: follow "Adding a language" in the root README (catalog file,
  `LANGUAGES`/`catalogs`/`LOCALES` in `index.ts`, `LanguageSelect`, API `PreferencesIn.language`).
- `no-literal-text.test.ts` fails on literal words in JSX or in `aria-label`/`placeholder`/
  `title`/`alt`.
