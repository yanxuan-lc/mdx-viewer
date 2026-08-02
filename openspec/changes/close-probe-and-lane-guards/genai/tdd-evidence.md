# tdd-evidence — close-probe-and-lane-guards

Commit: PENDING

Pays down the two remaining INBOX items. Lane `min`: no spec node; input is the task description.
No product code changed.

Evidence discipline for this change follows the rule settled in `retier-test-lanes`, with the two
clauses that review left open there folded in:

1. **Anything reproducible at HEAD** — wall times, and any count derived by *running* (including
   `tests` totals, not just pass/fail/cancelled) — lives only in `suite-report.md`. This is the
   mechanical form review asked for (#B18): reproducibility at HEAD, not authorial intent, decides.
2. **Structural facts read off the source** may be stated wherever they help.
3. **Values that can no longer be reproduced** — because the state they described is gone — are
   historical narrative and exempt. Under clause 1's mechanical test they are exempt automatically,
   with no judgement call: re-run at HEAD and they do not come back.

Clause 1 subsumes review's #B17 (run-derived counts were outside the old wording) and #B18 (the old
clause-3 boundary was drawn by intent, so a current value could escape by being *described* as
historical).

## Item 1 — `s12-probe-escape-env-scrub-and-cjs` (P3)

The probe watched `vite.build` / `createServer` only, and rode into child processes on inherited
`NODE_OPTIONS`. Two escapes were measured by review: a child spawned with an env that **omits**
`NODE_OPTIONS`, and `createRequire("vite")` from the CJS side (the loader hook governs only the ESM
graph).

**Closed by watching the spawn itself.** The hook now wraps `node:child_process` as well —
`spawn`, `spawnSync`, `exec`, `execSync`, `execFile`, `execFileSync`, `fork` — in the **same** hook
module, because two separately registered hooks interfere (a previous round measured one silently
zeroing the other's counts). S12's assertion strengthens from "did not enter Vite" to **"neither
entered Vite nor spawned anything, in this process or any child"**. An env-scrubbed child is
therefore caught at the moment of spawning, before its own instrumentation matters.

That subsumes the CJS escape too: reaching a build through `createRequire` still requires either an
in-process Vite call (wrapped) or a spawn (now wrapped). `src/cli/vite-config.mjs` uses
`createRequire` only for `require.resolve`, never to load a module — checked, and no
`require("vite")`-shaped load exists anywhere in `bin/` or `src/`.

Two implementation details worth recording because both were wrong first:

- `export *` does not forward `default`, and vite's bundled code does
  `import childProcess from "node:child_process"`. Without an explicit `export default`, importing
  vite under the probe is a `SyntaxError`. Found by running, not reading.
- The synthetic module re-imports the real builtin, which resolves back through the hook unless the
  hook short-circuits on `parentURL`. The first version recursed until it had logged tens of
  thousands of phantom spawns.

## Item 2 — `test-lane-invariant-unguarded` (P2)

New `test/test-lanes.test.mjs` (L1, in-process) pins what is statically decidable:

| assertion | catches |
|---|---|
| lane membership | a glob-collected file in zero or two lanes; a lane list naming a deleted file |
| L1 zero-spawn | anything in `test:unit`'s **transitive closure** importing `child_process` |
| L1 no-vite | an L1 file importing vite, which could build without spawning |
| L3 still builds | build assertions moved out, leaving L3 a shell while the other three stay green |

**The criterion reads import specifiers, not free text.** A text scan flags this file itself — it
must name the APIs to look for them — and would fire on a passing mention in a comment. In ESM you
cannot call `child_process` without importing it, so "nothing in the closure imports it" is
equivalent to "structurally incapable of spawning", and it is decidable without false positives.

**Closure, not the lane list** (#B12): a file not spawning is not enough if something it imports
does. That hop started mattering when `test/helpers/` appeared.

**Deliberately not covered**: L2's "no build" is not statically decidable — `cli-output` and
`cli-language` legitimately invoke `bin/mdxx.mjs` on paths that exit before building. That dimension
stays with the dynamic probe, and the test file's header says so rather than implying coverage.

### Mutation checks — the guard goes red for each thing it claims to catch

| mutation | result |
|---|---|
| an L2 file added to `test:unit` (the #A1 shape) | ✖ membership + L1 zero-spawn |
| `child_process` imported directly by an L1 file | ✖ L1 zero-spawn only |
| an L1 file importing a helper that spawns (closure, one hop) | ✖ L1 zero-spawn only |
| a deleted file left in a lane list | ✖ membership (+ the two closure assertions, which die on the missing file — accurate messages, but noisy) |

`--check` mutated to fork a child with `NODE_OPTIONS`/`MDXV_PROBE_OUT*` stripped from its env — the
exact escape this change closes — reddens S12 and nothing else. All mutations restored
byte-identically (`diff -q` against pre-mutation copies of `package.json`, `test/locale.test.mjs`,
`test/helpers/cli-env.mjs`, `bin/mdxv.mjs`).

## Probe shadowing (`retier-test-lanes` #B13 / #B16), also closed here

`compile-check.no-build.test.mjs` used to repoint `MDXV_PROBE_OUT` at its own temp file, so a
lane-level measurement had no coverage of that file's subprocesses. It now uses a private
`MDXV_PROBE_OUT_S12`, and the hook records into **every** configured sink rather than picking one.

The first attempt got the precedence backwards — the private sink won, so the lane count still
missed those subprocesses and still read 4 where the truth was 5. Caught by re-measuring instead of
assuming the fix worked. The lane-level `createServer` count now reads 5, and L2's `build = 0` is
established by lane-level measurement rather than resting on that file's own assertions.

## Backlog

Both items → `done`. INBOX is empty; `flow doctor` clean.
