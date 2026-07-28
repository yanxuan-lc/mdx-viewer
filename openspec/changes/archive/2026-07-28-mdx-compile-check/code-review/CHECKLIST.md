# Code Review Checklist — mdx-compile-check

- **Mode**: Incremental（merge 前增量审查，两判定门禁）
- **Branch**: `dev`
- **Commit**: 尚无 commit —— **未提交工作树，base `15433c9`**；被审内容摘要
  `sha256:4baa8339549e7573`（`git diff HEAD -- bin/mdxv.mjs src/cli/output.mjs
  src/i18n/messages.mjs package.json Makefile` 加四个新文件全文的联合摘要）。
  合并候选 HEAD 生成后须重新盖章；工作树任何后续编辑都会使本报告失效。
- **Reviewer model family**: Anthropic Claude（Opus 5）。**独立性由 controller 判定，不由本报告自证**：
  本报告不能证明它与实施方不同族，因此**不构成 post-merge audit** 所要求的异族审计。
- **Scope**: 上述 5 个改动文件 + `src/cli/compile-check.mjs`、`test/compile-check{,.cli,.perf}.test.mjs`、
  `test/fixtures/compile-check{,-e2e}/`、change dir。**排除** `.claude/agent-memory/`（harness 脚手架，非本变更）。

---

## Verdict A — Spec-compliance（code-vs-spec，**不是**意图校验）

**Status: HELD** —— 零未解决 P0/P1。

> **边界声明**：本判定只回答「代码是否实现了 `specs/compile-check/spec.md` 上的 8 条要求 / 18 个场景」，
> **不回答**「这份 spec 是否是用户真正想要的东西」。后者属于人类意图回路，本审查结构上无法替代。
> 判定 A 通过 ≠ 这就是用户要的；只等于「与磁盘上的 spec 一致」。

### 逐要求核对（我自己从 diff + spec 重新推导，未采信实施方自述）

| 要求 | 结论 | 依据 |
|---|---|---|
| R1 编译一致性 + 逐篇按扩展名推导 format | ✅ | `src/cli/compile-check.mjs:68` 逐篇 `compile({ path: abs, value }, mdxOptions())`；全仓 `grep` 无 `createProcessor` / `createFormatAwareProcessors`，**未复用缓存 processor**（F1 根因未回归）。S13 双向在单测与 CLI 测试各钉一遍 |
| R2 文档集解析 | ✅ | `bin/mdxv.mjs:158` `input === "demo" ? scanTree(DEMO_DIR) : resolveCheckDocuments(input)` —— demo 分支**先于** `resolveCheckDocuments` 里那个 `target ? … : …` 三元，F11 不成立。另核实 `scanTree` → `parseLocalizedDocuments` 是 1:1 `map`（`src/cli/localized-docs.mjs:29`）**不折叠**语言变体，故 demo 真的是 2 篇（实测 `--check demo` 输出 3 行 = 2 篇 + 汇总） |
| R3 无位置时降级、不伪造 | ✅ | `describeCompileFailure` 要求 `line` 与 `column` **同时**为 number 才带位置（`compile-check.mjs:30`）；`formatCheckLine` 同守卫（`output.mjs:116`）。路径 / reason 不着色不加引号 |
| R4 退出码与流分工 | ✅（一处窄缝见 #A1） | 0/1/2 三档齐备；引擎故障**未**另设退出码、无 `CompileEngineError`；`runCheck` 全程只设 `process.exitCode` 后 return（`:165` `:170` `:182`），check 模式两处早退也是 `exitCode = 2; return`（`:44` `:141`）；报告走 `console.log`（stdout）、诊断走 `console.error`（stderr）；汇总仅 `documents.length > 1` 时打印 |
| R5 零副作用 + 选项惰性 | ✅ | check 分支在 `createServer` 之前 return，`pickDefaultDoc` / `buildConfig` 完全不调用；实测 `--check … --help` → 退 0 出 help，`--check … -v` → 退 0 出版本号，**`--help`/`--version` 优先级成立** |
| R6 两档边界写进 help | ✅（措辞精度见 #A3） | `output.mjs:46` 追加 `Notes:` 段，`cli.checkBoundaryNote` 双语；实测 help 页含「top-level ESM `import`/`export ... from`」与围栏豁免语，**未**写成笼统的 "import" |
| R7 本地化 + **按流分别着色** | ✅ | 见下「专项一」 |
| R8 性能预算 | ✅ | 断言只有相对倍数（`compile-check.perf.test.mjs` 末行 `checkMs <= exportMs / 5`），无绝对秒数断言；该文件**不在** `package.json` 的 `test:unit` 清单内（F9 成立），仅被 `npm test` 的 `test/*.test.mjs` 通配带上（慢车道，符合设计） |

