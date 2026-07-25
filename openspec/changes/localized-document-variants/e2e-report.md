# E2E Report — localized-document-variants

- **Date / Branch / Commit**: 2026-07-25 / no branch baseline / `working-tree-only` (repository has no resolvable `HEAD`)
- **Mode**: scripted Playwright (all scenarios)
- **Coverage**: executed 12 + manually-verified 0 + waived 0 = 12
- **Verdict**: ✅ all green (working-tree-only; no commit-stamp freshness can be established)

## Execution evidence

- `CI=1 npm run test:e2e` → exit 0; full Playwright run: passed 33, failed 0, skipped 0. The 12 mapped tests in `localized-document-variants.spec.mjs` each executed once and passed.
- `npm test` → exit 0; Node test runner: passed 62, failed 0, skipped 0. This includes real `mdxx` export smoke coverage plus B2/B3 query-and-fragment unit coverage.
- S4's current scripted scenario verifies normal persistence, a broken selected physical variant, and the Storage-blocked body variant: a broken `zh-CN` target produces the localized MDX render-error state without a page error or an incorrect canonical URL; after `Storage.getItem` and `Storage.setItem` are patched to throw, a language switch still renders the Chinese physical document and updates its URL.
- S8's current scripted scenario verifies a localized relative target while retaining `?view=compact#localized-target`. The full existing i18n/empty-state browser regressions also passed, including `Recover from damaged or unavailable LocalStorage`.
- S9's race-resistant assertion waits for both the Simplified-Chinese demo heading and the selected physical document URL; it passed in this final full run.

## Persistence / database verification

This is a browser-only MDX viewer: source/dependency inspection found no application database client, database configuration, or database environment connection. Therefore no database rows are applicable or queryable; this is not a missing DB assertion.

The feature's only persistent write is browser LocalStorage. S4's scripted assertion verified, in the running browser, that switching language writes `localStorage["mv-locale"] = "zh-CN"` and navigates to `README.zh-CN.mdx`. Its Storage-blocked branch verifies that the same visual/navigation outcome occurs without a thrown error when persistence is unavailable. Its broken-variant branch verifies a localized render-error response instead of an uncaught page error. No other S1–S12 path writes persistent server-side data.

## Scenarios

| ID | Execution | Result | Interface assertion | Persistence / DB verification |
|----|-----------|--------|---------------------|-------------------------------|
| S1 | script (`e2e/localized-document-variants.spec.mjs`) | ✅ | `zh-CN` renders the Chinese physical variant | N/A — no DB write |
| S2 | script | ✅ | missing locale selects the base physical file | N/A — no DB write |
| S3 | script | ✅ | `en-US` exact variant wins before base | N/A — no DB write |
| S4 | script | ✅ | normal and Storage-blocked switches render Chinese counterpart; broken selected variant shows localized render error without page error | ✅ runner: normal branch writes `mv-locale=zh-CN`; blocked/broken branches introduce no DB write |
| S5 | script | ✅ | direct locale-suffixed URL canonicalizes to exact/base target | N/A — no DB write |
| S6 | script | ✅ | navigation shows one neutral-label family entry | N/A — no DB write |
| S7 | script | ✅ | dotted basename stays a base document; final locale suffix resolves | N/A — no DB write |
| S8 | script | ✅ | relative link resolves to active locale target and retains `?view=compact#localized-target` | N/A — no DB write |
| S9 | script | ✅ | demo switches to Chinese heading and physical counterpart URL (race-safe poll) | N/A — no DB write |
| S10 | script | ✅ | selected Chinese export opens offline with no external requests | N/A — no DB write |
| S11 | script | ✅ | topbar computed height is 36px; controls fit with no overflow | N/A — no DB write |
| S12 | script | ✅ | localized matching hints and visible keyboard focus | N/A — no DB write |

## Regression suite

`CI=1 npm run test:e2e` ran the full existing browser suite: 33 passed / 0 failed / 0 skipped (including i18n and empty-state regression coverage).

`npm test` ran the full Node suite: 62 passed / 0 failed / 0 skipped, including real `mdxx` export smoke assertions and query/hash-preservation tests.

## Failures / blockers

- No product, test, or infrastructure failures observed.
- **Commit freshness limitation**: Git reports `fatal: ambiguous argument 'HEAD'`; all files are untracked and this report is necessarily against the current working tree only. A commit must exist before a commit-stamped merge-gate freshness check is possible.
