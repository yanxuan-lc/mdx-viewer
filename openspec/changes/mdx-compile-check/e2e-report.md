# E2E Report — mdx-compile-check

**Re-stamped fix-verification pass** — supersedes the prior report. Two increments landed since
the last pass (#A1 check-mode detection fix, #A3 boundary help-text rewrite) plus new scenario
S20; this run re-executes the full scripted suite and re-verifies the previously-checked
properties against the new `bin/mdxv.mjs`.

- **Date**: 2026-07-28
- **Branch**: `dev`
- **Commit stamp**: **uncommitted working tree on branch `dev`, base `15433c904d7791df1a5428ba97aa334f0bc714c4`** ("docs: add a contributing guide"). No commit hash exists for the change itself — recorded honestly, not invented. `git status --short` at this report's time (unchanged in shape since the prior pass — same files, now with #A1/#A3/S20 content inside them):
  ```
   M Makefile
   M bin/mdxv.mjs
   M package.json
   M src/cli/output.mjs
   M src/i18n/messages.mjs
  ?? .claude/
  ?? openspec/changes/mdx-compile-check/
  ?? src/cli/compile-check.mjs
  ?? test/compile-check.cli.test.mjs
  ?? test/compile-check.perf.test.mjs
  ?? test/compile-check.test.mjs
  ?? test/fixtures/compile-check-e2e/
  ?? test/fixtures/compile-check/
  ```
  (`.claude/` remains unrelated harness scaffolding, not part of this change.)
- **Mode**: scripted only, unchanged carrier — subprocess CLI, no app to boot, no browser surface.
- **db-assert**: n/a for all 19 scenarios — no database in this project.
- **Coverage**: executed E=19 + manually-verified V=0 + waived W=0 = **M=19** (spec scenario count re-confirmed by `grep -c '### Scenario: S'` → 19 unique IDs, S1–S16 + S18–S20; **S17 confirmed still absent** everywhere except the manifest's own explanatory note about its deletion).
- **Verdict**: ✅ **all green**

## Commands run, with real exit codes (this run)

```
$ node --test test/compile-check.cli.test.mjs
tests 19, pass 19, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 19921.36
EXIT=0

$ node --test test/compile-check.perf.test.mjs
[S12] check=354.3ms export=3602.4ms ratio=10.17x
tests 1, pass 1, fail 0, duration_ms 3991.19
EXIT=0

$ npm test
tests 122, pass 122, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 26239.84
EXIT=0
```

This run's raw top-line total (122/122) matches the controller's own reported total exactly.

## Scenarios (19)

| ID | Execution | Result | Interface assertion | DB |
|----|-----------|--------|---------------------|----|
| S1  | script | ✅ | exit 0, exact `✓ <path>` | n/a |
| S2  | script | ✅ | exit 1, exact position + reason — **re-run outside the suite, same `:2:8`** | n/a |
| S3  | script | ✅ | mixed dir, sorted, summary | n/a |
| S4  | script | ✅ | all-pass summary | n/a |
| S5  | script | ✅ | full-feature doc passes | n/a |
| S6  | script | ✅ | 9 error shapes exit 2, stack-free | n/a |
| S7  | script | ✅ | unchanged since last audit — still asserts real `status===0` + post-exit TCP `ECONNREFUSED` | n/a |
| S8  | script | ✅ | no-position degrade | n/a |
| S9  | script | ✅ | unreadable-in-dir counted, rest reported | n/a |
| S10 | script | ✅ | undefined component passes; help text now names the boundary via mechanism-plus-examples (updated assertion, verified present — see below) | n/a |
| S11 | script (2 cases) | ✅ | locale-invariant lines, zero ANSI on non-TTY, `resolveCheckColors` pty-free branch | n/a |
| S12 | script, slow lane | ✅ | ratio **10.17x** this run (≥5x required) | n/a |
| S13 | script | ✅ | `.md`/`.mdx` asymmetry — **re-run outside the suite against the new `bin/mdxv.mjs`, still holds exactly** | n/a |
| S14 | script | ✅ | unresolvable top-level import: `--check` 0 / `mdxx` 1; fenced import passes both — **assertion untouched this round, per R6** | n/a |
| S15 | script | ✅ | 24-doc piped dir, no line dropped | n/a |
| S16 | script | ✅ | `--check demo` → exactly 2 named docs | n/a |
| S18 | script | ✅ | invalid prop not detected | n/a |
| S19 | script | ✅ | malformed math not detected | n/a |
| S20 | script (new) | ✅ | **audited below** — evaluation-time tier-B subset invisible to both `--check` and `mdxx` | n/a |

S17: still not a scenario, confirmed absent from spec.md, e2e-manifest.md, and both test files.

## S20 test-body audit (explicitly requested, same rigor as the S7 audit)

Read `test/compile-check.cli.test.mjs` lines 385–413 directly.

- **Two dedicated fixtures**, `boundary/throwing-initializer.mdx` (top-level `export` initializer
  that throws) and `boundary/throwing-expression.mdx` (a `{…}` expression that throws on
  evaluation) — distinct from every other fixture in the suite, not reused from an unrelated
  scenario.
- **Real subprocess exit codes, not a trivially-true assertion**: for each fixture, `runCheck`
  spawns the actual `bin/mdxv.mjs --check` child and asserts `checkResult.status === 0` plus the
  exact `✓ <path>` stdout line (lines 395–398) — a real compile-only pass, not an inference.
  Then `runExport` spawns the actual `bin/mdxx.mjs` child on the same fixture into a temp file and
  asserts `exportResult.status === 0` (lines 402–409) — this is the build path genuinely
  completing, producing an HTML artifact that would only throw in a browser, which the test
  correctly does not open.
- **Would fail if either command started detecting these shapes**: because the assertion is
  `status === 0` on both sides rather than "check and mdxx agree" or some other shape-blind
  comparison, if either `checkDocuments` or `mdxx`'s build pipeline began statically detecting a
  throwing top-level initializer or a throwing `{…}` expression, the corresponding `assert.equal`
  would fail with a nonzero status. Not vacuous — a code path that started raising here would trip
  this test immediately.
- Comment at lines 386–390 (in Chinese, matching the file's existing convention) explicitly states
  the design intent: S14 (specifier resolution, a build-time-visible failure) and S20 (evaluation-
  time-only failure) are deliberately kept as separate scenarios rather than folding S20's shapes
  into S14's `mdxx` assertion — which the test confirms it has not done (S14's own body is
  untouched, verified by reading it above: still asserts `exportOnImport.status === 1`).

Verdict: **S20 is genuine, non-vacuous coverage of the stated regression-pin, not a decorative
"both exit 0" tautology.**

## #A1 fix — spot-checked end-to-end (this run)

```
$ node bin/mdxv.mjs --check --lang bogus test/fixtures/compile-check-e2e/pass.mdx
Error: Unsupported language "bogus"; expected zh-CN or en-US.
...
exit=2                                          # was 1 before the fix — confirmed now 2

$ node bin/mdxv.mjs --check=true --lang bogus test/fixtures/compile-check-e2e/pass.mdx
Error: Unsupported language "bogus"; expected zh-CN or en-US.
...
exit=2                                          # the exact spelling the bug report named

$ node bin/mdxv.mjs --check=true test/fixtures/compile-check-e2e/format-asymmetry.md --lang en-US
✓ test/fixtures/compile-check-e2e/format-asymmetry.md
exit=0

$ node bin/mdxv.mjs --check=false --no-open --port 0 test/fixtures/compile-check-e2e/pass.mdx --lang en-US
(stderr) ✓ Preview ready
  Version          : mdx-viewer v0.2.0
  ...
  Press Ctrl+C to stop.
```

`--check=false` genuinely started the real preview server (printed "Preview ready", bound a port,
no `✓`/`✗` report line) — confirming it stays in preview mode exactly as `cac`'s own boolean
coercion dictates, not check mode. All four spot-checks match the described fix.

## Re-verified properties (unchanged by #A1/#A3, confirmed against the new `bin/mdxv.mjs`)

1. **`.md`/`.mdx` asymmetry** — `format-asymmetry.md` → `✓ …, exit 0`; byte-identical
   `format-asymmetry.mdx` → `✗ …:2:8  Unexpected character \`|\`…, exit 1`. Unchanged, still holds.
2. **Stream split + zero-ANSI** — `mdxv --check <mixed-dir> >report2.out 2>report2.err`: stdout 352
   bytes (unchanged from the prior run — the report body content did not change), stderr 0 bytes,
   byte-level scan found **zero ESC bytes** in stdout.

## #A3 boundary help-text rewrite — confirmed present

`mdxv --help` (captured above under the `--check --lang bogus` error path, which appends full
help) now reads: *"any top-level ESM statement or `{...}` expression that fails at module
evaluation or render time will keep the document from loading yet go undetected here — for
example an unresolvable module, an undefined identifier, or an initializer that itself throws.
These are examples, not an exhaustive list..."* — genuinely mechanism-plus-examples, not the
prior closed two-item enumeration. S10's updated help assertion (`/import|export.*from|top-level/i`)
matches this wording and passed in the re-run above.

## Regression suite

`npm test` — 122/122 pass, 0 fail, 0 skipped, `duration_ms 26239.84`, exit 0. Matches the
controller's own reported total exactly.

## Failures / blockers

None. No product defects, no test defects, no infra blockers, no `needs-user-decision`
escalation.

## Carried-forward notes (unchanged from the prior pass)

- S11's colour-wiring manual read remains routed to code-review (pty-free repo constraint,
  unchanged).
- `db-assert = n/a` throughout is structural (no database in this project).
