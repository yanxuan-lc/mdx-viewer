# Pipeline — i18n-preferences

archetype:        feature
criticality:      supporting
reversibility:    reversible
ceiling:          auto+spot-check
gate-shape:       async spot-check
intensity:        adversarial-N=1; design-it-twice=off; verifier-tier=standard; verifier-model=gpt-5.6-sol; oracles=property; sweep=diff-scoped; token-budget=n/a
infra-readiness:  off
escalations:      []
anomaly-rate:     n/a
budget-B:         n/a
downgrade-state:  none
started:          2026-07-24T17:27:00Z
completed:        2026-07-25T03:00:00Z

- [x] grill         → BRIEF.md (light, derived from confirmed user requirements) @ 2026-07-24T17:27:00Z → 2026-07-24T17:27:00Z
- [x] design-spec   → proposal.md + design.md + specs/i18n-preferences/spec.md + tasks.md @ 2026-07-24T17:27:00Z → 2026-07-24T17:35:57Z
- [-] arch-review   (skipped: no DDL, removal, or external network contract) @ 2026-07-24T17:35:57Z
- [x] implement     → product code + unit tests; tdd-evidence.md; npm test 50/50 @ 2026-07-24T17:35:57Z → 2026-07-25T03:00:00Z
- [x] e2e-author    → e2e tests + e2e-manifest.md (12/12 mapped) @ 2026-07-24T17:35:57Z → 2026-07-24T18:01:57Z
- [x] security-gate → security-scan-report.md; 0 Medium+ findings @ 2026-07-24T17:56:59Z → 2026-07-24T18:01:57Z
- [x] a11y-gate     → a11y-report.md; PASS, 0 critical/serious @ 2026-07-24T17:58:00Z → 2026-07-24T18:01:57Z
- [x] perf-gate     → perf-report.md; PASS, export +0.135% @ 2026-07-24T17:57:20Z → 2026-07-24T18:01:57Z
- [x] e2e-run       → e2e-report.md; 12/12 scenarios, Playwright 21/21 @ 2026-07-24T18:01:57Z → 2026-07-25T02:29:53Z
- [x] code-review   → CHECKLIST.md; both verdicts HELD, 8/8 P0/P1 resolved @ 2026-07-24T18:01:57Z → 2026-07-25T03:00:00Z
- [ ] spot-check    → async human sample
- [-] merge         (skipped: repository has no established integration branch or committed baseline) @ 2026-07-24T17:27:00Z
- [-] canary        (skipped: no project CD/canary infrastructure) @ 2026-07-24T17:27:00Z
- [-] archive       (deferred: repository has no committed baseline or merge candidate)
- [x] docs-sync     → README.md + README.zh-CN.md

manual: none
waived: none
