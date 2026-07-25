# E2E Report — i18n-preferences

- **Date / Branch / Commit**: 2026-07-25 02:29:53 +08 / no branch (unborn repository) / **no valid HEAD**
  - `git rev-parse --verify HEAD` exited 128 (`fatal: Needed a single revision`). `git status --short` shows the working tree as entirely untracked, including source, tests, OpenSpec, and generated `test-results/`. This is working-tree evidence only: a commit-equality merge gate cannot accept it until a baseline commit exists and this run is repeated.
- **Mode**: scripted (Playwright + Node `node:test` + real Vite export)
- **Coverage**: executed 12 + manually-verified 0 + waived 0 = 12
- **Verdict**: ✅ all green (working-tree-only evidence; not commit-stamped)

## Scenarios

| ID | Execution | Result | Interface assertion | Persistence verification |
|----|-----------|--------|---------------------|--------------------------|
| S1 | script (`e2e/i18n-preferences.spec.mjs`) | ✅ | `zh-CN` browser renders Chinese and `html[lang=zh-CN]` | suite: `mv-locale` and `mv-theme` are both `null`; no database exists |
| S2 | script (three browser locales) | ✅ | `en-US`, `fr-FR`, and `zh-TW` each render English and `html[lang=en]` | suite: both preference keys remain `null`; no database exists |
| S3 | script | ✅ | language toggle updates mounted chrome and survives reload | suite: only `mv-locale=en` is added; no database exists |
| S4 | script | ✅ | three clicks/reloads produce `light`, `dark`, then `auto`, with matching resolved theme | suite: `mv-theme` is the current raw preference after each action; no database exists |
| S5 | script | ✅ | `auto` follows emulated system changes; manual `light` does not | suite: later system changes leave LocalStorage unchanged; no database exists |
| S6 | script (five frontmatter cases) | ✅ | valid `mode` values resolve; invalid/missing falls back to `auto` | suite: `mv-theme` remains absent; no database exists |
| S7 | script | ✅ | invalid and throwing LocalStorage remains usable; in-memory controls update DOM | suite: invalid values are not rewritten; no database exists |
| S8 | script (including four empty-state carriers) | ✅ | Chinese/English menus, TOC, controls, Grid, empty/error surfaces, Colophon, and catalog-key parity pass | suite: deliberate language action writes `mv-locale=en`; no database exists |
| S9 | script (`test/cli-language.test.mjs`) | ✅ | CLI precedence, localized invalid input, exit status, and injected provenance pass | suite: invalid invocation performs no server/build/storage write; no database exists |
| S10 | script (Playwright offline export + `test/export.test.mjs`) | ✅ | offline English export has zero HTTP requests; both controls and reload work | suite: exactly `mv-locale=zh-CN` and `mv-theme=light` after actions; no database exists |
| S11 | script | ✅ | author text nodes are unchanged through language toggle | suite: only `mv-locale=zh-CN` is written; no database exists |
| S12 | script (full Node + Playwright suites) | ✅ | MDX compilation, routing, diagrams, and self-contained export remain compatible | suite: fixtures make no database write; preference writes are scoped by their scenarios |

## Persistence / database verification

This change has **no database, schema, connection string, or database write path**. A repository-wide configuration search found no application database integration; browser LocalStorage is the only persistence surface specified and exercised. There are therefore no tables to query with `SELECT` and no database evidence to fabricate. The browser suite directly checks `mv-locale` and `mv-theme` on every executed browser path that mutates them or requires their absence; the CLI and export suites check their no-write and self-contained contracts.

## Scripted results

- `npm test` → exit 0; **46 passed / 0 failed / 0 skipped** (7.01 s). This includes S9, locale/preference rules, MDX pipeline, resolve/routing, and export smoke.
- `CI=1 npm run test:e2e` → exit 0; **21 passed / 0 failed / 0 skipped** (20.2 s). Machine-readable `test-results/playwright.json` confirms 21 expected tests, 21 passed results, 0 report errors, 0 unexpected, and 0 skipped. All manifest-mapped Playwright tests executed; the additional four S8 empty-state carriers passed.
- `npm run test:export` → exit 0; **8 passed / 0 failed / 0 skipped** (3.66 s), including S10's localized offline-export contract and zero-external-resource assertions.

During S8, the intentionally malformed `e2e/fixtures/render-error.mdx` caused the expected Vite/MDX compile diagnostic; its localized `MDX render failed` surface was asserted successfully. It is test input for the error path, not a test failure.

## Regression suite

Executed in scope. The commands above cover existing Node compatibility tests, the full browser suite, and the real Vite single-file export smoke. No regression failure was observed.

## Failures / blockers

No scenario failure or infrastructure blocker occurred.

**Freshness blocker for merge gate:** the repository has an unborn Git history, so no report can satisfy `report commit == merge-candidate HEAD`. Create a baseline commit, then repeat this acceptance run against that HEAD.
