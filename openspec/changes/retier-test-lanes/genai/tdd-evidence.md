# tdd-evidence — retier-test-lanes

Commit: 016d9c73a5a551f651acee42e5d2acf5fabbbe69

Re-partition the test lanes by **dependency surface** instead of by (mislabelled) elapsed time.
Lane `min`: no spec node; input is the task description. No product code changed — this touches
test files, `package.json`, `Makefile` and the docs that describe them.

## The defect being paid down

`Makefile` advertised `test-unit` as「快，无 vite 构建」and `test-export` as「含 vite 构建，较慢」.
Measured, the "fast" lane was **27.5 s** and the "slow" lane **5.8 s** — the label had been false
for as long as anyone had been reading it, because three files in the fast lane ran real Vite
builds. `export.test.mjs`, the one file singled out as slow, was the only one that had ever
amortised its build across assertions.

## Build attribution — measured, not grepped

Used this repo's own `test/fixtures/vite-call-probe` (built for S12 in the previous change) to
count real `vite.build` / `createServer` calls per test, via `NODE_OPTIONS`:

| test | file (before) | builds |
|---|---|---|
| S14 | `compile-check.cli` | 2 |
| S20 | `compile-check.cli` | 2 |
| A3 export build failure | `cli-language` | 1 |
| A5 mdxx flag wins | `cli-language` | 1 |
| A5 mdxx matrix | `cli-language` | 4 |
| S3 export status panel | `cli-output` | 1 |
| `before()` | `export` | 1 |
| **total** | | **12** |

Plus 4 `createServer` (the mdxv preview matrix) — L2, no build, left in place.

S20 was missed by every earlier grep: it has no `mdxx.mjs` literal (it goes through the
`runExport` helper) and its title contains the substring "S14", so a name-pattern probe for S14
silently reported both. Only the call-counting probe attributed it correctly.

## The three lanes

| lane | criterion (greppable, does not drift) | files |
|---|---|---|
| `test:unit` | in-process, imports `src/`, zero spawn — checked on the transitive closure | 8 |
| `test:cli` | spawns `bin/`, asserts stdout/exit code, no build (a dev server is still L2) | 4 |
| `test:build` | runs a real Vite build | 3 |

Test counts and timings are measurements, so they live only in `suite-report.md` — see #A4 below.
Two copies drift; this table carried a stale one until the third review round caught it.

Lane invariant measured on **both** dimensions (see the review round below — the first attempt
measured only one of them):

| lane | build | createServer | spawn |
|---|---|---|---|
| `test:unit` | 0 | 0 | **0** |
| `test:cli` | 0 | 4 | 39 |
| `test:build` | 11 | 0 | 6 |

The two loader probes must be injected **separately** — running both in one `NODE_OPTIONS`
silently zeroed the vite probe's counts (measured, not assumed).

`npm test` keeps its `test/*.test.mjs` glob. The gate's load-bearing property is
**no exceptions** — a new test file joins it automatically, without anyone remembering to edit a
hand-written list. The hand-written `test:unit` list is exactly what drifted here.

## What moved, and what deliberately did not

Two new L3 files:

- `test/compile-check.export-pairing.test.mjs` — S14, S20 (+ the `assertGenuinelyThrowsAt`
  witness helper they alone used)
- `test/cli-export.test.mjs` — A3, A5 ×2, S3

**S14 and S20 moved whole, not split.** Each asserts a *differential* — S14 that one document
passes `--check` **and** fails `mdxx`; S20 that both pass, hence the subset is unwitnessed.
Leaving the `--check` half in L2 and moving the `mdxx` half would leave neither side a complete
judgement; the scenario would be gone while both files still looked green.

## Step 3 — build sharing: 12 → 11, not the 2–3 I predicted

I told the user this step could collapse ~13 builds to 2–3. **That was wrong**, and the
attribution above is why: 11 of the 12 builds are semantically distinct and cannot share.

| build | why it cannot be shared |
|---|---|
| A3 | must **fail** (render-error fixture) |
| S14 ×2 | one must fail, one must pass — different fixtures |
| S20 ×2 | two different tier-B fixtures |
| matrix ×4 | each bakes a different `localeSource` into the artifact |
| S3 | tests the **default** language path; preloading `Intl` for any matrix case destroys what it tests |
| `export.test.mjs` | already amortised across 10 assertions since before this change |

