# suite-report — fix-s12-structural-criterion

Commit: 17dfdf0edcdbc2902d8f50c04e99468c16c0e7cc

The minimal lane's verification carrier: the project's own suite, run whole against the
working tree at the commit above.

## Result

| command | result | wall |
|---|---|---|
| `npm test` (= `node --test test/*.test.mjs`, the full gate) | **247 pass / 0 fail / 0 skipped / 0 todo** | 31.5 s |
| `npm run test:unit` | **237 pass / 0 fail** | 27.5 s |
| `make lint` | exit 0 | — |

`make lint` detail: 35 `.mjs` files parsed by `node --check`, `sh -n` clean on
`scripts/publish.sh`, `mdxv --check examples` 2 passed / 0 failed, `mdxv --check demo`
2 passed / 0 failed.

## Suite composition after this change

13 test files, unchanged in count: `compile-check.perf.test.mjs` was deleted and
`compile-check.no-build.test.mjs` added in its place. The glob in `npm test` picks the new
file up automatically, so the gate retains its no-exceptions property without an edit.

Net test count 247 (was 245): S12's single wall-clock assertion became three deterministic
ones — the check itself, a probe-liveness control, and a probe-coverage assertion.

## Notes

- No product code changed. `bin/mdxv.mjs` was mutated transiently during mutation testing and
  restored byte-identically; verified with `diff -q` against a pre-mutation copy and
  `grep -c mutant bin/mdxv.mjs` → 0.
- The new file joins `test:unit`. Unlike the file it replaces it runs no Vite build, so the
  lane's stated "无 vite 构建" contract holds for it — see the out-of-scope note in
  `tdd-evidence.md` about the three files already in that lane for which it does not.
