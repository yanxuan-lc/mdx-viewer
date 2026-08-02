# Code Review Checklist — fix-s12-structural-criterion

- **Mode**: Incremental（合并前门禁，只审 `530cfcc` 一个提交的 diff）
- **Branch**: dev
- **Commit**: 530cfccadb9c68cea31439bf0866233979c7c718
- **Reviewer model family**: Claude (Opus 5)

## 复核证据（采样口径）

`suite-report.md` 提交时的 `Commit:` 戳是 `63b83db`，与被审 HEAD `530cfcc` **不一致**（stamp
mismatch），因此触发全量重跑，不复用记录值：

| 命令 | 我实测结果 |
|---|---|
| `npm test` | exit 0 · **247 pass / 0 fail** · 28.0 s |
| `node --test test/compile-check.no-build.test.mjs` | exit 0 · **3 pass** · 0.96 s |
| `make lint` | exit 0 |

另做了 5 组独立探针实验（不改仓库，脚本在 scratchpad），结论见下方各条。**最重要的一条：**
在真实 `--check` 进程里给钩子加载记打点，确认 wrapper 模块**确实被求值**且零调用 —— 所以
「S12 断言为空 = 探针没装上」这个空洞路径**实际不成立**，反向对照设计是有效的。

## Verdict A — Spec-compliance（code-vs-spec，不评判 spec 本身是否是该做的事）
**Status: HELD**

改动完整落地了任务陈述的意图：判据从挂钟比值换成结构事实，测试 3 条断言与 `spec.md:259` 的
S12 场景对得上，`package.json` 的车道迁移与 spec 新增的「SHALL live in the fast unit lane」一致。
未见夹带的越界改动（产品代码零改动，已核 `git show --stat`）。

- [ ] 🟡 **P2 #A1** `openspec/specs/compile-check/spec.md` L253-254 — 需求正文仍写「Wall-clock
  figures **are recorded** as a budget for the performance gate」，但唯一记录机制是被本次删掉
  的 `compile-check.perf.test.mjs` 末尾那行 `console.log('[S12] check=… export=… ratio=…')`。
  全仓已 grep：现存代码里没有任何地方再产出这组数值（只有 archive 里的历史读数）。修：要么删掉
  这半句，要么在句中指明预算现在落在哪个 perf-gate 产物里。
- [ ] 🟡 **P2 #A2** `openspec/changes/fix-s12-structural-criterion/genai/suite-report.md` L3 —
  提交进 `530cfcc` 的版本戳的是 `63b83db`，即 3 个提交之前、且是「工作区脏」时的那次测量
  （ledger 里 `existing-suite` 的 fail 事件正是记这件事）。工作区已有未提交的修正把它改成
  `530cfcc`，但**未随本提交入库**。修：把该修正一并提交，让入库证据的戳等于被审 HEAD。
- [ ] 🔵 **P3 #A3** `openspec/specs/compile-check/spec.md` L259-263 — S12 的 THEN 只描述了
  liveness 对照，没提第三条 probe-coverage 断言（测试里实际有）。spec 少描述了一个防空洞控制项。
  修：THEN 补一句「且探针须被证明同时包住 `build` 与 `createServer`」。

## Verdict B — Code-quality
**Status: NOT HELD**（1 条 P1 未决）

- [ ] 🟠 **P1 #B1** `test/compile-check.no-build.test.mjs` L44、L58 — **探针管不到子进程，这是
  相对旧判据的一次检测能力倒退。** 探针靠 argv 上的 `--import` 注册，而 `--import` 是命令行标志，
  **不会**被 `child_process` 派生的 node 子进程继承。我实测确认（同一段代码，两种传法）：

  | 传法 | 子进程里 `import {build} from "vite"; build({})` 是否被记录 |
  |---|---|
  | `node --import <preload> …`（现状） | **未记录**（探针没进子进程） |
  | `NODE_OPTIONS="--import file://<preload>" node …` | **记录到 `build`** |

  后果：如果哪天有人把 `--check` 重构成「起个子进程去跑 `bin/mdxx.mjs` / node」——这恰恰是
  「`--check` 偷偷变成第二个 mdxx」最直白的一种写法 —— 父进程一次 `vite.build` / `createServer`
  都不会调，S12 **依然全绿**。而被删掉的挂钟比值判据在这条路径上是**能红的**（子进程构建要 ~3.6 s，
  比值必然爆）。所以在这一个回归面上，新判据严格弱于旧判据。
  修：把探针改成经 `env` 传 `NODE_OPTIONS: "--import file://…/preload.mjs"`（已验证可用，注意用
  file: URL），或 argv 与 `NODE_OPTIONS` 同时给；这样子进程也带探针，覆盖面才与 S12 声称的一致。

