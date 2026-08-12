# suite-report — close-probe-and-lane-guards

Commit: 988e488c0efd4ca46364babb5ece76560d2ce779

Everything reproducible at HEAD lives here and nowhere else. Recorded as exit code plus all four
counters, because a `describe()`-scoped `before()` throw marks its tests `cancelled` rather than
`fail`, so a pass/fail-only line can read green at exit 1.

| command | exit | tests | pass | fail | cancelled | skipped |
|---|---|---|---|---|---|---|
| `npm test` (full gate) | **0** | 252 | 252 | 0 | 0 | 0 |
| `npm run test:unit` (L1) | 0 | 190 | 190 | 0 | 0 | 0 |
| `npm run test:cli` (L2) | 0 | 46 | 46 | 0 | 0 | 0 |
| `npm run test:build` (L3) | 0 | 16 | 16 | 0 | 0 | 0 |
| `make lint` | **0** | — | — | — | — | — |

190 + 46 + 16 = 252. Up 5 from 247: the five assertions in the new `test/test-lanes.test.mjs`.

## Lane invariant, measured — and the shadowing is gone

| lane | build | createServer | spawn |
|---|---|---|---|
| `test:unit` | 0 | 0 | 0 |
| `test:cli` | 0 | **5** | 39 |
| `test:build` | 11 | 0 | 6 |

L2's `createServer` now reads **5**, not 4. The missing one was
`compile-check.no-build.test.mjs`'s own probe-liveness control, invisible to lane-level measurement
while that file repointed `MDXV_PROBE_OUT` at a private file. It now uses `MDXV_PROBE_OUT_S12` and
the hook writes to every configured sink, so **L2's load-bearing `build = 0` is established by this
table for every file in the lane** — previously it rested, for that one file, on the file's own
assertions.

The build dimension is still probe-measured rather than asserted in the suite: L2's "no build" is
not statically decidable, since `cli-output` and `cli-language` legitimately invoke `bin/mdxx.mjs`
on paths that exit before building. `test/test-lanes.test.mjs` covers the statically decidable half
and says so in its header.