**未夹带越界改动**：diff 只触及 spec 声明的文件面。

### 专项一 · S11 着色接线（本次显式路由给我、全套测试都测不到的那条）

**结论：接线正确，未交叉。** 四处调用点逐一读过：

- 报告行 `bin/mdxv.mjs:176` → `console.log(formatCheckLine(result, { color: checkColors.report }))`
  —— 写 **stdout**，取 **`.report`**（stdout 的 TTY 态）✅
- `Error:` 诊断三处 `:160`、`:169`、以及 check 模式下的 `:43` / `:138`
  → 全部 `console.error(...)` 写 **stderr**，`color` 取 **`.diagnostic`** ✅
- 上游取值本身也没串：`:33` `resolveCheckColors({ stdoutIsTTY: process.stdout.isTTY, stderrIsTTY: process.stderr.isTTY, env })`
  —— 形参与实参一一对应，未把 stderr 的 isTTY 喂给 stdout 那半 ✅
- 汇总行 `:180` 完全不着色，符合「颜色只作用于 `✓`/`✗`」✅

即：广告过的 `mdxv --check <dir> >report 2>err` 姿势下，report **逐字节无 ANSI**，
消费方不需要把剥离正则写进跨仓库契约。**F2 的落地是真的，不只是纯函数层面为真。**

### 专项二 · 边界措辞问题（第二条路由项，判断而非缺陷）

我复现了那个第三形状，确认现象成立：

```
export const boom = (() => { throw new Error("x") })()   →  --check 退 0，浏览器里模块求值期炸
```

**判断：现有措辞不算说假话，但那份枚举读起来是封闭集，应当泛化。** 理由分开讲：

- help 的**引导句**「`--check` 只校验编译，不保证文档能加载 / verifies compilation only, not that a
  document can load」已经把话说对了 —— 这一句本身覆盖 `boom`，所以**不是错误陈述**，R6 字面要求
  （「help SHALL name the second tier explicitly」）也确实被满足了。故不是 spec 违反。
- 但紧跟其后的 `A、或 B` 两项枚举**没有任何「例如」标记**，理性消费方会读成穷举，进而推出
  「我这篇既没 import 也没 `{…}`，那么通过 = 可交付」—— 这恰是 R6 存在的全部目的要打掉的推理。
  `boom` 证明该推理不成立；同类还有「`{…}` 里的表达式**求值抛错**」（不是「未定义标识符」那一项）。
- **建议的落法**（P2 #A3）：把乙档从「列两个实例」改成「点名机制 + 举实例」，同时保住那句
  载重的「顶层 ESM 语句」（围栏豁免不能丢）。例如：乙档 = **任何顶层 ESM 语句或 `{…}` 表达式在
  模块求值 / 渲染期失败** —— specifier 无法解析、标识符未定义、**或初始化器自身抛错**。

这是措辞判断、涉及已对外广告的跨仓库文案，我给出建议但把「现在改还是 merge 后改」留给人类裁定
（见文末 open question）。

### 发现（Verdict A）