- [ ] 🟡 **P2 #B2** `test/compile-check.no-build.test.mjs` L55-73 — liveness 用例既没有
  test 级 `timeout`（另两条 spawnSync 用例都有 `timeout: 30_000`，`node:test` 默认是 Infinity），
  又用了 `stdio: "ignore"`，还没有 `child.on("error")` / 退出码检查。子进程因任何原因起不来
  （端口异常、加载器抛错、参数变更）时的表现是：空转 10 s，然后报「or the probe is dead」——
  一句与真实原因无关的误导性诊断，且 stderr 已被丢弃，无从排查。
  （附：SIGTERM 清理本身没问题，实测子进程 12 ms 退出；`strictPort: false` 也让写死的 47311
  端口冲突不影响断言。）修：`stdio: ["ignore","ignore","pipe"]` 收集 stderr 并拼进断言消息，
  给该用例加 `{ timeout: 60_000 }`，轮询超时前先判子进程是否已退出。

- [ ] 🟡 **P2 #B3** `test/compile-check.cli.test.mjs` L8 — 本次删了
  `test/compile-check.perf.test.mjs`，但该文件头注释仍写「S12（性能场景）单独在慢车道文件
  test/compile-check.perf.test.mjs」，指向一个已不存在的文件，且车道描述也已过期。
  修：改为指向 `test/compile-check.no-build.test.mjs`，并去掉「慢车道」表述。

## Tracked (P2 / P3 — 可留到合并之后)

- [ ] 🔵 **P3 #B4** `test/fixtures/vite-call-probe/hooks.mjs` L5、L27 — `WRAPPED` 与本仓真实的
  vite 入口面之间没有任何东西把它们钉在一起。我核过当前确实只有两处：`bin/mdxx.mjs:9` 的
  `build`、`bin/mdxv.mjs:12` 的 `createServer`，所以**今天覆盖是完备的**；但 vite 6.4.3 还导出
  `createBuilder` / `preview` / `optimizeDeps` / `runnerImport` 等入口，将来任一条被引入产品代码，
  探针会静默变窄而 S12 不红。修：加一条断言，要求 `bin/` + `src/` 里所有 `from "vite"` 的具名
  导入 ⊆ `WRAPPED`。
- [ ] 🔵 **P3 #B5** `test/compile-check.no-build.test.mjs` L76-91 — coverage 用例绕开了
  `withProbe`，把 `MDXV_PROBE_OUT` 指到固定路径 `tmpdir()/unused-probe-log`，既不清理也不可观测。
  修：统一走 `withProbe`，顺带断言该文件仍为空（多一条免费的「导入 vite 本身不触发调用」保证）。
- [ ] 🔵 **P3 #B6** `test/fixtures/vite-call-probe/hooks.mjs` L28 — `note()` 直接把
  `process.env.MDXV_PROBE_OUT` 交给 `appendFileSync`，未设该变量时任何 vite 调用会从 shim 内部抛
  一个语焉不详的 `TypeError`。修：在 `preload.mjs` 注册时 fast-fail 并给出明确报错（**不要**降级
  成静默 no-op —— 那正好制造 S12 的空洞）。
- [ ] 🔵 **P3 #B7** `test/fixtures/vite-call-probe/hooks.mjs` L10 —
  `if (resolved.url.includes(MARK)) return resolved;` 不可达：`nextResolve("vite", …)` 永远不会
  返回带标记的 URL。修：删掉，或补注释说明它防的是哪条递归路径。
- [ ] 🔵 **P3 #B8** `test/compile-check.no-build.test.mjs` L33-42 — 最后一丝空洞可以零成本堵上：
  让钩子把「wrapper 模块已求值」写进另一个文件，S12 断言它非空、调用记录为空。我用这个办法独立
  验证过 `--check` 现场探针确实在位，可直接落进测试。

### 已核查、非问题（供作者对照）

- `export *` 与显式导出的交互**正确**：实测探针命名空间 53 个键 vs 原生 52 个，恰好只多
  `__mdxvProbedExports`，`preview` / `defineConfig` / `version` 等全部照常透出，vite 无 default 导出，
  不受 `export *` 不转发 default 的影响。
- wrapper 确实会记账：实测调用 `build({})` / `createServer({})` 两条都落盘，`note()` 在委托前执行。
- `__mdxvProbedExports` 由 `WRAPPED` 同源生成，coverage 断言与实际包裹面**不可能漂移**，设计成立。
- **无 scope creep**：产品代码零改动；改动面 = 2 个 fixture + 1 新测试 + 1 删测试 + spec + `test:unit`
  清单，与「还一条 flaky 断言的债」严格匹配。车道迁移是判据变更的直接后果，不算夹带。

---
<!-- genai:code-review.verdict blocking-open=1 -->
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **NOT HELD**
**Progress**: 0 / 1 resolved
