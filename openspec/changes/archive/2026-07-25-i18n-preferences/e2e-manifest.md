# E2E Manifest — i18n-preferences
status: final
total-scenarios: 12

## Coverage
| Scenario | Bucket | Test / reason | db-assert |
|----------|--------|---------------|-----------|
| S1 | mapped | e2e/i18n-preferences.spec.mjs → `S1: Simplified Chinese browser default` | suite |
| S2 | mapped | e2e/i18n-preferences.spec.mjs → `S2: Non-Simplified-Chinese browser default` | suite |
| S3 | mapped | e2e/i18n-preferences.spec.mjs → `S3: Switch language and restore it` | suite |
| S4 | mapped | e2e/i18n-preferences.spec.mjs → `S4: Cycle and restore all theme preferences` | suite |
| S5 | mapped | e2e/i18n-preferences.spec.mjs → `S5: Follow system only in auto` | suite |
| S6 | mapped | e2e/i18n-preferences.spec.mjs → `S6: Resolve frontmatter and default theme` | suite |
| S7 | mapped | e2e/i18n-preferences.spec.mjs → `S7: Recover from damaged or unavailable LocalStorage` | suite |
| S8 | mapped | e2e/i18n-preferences.spec.mjs → `S8: Exercise every fixed-message family` | suite |
| S9 | mapped | test/cli-language.test.mjs → `S9: Resolve CLI precedence and reject invalid values` | suite |
| S10 | mapped | e2e/i18n-preferences.spec.mjs → `S10: Use preferences in an offline export`; test/export.test.mjs validates export bootstrap | suite |
| S11 | mapped | e2e/i18n-preferences.spec.mjs → `S11: Preserve author-provided content` | suite |
| S12 | mapped | e2e/i18n-preferences.spec.mjs → `S12: Preserve drawer navigation and relative Markdown links`; compatibility suites | suite |

non-scripted: 0 / 12 (agent-driven + waived)

## Run

- `npm run test:e2e -- --reporter=json,junit`
- `npm run test:export`
- `npm test`

## Verification

- `CI=1 npm run test:e2e` → 21 passed twice consecutively (2026-07-25)
