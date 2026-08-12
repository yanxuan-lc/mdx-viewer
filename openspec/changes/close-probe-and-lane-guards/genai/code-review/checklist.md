# Code Review Checklist — close-probe-and-lane-guards

- **Mode**: Incremental（合并前门禁）
- **Branch**: dev
- **Commit**: 70d36cddf0526781ef917a37dfb5faaf0460269a
- **Reviewer model family**: Claude (Opus 5)，fresh context
- **Lane**: `min`，无 change-local spec 目录。Verdict A 的基准 = 任务描述 + 车道判据本身
  + `genai/` 证据是否如实描述被审提交。
- **Scope**: 仅 `70d36cd`。`016d9c7` 及更早属另一已过门禁的 change，只作上下文。

## 复核证据（本轮自己重跑，退出码取自命令本身而非管道）

| 命令 | exit | tests | pass | fail | cancelled | skipped |
|---|---|---|---|---|---|---|
| `npm test` | **0** | 251 | 251 | 0 | 0 | 0 |
| `npm run test:unit` | 0 | 189 | 189 | 0 | 0 | 0 |
| `npm run test:cli` | 0 | 46 | 46 | 0 | 0 | 0 |
| `npm run test:build` | 0 | 16 | 16 | 0 | 0 | 0 |
| `make lint` | **0** | — | — | — | — | 39 files parsed |

与 `suite-report.md` 逐格吻合。另外做了四个第一手实验（Node v24.15.0，脚本在会话 scratchpad，
未改动仓库任何文件）：默认导入/CJS 逃逸、`promisify.custom` 保真、双 sink 同路径、
车道守卫正则的绕过面。结论见 #A1 / #B1 / #B7 / #B2。

## Verdict A — Spec-compliance（code-vs-任务描述与车道判据；**不评判该不该做**）
**Status: NOT HELD**

- [ ] 🟠 **P1 #A1** `test/fixtures/vite-call-probe/hooks.mjs:60,65` — **本次改动要关的那条逃逸
  路径没关上，而代码注释与证据都写它关上了。** `export default realDefault` 导出的是**未被包装
  的真身**（实测 `cp.spawnSync === createRequire(...)("child_process").spawnSync` 为 `true`），
  于是 `import cp from "node:child_process"; cp.fork(...)` 这一形状**完全不被记录**。
  我按你描述的攻击面原样复现了一次：默认导入 + 显式剥掉 `NODE_OPTIONS`/`MDXV_PROBE_OUT*` 的
  env + 子进程里真的跑 `vite.createServer()`（子进程 exit 0）→ **记录文件 0 行**，
  即 S12 会绿。mutation 证据里那次 `fork` 之所以变红，只是因为它用的是具名导入。
  同理 CJS 侧也未闭合：`register()` 的异步钩子只管 ESM 图，`require("child_process").spawnSync`
  实测不被拦，所以 tdd-evidence「That subsumes the CJS escape too」为假。
  这一条同时使 `hooks.mjs:1-19` 的头注、`compile-check.no-build.test.mjs:63-66` 的注释、
  `tdd-evidence.md` Item 1 三处叙述都强于事实。
  **修法**：默认导出改成挂着包装函数的对象，例如
  `const d = Object.create(realDefault); Object.assign(d, { spawn, spawnSync, exec, execSync, execFile, execFileSync, fork }); export default d;`
  —— 既保住「vite 用默认导入会 SyntaxError」那条修复，又让默认导入路径进包装。
  CJS 半边二选一：改用 `module.registerHooks()`（同步钩子，实测**能**看见
  `require("child_process")` 的 resolve，Node ≥22.15/24 可用），或把三处叙述收窄成
  「ESM 具名导入这一形状」并把剩下的洞记进 backlog。**不要只改注释就算完**——具名导入是
  最容易被重构掉的那一种，默认导入恰恰是 vite 自己的写法。

- [ ] 🟠 **P1 #A2** `openspec/changes/close-probe-and-lane-guards/genai/` — **被审提交里的证据
  载体没有描述被审提交。** 在 `70d36cd` 的树里：`tdd-evidence.md:3` 是 `Commit: PENDING`；
  `suite-report.md` **根本不在提交里**（`git ls-tree` 只有 flow.json / ledger.jsonl /
  tdd-evidence.md，该文件至今 untracked）；`ledger.jsonl` 记着一条
  `{"event":"fail","node":"implement","unmet":[{"kind":"commit-match", ...}]}`。
  当前戳只在**未提交的工作树**里对得上。合并门禁读的是 checklist 的戳与证据的戳，
  而「凡可在 HEAD 重现的计数只住在 `suite-report.md`」这条规则的落点文件不在树里时，
  那些计数在被审提交里**无处可住**。
  **修法**：把 `suite-report.md` 与已改好的 `tdd-evidence.md` 一并纳入提交（`--amend` 或补一个
  提交），并让 ledger 的 implement 节点重判为 pass；戳与 HEAD 对齐后本条即可勾掉。