- [ ] 🟡 **P2 #A1** `bin/mdxv.mjs:30` —— `--check=<value>` 拼写绕过裸 argv 探测。`checkMode` 用
      `process.argv.slice(2).includes("--check")` 精确匹配，故 `--check=true` 时 `checkMode === false`
      而 cac 的 `opts.check` 为真：**参数级失败会退 1 而不是 2**。实测：
      `mdxv --check=true <pass.mdx> --lang xx-XX` → **exit 1**；同样内容用裸 `--check` → **exit 2**。
      这是 R4「`--check` 在场时一切参数级失败退 2」与 S6 字面读法下的偏离，后果正是 D2 要消灭的误诊
      （消费方把「我调用错了」读成「文档破了」）。**降级为 P2 而非 P1** 的理由：`--check=<value>` 从未被
      spec / help / `mdx-artifact` 契约广告过，广告姿势是裸 flag；且报告本身仍正确（`runCheck` 自己设
      exitCode）。**修法**：探测改为
      `.some((a) => a === "--check" || a.startsWith("--check="))`。
      （附注：`--check=false` 实测正确进入预览模式并起 server，语义自洽，无需改。）
- [ ] 🟡 **P2 #A2** `design.md:146,148-150` —— exit-2 清单与自己的 D7 相互矛盾。该处仍写着
      exit 2 覆盖「无法归因于单篇内容的故障（编译管线构建失败、引擎/资产加载失败，见 D7）」，
      而第 2 轮重写后的 D7（`:364-398`）与 `spec.md` R4 明确裁定：**引擎故障留在 exit 1，判别靠
      reason 文本**。代码跟的是 spec.md（正确）。这是第 1 轮残留的过期句子。**修法**：把
      `design.md:148-150` 那一项从 exit-2 清单里删掉，并把 `:146` 表格里 exit 2 的含义收敛为
      「无法执行校验」，去掉「或结果无法归因于文档内容」。留着它，将来维护者会照 §2 把引擎故障接到 2 去。
- [ ] 🟡 **P2 #A3** `specs/compile-check/spec.md:165-168` + `src/i18n/messages.mjs:66,131`
      （`cli.checkBoundaryNote` 双语）—— 乙档枚举读作封闭集，未涵盖「顶层 `export` 初始化器抛错」
      与「`{…}` 表达式求值抛错」两个同类形状。详见上方「专项二」，含建议措辞。
      改动波及 spec R6、两条 locale 文案、以及 `compile-check.test.mjs:228-235` /
      `compile-check.cli.test.mjs:221-234` 两处 help 断言。**非阻塞**：引导句已使陈述为真。
- [ ] 🟡 **P2 #A4** `tasks.md:5.3`（未勾选）—— docs-sync 未做，实测三处 drift：
      `AGENTS.md:86-87` 命令表列了 `make view` / `make export` 但**没有** `make check-mdx`；
      `AGENTS.md:212` 术语表**未登记**「编译校验（compile check）」（design.md:103-107 自己标了这条
      unregistered）；`README.md` 与 `README.zh-CN.md` 对 `--check` 的提及次数**均为 0**。
      ledger 已显式把它路由出 developer 的文件所有权，故按「tracked」处置；但注意
      `package.json` 的 `files` 含两份 README —— **发布到 npm 那一刻**这就是「用户手册里没有这个
      功能」，建议在 publish 门之前补齐，而不是 merge 门。
- [ ] 🔵 **P3 #A5** `design.md:36-37,262-267` —— 测试文件名与车道表已过期：写的是两个文件
      （`compile-check.test.mjs` 含子进程 CLI、`compile-check-perf.test.mjs`），实际交付三个
      （`compile-check.test.mjs` / `.cli.test.mjs` / `.perf.test.mjs`）。`tasks.md` §4 顶部的
      dispatch 注记已记录此次改派，design.md 未同步。

---

## Verdict B — Code-quality

**Status: HELD** —— 零未解决 P0/P1。

### 约束逐条实证（不采信自述）

