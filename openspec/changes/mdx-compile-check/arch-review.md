# 设计审查 — mdx-compile-check

**结论：❌ 先修 spec 再开工**（3 项 P0 + 1 项 blocking P1）

审查对象是 spec，不是实现。载重契约（`--check` flag 名、退出码语义、流分工）会被 `excalivibe`
的 `mdx-artifact` skill 硬编码成跨仓库契约，因此下面的 blocking 项都属于「现在改一行 spec，
上线后改不动」那一类。

整体判断：**决策骨架是对的**（capability 划分、模块边界、退出码分档、flag 形状、零改动共享管线的硬约束
都站得住，逐条见文末「已判定为健全」）。问题集中在同一个主题上：**这道门声称的能力强于它实际具备的能力**
—— 一处是编译不对齐导致门会误报（F1）、一处是流分工的未处理后果让报告不可 grep（F2）、
一处是承诺范围超出射程（F4）。而变更的全部价值恰恰建立在那句承诺上。

> findings 按**上线后修复成本**排序（非严格按严重度），每条自带 severity 与 blocking 标注。
> 三项 P0 分别是 F1 / F2 / F4。

---

## F1 · 🔴 P0 · blocking · 接口/契约（编译一致性）

**`.md` 文件的 `format` 不对齐 —— 门会假失败，且正是 BRIEF 触发案例的形状**

位置：`specs/compile-check/spec.md:5-9`

> "using the same `mdxOptions()` compile options that `src/cli/vite-config.mjs` hands to
> `@mdx-js/rollup`, so a document that passes the check is guaranteed to be openable"

配合 `design.md:199-210`（D1，选定 `createProcessor(mdxOptions())`）与 `tasks.md:6-8`（1.3）。

**问题。** 真实管线不是「`mdxOptions()` 直接进编译器」：

- `src/cli/vite-config.mjs:65` → `mdx(mdxOptions())` → `@mdx-js/rollup` 的 `config()` 钩子
  → `createFormatAwareProcessors({ SourceMapGenerator, development: env.mode === 'development', ...rest })`
- 该函数**逐文件**用 `resolveFileAndOptions` 从扩展名推导 `format`：`.md` → `'md'`，`.mdx` → `'mdx'`
- `@mdx-js/mdx` 的 `core.js` 里：`if (settings.format !== 'md') pipeline.use(remarkMdx)`
  —— 即 **`.md` 文件根本不过 MDX 解析器**

spec 选定的 `createProcessor(mdxOptions())` 里 `mdxOptions()` 不含 `format`，默认 `'mdx'`，
对**每一篇**都按 MDX 解析，包括 `.md`。

**实测（本机 2026-07-27，同一份 `mdxOptions()`，对比 `createProcessor` 与 `createFormatAwareProcessors`）：**

| 文档内容 | 扩展名 | 本 spec 的校验 | 真实管线 | 判定 |
|---|---|---|---|---|
| 行首 `<global\|tenant\|workspace>` | `.md` | FAIL `Unexpected character \`\|\` …` | **OK** | **假失败** |
| `A <not_a_tag> here` | `.md` | FAIL `Expected a closing tag …` | **OK** | **假失败** |
| 同上两例 | `.mdx` | FAIL | FAIL | 一致 |

**为什么这条最贵。** `Requirement: Document-set resolution`（`spec.md:36-38`）明确把 `.md` 收进文档集，
而 `scanTree` 的 `INDEX_NAMES` 本身就含 `README.md` —— 「目录里有普通 `.md`」是**默认情况**，不是边缘情况。
后果是消费方拒发一份完全正常的产物；更糟的是这种失败会教会调用方忽略这道门。
注意这恰好是 BRIEF 触发案例的同一模式：那份文档若是 `.md`，本门会报一个预览根本不存在的错。

**建议修订。**
1. 在 `Compile-parity checking` 里写明：校验 SHALL 按文档扩展名推导 `format`，与 `@mdx-js/rollup`
   的推导规则一致。实现路径二选一（建议方案 B，理由是耦合面）：
   - A：改用 `@mdx-js/mdx/internal-create-format-aware-processors` 的 `createFormatAwareProcessors`
     —— 与 rollup 插件同一入口，天然对齐，且它内部也是「每种 format 缓存一个 processor」，
     顺带满足「processor 建一次」。代价：依赖一个 `internal-*` 子路径导出。
   - B：自建两个 `createProcessor`（`format: 'md'` / `format: 'mdx'`），按扩展名分派。
     代价：需要自己维护 md 扩展名判定；但只覆盖 `scanTree` 认的 `.md`/`.mdx`，判定面很小，
     且不依赖非公开入口。
2. 顺手改掉 "the same `mdxOptions()` compile options" 这句 —— 它字面不成立：rollup 包装层还注入
   `SourceMapGenerator`、并从 Vite mode 推导 `development`（`mdxv` dev → `true`，`mdxx` build → `false`，
   两条既有路径本来就不一致）。spec 应把**刻意不对齐的旋钮列出来**（`SourceMapGenerator`、
   `development` 与 pass/fail 无关，`format` 必须对齐），而不是笼统说"same options"。
3. 补场景：**S13** —— 一份 `.md` 文档，行首为 `<a|b|c>`，`--check` 报**通过**（因为预览接受它）；
   同一内容改名为 `.mdx` 则报失败。这一条同时把两个方向都钉住。

---

## F2 · 🔴 P0 · blocking · 接口/契约（D3 的未处理后果）

**报告改走 stdout 之后，着色判定仍看 stderr —— 报告里会混入 ANSI，消费方 grep 直接失效**

