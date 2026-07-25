# Design — localized document variants

## Module design

- `src/cli/localized-docs.mjs` owns filename parsing, family grouping, locale selection and fallback.
- `scanTree` continues returning physical files; the preview sends these to the browser.
- `main.tsx` resolves the selected physical file before importing and canonicalizes `?doc=`.
- `Layout.tsx` receives logical navigation entries and a locale-change callback. Language persistence
  remains owned by `PreferencesProvider`.
- `theme.css` owns the 36px topbar/control geometry and hover presentation.

## External protocol

`GET /__mdxv/tree` remains JSON. File records may carry family metadata needed by the browser.
Existing `?doc=<absolute physical path>` URLs remain accepted.

Supported locale suffixes are exactly `.zh-CN` and `.en-US` immediately before `.md` or `.mdx`.
Other dotted names are ordinary base filenames.

Selection order is exact active locale, then the unsuffixed base file. If neither exists, the
current physical file remains available only when directly addressed; it is not used as a
cross-locale fallback.

`mdxx <file>` exports only `<file>`.

## Database design

Not applicable. Persistence remains browser LocalStorage (`mv-locale`, `mv-theme`).

## UI design

The topbar is exactly 36px high. Menu, language and theme controls fit inside it. Every topbar
button has the same localized text for its accessible name and native hover hint (`title`).

