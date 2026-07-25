# TDD evidence — polished-cli-output

## Scenario-to-test mapping

| Scenario | Test coverage |
| --- | --- |
| S1 | `test/cli-output.test.mjs`: both direct `--help` subprocess tests, plus `formatHelp` section test |
| S2 | `test/cli-output.test.mjs`: both commands reject unknown options, missing option values, and surplus positional arguments with a diagnostic and complete help page |
| S3 | `test/cli-output.test.mjs`: plain preview/export formatter panels and a real `mdxx` subprocess export panel |
| S4 | `test/cli-output.test.mjs`: TTY/`NO_COLOR` decision and ANSI success/link styling while stripped text remains unchanged |

## Final verification

This workspace has no Git repository baseline, so every run is stamped `uncommitted (no HEAD)`.

| Command | Exit | Result | Stamp |
| --- | ---: | --- | --- |
| `node --test test/cli-output.test.mjs` | 0 | 12 passed, 0 failed | uncommitted (no HEAD) |
| `node --test test/cli-language.test.mjs` | 0 | 14 passed, 0 failed | uncommitted (no HEAD) |
| `node --test test/cli-output.test.mjs test/cli-language.test.mjs` | 0 | 26 passed, 0 failed | uncommitted (no HEAD) |
| `npm test` | 0 | 74 passed, 0 failed | uncommitted (no HEAD) |

## Oracles and quality gates

- Exported presentation interfaces are exercised by `test/cli-output.test.mjs`: `isColorEnabled`, `formatHelp`, `formatPreviewSuccess`, and `formatExportSuccess`; `formatError` is exercised through both CLI subprocess error paths.
- ANSI invariant: S4 verifies that enabling color styles the semantic success mark and link, while removing ANSI escapes retains the status text; a non-TTY or any present `NO_COLOR` value disables styling.
- Linux-style error invariant: unknown options, missing option values, missing required input,
  and surplus positional arguments all emit a specific diagnostic followed by complete help.
- Display invariant: Chinese full-width labels are padded by terminal column width; export size
  is calculated from UTF-8 bytes rather than JavaScript UTF-16 character count.
- Mutation testing and a property-testing library are not configured in this Node built-in-test project; no mutation result is claimed.
- The project provides no lint, formatter, or standalone typecheck command (`package.json` and `Makefile` inspected), so no lint command was run or invented.