The one real sharing opportunity: `A5: mdxx flag wins` and the matrix's `flag` case are the
*same command* (same fixture, `--lang en-US`, `MDXV_LANG=zh-CN`). Hoisted the four matrix exports
into a `before()` and had both tests assert against the stored results — **1 build saved**,
both test names kept. Deleting the flag-wins test would have saved the same build but lost the
only place the phrase "flag wins over environment" is discoverable.

The real payoff of this change is step 2, not step 3: the inner loop went from **27.5 s** (the
pre-change baseline) to sub-second — current figure in `suite-report.md`. It first landed at 1.3 s;
the rest came off when review found four stray subprocesses in L1 as #A1.
Total suite time barely moves, because the builds are inherent to what is being asserted.

## Commands run

**Timings and pass / fail / cancelled counts live in exactly one file**: `suite-report.md`, stamped
with the commit they were measured at. This file used to carry its own copy of the table, which is
how review found it two rounds stale while its stamp said otherwise (#A3, then #A4 for repeating the
mistake here). A second copy of a re-measured value is a second thing to forget to update.

The rule has three clauses, and it took two rounds to get them right (#A5, twice):

1. **Current measured values** — wall times, and pass / fail / cancelled counts — live only in
   `suite-report.md`. They change on every run, so a second copy is a second thing to forget.
2. **Structural facts read off the source** — how many builds a file runs, how many files a lane
   lists — may be stated wherever they help. They change only when the source does.
3. **Historical measurements of superseded states, and quotations of past defects, are exempt.**
   The 27.5 s / 5.8 s pre-change baseline, and "it first landed at 1.3 s", are narrative about what
   *was* true; they are not claims about this commit and cannot go stale.

Clause 3 is the one that makes the rule satisfiable. Round 4's version had only clauses 1 and 2, so
the historical figures this file *should* keep were permanent violations of it — meaning every round
could only re-word the rule instead of converging. That, not carelessness, is why #A5 recurred: the
first fix narrowed the wording and left the live values alone, and the wording could never be made
true anyway.

Test count is **247 before and after** — every test moved, none dropped. Lane membership checked
programmatically: 15 files on disk, 15 covered, no file in two lanes, none missing.

## Correctness detail caught during the move

Copying S3 turned `/\[/` into a literal ESC byte in the new source. Behaviour was
identical (both match ESC + `[`), but a raw control character in source is fragile — normalised
back to the escaped form and verified the file holds no control characters.

## Docs updated

`Makefile` (lane comments + `.PHONY` + `make help` group), `package.json`, `AGENTS.md` (command
table + the testing-conventions bullet), `README.md`, `README.zh-CN.md`. `test:export` is gone;
no stale reference to it remains outside `openspec/changes/archive/`.

## Backlog

Filed `test-lane-invariant-unguarded` (P2): nothing asserts the lane invariant, so an L3
assertion sliding back into L1/L2 would not go red — which is precisely how the original
mislabel survived. Carries a re-verifiable criterion using the probe.


## Review round 1 — 2 × P1, both fixed

**P1 #A1 — the L1 criterion was false on the day it was written.** `test/compile-check.test.mjs`
sat in `test:unit` while spawning `bin/mdxv.mjs` four times through a local `runMdxv()` helper
(the #A1 / #B5 bare-argv probe regressions). So this change **recreated, inside the very commit
meant to eliminate it, the class of false lane label it was paying down.**

Why it got through is the part worth keeping: the evidence line "lane invariant verified with the
probe" used the vite-call probe, which counts `build` / `createServer` only. **The spawn half of
the criterion was declared and never measured.** A `spawnSync` grep does not see it either,
because the calls go through a helper — the same indirection that hid S20 from every earlier
grep, noted two paragraphs up in this very file and still not generalised.

Fixed by moving the four argv-probe tests to `test/compile-check.cli.test.mjs` (L2, where they
belong by the criterion — they test argv assembly at the process boundary and cannot be a direct
call). L1 is now genuinely zero-spawn — count and wall time in `suite-report.md`. Verified with a
second loader probe
that wraps `child_process`, written for this purpose.

Two self-inflicted errors during that fix, both caught by running rather than reading:

- the first `child_process` probe recursed infinitely (`import * as real from "node:child_process"`
  resolved back through its own hook), reporting 27 517 spawns. Fixed by short-circuiting when
  `parentURL` is the synthetic module.
- the `unitFixture` helper was inserted by a `str.replace` whose anchor no longer existed (I had
  already deleted the `abs` line it keyed on) and, unlike the other replacements in the same
  script, that one carried no assert — so it silently did nothing and three tests failed with
  `ReferenceError`. Every replacement in the follow-up is asserted.

**P1 #A2 — `CONTRIBUTING.md` / `CONTRIBUTING.zh-CN.md` were not updated**, and still told
contributors to "add the file to the `test:unit` list" — the instruction that reproduces this
defect. AGENTS.md and both READMEs had been updated; the two documents that most directly drive
contributor behaviour had not. Both now describe the three lanes and state the rule explicitly:
must spawn → `test:cli`; must build → `test:build`, even for a single assertion.

Also fixed from the same review:

- `#B1` (P2) — the four shared matrix exports are now inside a `describe()`. A root-level
  `before()` runs even under `--test-name-pattern`, so "run just A3" was paying four real builds
  (four real builds where one was needed). Verified: it is now 1 build.
- `#B2` (P2) — orphaned `readFileSync` import left in `cli-output.test.mjs` when `S3` moved out.
- `#B5` (P3) — `compile-check.cli.test.mjs`'s header still claimed "S1–S16 / S18 / S19" and
  "pairs with `bin/mdxx.mjs`", contradicting the L2 line directly below it.
- `#B8` — the `test-lane-invariant-unguarded` backlog entry's criterion covered only the build
  dimension, so implementing it would not have caught `#A1`. Rewritten to cover both, with the
  measured baseline and the "inject the probes separately" caveat.

Not changed: the reviewer's observation that no lane is a gate — the only gated command is the
full `npm test`, so the sub-second inner loop buys nothing at the gate. True, and out of
scope for this change.

## Final numbers

See `suite-report.md` at this commit — exit code plus all four counters, per #B9. Deliberately not
duplicated here.

## Review rounds 2 and 3

**Round 2** raised two P1s (#A1 the false L1 zero-spawn label, #A2 the unupdated CONTRIBUTING) —
both recorded in the section above — plus four non-blocking findings in code this change had just
added. All four were fixed inline rather than filed, because they were this change's own mess and
the user had separately raised that the INBOX was accumulating speculative work:

- `#B3` — `environment()` / `systemLocalePreload()` were byte-identical copies in `cli-language`
  and `cli-export`; extracted to `test/helpers/cli-env.mjs`, deliberately not `*.test.mjs` so the
  gate's glob does not collect it as a test.
- `#B4` — shared-export lookups go through `sharedExport()`, which names the drift instead of
  yielding `Cannot read properties of undefined`.
- `#B6` — `after` guards `localeDirectory` before `rmSync`, so a failed `mkdtempSync` is not buried
  under a `TypeError`.
- `#B7` — dropped the `status === 0` assertions that `before()` had already made.

**Round 3** raised **#A3** — `suite-report.md` had its stamp advanced while every number in it
stayed at round 1. On this lane that file *is* the verification record, and the stamp is the claim
that its numbers were measured at that commit; moving the stamp alone made it lie. Fixed by
rewriting it from a fresh measurement, and by adopting **#B9**: results are recorded as exit code
plus all four counters, because a `describe()`-scoped `before()` throw marks its tests `cancelled`
rather than `fail` — so `pass 2 / fail 0` reads green at exit 1.

**Round 4** raised **#A4**: the #A3 fix had been applied to one file rather than adopted as a
practice. *This* file's stamp said `0afc3ed` while its own body was two rounds behind — claiming a
1.3 s inner loop eleven lines above a sentence that said 0.5 s, and still using the pass/fail-only
format that the very same commit had just argued was unsafe. The reviewer also said it had
misjudged the lighter version of this as P3 in round 3 and was upgrading it, which is the right
call: the signal was never "one more stale number", it was that a fix had not generalised.

The structural remedy is above — **numbers now have exactly one home**. Two copies of a
measurement is two things to forget.

Round 4 also raised two non-blocking items, both fixed rather than filed:

- `#B11` — `AGENTS.md`'s test table contradicted the lane criterion thirteen lines below it:
  `cli-language` and `cli-output` were labelled 单元 / 纯逻辑 while both are L2 and both spawn two
  binaries (they account for most of L2's 39 spawns). The table also listed 9 of 15 files and
  carried a stale "~7s" from the mislabelled era. Rewritten to lane terms, all 15 files, and it now
  states that per-lane timings live only in `suite-report.md` — carrying them in a hand-edited
  table is what caused the original mislabel.
- `#B12` — the structural zero-spawn argument was phrased file-locally, which stopped being
  sufficient the moment `test/helpers/` existed: an imported helper could spawn while every listed
  file passed the check. Both the argument and the backlog entry's criterion now say **transitive
  closure**.