位置：`bin/mdxv.mjs:24`

```js
const color = isColorEnabled({ isTTY: process.stderr.isTTY, env: process.env });
```

对照 `design.md:148`（D3 广告的消费姿势）与 `specs/compile-check/spec.md:128-131`（S11）。

**问题。** D3 把报告挪到 **stdout**，但整个 CLI 的 `color` 只有这一处来源，判定依据是 **stderr** 的 TTY 属性。
于是 design 自己推荐的那条调用：

```
mdxv --check docs/ >report 2>err
```

stdout 是文件、**stderr 仍是终端** → `color === true` → 写进 `report` 的是
`[32m✓[0m` 而不是 `✓`。而 `design.md:166` 明写消费方靠 grep 前缀命中 —— 它 grep 的是一条带色流。

S11 只说 "neither output contains an ANSI sequence when the stream is not a TTY"，
**没说哪条流说话**；也没有任何要求规定着色判定必须按「该片段实际写入的流」重算。
`tasks.md:14-17`（2.2）/`tasks.md:27-28`（3.3）都没有拦这一步 —— 实现者复用现成的 `color`
（最自然的写法）就会带着这个 bug 上线。

**为什么这条贵。** 消费方会用一条 ANSI 剥离正则绕过去，那条正则随后就成了跨仓库契约的一部分，
以后想去掉着色反而变成 breaking change。

**建议修订。** 在 `Localized check presentation` 里补一句：校验模式下着色 SHALL 按每个片段实际写入的流
分别判定 —— 报告行与汇总行按 `process.stdout.isTTY`，`Error:` 诊断按 `process.stderr.isTTY`。
并把 S11 收紧成断言那条被广告的调用本身：stdout 重定向到文件、stderr 为 TTY 时，报告逐字节无 ANSI。

---

## F3 · 🟠 P1 · blocking · 接口/契约（退出码）

**用法错误退 2 的契约在 `--lang` 边界上漏掉，实际退 1 —— 正是 D2 要消灭的那种混淆**

位置：`bin/mdxv.mjs:27-33` vs `specs/compile-check/spec.md:76-81` + S6（`spec.md:84-88`）

**问题。** `resolveCliArguments` 跑在**任何 `--check` 感知之前**，它的 catch 是 `process.exit(1)`。所以：

- `mdxv --check doc.mdx --lang bogus`（非法值）
- `mdxv --check doc.mdx --lang`（缺值）
- `--lang` 给两次

三者都退 **1**。消费方按契约读成「文档破了」，于是让用户去改文档 —— 而错的是调用方。
这正是 D2（`design.md:216`）存在的理由：*"消费方分不清「文档破了」和「我调用错了」"*。

`Exit-code and stream contract` 说 usage error → 2，S6 枚举了缺路径 / 不存在 / 非 MDX / 空目录 / 未知选项，
**唯独没有 `--lang` 的三种失败**。spec 与既有接线在此互相矛盾。

**建议修订。** 在退出码要求里写明：argv 含 `--check` 时，**一切参数级失败（含 `--lang` 非法/缺值/重复）**
退 2；把这三种 WHEN 补进 S6。并在 tasks 里注明：`--check` 的识别必须发生在 `resolveCliArguments`
边界**之前**（此时 cac 尚未解析，只能用 `process.argv.slice(2).includes("--check")` 这类裸探测，
与 `bin/mdxv.mjs:34` 判 `--help` 的既有做法同源）。

---

## F4 · 🔴 P0 · blocking · 接口/契约（承诺范围）

**「通过 = 一定能打开」是过强承诺：编译之后的阶段全在校验之外（端到端实测确认假通过）**

位置：`specs/compile-check/spec.md:5-9`（"guaranteed to be openable by the preview and export paths"）
与 `spec.md:103-108`（`Documented boundary against over-trust`）

**实测证据**（我的探针 + 控制器独立探针，结论一致，控制器那侧还补上了端到端的一环）：

| 文档内容 | `--check`（compile 阶段） | 真实路径 |
|---|---|---|
| `import Thing from "./does-not-exist.js"` + `<Thing />` | **通过** | `node bin/mdxx.mjs … ; echo $?` → **1** |
| `import x from "no-such-package-xyz"` + `{x}` | **通过** | Vite 解析失败 |
| `{someUndefinedIdentifier}` | **通过** | 渲染期 ReferenceError |

模块解析发生在 **Vite bundle / dev-server** 阶段，不在 MDX compile 阶段；裸标识符表达式则要到
**渲染期**才求值。两者都在 `--check` 的射程之外，而两者都会让**整篇文档加载失败**
—— 正是本变更存在的理由那个失败模式。所以 `guaranteed to be openable` 字面不成立。

**我为什么把它定为 P0（而非仅仅是措辞问题）。** 这不只是 spec 用词：
`Requirement: Documented boundary against over-trust` 是 **help 文案的来源**，
而 S10（`spec.md:110-117`）把「help 里必须有这段边界说明」写成了可断言的交付物。
清单里缺了这一类，**实现者照 spec 写出来的 help 就是错的**，并且随发行物一起出厂。
再加上这句承诺正是跨仓库消费方据以决定「可以交付了」的依据 —— 它有直接的实现产物，
不是可以推到 docs 轮次的措辞打磨。

### 回答控制器的问题 1：承诺能收紧到多紧、且仍然为真

关键是承认这道门是**单向可靠**的，并把这件事写成优点而不是含糊掉：

- **失败 ⇒ 一定打不开**（sound）。
- **通过 ⇒ 编译期无错**（necessary but not sufficient）。

