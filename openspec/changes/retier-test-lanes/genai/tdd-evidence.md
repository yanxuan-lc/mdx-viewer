# tdd-evidence — retier-test-lanes

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
| `test:unit` | in-process, imports `src/`, zero spawn | 8 | 189 | **1.3 s** |
| `test:cli` | spawns `bin/`, asserts stdout/exit code, no build (dev server counts as L2) | 4 | 42 | 7.7 s |
| `test:build` | runs a real Vite build | 3 | 16 | 22.6 s |

Lane invariant verified with the same probe: `test:unit` build=0 server=0 · `test:cli` build=0
server=4 · `test:build` build=11.

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
