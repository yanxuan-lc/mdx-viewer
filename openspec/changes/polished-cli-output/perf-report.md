# Performance budget — polished-cli-output

Overall verdict: **PASS**.

Stamp: `uncommitted (no HEAD)`. This change only adds small synchronous string formatters
and CLI presentation; it changes no browser import, dependency, database access, HTTP path,
or shipped HTML payload.

| Dimension | Measured | Threshold | Baseline | Delta | Verdict |
| --- | ---: | ---: | ---: | ---: | --- |
| Formatter latency p95 | 0.00091 ms/call | 0.1 ms/call (surfaced default for CLI formatting) | unavailable: no committed baseline | n/a | PASS |

Measurement command: Node `performance.now()` microbenchmark, 30 warmed process-local
rounds × 30,000 calls/round across `formatHelp`, `formatPreviewSuccess`, and
`formatExportSuccess`; p50 0.00084 ms/call, p95 0.00091 ms/call, max 0.00105 ms/call.

Not measured:

- Bundle size: runtime changes are Node-only `.mjs`; no browser bundle import changed.
- Query count: the project and change have no database.
- Server/page latency: no server request path or browser rendering code changed.

The repository has no configured performance budget or baseline artifact. The threshold
above is an explicit conservative default; committing a project-owned budget is recommended
if CLI formatting later becomes materially more complex.

