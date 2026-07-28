# Perf Gate — mdx-compile-check

**Verdict: PASS** (2 dimensions asserted, 1 baseline recorded)

Tree state: uncommitted working tree on branch `dev`, base `15433c9`. Machine: darwin, Node
v24.15.0. All figures are wall time including Node startup, measured in one session so the
ratio dimension is hardware-independent.

## Why this gate is load-bearing here

The change's entire justification is replacing the `mdxx` export workaround with something
cheap enough to run on every delivery. If it were not materially faster, the change would have
no reason to exist — so the ratio is an acceptance criterion, not a nicety.

## D1 — ratio against the `mdxx` workaround · **PASS**

Asserted dimension (S12). Budget: **≥ 5× faster**, measured in the same session on the same
document (`examples/demo.mdx` — frontmatter + GFM + KaTeX + `dot` fence + `mermaid` fence +
Shiki-highlighted fence, i.e. every feature the pipeline supports).

| | wall time |
|---|---|
| `mdxv --check examples/demo.mdx` | **359 ms** |
| `mdxx examples/demo.mdx <tmp>` | **3627 ms** |
| **ratio** | **10.1× faster** — budget ≥5× → **PASS** |

`e2e-author`'s independent runs of the same scenario measured 10.13×–10.98×, consistent.

**The absolute seconds are deliberately NOT the assertion** (review finding F9): a wall-clock
threshold makes the test flaky on slower hardware, while the ratio compares the two paths under
identical conditions. Recorded for reference only: 359 ms single document, well inside the
1.0 s recorded budget.

## D2 — `test:unit` stays fast · **PASS**

The perf scenario lives in `test/compile-check.perf.test.mjs`, kept **out of** `package.json`'s
`test:unit` list so `make test-unit` does not silently become a multi-second command (F9).
Verified directly, not assumed: `test/compile-check.perf.test.mjs` appears in neither
`package.json` nor `Makefile`; `e2e-author` independently re-verified the same. Full `npm test`
is 118/118 in 25.2 s, unchanged in character.

## D3 — marginal per-document cost · **baseline recorded, no regression**

Unasserted by design — the reviewer asked for a recorded baseline rather than a gate, because
the failure mode it guards (a future change that re-creates the Shiki highlighter or reloads
graphviz-wasm *per document*) would still pass the single-document ratio while a large directory
degrades to seconds.

Measured on N copies of `examples/demo.mdx` (the heaviest realistic document):

| documents | wall time | marginal |
|---|---|---|
| 1 (baseline, includes startup) | 352 ms | — |
| 10 | 436 ms | 9.3 ms/doc |
| 25 | 487 ms | 5.6 ms/doc |
| 50 | 606 ms | 5.2 ms/doc |

**Marginal cost is flat-to-declining as N grows (9.3 → 5.6 → 5.2), i.e. no accumulation.** This
independently reproduces the reviewer's round-2 finding and confirms the architectural claim
behind the F1 fix: the ~350 ms warm-up lives in *module-level* caches (the graphviz promise,
Shiki's highlighter), not in the processor object — which is exactly why dropping the
"build one processor and reuse it" requirement cost nothing while removing the false-failure bug.

**Recorded baseline: ≈5 ms/doc on this machine.** The reviewer's pre-implementation estimate was
≈4 ms/doc; same order, difference within machine-to-machine variance. A future measurement
materially above this — or a marginal cost that *rises* with N — indicates the regression this
baseline exists to catch.

## Not measured, and why

- **Memory ceiling** — no budget was specified and the workload is one document at a time with
  no retained state between documents; the flat marginal cost above is the observable proxy.
- **Cold-cache / first-run-on-a-machine cost** — dominated by Node module loading, unchanged by
  this change (the same imports already load for `mdxv`/`mdxx`).
