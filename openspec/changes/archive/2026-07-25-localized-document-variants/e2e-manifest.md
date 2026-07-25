# E2E Manifest — localized-document-variants
status: final
total-scenarios: 12

## Coverage
| Scenario | Bucket | Test / reason | db-assert |
|----------|--------|---------------|-----------|
| S1 | mapped | e2e/localized-document-variants.spec.mjs → `S1: Exact zh-CN locale renders the Chinese physical variant` | suite |
| S2 | mapped | e2e/localized-document-variants.spec.mjs → `S2: Missing exact locale falls back to the base physical file` | suite |
| S3 | mapped | e2e/localized-document-variants.spec.mjs → `S3: Exact en-US locale wins before base fallback` | suite |
| S4 | mapped | e2e/localized-document-variants.spec.mjs → `S4: Switching language persists mv-locale and changes the current document variant` (including unavailable Storage and malformed-variant regressions) | suite |
| S5 | mapped | e2e/localized-document-variants.spec.mjs → `S5: Direct locale-suffixed URLs canonicalize to the active exact variant or base fallback` | suite |
| S6 | mapped | e2e/localized-document-variants.spec.mjs → `S6: Navigation lists each localized document family once with its neutral label` | suite |
| S7 | mapped | e2e/localized-document-variants.spec.mjs → `S7: A dotted basename remains a base document while a final locale suffix is selected` | suite |
| S8 | mapped | e2e/localized-document-variants.spec.mjs → `S8: Relative Markdown links route and then select the active locale variant` (including query/hash preservation) | suite |
| S9 | mapped | e2e/localized-document-variants.spec.mjs → `S9: Demo has an English and Simplified-Chinese physical document counterpart` | suite |
| S10 | mapped | e2e/localized-document-variants.spec.mjs → `S10: mdxx exports only the explicitly selected variant and opens offline` | suite |
| S11 | mapped | e2e/localized-document-variants.spec.mjs → `S11: Topbar computes to 36px and its controls do not overflow` | suite |
| S12 | mapped | e2e/localized-document-variants.spec.mjs → `S12: Topbar buttons have matching localized hints and visible keyboard focus` | suite |

non-scripted: 0 / 12 (agent-driven + waived)

## Run
- `CI=1 npm run test:e2e -- localized-document-variants.spec.mjs --reporter=json,junit`
- `npm run test:export`

## Verification

- `CI=1 npx playwright test localized-document-variants.spec.mjs --reporter=list` → 12 passed (2026-07-25), including unavailable-Storage language switching, malformed-variant recovery, relative-link query/hash preservation, and the committed Chinese demo variant.
