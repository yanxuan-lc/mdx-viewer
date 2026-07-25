# TDD evidence — localized-document-variants

Commit stamp: unavailable — this workspace has no Git baseline, so no commit hash exists.

## Scenario-to-test mapping

| Scenario | Unit / integration coverage |
|---|---|
| S1 | `e2e/localized-document-variants.spec.mjs`: exact `zh-CN` physical variant; `test/localized-docs.test.mjs`: locale suffix parsing |
| S2 | E2E base-file fallback; `test/localized-docs.test.mjs`: exact-locale then base-only selection |
| S3 | E2E exact English-before-base selection; `test/localized-docs.test.mjs`: family selection invariant |
| S4 | E2E language switch, `mv-locale` persistence, URL, and unavailable-Storage regression; `test/locale.test.mjs`: persistence-result boundary |
| S5 | E2E direct locale URL canonicalization; `test/localized-docs.test.mjs`: direct unavailable variant remains addressable |
| S6 | E2E neutral, deduplicated document-family navigation; `test/localized-docs.test.mjs`: logical nav projection |
| S7 | E2E dotted basename and final locale suffix; `test/localized-docs.test.mjs`: dotted-name parsing |
| S8 | E2E relative local document routing, query/hash preservation, and localized target selection; `test/local-document-links.test.mjs`: POSIX/Windows path and URL pure functions |
| S9 | E2E English and Simplified-Chinese demo counterparts; demo source files are checked by the Vite build. |
| S10 | E2E explicit-physical-file `mdxx` offline export; existing `test/export.test.mjs` smoke coverage. |
| S11 | E2E computed 36px topbar and non-overflowing controls. |
| S12 | E2E matching localized hover/accessibility labels and keyboard focus. |

The scenario-to-script mapping is the authoritative `e2e-manifest.md`. The developer does not
write or run E2E code; its current execution result is recorded separately in `e2e-report.md`.

## Red-green record

| Phase | Exact command | Exit | Result | Commit |
|---|---|---:|---|---|
| RED | `node --test test/localized-docs.test.mjs` | 1 | 0 pass / 1 failed; expected missing `localized-docs.mjs` module | unavailable |
| GREEN tracer | `node --test test/localized-docs.test.mjs` | 0 | 1 pass / 0 failed | unavailable |
| Scoped final | `node --test test/localized-docs.test.mjs test/resolve.test.mjs` | 0 | 20 pass / 0 failed | unavailable |
| RED storage regression | `node --test test/locale.test.mjs` | 1 | 0 pass / 1 failed; expected missing `switchLocalePreference` export | unavailable |
| GREEN storage regression | `node --test test/locale.test.mjs` | 0 | 7 pass / 0 failed | unavailable |
| RED link routing | `node --test test/local-document-links.test.mjs` | 1 | 0 pass / 1 failed; expected missing `local-document-links.mjs` module | unavailable |
| GREEN link routing | `node --test test/local-document-links.test.mjs` | 0 | 3 pass / 0 failed | unavailable |
| Scoped final | `node --test test/local-document-links.test.mjs test/localized-docs.test.mjs test/locale.test.mjs test/resolve.test.mjs` | 0 | 31 pass / 0 failed | unavailable |
| Full final (post-B6 and BCP 47 rename) | `npm test` | 0 | 62 pass / 0 failed | unavailable |

The final full command ran after every changed test was present. Its Node test runner also exercises
the existing MDX compile pipeline and real `mdxx` export smoke test.

B6 changes the browser-only dynamic-import error boundary. The export smoke test compiles that
entrypoint in the final Node run; its rejected-import interaction is intentionally left to the
e2e-author browser regression carrier rather than simulated with a non-browser unit test.

## Oracle and interface coverage

No mutation or coverage runner is configured for this repository. The change instead has a
property-style exhaustive oracle: S6 enumerates all seven non-empty combinations of base,
`zh-CN`, and `en-US` family members; for every directly addressed member and both active locales it
asserts the invariant `exact locale → base only → no cross-locale result`.

Every exported interface in `src/cli/localized-docs.mjs` is directly exercised:
`parseLocalizedDocument` (S1), `parseLocalizedDocuments` (S1–S4), `selectLocalizedDocument`
(S2, S3, S6), `resolveCurrentDocument` (S3), and `buildLocalizedNavigation` (S4). This is
100% exported-interface coverage for the new module. The regression's
`switchLocalePreference` exported interface is directly exercised by S4. The new
`resolveLocalDocumentLink` and `buildLocalizedDocumentUrl` exported interfaces are directly
exercised by S8. Line coverage is not available because the project has no instrumented coverage
command.

## Build and lint

| Command | Exit | Result | Commit |
|---|---:|---|---|
| `node --input-type=module -e 'import { build } from "vite"; import { buildConfig } from "./src/cli/vite-config.mjs"; import { viteSingleFile } from "vite-plugin-singlefile"; import { resolve } from "node:path"; const config = buildConfig({mode:"file",target:resolve("demo/index.mdx"),version:"1.0.0",license:"MIT",initialLocale:"en-US",localeSource:"argument",outDir:"/tmp/mdxv-demo-build",extraPlugins:[viteSingleFile()]}); await build({...config,logLevel:"info"});'` | 0 | 3,667 modules transformed; self-contained demo build succeeded | unavailable |

No lint, formatter, typecheck, mutation, or coverage script is provided by `package.json` or
`Makefile`, so no lint command was invented.

## Glossary check

No `CONTEXT.md` exists for this bounded context. The glossary-conformance registry is therefore
missing and no naming verdict can be issued; this has no bearing on correctness.
