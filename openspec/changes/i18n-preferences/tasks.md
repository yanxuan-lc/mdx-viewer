## 1. Shared locale and preference core

- [ ] 1.1 Add the two complete message catalogs, Locale normalization, interpolation, and catalog-key parity tests.
- [ ] 1.2 Add pure browser preference resolution and safe `mv-locale` / `mv-theme` LocalStorage helpers with invalid/unavailable-storage tests.
- [ ] 1.3 Change expected CLI input failures to stable error codes with parameters while preserving resolve/scan/default-document behavior.

## 2. CLI and virtual configuration

- [ ] 2.1 Implement strict `--lang` / `MDXV_LANG` / system / English CLI resolution and localized help, status, success, and expected-error output for both commands.
- [ ] 2.2 Inject `initialLocale` and `localeSource` through Vite configuration and `virtual:mdxv-config`, including global type declarations.
- [ ] 2.3 Add subprocess tests for both command precedence matrices, localized invalid-value failures, and “no server/build on invalid language”.

## 3. Browser preferences and product messages

- [ ] 3.1 Add the preference provider that initializes Locale/theme before visible render, updates `<html>` attributes, persists valid manual choices, and safely degrades when storage is unavailable.
- [ ] 3.2 Replace the existing theme effect/toggle with the auto → light → dark cycle and correctly scoped system-theme listener.
- [ ] 3.3 Add the language control left of the theme control and localize navigation, TOC, empty/error surfaces, accessibility labels, Grid default, and Colophon fixed wording.
- [ ] 3.4 Update semantic CSS for the two controls without hard-coded component colors or regressions to responsive/reduced-motion behavior.

## 4. Scripted acceptance and compatibility

- [ ] 4.1 Add Playwright test infrastructure and implement S1–S8 and S11 against a local preview, including DOM, media-query, LocalStorage, reload, and author-content assertions.
- [ ] 4.2 Extend the real export fixture/smoke and Playwright coverage for S10: `--lang`, offline zero-request behavior, controls, and persistence.
- [ ] 4.3 Run S12: existing resolve/MDX/export suites plus all new unit, CLI, and browser suites; record the stable S1–S12 mapping in `e2e-manifest.md`.