- [ ] 🟠 **P1 #A3** `AGENTS.md:152-172`（车道表）＋ `AGENTS.md:174-177`（单一出处指针）—
  **本次新增了一个车道文件，人读的那张车道表没跟上；单一出处指针指向了过期的那份报告。**
  磁盘上 `test/*.test.mjs` 现有 **16** 个，表里只有 **15** 行——缺 `test/test-lanes.test.mjs`
  这一行（它自己就是为了防车道标签漂而加的文件）。同时 L177 仍写着计数与耗时的唯一出处是
  `openspec/changes/retier-test-lanes/genai/suite-report.md`，而那份报告停在 `016d9c7` 的
  247 / 185，HEAD 是 251 / 189，本 change 又新写了一份 `suite-report.md`——于是「只有一处来源」
  这句在 HEAD 上为假。按本项目一贯的尺子（写下来的不变式为假 = P1）计。
  **修法**：(1) 表里补 `test/test-lanes.test.mjs | L1 | 三条车道的依赖表面不变式 | 纯读文件、
  零子进程`；(2) L177 的指针改成不指死某个 change（例如「最新一个 change 目录下的
  `suite-report.md`（带 commit 戳）」），否则每个 change 都得记得回来改这一行。

- [ ] 🟠 **P1 #A4** `openspec/changes/close-probe-and-lane-guards/genai/tdd-evidence.md:95-96` —
  **这份文件自己声明的 clause 1，自己没遵守。** 「The lane-level `createServer` count now reads 5」
  与「L2's `build = 0`」都是**由运行得出、且在 HEAD 上可重现**的计数（重跑车道级探针注入就会
  再得一次），按 clause 1「lives only in `suite-report.md`」它们不该出现在这里；两处也确实
  已在 `suite-report.md` 的表里各有一份。这正是 retier 那轮 #A3/#A5 的形状：数字被抄到单一
  出处之外，L2 多一个 dev server 测试它就漂。
  同段的「still read 4」属 clause 3（那个状态已不存在，重跑不回来），**豁免正确，不要改**。
  **修法**：L95-96 改成结构性表述——「车道级测量现在覆盖了该文件的子进程，L2 的
  `build`/`createServer` 以 `suite-report.md` 的表为准」，不复述具体数值。
  **不作为 finding**：提交信息里的 251/46/16 —— 提交信息是不可再改的时点记录，
  按 clause 1 的机械判据它无法「住到别处去」，与本条不同类。

## Verdict B — Code-quality
**Status: HELD**（无未解决的 P0/P1；下列 P2/P3 可留到 merge 之后）

## Tracked（P2 / P3）

- [ ] 🟡 **P2 #B1** `hooks.mjs:53-56`（包装体）— **包装函数丢掉了 `promisify.custom`，探针会
  改变被观察系统的语义。** 实测：真身 `exec[util.promisify.custom]` 是 `function`，包装后是
  `undefined`。于是探针在场时 `promisify(exec)` / `promisify(execFile)` 从「resolve 成
  `{stdout, stderr}`」退化成「resolve 成回调首参」。这不是理论问题：vite 的
  `dist/node/chunks/dep-*.js:16` 正是 `import childProcess$2, { exec, execFile, execSync } from
  'node:child_process'`，具名那三个在 `mdxx` 路径下**已经**走包装。今天没咬人只因为 vite 自己
  没 `promisify(exec)`（我 grep 过 dist，零命中）。
  **修法**：包装函数上补 `wrapped[promisify.custom] = real[name][promisify.custom]`（存在才补），
  顺手把 `name`/`length` 也对齐。