| 约束 | 结论 |
|---|---|
| `src/mdx/plugins.mjs`、`src/cli/vite-config.mjs` 零 diff | ✅ 二者（连同 `src/cli/resolve.mjs`、`bin/mdxx.mjs`）在 `git status --porcelain` 与 `git diff --stat HEAD` 下均为空 |
| 无 `CompileEngineError`、无可注入 `compileDocument` | ✅ `grep -rn 'CompileEngineError\|compileDocument\|createProcessor\|createFormatAwareProcessors' src bin test` → **零命中**。**我也不建议加回来**：D7 的空集论证成立（引擎故障必然落在 per-document 编译内部） |
| 逐篇 compile，非缓存 processor | ✅ 同上；`compile-check.mjs:68` 每篇现建 |
| `compile-check.mjs` 不碰流 / process / locale / 格式化 | ✅ 模块内无 `console.` / `process.` / `t(` / `colorize`（`:6` 的命中是注释，`:47/:51/:60` 的命中是变量名 `document`/函数名，非 `process.*`）。依赖只有 `node:fs` + `@mdx-js/mdx` + `../mdx/plugins.mjs`，与 design.md 的依赖图一致 |
| check 模式绝不 `process.exit()` | ✅ check 路径三处只设 `exitCode`；`process.exit()` 仅留在 `checkMode === false` 的既有预览分支与 help/version 早退（后者发生在任何报告写出之前，无截断风险）。实测 `--check demo \| cat` 完整拿到 3 行 |
| 呈现/进程职责划分 | ✅ 报告行格式化全在 `output.mjs`，`bin/` 只负责流与退出码 |

### 质量评价（对照 coding-guideline / tdd）

清晰、克制、与既有 CLI 模块惯例同构：命名沿用 `format*` / `resolve*` / `is*` 前缀，结果对象复用
`scanTree` 既有的 `abs` 字段名（无新造 `path`/`filePath`），全部导出带 JSDoc 类型，
`DocumentCheckResult` 由 `output.mjs` 以 `import("./compile-check.mjs")` 反向引用类型而**不**产生运行时
依赖（依赖方向未被污染）。`checkOneDocument` 把「读文件失败」与「编译失败」分成两个 `try`，
错误归一集中在一个纯函数里 —— 这是这个模块最值得肯定的一处结构选择。测试侧：43/43 通过（我在本树
重跑，exit 0），F12 的 `onResult` 契约（恰好一次 / 按序 / await thenable / 抛出即 reject）被真的钉住，
而不是只测 happy path。

**关于 SAST**：`security-scan-report.md` 诚实记录了 SAST **未由工具执行**，所以静态分析意见只有我这一份。
我按注入面逐条看过新代码，无发现：无 `eval` / `new Function` / 动态 `import()` / 子进程；
`compile()` 只编译不 `run()`，文档里的表达式与 import 不求值；路径经 `resolveInput` 的
`statSync`/`accessSync` 把关，且 `--check` 只读不写、不出网、不 bind 端口。
唯一的输入面是 argv 与文件内容，处置方式与既有 `mdxv` 一致。**这不等于跑过 SAST**，
本报告只是记录：人工审下未见问题。

### 发现（Verdict B）

- [ ] 🟡 **P2 #B1** `test/compile-check.test.mjs:10` —— 三个死导入：`mkdtempSync`、`rmSync`、
      `writeFileSync` 全文各只出现 1 次（即只在 import 语句里，从未被调用；同行的 `chmodSync`
      用了 3 次）。本仓库无 lint / typecheck 脚本（`AGENTS.md:135` 自陈），没有任何自动化会拦住它。
      **修法**：`import { chmodSync } from "node:fs";`。
- [ ] 🔵 **P3 #B2** `bin/mdxv.mjs:137-143` —— 任何**非 per-document**的异常从 `runCheck` 逃出后，
      会被这个 catch 当作 parser error 格式化，经 `formatParserMessage` 的兜底分支
      （`output.mjs:162`）输出「Error: 命令参数无效。」**外加整页 help**。退出码 2 是对的，
      但对一次 stdout 写失败（`onResult` 抛出，F12 归 2 的那条路）来说这是错的诊断文案。
      实际可达性很低（`console.log` 遇 EPIPE 通常不抛），故只作记录。
      **修法**：`runCheck` 内部包一层 try，或在该 catch 里区分 `error instanceof CliArgumentsError`
      与 cac 的 parser error，其余走一条中性的「校验未能完成」文案。
