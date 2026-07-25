# Performance budget — i18n-preferences

Overall verdict: PASS.

Commit stamp: unavailable (`HEAD` has no commit); measured current working tree on 2026-07-24.

| Dimension | Measured | Threshold | Baseline | Delta | Verdict |
|---|---:|---:|---:|---:|---|
| self-contained export size | 5,357,198 B | ≤ baseline + 1% (default regression tolerance) | 5,349,951 B | +7,247 B / +0.135% | PASS |
| gzip diagnostic | 2,144,728 B | informational | unavailable | n/a | INFO |

Command: real `mdxx test/fixtures/export-sample.mdx <temp>/current.html --lang en`, followed by byte count and Node `gzipSync`.

- Threshold source: no repository performance budget exists, so the report uses a surfaced 1% bundle-regression tolerance.
- Baseline source: the same export fixture measured immediately before this feature in the same workspace/session.
- Query count: not applicable; no database or data layer.
- Runtime latency: not measured; the change is local preference/message logic and the project has no stable browser timing baseline.
- Cause of growth: two small message catalogs, preference state logic and toolbar control code; no new runtime production dependency.