- [ ] 🟡 **P2 #B2** `test/test-lanes.test.mjs:26-33` — **「decidable without false positives」
  为假，而且反例已经在仓库里。** `ANY_IMPORT` 是纯文本正则，注释与字符串一样命中：
  `test/cli-export.test.mjs:47` 就有
  `/** @type {Map<string, {result: import("node:child_process").SpawnSyncReturns<string>, ...}>} */`
  ——一句 JSDoc 类型引用（这正是给 child_process 结果标类型的惯用写法）。该文件今天在 L3、
  不被 L1 守卫扫到，所以只是潜在误报；但头注写的「文本扫描会误报、读 import 说明符不会」
  这个区分并不成立：两者都是文本扫描，只是形状更窄。`RELATIVE_IMPORT` 同理——一句被注释掉的
  `from "./old-helper.mjs"` 会让 `closureOf` 在 `existsSync` 上抛「referenced by ... but does
  not exist」，一个不存在的违规；`import("./fixtures/" + name)` 这种拼接会把目录当文件读，
  抛 EISDIR 而不是给出断言信息。
  **修法**：扫描前先剥掉注释与字符串字面量（一个小的 tokenizer 就够，或用 `acorn` 的话又引了
  依赖，本项目零测试依赖，倾向自己剥），或把头注从「无误报」改成「误报形状为 A/B/C，出现时
  这样处理」。

- [ ] 🟡 **P2 #B3** `test/test-lanes.test.mjs:27-29,36-52` — **「闭包内无人 import 它」与
  「结构上不具备派生能力」不等价**，闭包只沿**相对** import 走。实测四种绕过：
  ① 计算出的动态 specifier（`await import("node:child" + "_process")`）；
  ② 模板字面量 specifier；
  ③ `createRequire(import.meta.url)("child_process")`（只看见 `node:module`，且这条同时绕过
  探针本身，见 #A1）；
  ④ 经**包名** import 的 helper（`some-pkg` 不被走进去）。
  同一个洞也削弱了上一条「never imports vite, so it cannot reach a build at all」——L1 文件
  import 的某个包自己 import vite 时，闭包看不见。
  **修法**：把 `node:module`/`createRequire` 也纳入告警集合，并把头注的「等价」降级为
  「在『只用静态相对 import 组织测试代码』这个前提下等价」，把前提写出来。

- [ ] 🟡 **P2 #B4** `test/test-lanes.test.mjs:96-97` — **L3 反向守卫可以被散文满足。**
  判据是「闭包里有文件的正文匹配 `/mdxx\.mjs/`」，而 `test/export.test.mjs:2` 的头注
  「端到端冒烟测试 · bin/mdxx.mjs」就已经命中。也就是说：把三个 L3 文件的构建断言全搬走、
  只留头注，这条仍然绿——正好是注释里声明它要防的那个场景（「留下空车道」）。
  **修法**：判据改成「有 `spawnSync`/`execFileSync` 形状的调用且 argv 里出现 `bin/mdxx.mjs`」，
  或直接断 L3 的探针实测 `build > 0`（那已经是 `suite-report.md` 里的一个数）。

- [ ] 🟡 **P2 #B5** `hooks.mjs:41` — **共享 fixture 硬编码了某个测试文件的私有变量名。**
  `MDXV_PROBE_OUT_S12` 这个名字属于 `compile-check.no-build.test.mjs`，却写在公用探针里
  （连报错文案也把它枚举了出来）。第二个需要私有 sink 的测试文件出现时，必须回来改 fixture，
  而这类「改一处忘另一处」正是本 change 在偿还的债。
  **修法**：`MDXV_PROBE_OUT` 收成 `path.delimiter` 分隔的列表，或扫 `MDXV_PROBE_OUT*` 前缀，
  fixture 从此不认识任何具体消费者。

- [ ] 🟡 **P2 #B11**（**先于本次改动存在**，但就在本 diff 改过的文件里，且正是新守卫要防的类）
  `test/compile-check.no-build.test.mjs:11` — 头注写「因此本文件进 test:unit 快车道」，
  而它实际在 **test:cli**（`package.json` 的 `test:cli` 清单、`AGENTS.md:165` 都是 L2）。
  一个**写在文件里的假车道标签**，而新守卫只比对 `package.json` 与磁盘，看不见它。
  **修法**：删掉那半句（判据的确定性与亚秒级不依赖它属哪条车道），并考虑给守卫加一条
  「文件头注若声明车道，必须与 `package.json` 一致」。

- [ ] 🔵 **P3 #B6** `hooks.mjs:20-22` — `TARGETS` 里的 `real` 字段三处赋值、零处读取
  （`resolve` 只用 `kind`，proc 分支把 `node:child_process` 写死了）。死数据会让下一个读者
  以为它承重。删掉，或让 proc 分支真的用 `target.real`。

- [ ] 🔵 **P3 #B7** `hooks.mjs:41` — sinks 未去重：两个变量指向**同一路径**时每条事件写两行
  （实测 1 次 spawn → 文件 2 行）。今天没有这种配置，但这正是「记录进每一个 sink」这个改法
  唯一能造成的 count 变错（而非变大）的形状。**修法**：`[...new Set(sinks)]`。