可断言的最紧措辞，大意如下（交给 planner 润色）：

> 校验失败的文档一定无法被预览或导出路径渲染。校验通过的文档在本项目插件集下无 markdown/MDX
> 编译错误 —— 语法可解析、frontmatter 合法、`dot`/`graphviz` 围栏可成图。通过**不**表示文档能加载：
> 模块 specifier 由 Vite 在编译之后解析，JSX 标识符与 `{…}` 表达式在渲染期求值；
> 这些残余途径由边界要求穷举。

两点值得注意：

1. 「`dot` 围栏可成图」是**真实且不小的**保证 —— `rehypeDiagrams` 在编译期就把 dot 源喂给
   graphviz-wasm，坏图确实被挡（design 的三种异常形状表里已实测到）。收紧措辞时别把这条一起丢掉。
2. **「失败 ⇒ 一定打不开」这个 sound 方向依赖 F6 被修好。** 若引擎/资产加载失败仍归到 exit 1
   （现状），那么 exit 1 就不再唯一意味着「文档破了」，这条唯一还站得住的保证也会被污染。
   F4 与 F6 应当一起落地。

### 回答控制器的问题 2：import 解析失败该不该进非检出清单

**该进，但不能只是追加第四个 bullet。** 控制器的观察是对的，而且它应当改变这段要求的**结构**：
现有三项（未定义组件、非法属性值、坏公式）同属「**页面能打开，只是不对**」；
新增的两项属于「**页面根本打不开**」。对调用方而言这是两个不同的严重性档位，
混在一句 "compile cleanly and are therefore NOT detected" 里，最要紧的那一类会被埋掉。

建议把边界要求分成两档：

- **甲档（能渲染，但不对）**：未定义组件（运行时有清晰报错）、非法属性值（静默失效）、坏公式（KaTeX 渲染错误节点）。
- **乙档（整篇加载失败）**：无法解析的模块 specifier（`import` / `export … from`）、
  `{…}` 里的未定义标识符。

help 的边界说明必须**点名乙档**，因为乙档才是会击穿「过了就能交付」这个用法的那一类。

**补场景（建议 S14）**：用控制器那对断言的**配对**形式 —— 同一份含不可解析 import 的文档，
`mdxv --check` 退 0，而 `mdxx <同一文档> <tmp>` 退 1。配对断言才能把这项非检出变成
**登记在册、且有回归保护的刻意边界**；将来若把门做宽（OQ1 方案乙），这条场景会翻转并强制更新 spec。
单侧只断「check 退 0」做不到这一点。

### 对真实消费方的影响评估：比「近乎零」要高

控制器的先验是对的方向（`mdx-artifact` 的文档靠 `providerImportSource: "@mdx-js/react"`
从 `MDXProvider` 取组件，其指引从不写 `import`），但我认为频率**不是近乎零**，有一处具体的抬升项：

- `lucide-react` 是本项目依赖，并且被 app 自己的组件用着（`src/app/main.tsx`、`Layout.tsx`、
  `components/blocks.tsx`）—— 但它**不在** `RESOLVE_ALIAS` 里（`src/cli/vite-config.mjs:36-40`
  只别名了 `react` / `react-dom` / `@mdx-js/react`）。
- 于是一份**位于包目录树之外**的文档若写下 `import { Check } from "lucide-react"`，
  编译通过、`--check` 放行、Vite 解析失败 → 500。
- 而「LLM 生成的 MDX 自发冒出 `import`」恰恰是高先验事件：想放个图标/图表时补一行 import
  是从 MDX/React 文档语料里学来的强习惯。也就是说，**最可能触发这一类的正是 agent 产的文档**
  —— 本变更服务的那个人群。

综合判断：**频率低到中等，爆炸半径是整篇（100%），而调用方发现它的方式正是「交付了一个 500 的 URL」**
—— 与触发本变更的那次事故一模一样。所以即便按控制器较低的频率估计，也不该保留一句兑现不了的承诺：
这句承诺就是本变更的核心卖点，它出错的方式恰好是它本该防住的那种。

> spec 侧修法明确（收紧措辞 + 两档边界 + S14）。但**是否顺手把门做宽**（让 `--check` 也解析
> 相对 import 与本地文档链接，从而消灭乙档的第一项）是范围决策，见文末 OQ1。

---

## F5 · 🟠 P1 · non-blocking · 接口/契约（输出完整性）

**报告写 stdout 后紧跟 `process.exit()`：管道下会截断**

位置：`bin/mdxv.mjs:59-60 / 95-104 / 119-120` 的既有模式，配合 `design.md:88-94`（`onResult` 边算边打印）

**问题。** stdout 是**管道**时（`mdxv --check docs/ | tee log`），Node 的写入是异步的，
`process.exit` 会丢弃排队数据。校验模式通过 `onResult` 增量吐 N 行，**长目录正是高危形状**。
（重定向到文件时 POSIX 下是同步写，风险低；管道不是。）

没有任何要求覆盖「输出完整性」。而「退出码正确 + 报告被截断」对一道门是最坏形状：
消费方看到 exit 1，却拿到一份不完整的破损清单。

**建议修订。** 在退出码/流要求里写明：校验模式 SHALL 设置 `process.exitCode` 并正常返回（让 Node 自行冲刷），
不调用 `process.exit()`。补场景：把一个 ≥20 篇目录的报告经管道传出，断言恰好每篇一行 + 汇总行。

---

## F6 · 🟡 P2 · non-blocking · 接口/契约（失败归属）

