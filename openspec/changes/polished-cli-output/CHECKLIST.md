# Code Review Checklist — polished-cli-output

- **Mode**: Incremental
- **Branch**: N/A（当前目录不是 Git 仓库）
- **Commit**: `uncommitted (no HEAD)`；修复轮复核范围为 `src/cli/output.mjs`、`src/cli/language.mjs`、`bin/mdxv.mjs`、`bin/mdxx.mjs`、`test/cli-output.test.mjs`、`test/cli-language.test.mjs`
- **Reviewer model**: `gpt-5.6-sol`（family: GPT-5）

## Verdict A — Spec-compliance（code-vs-spec；不代表用户意图验证）

**Status: HELD**（下列 P0/P1 已全部解决）

- [x] 🟠 **P1 #A1 — Resolved** `bin/mdxv.mjs` L55、`bin/mdxx.mjs` L43 — `INPUT_REQUIRED` 现在输出“具体错误 + 空行 + 完整帮助”；`test/cli-output.test.mjs` L63 覆盖两个无参数子进程的退出码、分区和无堆栈行为。
- [x] 🟠 **P1 #A2 — Resolved** `src/cli/language.mjs` L17、L91、L125 — 裸 `--lang` 现在产生 `CliOptionValueError` / `OPTION_VALUE_MISSING` 并本地化为具体缺值诊断；`test/cli-output.test.mjs` L50 与 `test/cli-language.test.mjs` L136 均断言具体消息和完整帮助。
- [x] 🟠 **P1 #A3 — Resolved** `src/cli/output.mjs` L88、L120 — 状态行按终端显示列宽补空格；`test/cli-output.test.mjs` L137 覆盖中文各标签的对齐结果。

## Verdict B — Code-quality

**Status: HELD**（无未解决 P0/P1；下列 P2 可跟踪）

没有未解决的 P0/P1。

## Tracked（P2 / P3 — 可在合并后继续跟踪）

- [x] 🟡 **P2 #B1 — Resolved** `bin/mdxx.mjs` L77、`test/cli-output.test.mjs` L172 — 实现使用 `Buffer.byteLength(html)`；真实 `mdxx` 子进程测试现在解析面板中的文件大小，并与 `statSync(output).size` 的同口径换算结果作等值断言。独立重跑 `node --test test/cli-output.test.mjs`：12 passed，0 failed。
- [x] 🟡 **P2 #B2 — Resolved** `src/cli/language.mjs` L28、`bin/mdxv.mjs` L115、`bin/mdxx.mjs` L97 — 两入口已复用 `CliArgumentsError extends Error`，保留结构化 `code` / `params`，不再抛普通对象。

## Verification evidence

- 当前 `tdd-evidence.md` 仍记录修复前的 `10 + 14` 定向用例与 `72` 个完整用例，且无 Git HEAD 可证明其新鲜度，因此本轮触发了完整套件重跑。
- 独立重跑：`node --test test/cli-output.test.mjs test/cli-language.test.mjs`，退出码 0，`26 passed, 0 failed`。
- 完整重跑：`npm test`，退出码 0，`74 passed, 0 failed`。
- 修复抽样确认：无输入与裸 `--lang` 均退出 1、输出具体诊断和完整帮助且无堆栈；中文状态标签按显示列宽对齐；多余位置参数由共享 `Error` 子类表示；导出大小使用 UTF-8 字节数。
- 项目没有 lint/typecheck 命令，因此未虚构 scoped lint。
- 未找到上下文级 `CONTEXT.md`，故 `glossary-conformance` 无可用术语注册表；这不提供任何正确性信用。

---
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **HELD**
**Progress**: 3 / 3 P0+P1 resolved