- [ ] 🔵 **P3 #B3** `bin/mdxv.mjs:169` —— 空文档集诊断用
      `t(locale, "cli.directoryEmpty", { root: input })` 传的是**用户原始入参**，而预览路径同一条
      消息（`:90`）传的是解析后的绝对 `inp.root`。同一条文案两种口径；若走到 `--check demo` 的空集分支
      会打出 root 为字面量 `demo`（该分支实际不可达，DEMO_DIR 恒有 2 篇）。
      **修法**：改传解析后的根目录，与 `:90` 对齐。
- [ ] 🔵 **P3 #B4** `test/compile-check.test.mjs:108-120`（S9）—— 用 `chmodSync(fixture, 0o000)`
      改**受版本控制的** fixture，靠 `t.after` 还原成 `0o644`。两个脆点：以 root 跑（容器 CI 常态）
      时 mode 000 仍可读，该断言会假失败；测试进程被杀则 fixture 以不可读状态留在工作树里。
      同一份断言在 `compile-check.cli.test.mjs:196-219` 已改用 `mkdtempSync` 临时目录 —— 建议
      快车道这条也照那个写法，别动仓库内文件。

---

## Tracked（P2 / P3 —— 可带过 merge）

上列 #A1 #A2 #A3 #A4 #A5 #B1 #B2 #B3 #B4 全部属此类：**无一条阻塞 merge**。
建议路由：#A2 #A5 → 文档修订（planner / docs-sync）；#A4 → publish 门之前必须补；
#A1 #B1 #B3 #B4 → developer 一轮小修即可；#A3 → 待人类裁定措辞后再改；#B2 → 可留。

---

**Merge gate**: 仅当两个判定都 HELD 时成立。**Currently: HELD**
**Progress**: 0 / 0 P0+P1 待解决（两判定各自零 P0、零 P1）

**给 controller 的三点提醒（不是我的决定）**

1. 本报告只是 merge 决策的**一个输入**，不是决策本身；`security-gate` / `a11y-gate` / `perf-gate`
   各自出自己的裁决，我没有替它们裁。
2. **Commit 章未落地**：`Commit` 字段目前记的是「未提交工作树 + 内容摘要」。合并候选 commit 一旦生成，
   须核对 `sha256:4baa8339549e7573` 仍代表同一份内容，否则本报告需重跑。
3. **本报告不构成 post-merge audit**：那道门要求异族模型，且我无法自证族别。

## Open questions（须人类裁定，我不代答）

1. **#A3 的措辞要不要在本次 merge 前改？** 乙档枚举读作封闭集，会支撑「没 import 就通过 = 可交付」
   这个不成立的推理；但 `cli.checkBoundaryNote` 是已对外广告的跨仓库文案，改它牵动 spec R6 + 两条
   locale + 两处 help 断言。选项：(甲) 本次就泛化为「机制 + 举例」；(乙) 记账，随下一次
   `--check` 相关变更一并改。我的技术建议是甲（越早越便宜，且此刻测试断言正好在手），
   但「值不值得现在动已广告的文案」是产品判断，不是我的权限。
2. **#A4 的 docs-sync 归谁、卡哪道门？** ledger 5.3 已路由出 developer 所有权但无人接手。
   建议至少把「卡 publish 门」这条定下来 —— README 里零处提及 `--check` 而 npm 包又带着两份 README。

---
---

# Round 2 — 修复项增量审查（delta review）