**整轮内部故障没有退出码归属，会伪装成「所有文档都破了」**

位置：`specs/compile-check/spec.md:76-81`（三档退出码）与 `design.md:237-240`（D5）

**问题。** 校验会在编译期把文档内容喂给 graphviz wasm（`src/mdx/diagrams.mjs` 的 `getGraphviz()`）
与 shiki 语法（`rehype-pretty-code`）。若 wasm/语法加载失败（离线、装坏、OOM），
`processor.process()` 会**逐篇** reject → 按 D5 的规则统统计入 `failed` → 退 1，
reason 与文档本身毫无关系。

三档退出码里没有「工具自己跑不起来」这一格。语义上它就是 2（"无法执行校验"），
要求正文（`spec.md:76-78`）概念上已经覆盖，但没有任何要求把它**路由**到 2。

**建议修订。** 写明：不可归因于单篇文档内容的失败（processor 构建失败、引擎/资产加载失败）退 **2** 而非 1。
现在一句话，上线后就是一条永久性误诊通道。

> **与 F4 联动**：F4 收紧后唯一还站得住的强保证是「**失败 ⇒ 一定打不开**」。若引擎故障仍归 exit 1，
> 这条保证就被污染了（exit 1 不再唯一意味着文档破了）。两条应当一起落地，否则 F4 的新措辞也不为真。

---

## F7 · 🟡 P2 · non-blocking · 接口/契约（对称性成文）

**单文件不可读 vs 目录内不可读，退出码不同且未成文**

位置：`src/cli/resolve.mjs:34-38`（`accessSync` → `INPUT_NOT_FOUND`）vs S9（`spec.md:68-72`）+ D5

`resolveInput` 对直接给的文件做 `accessSync`，不可读即抛 → 校验模式下退 **2**。
同样的物理状况若发生在被扫描目录**内部**，按 D5/S9 退 **1**。

这个分叉其实是对的（D5 的理由「其余文档确实被校验了」对单文件输入不成立），但**没写下来**，
且 S9 只覆盖目录内一种。建议在退出码要求里补一句、在 S6 补一条 WHEN（直接寻址的不可读文件 → 2），
并交叉引用 D5，让这个不对称读起来是刻意的。

---

## F8 · 🟡 P2 · non-blocking · 验收标准质量

**S10 把三种非检出捆在一份文档、一个断言里**

位置：`specs/compile-check/spec.md:110-117`

一份文档同时带 `<Foo bar="x" />` + `<Callout tone="nope">` + `$\frac{1}{$`，断言一个 exit 0。

三项彼此独立的边界主张挤在一个断言上：任一项真的报错（坏公式最可疑 —— `$…$` 的 tokenize
与 MDX 表达式 `{` 的优先级并非显然），场景失败但**看不出是哪一项退化了**。
而"exits 0"对三项主张而言是最弱的证据形式。

**建议修订。** 拆成三条场景（或一条场景内三份独立断言的 fixture），每条对应边界要求里的一项非检出，
让每项边界主张可被单独钉住。同一个修法也让边界要求的清单变成逐项可验的。

---

## F9 · 🟡 P2 · non-blocking · 验收标准质量

**性能要求的绝对秒数与 tasks 的相对断言互相矛盾**

位置：`specs/compile-check/spec.md:134-146`（S12 断言 ≤1.0 s / ≤1.5 s）vs `tasks.md:43-44`（4.5
明确说**只**断相对 ≥5×，"避免机器差异导致 flaky"）

两者必须让一个。按现状，spec 的验收面是机器相关的；而且 S12 还把一整轮 `mdxx` Vite 构建
（约 3.8 s，并写临时 HTML）拖进了 `AGENTS.md:121-127` 描述的「快单测车道」。

**建议修订。** 绝对秒数降级为**记录在册的基线/预算（不作断言）**，被断言的判据是相对倍数；
并明确 S12 属于哪条测试车道 —— 它该和 `test/export.test.mjs` 一起待在慢车道，
否则 `make test-unit` 会静默变成一条 5 秒命令。

---

## F10 · 🟡 P2 · non-blocking · 验收标准质量

**「processor 建一次」是一条不可观测的 SHALL**

位置：`specs/compile-check/spec.md:7-8` —— "SHALL build the compile processor once per run"

S1–S12 没有任何一条能观测它；这是实现技巧，其唯一用户可见后果（首篇暖机被摊薄）
已由性能要求覆盖。建议：要么从规范正文移除、留在 `design.md` D1 该待的地方；
要么改写成可观测形式（≥4 篇文档集上，边际单篇成本低于首篇成本）。

---

## F11 · 🟡 P2 · non-blocking · 模块边界

**`demo` 的 target 与 file 的 target 同形 —— `--check demo` 可能只校验 1/2 篇**

位置：`bin/mdxv.mjs:51-52` vs `src/cli/resolve.mjs:41` vs `spec.md:36-38` + S4（`spec.md:48-51`）

`bin/mdxv.mjs` 给 `demo` 返回的是 `{ root: DEMO_DIR, target: resolve(DEMO_DIR, "index.mdx") }`
—— 与 `resolveInput` 对**文件**输入返回的形状**完全一样**。而 spec 要求两者反向处理：
文件 → 恰好该篇；`demo` → 随包 demo 目录的**每一篇**（实际有 `index.mdx` + `index.zh-CN.mdx` 两篇）。

实现者写下最自然的 `target ? [target] : scanTree(root)`，`--check demo` 就静默只校验
`demo/index.mdx`，漏掉 `index.zh-CN.mdx` —— 「自检发行物」这条能力只覆盖了发行物的一半，
而 S4 没有钉住篇数，测试也照样绿。这是典型的「门看起来过了，其实没测到」形状。

