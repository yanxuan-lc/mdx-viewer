## 1. 校验逻辑（src/cli/compile-check.mjs）

- [x] 1.1 先写失败测试：`describeCompileFailure` 对三种异常形状的归一
      —— 带 `line`/`column` 的 `VFileMessage`、无位置的 `VFileMessage`、裸 `Error`（S2 / S8）。
- [x] 1.2 先写失败测试：`checkDocuments` 单篇失败不中断其余、结果按输入顺序、计数正确（S3 / S9）；
      `onResult` 对每篇**恰好调用一次**、thenable 被 await、它抛出即中止整轮并归 exit 2（F12）。
- [x] 1.3 实现 `describeCompileFailure` + `checkDocuments`：**逐篇 `compile({ path, value }, mdxOptions())`**
      —— 传 `path` 是硬要求，库据此按扩展名推导 `format`（`.md` 不过 MDX 解析器）。
      **不要**用 `createProcessor()` 复用（会把 format 钉死成 `mdx`，令 `.md` 假失败 —— F1 的根因；
      且实测复用零收益）。**不要**引 `vfile`（普通对象即可，它只是传递依赖）。
      不 `console.*`、不 `process.exit`、不本地化。
- [x] 1.4 不可读文件在 `checkDocuments` 内被捕获为失败结果（带 OS reason、无位置），不向上抛（S9）。
- [x] 1.5 **负向指令（第 2 轮复审后改写，别按旧稿造东西）**：**不要**定义 `CompileEngineError`，
      **不要**给 `checkDocuments` 加可注入的 `compileDocument`。原因：方案 C 下引擎/资产故障
      **必然**落在 per-document 编译内部（`compile()` 逐次自建 processor；graphviz-wasm 在
      `rehypeDiagrams` 的 transformer 里 await；highlighter 在 rehype-pretty-code 内部创建），
      「编译之外的故障」是**空集**，那个类与接缝在生产中永不触发 —— 造出来就是死代码 + 虚假覆盖，
      且「可替换的编译函数」本身正是让校验与真实管线漂移的机制（与 R1 相悖）。
      引擎故障就作为该篇的 `✗` 行计入 exit 1，判别靠 reason 文本（同 D5 对 EACCES 的先例）。见 D7。

## 2. 呈现（src/cli/output.mjs + src/i18n/messages.mjs）

- [x] 2.1 先写失败测试：`formatCheckPath` 的 cwd 相对化与「向上逃逸则打绝对路径」分支。
- [x] 2.2 先写失败测试：`formatCheckLine` 的三种形状（`✓`、带位置 `✗`、无位置 `✗`，两空格分隔）
      与 `formatCheckSummary` 的 `<N> passed, <M> failed`；着色仅作用于 `✓`/`✗`（S1 / S2 / S8）。
- [x] 2.3 实现上述三个 formatter，复用既有私有 `colorize`；新增 `cli.*` 键的**两个** locale
      （zh-CN / en-US），键集必须对齐——`t()` 缺键会抛。
- [x] 2.4 `formatHelp` 的 mdxv 分支加 `--check` 选项行，并加一段边界说明：只验编译；**点名乙档**
      （顶层 ESM `import` / `export … from` 的 specifier 无法解析、`{…}` 里的未定义标识符会让整篇
      加载失败，本命令测不到）。措辞**不得**写成笼统的「import」—— 围栏代码块里的 import 完全正常
      （已实测：`mdxx` 退 0），不能牵连「写文档讲 JS」这个主要用法。既有 `Usage:` / `Arguments:` /
      `Options:` 三段保持不变，`cli-output` 的 S1/S2 断言不得回归（S10）。
- [x] 2.5 新增并单测 `resolveCheckColors({ stdoutIsTTY, stderrIsTTY, env })` → `{ report, diagnostic }`
      （F2）。断言 `{stdoutIsTTY:false, stderrIsTTY:true}` → `{report:false, diagnostic:true}`
      —— 即广告过的 `>report 2>err` 姿势下报告里**逐字节无 ANSI**（S11）。**不要**复用
      `bin/mdxv.mjs:24` 那个基于 stderr 的单一 `color`。
