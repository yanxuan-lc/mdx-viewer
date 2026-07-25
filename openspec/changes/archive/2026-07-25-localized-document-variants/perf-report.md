# Performance budget — localized-document-variants

**Overall verdict: PASS**

The affected measurable dimension is the self-contained browser bundle. There is no database,
server request handler or query path, so query count and backend latency do not apply.

| Dimension | Measured | Threshold | Baseline | Delta | Verdict |
|---|---:|---:|---:|---:|---|
| Offline HTML bytes | 5,359,473 | baseline + 1% (default tolerance) | 5,357,198 | +2,275 (+0.042%) | PASS |
| Gzip bytes | 2,147,982 | diagnostic only | not recorded | n/a | INFO |

Command: `node bin/mdxx.mjs test/fixtures/export-sample.mdx /tmp/mdxv-localized-perf.html --lang en-US`,
followed by `wc -c` and `gzip -c | wc -c`. The baseline is the immediately preceding
i18n-preferences gate measurement. No repository-owned performance budget is configured.

Commit stamp is unavailable because the repository has no valid `HEAD`.