**建议修订。** S4（或新增场景）断言 `mdxv --check demo` 恰好报告 **2** 篇并点名两者；
`tasks.md:25-26`（3.2）写明 `demo` 忽略 target、一律走 `scanTree`。

---

## F12 · 🔵 P3 · non-blocking · 模块边界

**`onResult` 的契约缺口：双通道输出可能重复打印或顺序错乱**

位置：`design.md:88-94`

`checkDocuments` 既返回 `{results, passed, failed}` 又通过 `onResult` 流式吐结果。
没说 `onResult` 返回 promise 时是否被 await、它抛异常怎么办、以及调用方**不得**同时遍历 `results` 再打印一遍。
成本极低，但这是模块边界唯一可能漏出顺序/重复 bug 的地方。

**建议修订。** 在公开面说明里补一句：`onResult` 按输入顺序对每篇恰好调用一次、thenable 则 await、
它抛出即中止整轮并退 2（工具故障，见 F6）；返回的 `results` 只用于聚合，永不二次打印。

---

## F13 · ⚪ 建议 · non-blocking · 范围与风险

**`make check` 与 GNU 惯例冲突；`.PHONY` 未登记**

- GNU 标准目标里 `check` 就是「跑测试套件」，而本仓库已经有 `test`。`make check FILE=…`
  表示「校验一份 MDX 能否编译」对项目外的人会读反。考虑 `check-mdx` / `verify`。
- `tasks.md:41-43`（4.4）改了 `run` 分组的 help grep，但**没把 `check` 加进 `.PHONY`**
  （`Makefile:12`）—— 若仓库里出现名为 `check` 的文件或目录，目标会被遮蔽。

---

## 已判定为健全（不制造问题）

以下各项逐条查证过，没有发现缺陷，记录在此以免下一轮重复审：

- **flag 形状 `--check` 挂在默认命令上：判定正确。** 改成 `check` 子命令会与本 CLI 既有的
  位置参数惯例冲突（`bin/mdxv.mjs:51` 的 `demo` 就是一个魔法位置参数），并且会遮蔽真实存在的
  名为 `check` 的目录。加法式布尔 flag 是风险更低、也更经得起被硬编码的形状。
  一个长期提示：既然 D6 排除了 `--json`，建议把 `--check-*` 预留为将来所有 check 专属选项的前缀，
  这样 flag 命名空间能扩展而不用再谈一次跨仓库契约。
- **三档退出码 0/1/2：粒度正确。** 与 grep/diff/lint 惯例一致，D2 的「修文档 vs 修调用」
  正是消费方真正要做的那个分支判断。（F6 只是问第四种情况归到哪一格。）
- **`--port`/`--host`/`--no-open` 接受但忽略：在本设计里不是陷阱。** `ARGS=` 透传习惯
  （`Makefile:9`）恰恰是「报错」会打断的东西；不起服务这件事有可机检的不变量（零端口 bind、
  进程自退，S7 已钉）；未注册选项仍退 2，所以拼写错依然被拦。控制器设想的失败模式
  「脚本里 `ARGS=--port 5000` 却静默拿不到服务」需要有人主动往预览调用里加 `--check`，那是刻意动作。
- **模块边界：分解正确、无隐藏耦合。** `compile-check.mjs` 被禁止碰流/进程/locale/格式化，
  `output.mjs` 被禁止碰 fs/编译，两个共享文件被钉在「diff 为空」这个可机检不变量上
  （`design.md:251-254`）。`describeCompileFailure` 作为对三种**实测**异常形状的纯函数归一，
  是正确的接缝，且可直接单测 —— 这是本设计里做得最好的一处。
- **删除安全性：本变更零删除。** `plugins.mjs` / `vite-config.mjs` / `resolve.mjs` / `bin/mdxx.mjs`
  钉零 diff，是 CLAUDE.md 双端一致硬约束的正确表达方式。
- **对既有两条路径的回归风险：查过，干净。** 往 `formatHelp` 的选项表加 `--check` 不会改变
  `formatRows` 算出的对齐宽度（最长标签仍是 `--lang <locale>` 的 15 字符），既有 `cli-output`
  对其他行的断言不受影响；`parsed.args.slice(1)` 的多余参数处理、`demo` 特例、
  `--help`/`--version` 早退路径都不受「新增一个布尔选项」影响。
- **本地化文档族：覆盖方向是安全的那一侧。** `scanTree` 里的 `parseLocalizedDocuments` 只**追加**
  元数据，不像 `buildLocalizedNavigation` 那样按族去重 —— 所以校验覆盖每一个物理文件
  （含 `.zh-CN.mdx` 变体），比预览导航里出现的更多。（对应地，F11 是这条的例外，需要钉住。）
- **术语一致性（glossary-conformance）：** 结果对象复用 `scanTree` 的 `abs`，`format*`/`is*`
  前缀沿用既有 CLI 模块惯例。一条未登记术语（「编译校验 / compile check」）已正确路由到
  docs-sync（`tasks.md:52-53`）。**仅命名漂移检查，不构成设计正确性的任何 credit。**
- **中间件/监控面：正确判定为不适用。** 无后端服务、不读配置中心、无需 `/healthz`·`/metrics`
  —— 单命令 CLI 的可观测面就是报告行 + 退出码。
- **数据模型：不适用。** 本项目无数据库、无 DDL、无迁移；`--check` 零文件写入本身被写成了
  可机检要求，这一处处理得当。