- [ ] 2.6 **（code-review #A3 追加，developer 负责）** 2.4 已按当时的 spec 正确落地；
      现按泛化后的 R6 改 `cli.checkBoundaryNote` 的**两条 locale**：乙档从「列两项」改成
      **「机制 + 举例」**（成品文案见 planner 本轮返回，zh-CN / en-US 均已给出）。
      **必须保住**「顶层 ESM 语句」措辞与围栏惰性说明（丢了就会牵连「写文档讲 JS」这个主要用法）。
      连带更新 `test/compile-check.test.mjs` 与 `test/compile-check.cli.test.mjs` 里的 help 断言。
      **不要**改 `formatHelp` 的结构（三段式不变），也**不要**动引导句（它本来就是真的）。

## 3. 接线（bin/mdxv.mjs）

- [x] 3.1 `--check` 的识别必须发生在 `resolveCliArguments`（`:27-33`）**之前** —— 此时 cac 尚未解析，
      用 `process.argv.slice(2).includes("--check")` 裸探测，与 `:34` 判 `--help` 的既有做法同源。
      目的：让 `--lang` 非法/缺值/重复这三种失败在 `--check` 下退 **2** 而非现状的 1（F3）。
      同时注册 `--check` 布尔选项（不注册的话 cac 会报 Unknown option）。
- [x] 3.2 在 `createServer` **之前**分流：文件 → 单篇；目录 → `scanTree`；
      **`demo` → 一律 `scanTree(DEMO_DIR)`，忽略 `:51-52` 给出的 `target`**
      （它与「文件输入」同形，`target ? [target] : scanTree(root)` 会静默只校验 2 篇里的 1 篇 —— F11）。
      空集 / 入参错误 → exit 2；`pickDefaultDoc` 与 `buildConfig` 在校验模式下完全不调用。
- [x] 3.3 逐篇结果经 `onResult` 回调写 **stdout**（着色用 `resolveCheckColors().report`）；
      汇总行仅在文档集 >1 篇时写 stdout；`Error:` 诊断写 **stderr**（着色用 `.diagnostic`）。
      返回的 `results` 只用于聚合计数，**不得**二次遍历打印。
- [x] 3.4 退出码：0 / 1（≥1 篇失败，含引擎故障那一类）/ 2（参数级失败、入参错误、
      直接寻址的不可读文件、空文档集、`onResult` 抛出）。
      argv **不含** `--check` 的既有路径仍退 1（`cli-output` S2 不回归）。
- [x] 3.5 **设 `process.exitCode` 后正常返回，禁止 `process.exit()`**（F5）——stdout 是管道时
      `process.exit` 会丢弃排队数据，而校验模式正是增量吐 N 行的高危形状。**落地方式**：
      整个既有顶层脚本体包进一个 `async function main()`，凡是 `checkMode===true` 的分支
      用 `process.exitCode = …; return;` 收尾；`checkMode===false` 的既有分支原样保留
      `process.exit(...)`，零行为回归。
- [x] 3.6 `--port` / `--host` / `--no-open` 在校验模式下不产生任何效果，且进程自行退出（S7）。

## 4. 测试与登记

> **文件所有权分派更新（本轮 dispatch，晚于本文件原稿）**：controller 把子进程 CLI 断言
> （原计划混在 4.2 里）与慢车道性能断言（4.4）分给了并行的 `e2e-author`，产物文件名也随之改为
> `test/compile-check.cli.test.mjs` / `test/compile-check.perf.test.mjs`（而非本文件原写的
> `test/compile-check-perf.test.mjs`）。developer（本 agent）保留：fixtures（4.1）、
> **纯函数 + 直接函数调用**的 `test/compile-check.test.mjs`（4.2 的内容层子集：S1–S5、S8–S10、
> S13、S18、S19 的内容断言 + S11 的 `resolveCheckColors` 纯函数断言，共 25 个测试）、
> `package.json` 登记（4.3，现涵盖两个文件）、`Makefile`（4.5）。S6/S7/S14/S15/S16（argv 接线 /
> 流分工 / demo 篇数）与 S12（性能）由 `test/compile-check.cli.test.mjs` /
> `test/compile-check.perf.test.mjs` 覆盖 —— 已核实二者对本次实现全绿（18/18 + 1/1）。

