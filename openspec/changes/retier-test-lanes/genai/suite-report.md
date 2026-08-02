# suite-report — retier-test-lanes

Commit: 3bd40e4ddabb98e2a7741ab0fb5def00dda052d6

The minimal lane's verification carrier: the project's own suite, run whole.

## Result

| command | result | wall |
|---|---|---|
| `npm test` (`node --test test/*.test.mjs`, the full gate) | **247 pass / 0 fail / 0 skipped / 0 todo** | 24.4 s |
| `npm run test:unit` (L1) | 189 pass / 0 fail | 1.3 s |
| `npm run test:cli` (L2) | 42 pass / 0 fail | 7.7 s |
| `npm run test:build` (L3) | 16 pass / 0 fail | 22.6 s |
| `make lint` | exit 0 | — |

189 + 42 + 16 = 247, and 247 is also the count before this change — every test was moved,
none dropped or duplicated.

## Lane invariant, measured

Counted real `vite.build` / `createServer` calls per lane with `test/fixtures/vite-call-probe`
injected via `NODE_OPTIONS`:

| lane | build | createServer |
|---|---|---|
| `test:unit` | 0 | 0 |
| `test:cli` | 0 | 4 (dev servers — L2 by definition) |
| `test:build` | 11 | 0 |

Nothing asserts this invariant yet; filed as `test-lane-invariant-unguarded` (P2).

## Membership check

15 test files on disk, 15 covered across the three lanes, no file in two lanes, none missing —
verified programmatically against `package.json`, not by reading.