---

## 待用户决策的开放问题

**OQ1 · `--check` 是否要把门做宽到「模块 specifier 可解析」？**

F4 已由两侧独立探针确认：不可解析的 `import` 会**假通过**（`--check` 退 0，`mdxx` 同文档退 1）。
spec 侧最小修法是「收紧承诺 + 两档边界 + S14」（我已按此给出建议，那部分不需要用户拍板）。
需要 owner 拍的是范围：

- **方案 甲（保持 compile-only，只收紧措辞）**：成本最低，与 D6「不做投机扩展」一致，
  本轮范围不变。代价：乙档第一项仍是一个真实的漏放通道，消费方需自己承担。
- **方案 乙（把门做宽）**：额外校验文档里的相对 specifier 与本地文档链接是否存在于磁盘。
  消灭乙档第一项，更贴近「过了就能交付」的原始动机。代价：`--check` 从「纯编译校验」变成
  「编译 + 解析校验」，边界要重新划；且裸包名（`lucide-react` 这类）要判到「能否被 Vite 解析」
  就得复刻 `RESOLVE_ALIAS` 的逻辑，等于把 `vite-config.mjs` 的解析语义复制一份到 CLI 侧
  —— 与 CLAUDE.md「双端一致」的初衷相悖（复制品会漂移）。相对路径那一半则很便宜（`existsSync`）。

**我的倾向：甲，但把乙拆细。** 完整的乙（含裸包名）我不建议 —— 它引入的复制耦合正是这个仓库
一直小心避免的东西。而乙里**只做相对 specifier 存在性检查**这一半，成本接近于零、无复制耦合、
且能挡住「LLM 写了 `./chart.jsx` 但没生成那个文件」这类最常见形状。裸包名那一半留给边界文档。

不过这仍取决于 `mdx-artifact` 到底要这道门挡住多少 —— 属于 owner 对「门的强度 vs 变更范围」的取舍，
我不替他定。若选甲，本轮零实现代价；若选「半个乙」，需要给 spec 加一条要求 + 一条场景。

---

## 复审提示

下一轮只需核对四项 blocking（**F1 format 对齐 · F2 着色按流判定 · F3 `--lang` 退 2 · F4 承诺收紧 + 两档边界**）
是否落地，外加两条与之绑定的：**F6**（引擎故障退 2 —— 否则 F4 的新措辞不为真）与
**F11**（`--check demo` 篇数断言）。其余项若 spec 未在别处发生实质变动，不必重跑全量审查。

---
---

# 第二轮复审（2026-07-28 · 定向）

审查范围：第一轮点名的六项 + 三处刻意偏离 + F9/F13 是否引入新问题。
第一轮已记为「已判定为健全」的部分不重开。spec 现 8 requirements / 19 scenarios，
`REVIEW.mdx` stamp `d9ad1f50eac1`。

## 结论：✅ GO —— 可以开始实施

四项 blocking 全部落地且落得对。三处偏离**全部接受**，其中两处严格优于我原本的建议。
另有一项**新发现**（F1 与 F6 两个处置之间的相互作用，见下）—— 它不阻塞实施，
但必须在 D7/S17 里如实记下来，否则会留下一处虚假的覆盖感。

## 六项逐条核对

| # | 状态 | 依据 |
|---|---|---|
| **F1** format 对齐 | ✅ 已解决 | R1「SHALL derive each document's `format` from its file extension exactly as `@mdx-js/rollup` does」+ 明列 `SourceMapGenerator`/`development` 为刻意不对齐 + **S13** 双向断言（同一份内容 `.md` 退 0 / `.mdx` 退 1）。tasks 1.3 把「不要用 `createProcessor()` 复用」写成了带根因的负向指令 —— 这是防复发的正确写法。 |
| **F2** 按流着色 | ✅ 已解决（形式优于建议） | R7 + `resolveCheckColors` 命名导出 + S11。见下「偏离 2」，附一处**验证**残留。 |
| **F3** `--lang` 退 2 | ✅ 已解决 | R4 明写「including an invalid, valueless, or repeated `--lang`, which the existing argument boundary resolves before any `--check` awareness」—— 连**为什么**容易漏都写进了规范。tasks 3.1 指定裸 argv 探测且必须早于 `:27-33`。 |
| **F4** 承诺收紧 + 两档 | ✅ 已解决（超出建议） | R1 的单向措辞完整保留了我要求的三点，含「`dot`/`graphviz` fences really do render through graphviz-wasm」这条不该丢的真保证。R6 两档 + help 点名乙档 + **S14** 配对断言。**planner 还加了一条我没想到的**：乙档必须措辞为 *top-level ESM statement*，因为围栏代码块里的 `import` 完全正常，「写文档讲 JS」是主要用法 —— S14 用第二份文档把这件事一起钉住。这是对我 finding 的真实改进，不是照抄。 |
| **F6** 引擎故障退 2 | ⚠️ **部分解决** | 规范文本在（R4 + S17 + D7），但被 F1 的处置抽空了实际触发面。见下「新发现」。**不阻塞**：F4 的保证仍为真（理由也在下面），但覆盖感是虚的。 |
| **F11** `demo` 篇数 | ✅ 已解决 | R2 明写 `demo` 必须忽略 `target` 并说明原因（与单文件输入同形）+ **S16** 断言恰好 2 篇并点名两者。 |

## 三处偏离的裁定

### 偏离 1 · F1 走方案 C（逐篇 `compile({path, value})`）· **接受，优于我的 A/B**