- **Mode**: Incremental delta —— **只审第 1 轮之后新落地的代码**，第 1 轮结论原样保留、不重新论证。
- **Branch**: `dev`；仍无 commit，**未提交工作树，base `15433c9`**
- **Commit / 内容摘要**: **`sha256:a6b826a2904c6c11`** ← **门禁请读这一个**，它取代第 1 轮的
  `4baa8339549e7573`（同一算法：5 个改动文件的 `git diff HEAD` 加 4 个新文件全文的联合摘要）
- **Reviewer model family**: 同第 1 轮（Anthropic Claude, Opus 5）。**仍不构成 post-merge audit**。
- **本轮实测**: `npm test` → **122/122 pass, exit 0**（我自己在本树重跑，与 controller 报的数字一致）；
  `src/mdx/plugins.mjs` / `src/cli/vite-config.mjs` / `src/cli/resolve.mjs` / `bin/mdxx.mjs`
  零 diff 复核通过；`CompileEngineError` / `compileDocument` / `createProcessor` /
  `createFormatAwareProcessors` 全仓再 grep → **零命中**；spec 场景数 **19** 复核一致。

## 逐项处置

### 1. #A1 修法 —— ✅ **真正解决，且比我第 1 轮的建议更对**

**我第 1 轮给的那条正则是错的，developer 拒绝它是对的。** 我写了一份差分探针，把**出厂谓词逐字复制**
（`bin/mdxv.mjs:42-44`）与 cac 自己下游解析出的 `parsed.options.check` 在 13 种拼写上对撞：

| 拼写 | 出厂探针 | cac 实际 | 一致 |
|---|---|---|---|
| `--check` / `--check=true` / `--check=` / `--check=0` / `--check=1` / `--check=no` / `--check=FALSE` / `--check=xyz` | true | true | ✅ |
| `--check=false` / `--no-check` | false | false | ✅ |
| `--check --check=false`（重复） | true | `[true,false]` → truthy | ✅ |
| `--check=false --check`（重复） | true | `[false,true]` → truthy | ✅ |
| **`doc.mdx -- --check`** | **true** | **undefined** | ❌ 见 #B5 |

结论分三点：

1. **「复刻 cac 的强制转换」这条推理成立**，且实现忠实：所有 9 种**带值拼写**逐一吻合，
   `--check=false` 是 cac/mri 唯一认定为假的字面值（mri 的 `toVal` 对 boolean 键只特判
   `'false'` / `'true'`，其余非空值一律 `!!val` → true），出厂谓词的
   `arg.slice(8) !== "false"` 正是这条规则的最小复刻。
2. **我建议的 `.startsWith("--check=")` 会引入反向缺陷** —— 它把 `--check=false` 拉进 check 模式，
   而 cac 把它解析为 false 走预览。那会把**本来正确**的行为改坏，正是同一种「两处判定不一致」
   换了个方向。探针表里 `--check=false` 那行就是这条判断的证据。developer 的拒绝有据，我采纳。
3. **`--lang` 的类比也成立**：locale 是带语义的值、错值必须报错（`src/cli/language.mjs` 有专门校验）；
   `--check` 是纯开关、无语义可校验，把裸探测收得比 cac 还严只会制造新分歧。

**附带实测（都不是缺陷，记录备查）**：`--check=<垃圾值>`（`xyz` / `0`）会被 mri 推进位置参数，
于是走 `extraArguments` → `CliArgumentsError` → **exit 2**（退出码对，文案是「参数过多」略显偏题）；
`--check=`（空值）是一次**真实校验**，`✓` 行 + exit 0；三种拼写均自行退出，无常驻、无挂起。

**三条新回归测试极性正确**（`test/compile-check.test.mjs:243-259`）：其中
`--check=false` 那条断言 **exit 1** —— 这正是防止将来有人照我第 1 轮的建议「修」回去的守卫。
该文件因此新增了 `spawnSync` 导入并**同步更新了文件头**对「不 spawn 子进程」的自述，自述未失真。

### 2. #A3 修法 —— ✅ 解决，三块承重件都在，封闭集推理已关闭

`src/i18n/messages.mjs:65`（zh-CN）/ `:130`（en-US）双语核对：