- [ ] 🔵 **P3 #B8** `hooks.mjs:42` — 「没设 sink 就抛」的爆炸半径从「vite 入口被调用」扩大到
  「进程里任何一次派生」，包含第三方。实测：注册了探针而不设 sink 时，异常从 vite 内部的
  `exec` 抛出，栈里看不到任何测试代码。**修法**：注册时（`preload.mjs`）就校验 sink 存在并
  报错，而不是等到第一次派生。

- [ ] 🔵 **P3 #B9** `test/test-lanes.test.mjs:64` — 数字用 `assert.deepEqual(owners.length, 1)`，
  应为 `assert.equal`；另外 `closureOf(laneFiles("test:unit"))` 在两条测试里各算一遍，
  提出来共享更省也更明确这两条断言看的是同一个闭包。

- [ ] 🔵 **P3 #B10** `test/compile-check.no-build.test.mjs:63-66` — 加强后的判据比它守的回归
  **更宽**：S12 守的是「`--check` 没变成第二个 mdxx」，现在断的是「一个子进程都不许派生」。
  今天成立且我核过成因（`bin/`、`src/` 全仓只有 `vite-config.mjs:6` 一处 `createRequire`，
  且只用于 `require.resolve`，没有任何 child_process 使用），所以这不是当下的假失败风险；
  但将来若把 graphviz(wasm) 换成 `dot` 可执行文件之类的合法改动，S12 会因为与它声明的回归
  无关的理由变红。这是可接受的取舍（也是抓住 env-scrub 逃逸的唯一办法），只是**头注应当把
  新契约写成「check 路径上不允许出现任何子进程」**，而不是继续只说「不进构建」。

- [ ] 🔵 **P3 #B12** `openspec/changes/close-probe-and-lane-guards/genai/suite-report.md`
  （车道不变式表的 `spawn` 列）— 语义未定义：`node:child_process` 现在也包了 vite 自己，
  所以 39 / 6 混了「测试自己派生 binary」与「vite 内部派生」两类。**修法**：给该列加一句
  口径说明（或按 `spawn:<fn>` 拆开），否则下一个人会拿它当「测试派生了多少次」用。

## 已核为干净、不构成 finding

- **`export const spawn` 与 `export * from "node:child_process"` 的重名**：ESM 里本地显式导出
  优先于 star 导出（歧义只发生在两个 star 之间），实测具名 `execFileSync` 拿到的是包装体。
  这一处虽然微妙但正确。
- **`parentURL` 短路**（`hooks.mjs:30`）：合成模块回引真身必须放行，否则无限递归；条件用
  `endsWith(MARK)` 收得住——vite 分支的合成模块引的是**不带 MARK 的真实 URL**，因此 vite 内部
  再 import `node:child_process` 仍会被包（这也正是 #B1 的来源）。判据正确且完整。
- **「两个钩子会互相干扰、所以合进一个模块」**：未独立复现（需要重建那个失败配置），
  但这是历史测量、且合进一个模块本身无坏处，不追。
- **私有 sink 不会自我污染**：车道级测量时 `MDXV_PROBE_OUT_S12` 只存在于子进程 env，
  测试进程自己的 `spawnSync` 只写共享 sink，因此不会把 `spawn:spawnSync` 写进 S12 的断言文件。
  这一点设计对了，值得点名。
- **`npm test` 门控面未被触及**：仍是 glob 收全部 `test/*.test.mjs`；`test:unit` 新增文件后
  三条车道之和 189+46+16 = 251 = glob 全量，无重复无幽灵（新守卫自己也在断这件事）。
- **无产品代码改动**：diff 只含 `test/`、`package.json` 的 scripts、`genai/` 与 `openspec/` 文档。

## 门禁语义（避免被读成它没说的话）

- 两条判定同时 HELD 时合并门禁才开。当前 **NOT HELD**（Verdict A 有 4 条 P1）。
- Verdict A 是 **code-vs-契约**（此处为任务描述 + 车道判据 + 证据是否如实），**不是意图校验**：
  它不说明「把探针扩到 child_process」是不是该做的事，那属于人的意图回路。
- **本门禁不等于合并后审计**：门禁在合并前、跑每一次改动；审计在合并后抽样、且必须换模型族。
  跑完这道门禁**不替代**那次审计。
- 安全 / a11y / 性能有各自的确定性门禁节点，本轮不代跑、不代判。

---
<!-- genai:code-review.verdict blocking-open=4 -->
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **NOT HELD**
**Progress**: 0 / 4 resolved（#A1 #A2 #A3 #A4 待修；B 面 P2/P3 共 8 条不阻塞）