我提的 A（`internal-*` 子路径）和 B（自建扩展名映射）各有真实代价，planner 找到的 C 两个都避开了：
纯公开 API，format 由库从 `path` 推导，零复制。`compile()` 内部就是 `resolveFileAndOptions` +
`createProcessor` —— 与 rollup 侧同一套推导，这正是我要的对齐,而且是**结构性**对齐而非复制品对齐。
选 C 明显比我的两个建议都好。

**我独立复核了那条支撑性测量**（这是唯一支撑「丢掉 build-once 无代价」的事实，控制器只验了行为正确性），
10 篇含 frontmatter/GFM/math/js 围栏/dot 围栏的文档，同进程：

| 方式 | 首篇 | 边际均值 | 边际最大 | 10 篇合计 |
|---|---|---|---|---|
| A 逐篇 `compile()` | 125.3 ms | **3.7 ms** | 5.2 ms | 158 ms |
| B 复用 processor | 4.8 ms | **2.1 ms** | 2.7 ms | 24 ms |
| C 逐篇 `createProcessor` | 2.0 ms | 2.0 ms | 2.5 ms | 20 ms |

（B/C 跑在 A 之后，故已继承热缓存，首篇数字不可横比；边际值可比。）

**planner 的推理成立，且我的复核比它的原始数字更严格地支持它**：暖机（125 ms）确实在**模块级**缓存里
—— B、C 在同进程内紧随 A 就从 ~5 ms / ~2 ms 起步，证明 graphviz promise 与 shiki highlighter
与 processor 对象无关。processor 构建本身约 **2 ms**（C 与 B 的边际几乎相等即为证）。
所以逐篇重建的真实代价是 **~1.6 ms/篇**，外推 50 篇约 80 ms —— 相对 125 ms 一次性暖机与
「≥5× 快过 `mdxx`」的要求都是噪声。**「建一次」确实既无收益、又是 F1 的唯一根因**，
连带 F10 那条不可观测的 SHALL 自然消失，比我建议的「改写成可观测形式」干净。

我第一轮担心的扩展性也**不成立**：A 的逐篇耗时 5.2→4.3→…→3.0 ms 是**平的甚至下降**，
没有累积泄漏。

> ⚪ 唯一残留（与 F9 相关，非阻塞）：R8 现在只断**单篇**的相对倍数，4 篇预算降级为记录值，
> 于是**没有任何断言覆盖边际成本**。若将来有人无意改成「每篇新建 highlighter」，
> 单篇比值仍然通过，而 50 篇目录会从 0.3 s 掉到数秒。建议把记录预算里补一个**边际成本**数字
> （本机实测 ≈4 ms/篇），让 perf-gate 有可比的基线。

### 偏离 2 · F2 提升为纯函数 `resolveCheckColors` · **接受，优于我的建议**

判断：**纯函数是正确的接缝**。它与仓库既有的 `isColorEnabled({isTTY, env})`（`output.mjs:8`，
已被 `cli-output.test.mjs` 单测）是同一个模式，是这个仓库处理「环境判定」的既定做法；
把它扩成双流版本是顺着纹理走，且让 `compile-check.mjs` 依然不碰流。

planner 的理由也对，而且比我的散文建议更实在：散文管不住「复用现成 `color`」这条最省事的路径，
而一个带 shape 断言的命名导出可以。**这一处 planner 是对的，我原来的建议偏弱。**

**S11 的 shape 断言保护了什么、没保护什么（如实记录）：**

- ✅ 它钉住了**判定逻辑**：`{stdoutIsTTY:false, stderrIsTTY:true}` → `{report:false, diagnostic:true}`，
  正是我第一轮指出的那个危险组合。
- ❌ 它**不能**证明 `bin/mdxv.mjs` 真的把 `.report` 用在报告行、`.diagnostic` 用在 `Error:` 行。
  实现者可以写出完美的 `resolveCheckColors`、通过 S11，仍然用旧的进程级 `color` 给 `✓`/`✗` 上色。
- ❌ **子进程测试也抓不到这个**：`spawnSync` 下 stdout 与 stderr **都是管道**，
  新旧两种写法都产出无 ANSI 的输出，二者不可区分。而唯一能暴露它的环境（stdout 管道 + stderr TTY）
  需要 pty —— 本仓库零第三方测试依赖，起不了 pty。

结论：这是**验证**缺口，不是设计缺陷；tasks 3.3 已用「着色用 `resolveCheckColors().report` /
`.diagnostic`」明确钉住接线。可行的闭合方式只有人眼。
→ **建议把这一条作为显式条目交给 code-review**：读 `bin/mdxv.mjs` 的两处 `colorize` 调用，
确认取的是对应流的那个字段。不建议为此引 pty 依赖，也不建议为此把 check 接线从 `bin/` 抽成可导入模块
（收益不抵结构改动）。

### 偏离 3 · F6 只路由「可确定分辨」的那一类 · **接受 narrowing 本身，但它被偏离 1 抽空了**

先说 planner 做对的两点：

1. **拒绝「全篇同因失败即判工具故障」启发式是对的**，而且理由比 D7 写的更强：这种启发式在
   **不安全的方向**上出错 —— 它把一个真实的「整个目录都坏了」翻译成 exit 2（「你调用错了」），
   而把 2 当作「重试/与我无关」处理的消费方会**静默放行一批真破损文档**。拒绝得对。
2. 把分辨极限**如实记进 D7** 而不是粉饰，是正确的工程诚实。

**但我要修正我自己第一轮的推理，并指出一处新问题。**