| 承重件 | zh-CN | en-US |
|---|---|---|
| 机制表述、非裸 "import" | 「任何顶层 ESM 语句或 `{…}` 表达式在模块求值 / 渲染期失败」✅ | "any top-level ESM statement or `{...}` expression that fails at module evaluation or render time" ✅ |
| **例子≠清单**标记 | 「这些只是例子，不是清单」✅ | "These are examples, not an exhaustive list" ✅ |
| 围栏代码块惰性豁免 | 「围栏代码块里的 import 不受影响」✅ | "import inside a fenced code block is unaffected" ✅ |

spec R6 亦已改写为机制 + 举例，并新增一段「乙档不得假定 `mdxx` 能抓到」，把配对断言限定在
build-time 子集 —— 这一段是本轮最有价值的规范增量。新测试还加了
`assert.doesNotMatch(help, /\`import\`/)`（`compile-check.test.mjs:267`），比第 1 轮只有正向断言更硬。

**关于 `Notes:` 用英文标签：同意 controller，不算发现。** `Usage:` / `Arguments:` / `Options:`
在 `src/cli/output.mjs:47` 就是两个 locale 共用的硬编码英文，`mdxx` 亦然；「英文段标题 + 本地化正文」
是既有约定，单独把 `Notes:` 翻成中文反而破坏一致性。

### 3. 新场景 S20 —— ✅ 断言成立、非空洞、可被证伪；S14 未被扩展是对的

**我没有采信 fixture 的自述，而是独立验证了那个危险确实存在**：用 `@mdx-js/mdx` 的 `evaluate`
加 `react-dom/server` 真的去求值 / 渲染两份 fixture ——

```
throwing-initializer   -> THREW at module evaluation: throwing top-level initializer
throwing-expression    -> THREW at render: throwing expression
```

两篇都真的坏，一篇死在模块求值、一篇死在渲染。所以 S20 的「两条命令都退 0」钉住的是一个**真实的
双盲危险**，不是同义反复。可证伪性也成立：任一命令将来获得检出能力，这条断言就翻红并逼迫边界措辞更新
——这正是 spec 里写的那个 flip 机制。

**S14 未被扩展是正确的**：R6 现在明写「任何针对 `mdxx` 的配对断言 SHALL 限定在 build-time 子集」，
S14 的 THEN 也补上了 "for the build-time subset of tier B"。若真把 S14 扩展到求值期子集，
就会断言 `mdxx` 退 1 —— 那是**假的**（实测退 0 并产出一份会在浏览器里炸的 HTML）。

### 4. #B1 —— ✅ 解决，无附带损坏

`test/compile-check.test.mjs:13` 的 `node:fs` 导入现在只剩 `chmodSync`；`tmpdir` / `relative` /
`resolvePath` / `compile` 经核仍在使用。新增的 `spawnSync` 属 #A1 回归测试，非死导入。122/122 全绿。

### 5. #A2 —— ✅ 解决，且超出我的建议

`design.md:146` 表格里 exit 2 收敛为「无法执行校验」，`:148-149` 清单以 **「没有第五项」** 封口，
并新增 `:151-153` 一段**反向警告**，明写引擎/资产故障归 exit 1、「不要照那个旧口径把它们接到 2 去」。
反向警告是我没要求的加分项 —— 它防的正是「未来维护者照过期草稿重接」这条路径。
**代码仍跟 spec.md**：引擎故障落在 per-document 编译内部 → 该篇 `✗` → exit 1，无第三档语义。

## 本轮新发现

