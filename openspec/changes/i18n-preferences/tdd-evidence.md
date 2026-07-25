# TDD evidence — i18n-preferences

Stamp: uncommitted. This workspace has no Git baseline (`git status` reports every
file untracked), so no commit hash can be attached to the runs below.

## Scenario mapping

| Scenario | Fast test / evidence |
|---|---|
| S1–S2 | `test/locale.test.mjs` browser/system Locale normalization and precedence |
| S3 | Product implementation: `PreferencesProvider.tsx` persists `mv-locale`; browser interaction carrier is owned by `e2e/i18n-preferences.spec.mjs` |
| S4 | `test/locale.test.mjs` asserts the `auto → light → dark → auto` cycle |
| S5 | Product implementation: `PreferencesProvider.tsx` registers a media-query listener only for `auto`; browser carrier is owned by the e2e suite |
| S6–S7 | `test/locale.test.mjs` exact theme fallback and unavailable-storage behavior |
| S8 | `test/locale.test.mjs` catalog-key parity, interpolation, and selected fixed-message lookup |
| S9 | `test/cli-language.test.mjs` strict precedence, invalid failures, localized subprocess help, and virtual-config injection |
| S10 | `test/export.test.mjs` real Vite export smoke, including `--lang en` static initial HTML contract |
| S11 | Product code limits translation to `usePreferences()` consumers; browser author-content assertion is owned by the e2e suite |
| S12 | `npm test` runs the existing resolve, MDX pipeline, and real export smoke suites |

## Final verification

| Command | Exit | Result | Stamp |
|---|---:|---|---|
| `node --test test/locale.test.mjs test/cli-language.test.mjs` | 0 | 11 passed, 0 failed | uncommitted / no Git baseline |
| `npm run test:unit` | 0 | 20 passed, 0 failed | uncommitted / no Git baseline |
| `npm run test:export` | 0 | 8 passed, 0 failed | uncommitted / no Git baseline |
| `npm test` | 0 | 39 passed, 0 failed | uncommitted / no Git baseline |
| `node --experimental-test-coverage --test test/locale.test.mjs test/cli-language.test.mjs` | 0 | 11 passed, 0 failed | uncommitted / no Git baseline |

The project defines no lint, formatter, typecheck, mutation, or coverage-threshold command;
therefore no lint command was available to run. The coverage run is diagnostic only: the new
pure rule modules report 98.11% (`preferences.mjs`) or 100% (`locale.mjs`, `messages.mjs`,
`language.mjs`) line coverage. The repository-wide 63.07% is not a gate because it includes
pre-existing modules outside this change and no configured threshold exists.

## Oracle

No mutation runner is configured. The portable oracle is finite-domain/exhaustive testing:
every supported Locale, Simplified-Chinese normalization family, theme-cycle state, explicit
CLI source, invalid explicit source, catalog-key set, and storage failure path is exercised by
the pure Node tests. The real export test separately proves that this same application is
bundled as a self-contained offline artifact.

## Controller fix round

- Replaced all three directory empty-state call sites with message keys rendered by
  `EmptyState` through `usePreferences()`, so a saved/current Locale controls the phrase.
- Replaced boot-error `innerHTML` interpolation with `root.render(<RenderError ... />)`;
  React renders the localized message and untrusted error text as text nodes.
- `node --test test/locale.test.mjs`: exit 0, 6 passed, 0 failed (includes English and Chinese
  missing-document catalog assertions).
- `npm test`: exit 0, 39 passed, 0 failed.
- `npm run test:export`: exit 0, 8 passed, 0 failed.
- `npx playwright test e2e/i18n-preferences.spec.mjs --grep 'S8'`: not a clean verdict: it
  timed out while the existing test toggled the persisted navigation drawer before it reached
  the missing-document assertion. No e2e file or navigation-persistence behavior was changed.

## Accessibility fix round

- Closed navigation drawers now render `inert` together with `aria-hidden`, preventing the
  off-canvas Close button and document links from entering sequential keyboard focus while the
  existing transform transition remains intact.
- `npm test`: exit 0, 39 passed, 0 failed.
- `npx playwright test e2e/i18n-preferences.spec.mjs`: exit 0, 16 passed, 0 failed.

## Code-review fix round

- A1/B1: startup preference resolution now runs before `root.render`, while committed Provider
  changes update `<html>` in `useLayoutEffect`; returning to `auto` refreshes the media query
  synchronously before the preference update. This prevents an intermediate stale theme commit.
- A2: input readability is checked at the CLI boundary and directory scan errors become
  `INPUT_NOT_FOUND`, never `DIRECTORY_EMPTY`.
- A3/B2/B3: export failures are localized as stable `EXPORT_FAILED` diagnostics; raw language
  parsing is centralized and parser errors are stack-free; absent storage writers return false.
- A5: fast subprocess coverage now includes malformed/unknown CLI arguments, localized expected
  export failure, and a real `mdxx` flag-over-environment localized export.
- S12 routing: drawer navigation closes before document navigation; non-ASCII relative paths are
  decoded before becoming `?doc=` values; Vite's development overlay is disabled so the localized
  render-error surface does not block later navigation.
- `npm test`: exit 0, 46 passed, 0 failed.
- `npx playwright test e2e/i18n-preferences.spec.mjs`: exit 0, 17 passed, 0 failed.

## Final S9 subprocess matrix

- `test/cli-language.test.mjs` now runs real `mdxv` flag/environment/system/fallback cases,
  fetches Vite's `virtual:mdxv-config`, and asserts both `initialLocale` and `localeSource`.
- It likewise runs real `mdxx` flag/environment/system/fallback exports, asserting localized
  status, static HTML locale, and bundled provenance; invalid exports explicitly leave no
  requested artifact.
- System and fallback paths use a Node `--import` data-URL preload that overrides
  `Intl.DateTimeFormat().resolvedOptions()` (or throws), never a product test hook.
- `npm test`: exit 0, 49 passed, 0 failed.

## Accessibility re-verification round

- React 18 drops the boolean JSX `inert` property, so the drawer now uses an aside ref and
  `useLayoutEffect(() => element.toggleAttribute("inert", !open), [open])`.
- A real Playwright browser probe observed the closed drawer as
  `{ hasAttribute("inert"): true, inert: true, aria-hidden: "true" }`; after opening it,
  the same values were `false`, `false`, and `"false"`.
- `npm test`: exit 0, 39 passed, 0 failed.
- `npx playwright test e2e/i18n-preferences.spec.mjs`: exit 0, 16 passed, 0 failed.