**先修正我的**：我第一轮说「若引擎故障仍归 exit 1，F4 的保证连同新措辞一起变成假的」——
这句**过强**。校验与真实管线**共用同一个引擎模块**（`plugins.mjs` 是 view 与 export 共用的，
正是 CLAUDE.md 那条硬约束）。所以 graphviz-wasm 在本机装坏时，`mdxv` 预览与 `mdxx` 导出
**在同一台机上也编译不出这篇** —— 文档确实打不开。
**F4 的保证「失败 ⇒ 一定打不开」因此仍然为真**；坏掉的是**归因**（报告让人以为是文档内容的错），
不是保证本身。残余只剩非系统性的一类（一次性 OOM、大批量下的资源上限），任何门都有这一类，
规范消除不了。

**所以 narrowing 对 F4 是充分的** —— 但 D7 没写下让它充分的那个理由（共用引擎）。
D7 只写了「无法区分」+「拒绝启发式」，读 D7 的人会得出我第一轮那个过强结论。
→ 建议给 D7 补一句共用引擎的论证，并写明**判别手段是 reason 文本**（与 D5 对 EACCES 的既有先例一致）。

**新发现（本轮唯一新问题）· 🟡 P2 · non-blocking · F1 的处置抽空了 F6 的触发面**

R4 把「the compile pipeline failing to be constructed or its engine assets failing to load」
举为退 2 的例子，D7 的落地形式是「per-document 编译**之外**抛出的故障 → `CompileEngineError`」。
**但在方案 C 之下，这两个例子都已经落进 per-document 编译内部了**：

- `compile(d, mdxOptions())` 内部才做 `resolveFileAndOptions` + `createProcessor` ——
  **管线构建现在发生在每一篇的调用里**，构建失败即在 per-document try/catch 内 → 退 1。
- graphviz-wasm 在 `rehypeDiagrams` 的 transformer 里 `await getGraphviz()` → 在 `compile()` 内 → 退 1。
- shiki highlighter 在 rehype-pretty-code 的 transformer 里创建 → 在 `compile()` 内 → 退 1。
- 而插件包本身损坏会在 `compile-check.mjs` **import 期**就抛，那发生在 `checkDocuments` 之前，
  是 CLI 启动崩溃，不会走成 `CompileEngineError`。

即：方案 C 之后，「per-document 编译之外的故障」这个集合**几乎是空的**，
`CompileEngineError` 在生产中基本不会被抛出，**S17 只能靠注入的 `compileDocument` 通过**。
那就是一条「测的是现实中无法触发的路径」的场景 —— 我这个角色专门要盯的那种虚假覆盖。

**影响与定级**：契约本身没错（退出码含义、F4 的保证都仍成立，理由见上），
坏的是 F6 想关掉的那条**永久性误诊通道其实还开着**（引擎坏 → 一批好文档被标 ✗ → 让人去改文档），
以及 spec 读起来像已经修好了。修复成本很低且不影响开工，故 P2、非阻塞。

**建议修订**（三句话，都在 design/spec 层）：
1. D7 补记：在方案 C 之下，引擎/资产故障**不可避免地**落在 per-document 编译内、归 exit 1；
   `CompileEngineError` 只覆盖 import 期之后、逐篇循环之前的构建失败这一窄条。
2. 同处补上共用引擎论证，说明 F4 的保证为何仍然为真、判别手段是 reason 文本。
3. S17 的措辞标明它覆盖的是那一窄条残留路径（经注入的 `compileDocument` 断言），
   不要读成「引擎故障一律退 2」。

## F9 / F13 及其余非阻塞项：未引入新问题

- **F9** ✅ R8 只断相对倍数、绝对秒数降级为记录预算、S12 移入 `test/compile-check-perf.test.mjs`
  慢车道且明确不进 `test:unit`（tasks 4.4），`npm test` 的通配仍会带上它 —— `make test-unit`
  保持快车道，收口项 5.1 还专门复核这一点。处理干净。唯一残留是上面偏离 1 末尾那条 ⚪（边际成本无断言）。
- **F13** ✅ 改名 `check-mdx`，`.PHONY` 登记与 help grep 两处都在 tasks 4.5 里，
  第一轮担心的目标遮蔽已消除。
- **F5 / F7 / F8 / F10 / F12** ✅ 逐条落地：`process.exitCode` + 禁 `process.exit()`（R4 + S15）；
  单文件/目录内不可读的不对称显式成文（R4 + S6 + D5 改写）；原 S10 拆成 S10/S18/S19 三条独立场景，
  fixtures 也按 tasks 4.1 各自独立（不再捆在一份文档里）；F10 随 F1 消失；
  `onResult` 契约（恰好一次/按序/await thenable/抛出即归 2/`results` 不二次打印）写进 §1 公开面 + tasks 1.2。
- 关于 tasks 1.5 的可注入 `compileDocument`：作为内部模块的测试接缝可以接受（不是对外 API，
  无法被消费方误用来绕过 parity）。

## 交给下游的两条（不阻塞 merge 前的实施）

1. **code-review** —— 读 `bin/mdxv.mjs` 的两处 `colorize`，确认报告用 `resolveCheckColors().report`、
   诊断用 `.diagnostic`。这是 F2 唯一无法自动化断言的残留（偏离 2 的分析）。
2. **perf-gate** —— 记录预算里补一个边际成本基线（≈4 ms/篇），因为断言只覆盖单篇比值。

## 无新增开放问题

OQ1 已由用户裁定方案甲（`--check` 保持 compile-only），R6/D6 的落地与该裁定一致。本轮无新问题需要转达。
