# tdd-evidence — retier-test-lanes

Commit: 0afc3edb827bf83cbda67e085ad3268bbacc9e7e

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

| lane | criterion (greppable, does not drift) | files | tests | wall |
|---|---|---|---|---|
| `test:unit` | in-process, imports `src/`, zero spawn | 8 | 185 | **0.5 s** |
| `test:cli` | spawns `bin/`, asserts stdout/exit code, no build (dev server counts as L2) | 4 | 46 | 8.4 s |
| `test:build` | runs a real Vite build | 3 | 16 | 22.1 s |

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
into a `before()` and had both tests assert against the stored results — **1 build saved (~4 s)**,
both test names kept. Deleting the flag-wins test would have saved the same build but lost the
only place the phrase "flag wins over environment" is discoverable.

The real payoff of this change is step 2, not step 3: the inner loop went **27.5 s → 1.3 s**.
Total suite time barely moves, because the builds are inherent to what is being asserted.

## Commands run

| command | result |
|---|---|
| `npm run test:unit` | 189 pass / 0 fail · 1.3 s |
| `npm run test:cli` | 42 pass / 0 fail · 7.7 s |
| `npm run test:build` | 16 pass / 0 fail · 22.6 s |
| `npm test` | **247 pass / 0 fail / 0 skipped** · 24.4 s |
| `make lint` | exit 0 |

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
call). L1 is now genuinely zero-spawn: 185 tests, **0.5 s**. Verified with a second loader probe
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
  (~16 s). Verified: it is now 1 build.
- `#B2` (P2) — orphaned `readFileSync` import left in `cli-output.test.mjs` when `S3` moved out.
- `#B5` (P3) — `compile-check.cli.test.mjs`'s header still claimed "S1–S16 / S18 / S19" and
  "pairs with `bin/mdxx.mjs`", contradicting the L2 line directly below it.
- `#B8` — the `test-lane-invariant-unguarded` backlog entry's criterion covered only the build
  dimension, so implementing it would not have caught `#A1`. Rewritten to cover both, with the
  measured baseline and the "inject the probes separately" caveat.

Not changed: the reviewer's observation that no lane is a gate — the only gated command is the
full `npm test` (24.8 s), so the 0.5 s inner loop buys nothing at the gate. True, and out of
scope for this change.

## Final numbers

| command | result | wall |
|---|---|---|
| `npm run test:unit` | 185 pass / 0 fail | **0.5 s** |
| `npm run test:cli` | 46 pass / 0 fail | 8.4 s |
| `npm run test:build` | 16 pass / 0 fail | 22.1 s |
| `npm test` | **247 pass / 0 fail / 0 skipped** | 24.8 s |
| `make lint` | exit 0 | — |

185 + 46 + 16 = 247, unchanged from before this change.
