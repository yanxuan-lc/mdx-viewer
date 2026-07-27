# E2E Manifest — mdx-compile-check

status: final
total-scenarios: 19

Commit: **uncommitted working tree on branch `dev`, base `15433c9`** (`docs: add a contributing
guide`). `git status --short` at the time this report was produced:

```
 M Makefile
 M bin/mdxv.mjs
 M package.json
 M src/cli/output.mjs
 M src/i18n/messages.mjs
?? openspec/changes/mdx-compile-check/
?? src/cli/compile-check.mjs
?? test/compile-check.cli.test.mjs
?? test/compile-check.perf.test.mjs
?? test/compile-check.test.mjs
?? test/fixtures/compile-check-e2e/
?? test/fixtures/compile-check/
```

No commit hash is recorded because none exists yet — recording base `15433c9` + "uncommitted"
rather than inventing a hash for a state that was never committed. `npm test` is 122/122 per the
controller for this round; that total is developer's to report, not mine — the counts below are
only for my two files, re-run by me just now, after landing finding **#B7**'s fix (see below).

Carrier: **scripted, subprocess CLI** (`node --test`, no Playwright — this change has zero
browser surface; see design.md §4). No third-party test dependency is introduced.

There is no database in this project (design.md §3: "不适用。本项目无数据库、无持久化、无 DDL、
无迁移、无 ORM"). The `db-assert` column is therefore **n/a** for every row — there is no DB write
for any scenario to verify.

## Coverage — re-run just now, this round (delta-review finding #B7 fixed)

Raw counts from my own re-run, this round, after fixing #B7 (S20's missing witness assertion) and
the zh-CN negative guard on S10:

- `node --test test/compile-check.cli.test.mjs`: **19 pass, 0 fail, 0 skipped**
  (`duration_ms 19870.03`) — same test count as before (S20 gained an assertion, not a new test).
- `node --test test/compile-check.perf.test.mjs`: **1 pass, 0 fail** (`duration_ms 4039.67`) —
  logged `check=346.8ms export=3660.6ms ratio=10.55x` (≥ 5x required by R8).

Combined: **20 tests, 20 pass, 0 fail** across my two files. All 19 scenarios: **PASS**.
`#B5` (`--` terminator edge case) and `#A5` (stale file list in design.md) are explicitly not
addressed here per the controller's instruction not to pre-empt them.

| Scenario | Bucket | Test | Result | db-assert |
|---|---|---|---|---|
| S1  | mapped | `compile-check.cli.test.mjs` → `'S1: single passing file prints exactly ...'` | PASS | n/a |
| S2  | mapped | `compile-check.cli.test.mjs` → `'S2: single failing file reports the exact ...'` | PASS | n/a |
| S3  | mapped | `compile-check.cli.test.mjs` → `'S3: directory with mixed results reports ...'` | PASS | n/a |
| S4  | mapped | `compile-check.cli.test.mjs` → `'S4: directory where every document passes ...'` | PASS | n/a |
| S5  | mapped | `compile-check.cli.test.mjs` → `'S5: full-feature document ...'` | PASS | n/a |
| S6  | mapped | `compile-check.cli.test.mjs` → `'S6: usage and input errors exit 2 ...'` | PASS | n/a |
| S7  | mapped | `compile-check.cli.test.mjs` → `'S7: --port/--host/--no-open are accepted but inert ...'` | PASS — re-verified for the right reason (port-refusal check), see prior-round note preserved below | n/a |
| S8  | mapped | `compile-check.cli.test.mjs` → `'S8: a failure with no position degrades ...'` | PASS | n/a |
| S9  | mapped | `compile-check.cli.test.mjs` → `'S9: an unreadable document inside a scanned directory ...'` | PASS | n/a |
| S10 | mapped | `compile-check.cli.test.mjs` → `'S10: an undefined component is not detected ...'` | PASS — **assertion rewritten this round, see below** | n/a |
| S11 | mapped | `compile-check.cli.test.mjs` → two cases: `'S11: colour follows the written stream ...'` + `'S11: the colour decision is resolved per stream ...'` | PASS (both) — wiring itself still routed to code-review | n/a |
| S12 | mapped | `compile-check.perf.test.mjs` → `'S12: \`mdxv --check\` on the full-feature example is at most 1/5 ...'` (slow lane) | PASS (ratio 10.76x this run) | n/a |
| S13 | mapped | `compile-check.cli.test.mjs` → `'S13: format follows the extension in both directions ...'` | PASS | n/a |
| S14 | mapped | `compile-check.cli.test.mjs` → `'S14: an unresolvable top-level import passes --check but fails mdxx ...'` | PASS — **assertion left exactly as-is this round, per R6, see S20 note** | n/a |
| S15 | mapped | `compile-check.cli.test.mjs` → `'S15: a piped report for a >=20-document directory ...'` | PASS | n/a |
| S16 | mapped | `compile-check.cli.test.mjs` → `'S16: \`--check demo\` covers exactly the two packaged demo documents ...'` | PASS | n/a |
| S18 | mapped | `compile-check.cli.test.mjs` → `'S18: an invalid component prop value is not detected ...'` | PASS | n/a |
| S19 | mapped | `compile-check.cli.test.mjs` → `'S19: malformed math is not detected ...'` | PASS | n/a |
| **S20** | **mapped** | **`compile-check.cli.test.mjs` → `'S20: an evaluation-time-only tier-B subset is witnessed by neither --check nor mdxx ...'`** | **PASS — new this round** | n/a |

S17 is not listed: deleted from the spec in the second arch-review round (design.md D7 — the path
it tested does not exist under the chosen implementation shape, plan C). Not resurrected.

non-scripted: 0 / 19 (0%) — every scenario is mapped; nothing agent-driven, nothing waived.
No automation-coverage escalation needed.

## New this round

### S20 — pinning the evaluation-time-only subset of tier B

`planner` established (and I independently re-verified against the real, unmodified
`src/mdx/plugins.mjs` compile path and the real `bin/mdxx.mjs`, before writing the test) that tier
B is not uniformly witnessable by any command-line gate:

| tier-B shape | `--check` | `mdxx` | fails at |
|---|---|---|---|
| unresolvable specifier (S14) | 0 | **1** | build time (Vite resolves specifiers) |
| throwing top-level initializer (S20) | 0 | **0** | module evaluation, in the browser |
| throwing `{…}` expression (S20) | 0 | **0** | render time, in the browser |

Two new fixtures, verified independently before wiring into the test:

- `test/fixtures/compile-check-e2e/boundary/throwing-initializer.mdx` — a top-level ESM
  initializer (`export const boom = (() => { throw ...; })();`) that throws only when the module
  is evaluated.
- `test/fixtures/compile-check-e2e/boundary/throwing-expression.mdx` — a `{…}` expression
  (`<div>{(() => { throw ...; })()}</div>`) that throws only when React renders it.

I confirmed both compile cleanly through the real `mdxOptions()` (via `@mdx-js/mdx`'s own
`compile()`, no product code touched) and that the real `bin/mdxx.mjs` exits 0 on both — it emits
a self-contained HTML that would throw only once opened in a browser. The new test
(`'S20: an evaluation-time-only tier-B subset is witnessed by neither --check nor mdxx ...'`)
asserts exactly that: `--check` exits 0 on both fixtures, and `mdxx` exits 0 on both fixtures too.
This is a regression pin in the same spirit as S14 — if either command ever starts detecting
these, the test fails loudly rather than letting the boundary wording go stale.

**S14 was deliberately left untouched.** Per the controller's explicit instruction and R6, S14's
`mdxx`-paired assertion is not extended to the throwing-initializer/throwing-expression shapes,
because `mdxx` exits 0 on them — asserting `mdxx` fails there would be a false assertion. `planner`
only narrowed S14's stated scope to the build-time (unresolvable-specifier) subset; S20 is a
separate scenario for the separate, evaluation-time-only subset.

### #B7 (this round) — S20 had no witness that its fixtures still throw

Delta review flagged, correctly: S20's only assertions were `exit 0` on both `--check` and `mdxx`.
If `throwing-initializer.mdx` or `throwing-expression.mdx` were later edited into a trivially-valid
document, both assertions would keep passing — the scenario would silently become vacuous while
still reading as coverage of the evaluation-time boundary. Same failure shape as the S7 false-green
in phase 1 and the reason S17 was deleted.

**Fix — a direct witness, no new dependency.** Added `assertGenuinelyThrowsAt(absPath,
expectedStage)` to `test/compile-check.cli.test.mjs`, using only dependencies already in this repo
(`@mdx-js/mdx`'s `evaluate` + `react/jsx-runtime` + `react-dom/server`'s `renderToStaticMarkup`).
It runs the real MDX evaluation pipeline independently of `--check`/`mdxx` and asserts each fixture
throws at the *specific* expected stage:

- `throwing-initializer.mdx` must throw during `evaluate()` itself (module evaluation).
- `throwing-expression.mdx` must survive `evaluate()` and throw only when the returned component is
  rendered via `renderToStaticMarkup`.

Both calls are placed at the top of S20, before the `exit 0` assertions, so a fixture that stopped
throwing fails loudly and immediately rather than letting the rest of the test paper over it.

**Proof it bites — transcript.** I temporarily replaced `throwing-initializer.mdx` with a trivially
valid document ("Someone \"fixed\" this fixture. It no longer throws at all."), byte-backed-up
first:

1. Ran `node --test --test-name-pattern="S20"` against the corrupted fixture:
   ```
   ✖ S20: ... (7.34ms)
     AssertionError [ERR_ASSERTION]: Missing expected exception: .../throwing-initializer.mdx
     did not throw at module evaluation, and did not throw at render either — this fixture no
     longer witnesses tier B, which would make S20's exit-0 assertions vacuous ...
   ```
   Red, and red **at the witness assertion**, before ever reaching the `exit 0` checks.
2. Confirmed independently, by hand, that the old assertions alone would have stayed green on the
   same corrupted fixture:
   ```
   $ node bin/mdxv.mjs --check test/fixtures/compile-check-e2e/boundary/throwing-initializer.mdx --lang en-US
   ✓ test/fixtures/compile-check-e2e/boundary/throwing-initializer.mdx
   check exit=0
   $ node bin/mdxx.mjs test/fixtures/compile-check-e2e/boundary/throwing-initializer.mdx /tmp/corrupted.html --lang en-US
   ✓ Export complete (self-contained)
   mdxx exit=0
   ```
   This is the exact hole #B7 named: both commands exit 0 on the corrupted fixture, so the
   pre-fix S20 would have reported green with the scenario's substance gone.
3. Restored the fixture from the backup, diffed it byte-identical against the original
   (`diff` reported no output — `RESTORED IDENTICAL`), and re-ran: green again
   (`✔ S20 ... (7548.36ms)`).

**Negative guard added to S10 too (zh-CN half, same finding class as #B6).** S10's help-text
assertion already checked four positive markers in both `en-US` and `zh-CN`. Added a negative
guard for both locales: strip the legitimate fenced-code-aside parenthetical (the only place
"import"/`import` is expected to appear), then assert no bare mention of "import" remains in
either locale's boundary note — closing the same drift risk #B6 closed for `developer`'s file
(the zh-CN note could regress to a closed-set "import 就是这类" phrasing without any test turning
red, since the prior test only checked key presence and a loose positive pattern). Verified the
guard actually fires: stripping a synthetic zh-CN string containing a bare `import` mention outside
the aside still matches `/import/i` after stripping — confirmed by hand before relying on it.

### S10 — help-text assertion rewritten to load-bearing markers

`cli.checkBoundaryNote` was rewritten by `developer` (finding A3, user-approved) from a closed
two-item enumeration to mechanism-plus-examples wording, because a closed list licenses "no
import, no `{…}`, therefore deliverable." I rewrote S10's help assertion to match: instead of one
loose regex, it now checks four load-bearing markers, in **both** `en-US` and `zh-CN`, rather than
byte-matching the whole paragraph (full-string equality on prose is maintenance tax — a wording
tweak that preserves all four properties should not break the test):

1. **compilation-only** (`verifies compilation only` / `只校验编译`)
2. **"top-level ESM" wording**, never bare "import" (`top-level ESM` / `顶层 ESM`)
3. **fenced-code exemption** (`fenced code block` / `围栏代码块`)
4. **open-list marker** (`examples, not an exhaustive list` / `例子，不是清单`) — the property
   that closes off the "closed list ⇒ deliverable" misreading this rewrite exists to prevent.

Re-ran against the landed `src/i18n/messages.mjs`: all four markers present in both locales, test
green. **This round**, a fifth check — the zh-CN negative guard against a bare "import" mention —
was added on top of these four; see the `#B7` section above for detail.

## S7 re-assessment (carried over from the prior round, unchanged this round)

`--check` is wired ahead of `resolveCliArguments`, so S7 now exercises the real check path (not an
arg-parse failure on both sides). The test asserts `withServerOptions.status === 0` explicitly and
opens a real TCP connection attempt to the declared port after the process exits, asserting
`ECONNREFUSED` — direct proof the port was never bound, not an inference from matching output.
Unchanged and still green this round.

## S11 — unchanged scope, no pty invented (carried over, unchanged this round)

S11's colour-*wiring* check (whether `bin/mdxv.mjs`'s two `colorize()` call sites are actually fed
`.report`/`.diagnostic`) remains routed to **code-review** as a manual two-line read, per
design.md's own disposition. No pty-based coverage was added this round either, per explicit
instruction not to invent it now that the code exists.

## Registration — verified directly, not assumed (re-checked this round)

- `package.json` line 47, `scripts.test:unit`, still includes `test/compile-check.cli.test.mjs`
  (confirmed by `grep -n "compile-check" package.json Makefile` just now).
- `test/compile-check.perf.test.mjs` still does not appear in `package.json` or `Makefile` —
  confirmed by the same grep.
- `Makefile`'s `check-mdx` target is unrelated to test registration; developer-owned, unchanged.

## What I verified myself vs. what I'm taking on trust

I re-ran my own two files myself this round and report the raw counts above. I did not
independently re-run `npm test` or diff the developer-owned pipeline files (`src/mdx/plugins.mjs`,
`src/cli/vite-config.mjs`, `bin/mdxx.mjs`, `src/cli/resolve.mjs`) — outside my file ownership, and
`e2e-runner`'s prior pass already audited S7's strengthening directly at the relevant line numbers
per the controller's report. A further independent full-suite check belongs to the next
`e2e-runner`/`code-reviewer` pass, not to a re-run of my scenario suite alone.

## Run

```bash
node --test test/compile-check.cli.test.mjs      # fast lane — registered in test:unit
node --test test/compile-check.perf.test.mjs     # slow lane — confirmed absent from test:unit
```

Add `--test-reporter=junit` / `--test-reporter=json` (Node's built-in reporters, no new
dependency) for a machine-readable file if the acceptance pass needs one:

```bash
node --test --test-reporter=junit --test-reporter-destination=compile-check-cli.junit.xml test/compile-check.cli.test.mjs
node --test --test-reporter=json --test-reporter-destination=compile-check-perf.json test/compile-check.perf.test.mjs
```