- [x] 4.1 建 fixtures：`test/fixtures/compile-check/` —— pass、broken-jsx（行首 `<a|b|c>`）、
      broken-dot、unreadable、tier-b（顶层不可解析 import）、fenced-import（同样的 import 但在 ```js 围栏里）；
      **甲档三项各自独立一份**（undefined-component / bad-prop / bad-math），不要捆在一份里（F8）。
      **format 双向**：同一份 broken-jsx 内容各存一份 `.md` 与 `.mdx`（S13）。
- [x] 4.2 写 `test/compile-check.test.mjs`（**快车道**）——按上方分派更新，范围收窄为纯函数 +
      直接函数调用（无子进程 spawn）：describeCompileFailure 三种异常形状、checkDocuments 的
      S1–S5/S8–S10/S13/S18/S19 内容断言、`onResult` 契约（F12：恰好一次/按序/await
      thenable/抛出即中止并 reject）、`formatCheckPath`/`formatCheckLine`/`formatCheckSummary`/
      `resolveCheckColors`（S11）纯函数断言、`formatHelp` 的 --check 边界说明断言（S10 的 help 分句）。
      子进程 CLI 层的 S6/S7/S15/S16 断言在 `test/compile-check.cli.test.mjs`（e2e-author，已核实通过）。
- [x] 4.3 把 `test/compile-check.test.mjs` **与** `test/compile-check.cli.test.mjs` 加进
      `package.json` 的 `test:unit` **显式清单**（后者由 controller 路由过来登记，因
      `package.json` 是 developer-owned 文件、e2e-author 不能自己改）；
      `test/compile-check.perf.test.mjs` 确认**不在** `test:unit` 清单内（F9）。
- [x] 4.4 —— 由 e2e-author 以 `test/compile-check.perf.test.mjs` 落地（文件名与本文件原稿的
      `test/compile-check-perf.test.mjs` 不同，见上方分派更新），developer 未创建/编辑该文件；
      已核实 `node --test test/compile-check.perf.test.mjs` 通过（check ≈0.34s vs mdxx ≈3.7s，
      ratio≈10.9×，达到 ≤1/5 判据）。
- [x] 4.5 `Makefile` 加 `check-mdx: ## 校验 MDX 能否编译：make check-mdx FILE=<file|dir>` 目标
      —— **不要叫 `check`**（GNU 惯例里 `check` = 跑测试套件，本仓库已有 `test`，会读反 —— F13）。
      把 `check-mdx` 加进 `.PHONY`（`Makefile:12`），并把 `run` 分组的 help grep
      从 `^(demo|view|export):` 改成含 `check-mdx`，否则 `make help` 列不出它。

## 5. 收口

- [x] 5.1 跑 `make test-unit` + `make test`；确认 `resolve` / `cli-output` / `mdx-pipeline` / `export`
      既有断言零回归（109/109、118/118 全绿），且 `make test-unit` 仍是「快」（~24s；已含
      `test/compile-check.cli.test.mjs` 的两次真实 `mdxx` 子进程构建，同既有
      `test/cli-language.test.mjs` 里 A3/A5 早已引入的先例一致，非本次新破例——见收口报告细节）。
- [x] 5.2 确认 `src/mdx/plugins.mjs`、`src/cli/vite-config.mjs`、`src/cli/resolve.mjs`、`bin/mdxx.mjs`
      的 diff 为空（CLAUDE.md 双端一致性硬约束）——`git diff --stat` 核实为空。
- [ ] 5.3 docs-sync：**不在 developer 文件所有权清单内**（`AGENTS.md`/`README*.md` 均未列入本次
      dispatch 的「Files you own」），未执行，留给 controller 路由给合适的节点。
