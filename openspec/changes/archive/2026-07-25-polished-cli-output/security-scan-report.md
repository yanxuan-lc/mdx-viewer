# Security scan — polished-cli-output

Status: **clean at Medium+** — Critical: 0, High: 0, Medium: 0, Low: 0, Info: 0.

Scope: change-only scan of `src/cli/output.mjs`, `bin/mdxv.mjs`, `bin/mdxx.mjs`,
`src/i18n/messages.mjs`, and `test/cli-output.test.mjs`. The workspace has no committed
baseline or history, so the stamp is `uncommitted (no HEAD)` and secret scanning cannot
claim coverage of prior history.

| Dimension | Result | Command / evidence |
| --- | --- | --- |
| SAST | Run, clean | Targeted `rg` scan for dynamic evaluation, command execution, credential-bearing environment access, embedded credentials, and private keys. The only match was the intentional `node:child_process` import in the subprocess test. Semgrep is not installed. Manual review found no user-controlled shell execution, HTML generation, deserialization, or network request in the changed runtime code. |
| Dependency audit | Run, clean | `npm audit --json --registry=https://registry.npmjs.org` → exit 0; 400 dependencies, 0 advisories at every severity. No dependency changed in this change. |
| Secret scan | Run, clean in change scope | Targeted credential/private-key regex scan over the five in-scope files found no secret-like value. Gitleaks is not installed; no Git history exists to scan. |

Blocking threshold applied by the controller: Medium or higher. No blocking finding.