- [ ] 🔵 **P3 #B5** `bin/mdxv.mjs:42-44` —— `--` 终止符后的 `--check` 仍会被裸探测误判。
      实测 `mdxv --lang xx-XX -- --check` → **exit 2**，而 cac 对该 argv 给出
      `opts.check === undefined`（`--` 之后 `--check` 不再是选项），即这**不是** check 模式、
      按契约应退 1；对照组 `mdxv --lang xx-XX <file>` 确实退 1。与原 #A1 同类（预解析探针与 cac 分歧），
      只是换成 `--` 拼写。**评为 P3 而非 P2**：`--` 对 `mdxv` 无任何既定语义、从未广告；
      可观测后果仅限参数级失败路径上的 1↔2；且 `design.md:155`「`2` 只在 argv 含 `--check` 时出现」
      在字面上仍被满足（argv 确实含该 token）。**修法**（若要收）：`.some()` 之前先在第一个裸 `--`
      处截断 argv。
- [ ] 🔵 **P3 #B6** `test/compile-check.test.mjs:261-274` —— 边界文案只断言了 **en-US**。
      zh-CN 那条 `cli.checkBoundaryNote` 的三块承重件（机制 / 「不是清单」/ 围栏豁免）**无任何断言**，
      而 zh-CN 是本项目主要受众语言；既有 locale 测试只保证**键存在**、不校验内容，所以中文措辞可以
      静默漂移回封闭集写法而不翻红。**修法**：对 `formatHelp({ locale: "zh-CN" })` 补三条对应断言。
- [ ] 🔵 **P3 #B7** `test/compile-check.cli.test.mjs:385-413`（S20）—— 无守卫保证 fixture **仍然会抛**。
      两条断言都是 exit 0，故若有人把 fixture 改成一份平凡有效的文档，测试照样通过、场景**静默变空洞**。
      所需依赖仓库已全部具备（我用 `evaluate` + `renderToStaticMarkup` 约 15 行就复现了 witness）。
      **修法**：在 S20 里加一条求值期 witness 断言，把它从「非检出一个*据信*坏的文档」升级为
      「非检出一个*已证明*坏的文档」。P3：fixture 今日正确，且场景正文已写明意图。

## 第 1 轮遗留项状态

| 项 | 状态 |
|---|---|
| #A1 / #A2 / #A3 / #B1 | ✅ 本轮已解决（见上） |
| **#A4** docs-sync | **按 controller 指示不作为阻塞项结转**；publish 本轮已推迟，收尾节点归 controller。我仍保留原判断：`--check` 在两份 README 零提及、而 npm 包带着这两份 README，**卡 publish 门是对的** |
| #A5 design.md 测试文件名过期 | 仍未修，**且更旧了一点**：`design.md:36`、`:294-295` 仍写两个文件（含从未创建的 `compile-check-perf.test.mjs`），快车道那行的场景清单「S1–S11、S13–S19」也未收录 S20。P3 |
| #B2 非 parser 异常被 parser 分支误格式化 | 未动，P3 |
| #B3 空集诊断用原始 `input` | 未动，P3 |
| #B4 S9 对受版控 fixture 做 chmod | 未动，P3 |

---

## Round 2 判定

**Verdict A — Spec-compliance: HELD**（零未解决 P0/P1；R6 与 S14/S20 的规范增量核对通过，
代码仍与 `spec.md` 一致）
**Verdict B — Code-quality: HELD**（零未解决 P0/P1；本轮 3 条新发现全为 P3）

**Merge gate: HELD** —— 两判定同时成立。
**Progress**: 0 / 0 P0+P1 待解决（累计两轮：**零 P0、零 P1**；P2 中 #A1/#A2/#A3/#B1 已解决，
#A4 按 controller 决定转 publish 门）

**三条边界重申**（与第 1 轮相同，不因本轮通过而改变）

1. 本报告是 merge 决策的**一个输入**，不是决策本身；三道确定性 class gate 各自出裁决。
2. 门禁请读 **`sha256:a6b826a2904c6c11`**；合并候选 commit 生成后须核对内容未变，否则本报告失效。
3. **本报告（含本轮）不构成 post-merge audit** —— 那道门要求异族模型，且我无法自证族别。

## Round 2 open questions

无新增。第 1 轮的 OQ1（#A3 措辞）已由用户裁定并落地；OQ2（#A4 归属与卡门）已由 controller
接管为 publish 门 + 自有收尾节点，我无异议。
