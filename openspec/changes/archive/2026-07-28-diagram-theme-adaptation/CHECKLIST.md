# Code Review Checklist — diagram-theme-adaptation

> ⚠️ **当前有效判定在文末「# Round 5」**，**权威 stamp = `ff94bda`**（= 被审 merge-candidate
> HEAD；`src/` 与 `test/` 工作树与该 commit 逐字节一致，已实测 `git diff --stat ff94bda -- src test`
> 为空）。以下 round 1 / 2 / 3 / 4 段落是历史留痕，它们各自的 Commit 行记录的是**当时**审的
> 未提交工作树，**不是**门禁 stamp（#A1、#B1/#B2/#B6 在 round 2 修复；#A2/#A3、#B8/#B9/#B12/#B13
> 在 round 4 修复；#A4、#B14/#B15/#B16/#B17/#B19 与 OQ-6 在 round 5 修复）。
> 门禁请读文末 round 5 的 Merge gate 行与 Commit stamp。

- **Mode**: Incremental（merge 前增量审查 / 门禁）
- **Branch**: `dev`
- **Commit**: `ce99eabe80fbbe2ee0bebe125196bf2371107ab3` + **未提交工作树**（4 改 + 1 新增测试文件）
  - ⚠️ **历史 stamp，非门禁 stamp**（round 1 当时审的是未提交工作树）。改动已于 round 5 落成
    commit `ff94bda`，门禁 stamp 见文首横幅与文末 round 5。
- **Reviewer model family**: Anthropic Claude（Opus 5）。独立性由控制器分派决定，本 agent 无法自证与实现方是否同族。
- **Spec 基线**：本变更走 bug 轨道，无 planner 四契约。Verdict A 以 `HYPOTHESIS.md`「修复方向 / 硬边界 / 验收」+ `PIPELINE.md` 的节点与用户语义决策为 code-vs-spec 依据。
- **验证取样**：`tdd-evidence.md` 的 `npm test` 149/149 stamp 与被审 HEAD 一致 → 按取样策略直接采信，**未触发全量重跑**（无 stamp 失配、无证据缺失、无具体怀疑）。本次自行重跑：`node --test test/diagram-theme.test.mjs test/mdx-pipeline.test.mjs` → **34/34 pass, exit 0**。lint 不存在（无 eslint/prettier/biome 配置、`package.json` 无 lint/format script）—— 已核实，不是采信自述。
- **额外自证**：8 个定向 mutant 全部被杀（见文末「独立复核」），4 类颜色写法探针、Graphviz 真实输出结构、导出产物内联 CSS 均实测。

---

## Verdict A — Spec-compliance（code-vs-spec，**不是意图校验**）

**Status: NOT HELD**（存在 1 条未解决 P1）

> 本判定只回答「代码是否落实了 `HYPOTHESIS.md` / `PIPELINE.md` 写下的契约与边界」，**不判断这个修复方向本身是不是用户真正想要的** —— 那属于人类意图回路，本审查在结构上不能替代它。「黑→前景 / 白→背景」是用户已决策项，本判定只核对它被实现，不重新论证它。

- [ ] 🔴 **P1 #A1** `src/mdx/diagrams.mjs` L82-91（`fillSrc == null` 分支与「只读本元素属性」的取值方式）+ `src/app/styles/theme.css` L359-362（`!important`）— **`HYPOTHESIS.md:69` 的硬边界「别动作者故意设的颜色」未完全守住**：分类器只看**本元素**的 `fill`/`style`，但 SVG 的 `fill` 是**可继承属性**，且作者还能用 SVG 内部 `<style>` 上色；这两条路径上的作者颜色会被误判成「未指定/黑」并被 `!important` 不可翻盘地改写。实测（`svg` 车道）：

  | 输入 | 期望 | 实际 |
  |---|---|---|
  | `<g fill="#3b82f6"><text>hi</text></g>` | 文字保持蓝 | `<text>` 拿到 `mv-diagram-fg-fill` → `currentColor !important` → 变 `--ink` |
  | `<svg fill="red"><text>hi</text></svg>` | 文字保持红 | 同上被改写 |
  | `<g style="fill:var(--accent)"><text>hi</text></g>` | 保持 accent | 同上被改写 |
  | `<svg><style>text{fill:#3b82f6}</style><text>hi</text></svg>` | 保持蓝 | 同上被改写 |
  | `<svg><style>.brand{fill:#f59e0b}</style><rect class="brand" fill="black"/></svg>` | 层叠结果是琥珀色 → 保持 | 只看到 `fill="black"` → 打前景 class，`!important` 反压过作者 CSS |

  这是**相对改动前的行为回归**：旧代码把 `fill="black"` 改写成 `fill="currentColor"`（仍是**表现属性**），作者的 `<style>` 规则照样能盖过它；现在 `!important` 让作者失去任何退路（除非写 `style="fill:… !important"`）。`theme.css:358` 注释「不影响页面其余样式」对整页成立，但对图内作者样式不成立，需同步更正。
  **`dot` 车道不受影响**（已用真实 Graphviz 15.1.0 输出核对：每个元素自带 `fill`，`<g class="node">` 从不带 `fill`，故无继承来源），受影响面是**手写 `svg` 车道**（`AGENTS.md:152-156` 记录在册的产品能力）。
  **具体怎么改**（两半都要，缺一不可）：
  1. **JS 侧**：`<text>` 无 `fill` 的默认前景，只在**祖先链（到 `<svg>` 根）都没有声明 `fill`** 时才打 —— `themeColors` 改用 `unist-util-visit-parents` 即可拿到祖先，约 8 行。
  2. **CSS 侧**：按颜色来源分层，别一律 `!important`。`!important` 只有「颜色来自内联 `style=`」这一种情况真正需要（class 选择器本就无条件赢过表现属性）。建议：`<text>` 缺省前景改用零特异性 `:where(.mv-diagram-fg-fill-default) { fill: currentColor }` —— 它只替代 SVG 的**初始值**，理应输给作者的任何声明；属性来源的黑/白用普通 class；仅内联 `style=` 来源保留 `!important`。
  **若用户判定「手写 `svg` 车道的继承/内部 `<style>` 上色不在本次范围」**，这条可降级为 P2 并在 `PIPELINE.md` 记为显式边界（与 `<circle>` 缺省 fill 那条边界同等待遇）—— 但这是语义范围决策，属于用户，审查不代答（见文末 open question OQ-1）。

**A 判定其余项全部核对通过**（逐条 code-vs-spec，非采信自述）：

- ✅ 黑→前景、白→背景两类语义色均落地（`fg-fill`/`fg-stroke`/`bg-fill`/`bg-stroke` 四个 class + `theme.css` 四条规则）。
- ✅ **核心根因已修**：Graphviz 不写 `fill` 的 `<text>` 拿到前景语义色 —— 用真实 wasm 输出验证，`<text>` 确实无 `fill` 属性，且拿到 class。
- ✅ `stroke="black"` 描边前景化（旧行为在重构中保留）；`stroke="#000000"` 这个旧版疏漏也一并补上。
- ✅ 白底多边形仍被**剥除**而非重绘（三车道背景透明一致）；该决策在 `tdd-evidence.md:47-59` 有显式论证与测试。
- ✅ 颜色值集中在 `theme.css`，`fill="var(--x)"` 表现属性路线已按 `HYPOTHESIS.md:62` 规避。
- ✅ `mermaid` 车道未纳入范围且未被破坏（详见 Q6）。
- ✅ **`src/cli/vite-config.mjs` 与 `src/mdx/plugins.mjs` 零改动**（`git diff ce99eab --` 输出为空，已实测，非采信）。
- ✅ 双端一致（详见 Q5）。
- ✅ 浏览器双主题核对已完成并留痕（`PIPELINE.md:62-98`，13.42:1 / 13.84:1，dev + export 各一遍）。
- ✅ 无越界夹带：`package.json` 唯一改动是把新测试文件补进 `test:unit` 清单，这是 `AGENTS.md:130` 要求的同步点，属于本次改动的必要组成。

---

## Verdict B — Code-quality

**Status: HELD**（零未解决 P0/P1；下列 P2/P3 可带过 merge）

工程质量整体高于本仓库既有水平：纯函数化、单一职责、注释解释「为什么」而非「做什么」、`stripGraphvizBackdrop` 必须先于 `themeColors` 的次序理由写在代码里而不是留给后人考古。没有引入依赖、没有 I/O、没有需要错误处理的失败路径。以下无 P0/P1。

**实测确认的正确性（值得记下来，避免后续被"优化"掉）**：

- **属性 vs 内联 `style` 的优先级取对了**：`styleValue(...) ?? properties.fill` 让 `style` 压过表现属性，与 CSS 层叠一致。实测 `fill="black" style="fill:red"` → 不打 class（红色保留）；`fill="red" style="fill:black"` → 打前景 class。这个顺序反了就会产生反向 bug。
- **`tspan` 不需要同等处理，而且现在的做法是对的**：`<text>` 拿到 class 后 `tspan` 靠继承即得前景色；而 `<text fill="red"><tspan>` 两者都不打 class、正确继承红色。若「顺手给 `tspan` 也加默认前景」，恰恰会打破后一种情况。已实测两个方向。
- **作者色保留面**：`fill="none"`、`currentColor`、`transparent`、`#010101`、`rgb(0,0,1)`、`dimgray`、`#333`、`url(#grad)` 全部原样放过。**近黑不应该映射** —— 把 `#010101`/`#333` 当黑是启发式，会吞掉作者意图，现在的「只认精确黑白」是正确取向。
- **`style` 解析够稳**：`FILL:black`、`fill : black`、`;;fill:black`、`stroke-width:2;stroke:black` 均正确识别；`-webkit-fill:black` 正确不识别（精确键比较，不是子串匹配）。
- **无跨图状态泄漏**：同一函数连续渲染两张图，class 数量稳定。

### Tracked（P2 / P3 — 可留到 merge 之后）

- [ ] 🟡 **P2 #B1** `src/mdx/diagrams.mjs` L40 — **`themeSvg` 这个名字现在是假的**：函数体内已无任何 theming，JSDoc 第一行自己就写着「只做与颜色无关的结构清理」。留着会误导下一个人往这里加颜色逻辑，正是本次要摆脱的那条路。改名为 `normalizeSvgMarkup`（或 `prepareSvgMarkup`）—— 只有 L160/L163 两个调用点。
- [ ] 🟡 **P2 #B2** `test/diagram-theme.test.mjs`（整体）+ `src/app/styles/theme.css` L359-362 — **修复的另一半（CSS）零测试覆盖**。实测：把 `theme.css` 里四条语义色规则**整段删掉**，`diagram-theme` + `mdx-pipeline` 仍 **34/34 全绿, exit 0**。也就是说 class 落地被 26 个测试严密守着，而「class → 真实颜色」这层绑定没有任何守卫，一次误删就让本 bug 静默复发、而测试报告仍是满分。这正是本仓库一贯警惕的「两边都通过的测试等于没断言」，只是发生在 CSS 一侧。**建议**：在 `test/export.test.mjs`（它已经在读导出产物）加一条断言，检查内联 `<style>` 同时含四个选择器与 `currentColor` / `var(--surface)` 取值 —— 我已实测导出产物中四条规则齐备，加断言即可把这个事实钉住，成本约 5 行。
- [ ] 🟡 **P2 #B3** `src/mdx/diagrams.mjs` L51-52 — **黑白拼写集对 `svg` 车道仍不完整**。`HYPOTHESIS.md:47` 把「`hsl()`、`rgba()`、大小写、空格变体」列为字符串 regex 补不全的理由，但新实现只补上了大小写与空格；实测下列**语义上就是纯黑/纯白**的写法仍全部漏掉，深色主题下依旧不可见：`hsl(0,0%,0%)`、`rgba(0,0,0,1)`、`#000f`、`#000000ff`、`rgb(0%,0%,0%)`、`rgb(0 0 0)`（CSS Color 4 空格语法，现代工具链常见输出）、以及对应的白色形式。`dot` 车道不受影响（Graphviz 只吐 `black`/`white`/`none`/`#rrggbb`），所以这不是回归、也不阻塞 merge，但枚举拼写集这条路和被替换掉的 regex 是同一类天花板。**建议**：把两个 `Set` 换成「解析成 RGBA 后与 `(0,0,0,1)` / `(255,255,255,1)` 精确比较」的小函数（约 20 行，覆盖全部记法，且天然拒绝 `rgba(0,0,0,0.5)` 这类半透明黑 —— 现在也正确地不碰它）。顺带：`styleValue` 用朴素 `;` 切分，遇到 `url(data:…;base64,…)` 这类含分号的值会切碎，只会漏判不会误判，风险很低，可一并处理。
- [ ] 🔵 **P3 #B4** `src/app/styles/theme.css` L359-362 — 四个语义 class 是**全局未限定作用域**的选择器。命名前缀足够独特，实际碰撞风险很低，但既然它们只服务 `.mv-diagram` 内部，写成 `.mv-diagram .mv-diagram-fg-fill` 能零成本把 `!important` 的爆炸半径收进图内。与 #A1 的 CSS 分层一起改最省事。
- [ ] 🔵 **P3 #B5** `test/mdx-pipeline.test.mjs` L86 — 更新后的断言改看 `mv-diagram-fg-stroke`，但**描边在修复前本来就是好的**（旧 regex 已处理 `stroke="black"`），所以集成层这条断言见证不到本次真正的 bug。改看 `mv-diagram-fg-fill`（无 `fill` 的 `<text>`）会让它同时成为核心根因的集成级证人。断言本身**确实会咬**（旧代码下该字符串不存在 → 失败），不是空断言，只是选点偏了。
- [ ] 🔵 **P3 #B6** `test/diagram-theme.test.mjs` L86-97 — 背景多边形的测试只覆盖**匿名图** `digraph { … }`。而**具名图**恰恰是新旧行为唯一分叉的输入：Graphviz 对 `digraph G { … }` 会先吐 `<title>G</title>` 再吐背景多边形，旧 regex 的 `>\s*<polygon` 因此匹配不上 —— 实测旧 regex 对 `digraph { a }` 生效、对 `digraph G { a }`／`graph G { a -- b }` **全部失效**。也就是说本次结构化匹配顺手修掉了一个潜伏 bug（具名 dot 图在深色主题下曾残留一张白纸底），而 `HYPOTHESIS.md`/`tdd-evidence.md` 都以为只是「同锚点换实现」。加一条具名图用例把这个改进钉住（顺便说明：`examples/demo.mdx:58` 的 dot 图是匿名的，所以浏览器核对不可能覆盖到它）。
- [ ] 🔵 **P3 #B7** `src/mdx/diagrams.mjs` L109 / L79 — `stripGraphvizBackdrop` 与 `themeColors` 各自构造一次 `{ type: "root", children: nodes }` 合成根、各走一趟树。次序依赖已在注释里讲清楚，合并成一趟会削弱那份可读性，**倾向保持现状**；仅作记录，不建议改。

---

## 针对性问题的逐条回答

1. **`theme.css` 的 `!important` 是否站得住 / 会不会过界。** 理由本身成立：内联 `style="fill:…"` 只有 `!important` 能稳定压过，而 `themeColors` 的调用方无法区分颜色来自表现属性还是内联 style。但**「只给已判定为黑/白/未指定的元素加 class，所以作者颜色永远拿不到」这层围栏并不密封** —— 判定只看本元素属性，而 SVG 的 `fill` 可继承、作者还能用内部 `<style>` 上色。见 **#A1**，含实测反例与修法。关键点是：`!important` 不是问题的根源（误判才是），但它把「一次误判」升级成「作者无法翻盘」，所以按颜色来源分层用 `!important` 才是正解。
2. **作者色保留。** 常规写法全部安全（实测 19 种取值）。**近黑不应该映射**，现在的取向是对的。但两类漏判确实存在：语义上就是纯黑白的其他记法（**#B3**，`dot` 车道无影响）、以及经继承/作者 CSS 到达的颜色（**#A1**，这条是真回归）。
3. **背景多边形决策。** 剥除是对的：重绘成不透明会让 `dot` 与 `svg`/`mermaid` 两条透明车道分叉，属于 bug 修复之外的行为变更。**新的结构化匹配足够窄** —— 实测 6 种近似输入（缺 `id`、缺 `class`、`rect` 而非 `polygon`、嵌套一层、无包裹）全部原样保留，作者的白色图形不会被吃掉；同时它比旧 regex **更正确**（旧的过不了 `<title>`，见 #B6）。唯一放宽处是「直接子节点里所有白多边形」而非「紧跟其后的第一个」，在 Graphviz 输出里这仍然只对应背景多边形本身。
4. **`<text>` 专属默认。** 边界站得住，**建议保持**：Graphviz 的形状元素一律显式写 `fill="none"`（已用真实输出核对 `<ellipse fill="none">`／`<path fill="none">`），`dot` 车道毫无缺口；而手写 `svg` 里「形状不写 fill」真正含义不明（可能是「要默认」也可能是「忘了」），把它默认成 `currentColor` 会肉眼改变大量现成图（图标集普遍依赖黑色默认值或在根节点设 fill）。`PIPELINE.md:88-94` 已把它记为待决策边界而非缺陷，处理方式正确。**`tspan` 不需要同等处理，且加了反而会坏事** —— 已双向实测，见 Verdict B 正确性清单。附带一句：一旦 #A1 按建议改成零特异性默认，将来若真要把默认扩展到形状，风险会小得多。
5. **双端一致。** 确认无分叉可能，且是实测而非推理：两条路径共用同一个 `rehypeDiagrams`（经 `src/mdx/plugins.mjs`，**零改动**）与同一份 `theme.css`；实跑 `node bin/mdxx.mjs examples/demo.mdx` → 导出产物内联 `<style>` 中四条规则齐备（`fill:currentColor!important` / `fill:var(--surface)!important` / 两条 stroke），markup 中 `mv-diagram-fg-fill` 出现 9 次，且**零外链**（无指向 CDN 的 `<script src>` / `<link href>`），自包含硬约束守住。改动没有引入任何只在一端生效的分支。
6. **`mermaid` 车道。** 未被触碰且不可能被误伤：`src/app/` 除 `theme.css` 追加四条规则外零改动；`useMermaid`（`Layout.tsx:97-123`）逻辑原样，仍随主题重渲；mermaid 是客户端渲染，其生成的 SVG 元素**不可能带上**这四个 class（class 只在构建期由 hast 插件打给 `dot`/`svg` 车道），所以 `!important` 规则触不到它。

---

## 独立复核记录（不采信自述的部分）

- **测试是否真咬 —— 8 个定向 mutant 全部被杀**（在 scratchpad 的隔离副本上做，仓库未被改动）：去掉 `<text>` 专属守卫 / `stripGraphvizBackdrop` 空转 / 白色误映射成前景 / 忽略 `style=` 来源 / `normalizeColor` 去掉小写化 / 去掉空白剥离 / 从黑集删 `#000` / `themeColors` 空转 —— 全部 `exit=1`，基线 `exit=0`。**RED 声明可信**，26 个新测试不是花架子。
- **CSS 侧反证**：删掉 `theme.css` 四条规则后 34/34 仍全绿 → 即 **#B2**。
- **`test/mdx-pipeline.test.mjs` 改动的合法性**：确认「`currentColor` 不再出现于编译产物」这一前提为真（颜色现在只存在于 `theme.css`），断言改点合法、且在旧代码下会失败（会咬）；选点偏差另记为 **#B5**。
- **未触发全量重跑**：`tdd-evidence.md` 的 149/149 stamp 与被审 HEAD 一致，无 stamp 失配 / 证据缺失 / 具体怀疑，按取样策略采信机器事实。
- **未重复确定性门禁**：security / a11y / perf 三个门禁由独立节点负责，本审查未代跑，也未在 diff 中发现属于它们的问题（无新依赖、无新输入面、无新 I/O；对比度问题恰是本次修复对象，已由浏览器核对量测）。

---

**Merge gate**: 仅当 A、B 两个判定**同时** HELD 时成立。**当前: NOT HELD**（Verdict A 有 1 条未解决 P1 #A1）
**Progress**: 0 / 1 resolved（P0+P1 合计 1 条；P2×3 / P3×4 不计入门禁）

**收口路径（供控制器决策，不由本审查决定）**：#A1 是唯一阻塞项，修法明确、改动面小（`diagrams.mjs` 一处祖先判断 + `theme.css` 按来源分层）。若用户判定手写 `svg` 车道的继承/内部 `<style>` 上色不在本次范围，则 #A1 降级为 P2 并记入 `PIPELINE.md` 边界，两个判定即同时 HELD。**除此之外，这个修复是扎实的** —— 根因抓得准、分层选得对、测试真咬、双端一致、旧 regex 的疏漏与一个潜伏 bug 一并被带走。

## open questions（需人类决策，审查不代答）

- **OQ-1**：手写 `svg` 车道中，作者通过**祖先继承**或**SVG 内部 `<style>`** 表达的颜色，算不算 `HYPOTHESIS.md:69`「作者故意设的颜色」？判「算」→ #A1 是必修的 P1（推荐，因为它是相对改动前的行为回归）；判「不算/本次不管」→ 降级为 P2 + 记录边界，与 `<circle>` 缺省 fill 那条边界同等待遇。
- **OQ-2**：#B3 是否本轮就做？现在的枚举拼写集对 `dot` 车道够用，但对手写 `svg` 车道留着与旧 regex 同类的天花板。可本轮顺手换成解析比较，也可单独开一条改动。

---
---

# Round 3 — 增量审查（本轮唯一有效判定）

- **Mode**: Incremental（merge 前增量审查 / 门禁）。本轮只审 round 3 的 delta：`classify()` 重写、
  `FILL_PAINTING_TAGS` 扩面、`COLOR_AGNOSTIC_CONTAINERS`、`DEFERRED_FILL_CONTAINERS`、
  `stripGraphvizBackdrop` 改调 `classify`，以及 `test/diagram-theme.test.mjs`。
  round 1/2 已结的 #A1、#B1、#B2、#B6 不重复报。
- **Branch**: `dev`
- **Commit**: `ce99eabe80fbbe2ee0bebe125196bf2371107ab3` + **未提交工作树**（rounds 1+2+3 混在同一份
  `git diff` 里：M `src/mdx/diagrams.mjs` / M `src/app/styles/theme.css` / M `package.json` /
  M `test/export.test.mjs` / M `test/mdx-pipeline.test.mjs` / ?? `test/diagram-theme.test.mjs`）。
  - ⚠️ 仍未落 commit。生成真实 commit 后**必须回来把这一行刷成 merge-candidate HEAD**，否则门禁读到的
    stamp 与被合并的代码不是同一份（round 1 已记过同一条，仍未消除）。
- **Reviewer model family**: Anthropic Claude（Opus 5）。独立性由控制器分派决定，本 agent 无法自证。
- **Spec 基线**：bug 轨道，无四契约。Verdict A 依据 = `HYPOTHESIS.md` 的「修复方向 / 硬边界 / 验收」
  + `PIPELINE.md` 的用户语义决策（黑→前景 / 白→背景；OQ-1「祖先继承与 SVG 内部 `<style>` 上色都算
  作者故意设的颜色」）+ round 3 用户追加的两项（默认色扩到 `<text>` 之外；不再漏判近黑写法）。
- **验证取样**：`tdd-evidence.md:150` 的 stamp 与被审 HEAD 一致，但**整份改动未提交**，stamp 无法区分
  工作树状态 —— 按取样策略这属于「stamp 失配」的等价情形，故**本次全量重跑了一遍**：
  `npm test` → **211 tests / 211 pass / exit 0**（前台执行，取真实退出码，非 tail 管道）；
  `node --test test/diagram-theme.test.mjs` → **87 pass / exit 0**。lint 仍不存在（无
  eslint/prettier/biome 配置，`package.json` 无 lint script）—— 已核实，不是采信自述。
- **额外自证（不采信自述的部分）**：38 个颜色写法直接喂 `rehypeDiagrams()` 观察落 class；`<use>` /
  `mask` / `defs` / `marker` / `pattern` / 内部 `<style>` 共 11 组结构探针；5 个定向 mutant
  （2 死 3 活，见 #B8/#B13）。全部在 scratchpad 的隔离副本上做，仓库未被改动。

## Verdict A — Spec-compliance（code-vs-spec，**不是意图校验**）

**Status: NOT HELD**（2 条未解决 P1）

> 本判定只回答「代码是否落实了 `HYPOTHESIS.md` / `PIPELINE.md` 写下的契约与边界」。「默认色该不该扩到
> 形状」是**用户已决策项**，本判定只核对它被实现，不重新论证；下面两条不是反对这个决策，而是这个决策
> 的实现留了两处「作者显式颜色被顶掉」的口子 —— 与 round 1 #A1 同一缺陷类、同一条硬边界。

- [ ] 🟠 **P1 #A2** `src/mdx/diagrams.mjs` L208（`DEFERRED_FILL_CONTAINERS` 只含 `defs`/`symbol`）
  + L264-270 — **`<use>` 指向不在 `<defs>`/`<symbol>` 里的元素时，`<use fill="…">` 在引用处设的颜色仍被顶掉**
  ——即 round 3 item 4 修掉的那个回归只堵住了一半。实测（`node` 直接跑 `rehypeDiagrams()`）：

  ```svg
  <svg><g id="tri"><polygon points="0,0 20,0 10,18"/></g><use href="#tri" fill="#a855f7" x="30"/></svg>
  ```
  → `<polygon>` 拿到 `mv-diagram-fg-fill-default`（它不在 defs 里，豁免不生效），`<use>` 因为自己写了
  非黑白颜色而不打 class。影子树克隆携带该 class，而 **CSS 声明永远赢过继承**（源码 L199-200 自己写对了
  这条），所以 use 实例渲染成 ink 而不是紫色 —— 与控制器在 defs 场景实测到的完全同一个机制（那次实测正是
  document CSS 能匹配到 use 影子树内克隆元素的直接证据）。`<path id="p">` 不套 `<g>` 也一样复现。
  **这是 round 3 引入的新回归**：round 2 时默认只给 `<text>`，形状不打 class，所以 `<use fill>` 是好的。
  **具体怎么改**（任选，第 2 条更彻底）：
  1. 局部堵：`<use href="#x">` 的引用目标（按 id 解析 `href`/`xlink:href`）整棵子树都进「缺省豁免」，
     不再只看是否位于 `defs`/`symbol`；约 15 行，需要先建一次 id→节点索引。
  2. **换锚点（推荐，一并解决 #A3 并可删掉两个集合）**：不给叶子打缺省 class，而是在**根 `<svg>` 自己没
     声明 fill 时**给它补一个表现属性 `fill="currentColor"`（≈3 行）。这样缺省色由**继承**提供，而继承
     天然输给作者的任何声明 —— 无论作者写在元素自己、祖先、表现属性、内联 style 还是 SVG 内部 `<style>`
     上，也无论 `<use>` 指向哪里（影子树从 use 继承，use 从根继承）。表现属性优先级为 0 且排在作者样式表
     最前，所以作者写 `svg{fill:…}` 或 `<svg fill="red">` 都照样赢。`FILL_PAINTING_TAGS` /
     `DEFERRED_FILL_CONTAINERS` / 祖先链遍历三样都可以删掉，`marker`/`pattern` 的漏判（#B9）顺带修好。
     **代价必须一起处理**：根 fill 会继承进 `<mask>`（亮度遮罩里无 fill 的内容当前是黑=隐藏，继承到 ink
     后在深色下≈白=显示，遮罩会失效），所以 `COLOR_AGNOSTIC_CONTAINERS` 要保留，并在这些子树根上补
     `fill="black"` 把初始值钉回去。
  3. 若判定「`<use>` 指向非 defs 元素不在本次范围」→ 降级 P2，但必须在 `PIPELINE.md` 记为**「相对改动前的
     行为回归」**，与 `marker` 那类「本来就黑」的既存缺口区别对待，并补一条测试把已知行为钉住。
  另：**本条零测试覆盖**，改完请一并补 `<use>`→非 defs 目标的用例（现有 3 条 use 测试全部只覆盖 defs/symbol）。

- [ ] 🟠 **P1 #A3** `src/mdx/diagrams.mjs` L268（`inheritsFill` 只看祖先的属性/内联 style）—
  **祖先仅通过「SVG 内部 `<style>` 的 class 选择器」上色时，作者颜色被缺省色顶掉** —— round 1 #A1 的
  残留面，且被 round 3 从「只影响 `<text>`」放大到「影响所有形状」。实测：

  ```svg
  <svg><style>.wrap{fill:#3b82f6}</style><g class="wrap"><text>hi</text><rect/></g></svg>
  ```
  → `<text>` 与 `<rect>` 都拿到 `mv-diagram-fg-fill-default`。`:where()` 零特异度在这里救不了：
  作者的 `.wrap{fill:blue}` 声明在**祖先**上，子级拿到的是**继承值**，而继承值输给子级身上任何声明，
  与特异度无关（源码 L199-200 的注释把这条讲对了，只是没意识到它也适用于自己这条缺省规则）。
  round 2 的三层特异度只解决了「内部 `<style>` 命中元素自己」（`text{fill:…}` 0-0-1 赢过 `:where()`
  0-0-0，控制器的琥珀色浏览器实测正是这一种），**祖先变体从未被覆盖** —— 单测没有、浏览器探针也没有。
  按 `PIPELINE.md:111` 记录的 OQ-1 决策（内部 `<style>` 上色**算**作者故意设的颜色），这条属于 spec
  未落实；也是相对改动前的行为回归（改动前 `<rect>` 不打 class，继承到蓝色）。
  **具体怎么改**：首选 #A2 的方案 2（换锚点后本条自动消失，因为继承对继承，作者的祖先声明天然赢）。
  若维持现有叶子打 class 的架构，退而求其次的保守做法：`svgToHast` 里先扫一遍是否存在 `<style>` 元素且其
  文本含 `fill`，若有则对该张 SVG 整体跳过**缺省**分支（显式黑白照常语义化）—— 失败方向是「漏判、原样保留」，
  是安全的那一侧，约 6 行。**同样零测试覆盖**，请补祖先经内部 `<style>` 上色的用例。

**A 判定其余项逐条核对通过**（code-vs-spec，非采信自述）：

- ✅ **round 3 item 1（不再漏判近黑写法）已落实且方向正确**：38 个写法探针里，**构造不出一个「合法 CSS
  但被误判成纯黑/纯白」的输入**。`rgb(-5,-5,-5)`→黑、`rgb(300,300,300)`→白 与 CSS 的通道夹紧一致；
  `rgb(0.4,0.4,0.4)`→黑 与浏览器四舍五入到 `rgb(0,0,0)` 的渲染结果一致（不是误判）；
  `rgb(1e2,…)`（科学计数）、`hsl(…none…)`、`rgb(٠,٠,٠)`（阿拉伯-印度数字，`\d` 不带 `u` 标志天然拒绝）、
  `#00g`、`#0000000`、`rgb(from red r g b)`、`color-mix(…)`、`oklch(0% 0 0)`、`transparent`、
  `inherit`/`initial`/`unset` 全部判 other（漏判方向 = 原样保留 = 安全侧）。仅有的误判都要求输入是
  **非法 CSS**，见 #B11。
- ✅ **round 3 item 2（扩面）集合选得对**：`text/path/rect/circle/ellipse/polygon/polyline` 已覆盖 SVG 2
  全部可填充形状；`line` 排除正确（规范上 `line` 不绘制填充区域）；`tspan`/`textPath` 排除正确（继承自
  `<text>`，重复标注会破坏 `<text fill="red">`）；`g`/`svg` 排除正确。**没有发现真正遗漏的元素**
  （`image`/`foreignObject` 不吃 fill，`use` 另行处理）。附带一条不算缺陷的观察：`<polyline>` 默认是
  **隐式闭合并填充**的，扩面后深色下会从「黑饼」变成「ink 饼」—— 但浅色下本来就是可见的黑饼，所以这是把
  两种主题拉齐，符合本次设计意图，不是新缺陷。
- ✅ **round 3 item 3（`mask`/`clipPath` 跳过）正确，且「连 stroke 一起跳过」是对的**：亮度遮罩里描边的
  亮度同样参与遮罩计算，把黑描边换成 ink 会改遮罩形状；`clipPath` 只用几何，fill/stroke 完全不参与渲染。
  实测 `<mask><rect stroke="white" fill="black"/></mask>` 两个属性都未被标注。大小写也没问题：HTML 解析器
  的 SVG 名称修正表会把 `clippath` 还原成 `clipPath`，而代码比较前 `toLowerCase()`，两端对得上。
- ✅ **round 3 item 4（`defs`/`symbol` 只豁免缺省分支）在 defs 场景下正确**：`<use fill>`→defs 目标、
  `<use>` 无 fill→缺省落在 use 自己身上、`<symbol>`、嵌套 `<use>`（内层 use 在 defs 里被豁免，外层承担
  缺省）、`<use>`→目标写了 `fill="none"`（互不干扰）五种形态全部实测符合预期。缺口只在非 defs 目标（#A2）。
- ✅ **round 3 item 5（`stripGraphvizBackdrop` 改调 `classify`）行为正确**：`classify(undefined)` → other，
  所以不写 fill 的多边形不会被误删；`bgcolor="red"` 的 dot 图实测背景多边形**存活**。测试没钉住这一点，
  见 #B8。次序（先 strip 后 theme）仍被保留。
- ✅ `<text>` 缺省仍只有零特异度 `-default` 一档、白色没有 `-default` 变体（正确：SVG 初始 fill 是黑，不是白）。
- ✅ **`src/cli/vite-config.mjs` 与 `src/mdx/plugins.mjs` 零改动**（`git diff --stat` 实测两文件不在列，
  项目硬约束守住）；`theme.css` 本轮零改动（9 条 provenance 分层规则沿用 round 2）。
- ✅ 无越界夹带：`package.json` 只有 `test:unit` 清单补文件 + `unist-util-visit-parents` 提为显式依赖
  （round 2 的必要同步点，`AGENTS.md:130`）。
- ✅ 源码注释里**关于 SVG/CSS 的事实性主张基本正确**，包括三条最吃重的：`fill` 初始值是黑（对）、
  `stroke` 初始值是 `none`（对）、**「继承永远输给任何声明，跟特异度无关，零特异度 `:where()` 也救不了」
  （对，且正是 #A2/#A3 的成因）**；表现属性优先级为 0、排在作者样式表最前（对）；内部 `<style>` 在文档顺序上
  晚于 head 里的 theme.css 故同特异度时作者赢（对，dev 下 Vite 也注入到 head）；亮度遮罩白=显示黑=隐藏（对）；
  lab/oklch 亮度轴语义不统一（对）。两处**不准确**见 #B12。

## Verdict B — Code-quality

**Status: HELD**（零未解决 P0/P1）

`classify()` 的分解（`channel8` / `parseAlpha` / `classifyHex` 各自单一职责、纯函数、认不出就返回 null
让调用方统一判 other）比 round 2 的两个 Set 明显更耐改；`ownColor` 把「取值」与「来源」一起返回、由
`semanticClass` 单点决定 class 名，是这次分层能站住的关键；三个集合各自带「为什么排除项是排除项」的注释，
而不是留给后人考古。无新依赖、无 I/O、无需错误处理的失败路径。以下无 P0/P1。

### Tracked（P2 / P3 — 可留到 merge 之后）

- [ ] 🟡 **P2 #B8** `test/diagram-theme.test.mjs` L89-119 — **背景多边形的两条测试分不清「只剥白色」与
  「把 graph0 的直接子多边形全剥掉」**。定向 mutant：把 `stripGraphvizBackdrop` 的
  `return classify(fillSrc) !== "white";` 改成 `return false;`（即无条件删除）→ **87/87 仍全绿, exit 0**。
  两条测试都只断言「剥完之后 polygon 数为 0」，过度剥离恰好也满足。风险不对称：**误删作者内容比误改颜色更糟**
  （`bgcolor="red"` 的 dot 图会整块背景消失，而 `examples/demo.mdx` 是默认背景，浏览器核对不可能发现）。
  **建议**：加一条 `digraph { bgcolor="red"; a }` 的用例，断言 graph0 的直接子节点里那个
  `fill="red"` 的多边形**仍然存在且未被打 class**（我已实测现状是对的，加断言即可钉住），约 5 行。
- [ ] 🟡 **P2 #B9** `src/mdx/diagrams.mjs` L195-208 — **`defs` 作为豁免判据对 `marker` / `pattern` 是错的**，
  代价是这两处「完全不写 fill」的内容在深色主题下仍不可见。机制：`<use>` 之所以要豁免，是因为影子树能从
  引用处继承 fill；但 `marker`/`pattern` 的内容**不会**从引用元素继承 paint（SVG 1.1 无此机制，SVG 2 要靠
  显式 `context-fill`），它们只能从自己在文档里的祖先继承 —— 也就是说它们**永远拿不到引用处的颜色**，豁免
  换不来任何好处，只换来一块停在初始值黑的图形。实测：`<defs><marker><path/></marker>
  <pattern><circle/></pattern></defs>` 两个形状都没打 class。手写 SVG 把箭头 marker 定义在 `<defs>` 里是
  极常见写法。源码注释已把这个代价记为「与改动前一致（不是回归）」—— 陈述准确，所以不阻塞 merge，但判据本身
  可以改对。**建议**：`insideDeferredFillContainer` 从最近的祖先往上找，遇到 `marker`/`pattern` 边界即
  **停止**并返回 false（这两类容器不是 `use` 实例化路径）；或直接采用 #A2 方案 2，本条自动消失。
- [ ] 🔵 **P3 #B10** `src/mdx/diagrams.mjs` L155-161（`ownColor`）— **`fill=""`（空串/纯空白）被当成
  「作者声明了颜色」**，于是既不语义化、又**连带压掉整棵子树的缺省分支**。实测 `<rect fill=""/>` 与
  `<g fill=""><circle/></g>` 都不打任何 class。浏览器里 `fill=""` 是非法值 → 回落到继承/初始值黑 →
  深色下不可见。方向是漏判（安全侧），但「一个空属性静默关掉一整棵子树的主题适配」不是本意。
  **建议**：`ownColor` 里对 attr 与 style 两条来源都判 `String(v).trim() === "" → 视为未声明`（2 行）。
- [ ] 🔵 **P3 #B11** `src/mdx/diagrams.mjs` L112-136（`classify` 的函数式分支）— **对非法 CSS 存在误判**
  （合法 CSS 未发现误判，见 Verdict A）。实测判成黑的非法输入：`rgb(0,0,0,)`（尾逗号）、`rgb(0/0/0)`
  （斜杠当通道分隔）、`rgb(0 0 0, 1)` / `rgb(0,0,0 1)`（混用分隔符）、`rgb(0.,0.,0.)`（`0.` 不是合法 CSS
  数值）、`hsl(50%,0%,0%)`（色相不允许百分比，`ANGLE_OR_PCT_RE` 却接受 `%`）、`hsl(0,0%,0)`（逗号旧写法里
  亮度必须带 `%`）。后果：非法声明在浏览器里被整条丢弃 → 元素回落到**继承值**，此时我们打的 class 会盖过
  作者祖先的颜色（例如 `<g fill="#3b82f6"><rect fill="rgb(0,0,0,)"/></g>` 实际渲染蓝，被改成 ink）。
  概率极低，故 P3。**建议**：分隔符按写法二选一（要么全逗号、要么空格 + 可选 `/` alpha），不要 `[,/\s]+`
  一把切；`NUMBER_RE` 收紧为 `\d+(\.\d+)?|\.\d+`；色相单独用不含 `%` 的正则。
- [ ] 🔵 **P3 #B12** `src/mdx/diagrams.mjs` L188-190 与 L128-129 — **两处注释的事实性表述不准**（注释在本次
  是承重结构，故单列）：
  1. L188-190「`use` … 是自己影子树的**唯一可标注锚点**（影子树里的节点在 hast 上并不存在）」——
     只在被引用内容位于 `defs`/`symbol` 时成立。被引用元素本身在 hast 上是**存在**的（round 3 item 4 正是
     刻意跳过它），而当它不在 defs 里时代码确实标注了它 —— 这句话恰好盖住了 #A2 那个洞。建议改成
     「`use` 是**位于 `defs`/`symbol` 的**被引用内容唯一可安全标注的锚点」。
  2. L128-129「亮度按 CSS Color 4 允许不带 `%`」—— 只在**空格分隔的新写法**里成立；逗号旧写法
     （`hsl(0,0%,0)`）仍要求百分比。同段「色相/饱和度仍需是合法数值」与实现不符：`ANGLE_OR_PCT_RE` 接受
     `%` 形式的色相（非法写法）。
- [ ] 🔵 **P3 #B13** `test/diagram-theme.test.mjs` — **两个定向 mutant 存活，说明两处新行为只被间接见证**：
  1. `channel8` 去掉 `Math.min/Math.max/Math.round`（即取消 CSS 的通道夹紧与取整）→ **87/87 全绿**。
     注释宣称「越界按 CSS 规则夹紧」，但没有任何用例走越界/小数通道。建议把 `rgb(-5,-5,-5)`、
     `rgb(300,300,300)`、`rgb(0.4,0.4,0.4)` 三行加进 `BLACK_SPELLINGS`/`WHITE_SPELLINGS`（我已实测现状全对）。
  2. 把 stroke 分类**搬到** `insideColorAgnosticContainer` 守卫之前（即遮罩里的描边照样语义化）→ **87/87 全绿**。
     现有 `mask` 用例只写了 fill。建议在那条用例里补一个 `stroke="white"` 的形状并断言无 class。
  （对照：`use` 从 `FILL_PAINTING_TAGS` 删除 → exit 1；`defs` 从 `DEFERRED_FILL_CONTAINERS` 删除 → exit 1。
  round 3 的四项主体行为**是被真咬的测试守着的**，上面两处是边角。）

### 实测确认的正确性（记下来，避免后续被「优化」掉）

- **`fill="none"` 与 `transparent` 都判 other**：前者不是「未指定」，后者虽然等价 `rgba(0,0,0,0)` 但
  alpha≠1 → 不碰。半透明黑 `rgba(0,0,0,0.5)`、`#0008` 同理，全部原样保留。
- **`hsl` 走亮度极值而不换算 RGB 是对的**：亮度 0/100% 与色相饱和度无关，`hsl(0,-10%,-10%)` 按 CSS 夹紧
  也确实是黑。
- **不解析 lab/oklab/oklch/color() 是正确取舍**：漏判方向 = 原样保留；`NOT_SEMANTIC` 矩阵里留了
  `oklch(0 0 0)` 作为「记录在案的取舍」而非疏漏，这条测试本身就是文档。
- **`stripGraphvizBackdrop` 必须先于 `themeColors`** 的次序理由写在代码里，且本轮改调 `classify` 后仍成立。

---

**Merge gate**: 仅当 A、B 两个判定**同时** HELD 时成立。**当前: NOT HELD**（Verdict A 有 2 条未解决 P1）
**Progress**: 0 / 2 resolved（P0+P1 合计 2 条：#A2、#A3；P2×2 / P3×4 不计入门禁）

**收口路径（供控制器决策，不由本审查决定）**：#A2 与 #A3 是同一个根：**「缺省色用 CSS 声明表达」这件事本身
就赢过继承**，所以任何「作者的颜色是继承来的、或经引用处传进来的」场景都会被顶掉；round 2 的三层特异度只能
处理「声明命中元素自己」的那一半。两条一起看，最省的收口是 **#A2 方案 2（把缺省色改成根 `<svg>` 上的
`fill="currentColor"` 表现属性，让继承机制承担缺省）**：`FILL_PAINTING_TAGS`、
`DEFERRED_FILL_CONTAINERS`、祖先链遍历三样都可删，#A2 / #A3 / #B9 一并消失，代价只有「`mask`/`clipPath`
子树要补 `fill="black"` 把初始值钉回去」。这属于把 round 3 已经验证过的语义换一种更简单的载体，不是推翻
用户的决策。若判定两条都不在本次范围，则必须在 `PIPELINE.md` 记为**回归性边界**（与 `marker` 那类既存缺口
区别对待）并补测试钉住已知行为，两个判定即可 HELD。
**除此之外这一轮质量很高**：`classify()` 换成解析后，我构造不出合法 CSS 的误判；三个集合的取舍都有正确的
SVG 语义依据；`mask` 连 stroke 一起跳过是对的；`<use>` 缺省锚点在 defs 场景下的推理与实测都成立。

## open questions（需人类决策，审查不代答）

- **OQ-3**：`<use href="#x">` 指向**不在 `defs`/`symbol`** 里的元素（#A2），以及祖先**仅经 SVG 内部
  `<style>` class 上色**（#A3），是否在本次范围内？两者都是相对改动前的**行为回归**，且都落在
  `HYPOTHESIS.md:69` 的硬边界与 `PIPELINE.md:111` 的 OQ-1 决策之下 —— 按 round 1 对 #A1 的处理先例应判
  「在范围内、必修」。若用户选择缩范围，请按上文「收口路径」留痕。
- **OQ-4**：`<defs>` 里 `marker`/`pattern` 的无 fill 内容在深色下不可见（#B9）—— 本轮顺手修（判据从
  「是否在 defs 里」改成「是否在 `use` 实例化路径上」），还是单独开一条改动？它不是本次引入的回归，但正是
  本次要消灭的那种「深色下看不见」。

---
---

# Round 4 — 增量审查（本轮唯一有效判定）

- **Mode**: Incremental（merge 前增量审查 / 门禁）。本轮只审 round 4 的 delta：
  `applyRootDefaultFill`、`pinInitialFillInColorAgnosticContainers`、`applyRootSizing`（含
  根 `style` 合并这个既存缺陷的修复）、`themeColors` 收缩为「只看本元素声明」、
  `FILL_PAINTING_TAGS`/`DEFERRED_FILL_CONTAINERS`/`inheritsFill`/`:where(...-default)` 的删除、
  `ANGLE_RE`/`PERCENT_RE`、`test/diagram-theme.test.mjs`（93 条）与 `test/export.test.mjs` 新增
  两条断言 + fixture 加 dot 块。round 1/2/3 已结的条目不重复报，状态见文末对照表。
- **Branch**: `dev`
- **Commit**: `ce99eabe80fbbe2ee0bebe125196bf2371107ab3` + **未提交工作树**（rounds 1+2+3+4 混在
  同一份 `git diff`：M `AGENTS.md` / M `package.json` / M `src/app/styles/theme.css` /
  M `src/mdx/diagrams.mjs` / M `test/export.test.mjs` / M `test/fixtures/export-sample.mdx` /
  M `test/mdx-pipeline.test.mjs` / ?? `test/diagram-theme.test.mjs`）。
  - ⚠️ **仍未落 commit（rounds 1/3 记过两次，仍未消除）**。本轮判定针对的是**上述工作树内容**；
    生成真实 commit 后必须回来把这一行刷成 merge-candidate HEAD，若提交时内容有任何变动，门禁
    必须重新读一次本文件。
- **Reviewer model family**: Anthropic Claude（Opus 5）。独立性由控制器分派决定，本 agent 无法自证。
- **Spec 基线**：bug 轨道，无四契约。Verdict A 依据 = `HYPOTHESIS.md` 的「修复方向 / 硬边界
  （`:69`「别动作者故意设的颜色」）/ 验收」+ `PIPELINE.md` 的用户语义决策（黑→前景 / 白→背景；
  OQ-1「祖先继承与 SVG 内部 `<style>` 上色都算作者故意设的颜色」；round 3 的「默认色扩到 `<text>`
  之外」「不再漏判近黑写法」）+ round 3 CHECKLIST 的 OQ-3（控制器已判定 #A2/#A3 在范围内，必修）。
- **验证取样**：`tdd-evidence.md` **没有 round 3/4 的任何记录**（`grep` 211 / 218 / 93 全无命中，
  文件停在 round 2），属于取样策略里的「证据缺失」→ **触发全量重跑**：
  `npm test` → **tests 218 / pass 218 / fail 0**（前台执行，真实计数，非 tail 管道）。
  另在 scratchpad 的隔离副本上单独跑 `node --test test/export.test.mjs` → **exit 0, pass 10**
  （导出用例含真实 `vite build`，本轮 fixture 新增 dot 块后仍自包含）。lint 仍不存在（无
  eslint/prettier/biome 配置、`package.json` 无 lint script）—— 已核实，不是采信自述。
- **额外自证（不采信自述的部分）**：25 组结构探针直接喂 `rehypeDiagrams()`（多根 svg / 嵌套 svg /
  顶层非 svg / 注释与文本前导 / `fill=none|inherit|""` / 根 style 5 种形态 / mask-in-mask /
  mask 套 `<g>` / `maskContentUnits` / clipPath / 祖先声明 fill + mask / `<use>` 进 mask /
  大写 `<SVG>` / dot 匿名与具名图 / `bgcolor=red`）；15 组非法与合法 CSS 写法探针；
  **6 个定向 mutant（5 死 1 等价）**；**5 种步骤换序 × 全量单测 + 导出用例**；一个候选修法
  （#A4）实测跑通。全部在隔离副本上做，仓库未被改动。

## Verdict A — Spec-compliance（code-vs-spec，**不是意图校验**）

**Status: HELD**（零未解决 P0/P1；下列 1 条 P2 可带过 merge）

> 本判定只回答「代码是否落实了 `HYPOTHESIS.md` / `PIPELINE.md` 写下的契约与边界」，**不判断
> 这个修复方向本身是不是用户真正想要的**——那属于人类意图回路，本审查结构上不能替代它。

**round 3 的两条 P1 都真修好了，而且是结构性地修好的**（逐条实测，非采信自述）：

- ✅ **#A2 RESOLVED**：`<svg><g id="tri"><polygon/></g><use href="#tri" fill="#a855f7"/></svg>`
  → `polygon` 与 `use` 都零 class，紫色靠继承进影子树；原位置那份靠继承拿根上的 currentColor。
  两份各自正确，正是「不打 class」才能同时成立。测试 L351 钉住。
- ✅ **#A3 RESOLVED**：`<style>.wrap{fill:#3b82f6}</style><g class="wrap">` 的两个子级零 class。
  测试 L276 钉住。
- ✅ **换锚点后「作者声明必赢」是结构性的，不再是逐个堵洞**：我逐条验证了 8 条作者声明通道
  （元素自己的表现属性 / 元素内联 style / 祖先表现属性 / 祖先内联 style / SVG 内部 `<style>`
  命中元素 / 内部 `<style>` 命中祖先 / `<use>` 引用处 / 根 `<svg>` 自身），**全部保留**。
  机制上也站得住：缺省色现在是一条 priority-0 的表现属性 + 继承，而继承输给任何声明——
  round 1/3 那类「我们的 class 是一条声明，会盖掉作者的继承值」的洞在这个锚点上不可能再出现。
- ✅ **round 3 记账的 #B9 顺带修好**：`<defs><marker><path/></marker></defs>` 的 `path` 零 class
  且继承链一路通到根（测试 L374）。同时 `<defs>` 里**显式写死的黑**仍照常语义化（测试 L385）——
  这两条一起才说明「不是把 defs 整棵子树放弃了」。
- ✅ **`dot` 车道零回归且前提断言到位**：真实 Graphviz 15.x 输出实测——根 `<svg>` 拿到
  `fill="currentColor"`，`<text>` 零 class 且确无 `fill` 属性，`stroke="black"` 仍打
  `mv-diagram-fg-stroke`，匿名图与具名图（`<title>G</title>` 插在中间）的白底多边形都被剥掉，
  `bgcolor="red"` 的背景多边形存活且未被语义化。**控制器问的「未来 Graphviz 若吐根级 fill」
  已经被守住**：测试 L71 断言 `<text>` 无 fill、L78 断言根 fill 恰为 `currentColor`，任一前提
  变化都会红（若 Graphviz 自己写了根 fill，`applyRootDefaultFill` 会跳过 → L78 失败），不会静默。
- ✅ **既存的根 `style` 双属性缺陷修得正确**：`<svg style="fill:#3b82f6;stroke-width:2">` 作者
  声明全保留、我们的尺寸声明在前（作者后写者赢），且此时不再补缺省 fill。空 / 纯空白 / 尾分号 /
  双分号 / 含 `;` 的 `url('a;b.png')` 五种形态实测全部正确，序列化转义由 hast 负责（`'`→`&#x27;`），
  无注入面。
- ✅ **`src/cli/vite-config.mjs` 与 `src/mdx/plugins.mjs` 零改动**（`git diff --stat` 实测两文件
  不在列表，项目硬约束守住）；`mermaid` 车道未被触碰（`rehypeDiagrams` 的 mermaid 分支不走
  `svgToHast`）；双端一致（同一插件 + 同一 `theme.css`，导出用例在真实产物上钉住两半）。
- ✅ 无越界夹带：`package.json` 只有 `test:unit` 补文件 + `unist-util-visit-parents` 显式依赖
  （`themeColors` 仍在用，不是残留）；fixture 加 dot 块是为了让导出断言能打在真实产物上，
  选 `dot` 而非 `mermaid` 保住了「零运行时 + 自包含」。

- [ ] 🟡 **P2 #A4** `src/mdx/diagrams.mjs` L249-256（`pinInitialFillInColorAgnosticContainers`
  只看容器**自己**的 fill）+ L317-327（步骤次序）— **遮罩钉黑会顶掉作者写在祖先上的 fill，
  且在「我们根本没注入缺省色」时也照钉**。实测（`rehypeDiagrams()` 直跑）：

  | 输入 | 改动前渲染 | round 4 实际 |
  |---|---|---|
  | `<svg fill="red"><mask id="m"><rect/></mask>…` | mask 内容继承红（亮度≈0.21，部分显示） | mask 被钉 `fill="black"` → 完全挖掉 |
  | `<svg fill="white"><mask id="m"><rect/></mask>…` | 继承白 → **完全显示** | 钉黑 → **完全隐藏**（渲染彻底反转） |
  | `<svg><g fill="red"><mask id="m"><rect/></mask></g>…` | 继承红 | 钉黑 |

  关键点是**不对称**：作者一旦自己在根（或任一祖先）声明了 fill，`applyRootDefaultFill` 就
  **不会注入**任何东西，此时钉黑没有任何收益、纯粹是把作者经继承表达的颜色改掉——正是
  `HYPOTHESIS.md:69` 硬边界与 `PIPELINE.md:111` OQ-1 决策管的那件事，与 #A1/#A2/#A3 **同一缺陷类**，
  也是相对改动前的行为回归。源码注释「容器自己声明了 fill 时尊重作者」把尊重面说大了。
  **定为 P2 而非 P1 的理由**（说明白，便于控制器判断是否提级）：触发要三个不常见条件同时成立
  （图里有 `mask`/`clipPath` + 遮罩内容不写 fill（与「白=显示」的惯用写法相反）+ 祖先声明了 fill）；
  Figma/Illustrator 导出的 mask 子元素一律显式写 `fill="white"`，`dot` 车道不产生 mask，故实际
  命中概率极低；后果是视觉变化而非数据/安全问题。若按 round 1/3 对同类缺陷的处理先例严格执行
  硬边界，控制器可自行提级为 P1。
  **具体怎么改（我已在隔离副本上跑通，93+ 单测全绿）**：把 pin 挪到 `applyRootDefaultFill`
  **之前**，并改用 `visitParents` 检查祖先链——祖先里已有作者声明的 fill 就不钉：
  ```js
  function pinInitialFillInColorAgnosticContainers(nodes) {
    visitParents({ type: "root", children: nodes }, "element", (node, ancestors) => {
      if (!isColorAgnosticContainer(node)) return;
      if (ownColor(node, "fill") !== undefined) return;
      if (ancestors.some((a) => a.type === "element" && ownColor(a, "fill") !== undefined)) return;
      (node.properties || (node.properties = {})).fill = "black";
    });
  }
  ```
  实测副作用两条，都是对的：`<svg fill="red">`/`<g fill="red">` 场景不再钉（作者的继承值保住）；
  mask 套 mask 时内层不再重复钉（外层已钉黑，内层继承即是黑）。**这个修法顺带把 #B14 的
  「次序其实不承重」变成真承重**（pin 必须先于 `applyRootDefaultFill` 才能看到未被污染的祖先
  状态），届时请补一条测试把它钉住。**本条目前零测试覆盖**：把 pin 改成无条件 / 有条件，
  93 条单测都全绿，两个方向都没人守。

## Verdict B — Code-quality

**Status: HELD**（零未解决 P0/P1；下列 P3 可留到 merge 之后）

这一轮是三轮里工程质量最高的一版，而且是**减法**：删掉两张必然长期滞后的清单
（`FILL_PAINTING_TAGS` / `DEFERRED_FILL_CONTAINERS`）、一次祖先链遍历、一档 CSS 特异度，
换来一个 3 行的机制，`themeColors` 的 fill/stroke 两臂也并成一个循环。注释把「为什么是根属性
而不是叶子 class」这条最容易被后人"优化"掉的推理写在了函数上方，并附两次实测回归作为反例——
这是本仓库该有的写法。既存缺陷（根 `style` 被字符串拼接吃掉）在本轮被一条测试撞出来后没有
绕开而是修掉并把机制写进注释，值得记一笔。

### 实测确认的正确性（记下来，避免后续被「优化」掉）

- **遮罩钉黑的覆盖面完整**：mask 套 mask、mask 子级套 `<g>`、`<defs>` 里的 mask、
  `maskContentUnits="objectBoundingBox"`、大写 `<clipPath>`（parse5 的 SVG 名称修正表 +
  代码 `toLowerCase()` 两端对得上）全部命中。`visit` 走全树而不是只看顶层，是对的。
- **`stroke` 确实不需要在遮罩上钉**（控制器的结论成立）：`applyRootDefaultFill` 只写 fill，
  SVG 里 `stroke` 初始值是 `none`，没有可泄漏的来源。建议在注释里补一句「若将来给根加了
  stroke 缺省，这里要同步钉 `stroke="none"`」，把这个隐含前提写下来。
- **`clipPath` 上钉 fill 不可能改变渲染**：裁剪只取几何，fill/stroke 不参与；钉上去只是噪音
  （代价是 #A4 在 clipPath 上白挨一刀，但那一刀无视觉后果）。保留对称写法可以接受。
- **根尺寸声明的合并稳**：尾分号剥离（`replace(/;$/,"")`）是纯美观——去掉它产出
  `…;stroke-width:2;` 同样是合法 CSS，实测为**等价 mutant**（单测全绿且行为无差），
  不必为它补测试；`;;` 产生的空声明浏览器直接忽略。
- **`<SVG>` 大写、多个顶层根、前导注释/文本**都正确：多根时每个根都拿到缺省 fill 与尺寸
  （旧字符串实现的 `replace(/(<svg\b)/)` 没有 `g` 标志，只补第一个——这里顺带修好了）。
- **全屏缩放不受影响**：`Layout.tsx:335` 克隆后 `removeAttribute("style")`，`theme.css:485`
  `.mv-zoom-canvas svg{max-width:none!important}` 自己接管；克隆件的 `fill="currentColor"`
  在遮罩里解析自 `html,body{color:var(--ink)}`（`theme.css:87`），两个主题下都是 ink。

### Tracked（P2 / P3 — 可留到 merge 之后）

- [ ] 🔵 **P3 #B14** `src/mdx/diagrams.mjs` L317-327 — **`svgToHast` 的四个步骤实际上完全可换序，
  注释宣称的次序约束不存在**。实测：5 种换序（含完全倒序）→ `diagram-theme` + `mdx-pipeline`
  **全绿 exit 0**；再把 25 组探针输出按属性名排序后逐字节比对，**完全倒序与基线语义完全一致**
  （唯一差异是序列化时属性的先后）。原因：`ROOT_SIZING` 里没有 `fill` 声明，所以
  「先读作者根 style 再合并尺寸」这条注释（L321-322）保护的是一个不存在的冲突；
  `stripGraphvizBackdrop` 的「必须先于 `themeColors`」（L294-297）在字符串实现时代是真的
  （旧 regex 会**改写**属性），改成 hast 后 `themeColors` 只加 class 不动 fill，约束也退化了。
  这不是「测试没覆盖真实行为」的覆盖洞（没有可覆盖的行为），而是**注释在本仓库是承重结构**，
  一条讲错的次序理由会让下一个人以为有测试守着。**建议**：要么把两处注释改成「当前四步互相
  独立，保持此顺序只是叙事顺序」，要么按 #A4 的修法**让次序真的承重**（pin 必须先于
  `applyRootDefaultFill`）并补一条测试——后者更好，两个问题一起收。
- [ ] 🔵 **P3 #B15** `src/mdx/diagrams.mjs` L177-183（`ownColor`）— **round 3 的 #B10 未处理，
  且爆炸半径从「一棵子树」变成「整张图」**。实测 `<svg fill="">` / `<svg fill=" ">` →
  `applyRootDefaultFill` 认为作者已声明 → **整张图不再有缺省色**，而浏览器会丢弃这条非法值
  回落到初始值黑 → 本 bug 在这张图上原地复活，且单测的 class 断言永远发现不了。
  **建议**（仍是 #B10 的两行）：`ownColor` 对 attr 与 style 两条来源都判
  `String(v).trim() === "" → 视为未声明`。
- [ ] 🔵 **P3 #B16** `src/mdx/diagrams.mjs` L131-137 + `AGENTS.md:165` — **#B11 只修了 hsl 的
  色相/饱和度那一半，非法写法仍有 6 种被判成黑**：实测 `rgb(0,0,0,)`、`rgb(0/0/0)`、
  `rgb(0 0 0, 1)`、`rgb(0,0,0 1)`、`rgb(0.,0.,0.)`、`hsl(0,0%,0)` 全部 → `mv-diagram-fg-fill`
  （已修的两种确认修好：`hsl(50%,0%,0%)`、`hsl(0,0,0%)` 现在判 other）。
  **控制器问「不做会不会咬」——我的答复是：这一轮换锚点之后基本不咬了，同意维持不修**，
  但理由要写清楚：非法声明被浏览器整条丢弃 → 元素回落到**继承值**，而继承值现在通常就是我们
  根上的 `currentColor`，与我们打的 class 结果**完全相同**，肉眼无差。**唯一仍会咬的是「祖先
  声明了颜色」这一种**（`<g fill="#3b82f6"><rect fill="rgb(0,0,0,)"/></g>` 实际渲染蓝，被我们
  改成 ink），概率极低。真正需要修的不是代码而是文档：`AGENTS.md:165` 写「非法写法一律判
  『不是黑白』」，与实现不符——**要么收紧分隔符（逗号写法与空格写法二选一，不要 `[,/\s]+`
  一把切）、要么把这句话改成「大部分非法写法判 other，尾逗号/混用分隔符等仍会误判」**，
  别让下一个人拿它当保证。
- [ ] 🔵 **P3 #B17** `src/mdx/diagrams.mjs` L236-243 / L59-66（只遍历 `nodes` 顶层）—
  **`svg` 车道里最外层节点不是 `<svg>` 时（如作者写 `<figure><svg…/></figure>`），既拿不到
  缺省 fill、也拿不到尺寸声明**。实测 `<div><svg id="wrapped"><text>x</text></svg></div>` →
  `svg` 上零属性，深色下文字停在初始值黑。前导注释、前导文本、`<?xml?>`、`<!DOCTYPE>`、
  多个并列根、嵌套 `<svg>`（内层靠继承拿到，正确）都没问题，所以这是个窄口子；也**不是
  相对改动前的回归**（改动前 fill-less 文字同样是黑），尺寸也仍由 `theme.css:353` 的
  `.mv-diagram svg` 兜住。但 round 3 的叶子打 class 没有这个盲区，属于换锚点带来的收缩。
  **建议**（约 3 行）：把「根」的判据从「`nodes` 的顶层元素」改成「树里没有 `<svg>` 祖先的
  `<svg>`」（`visitParents` 判一下祖先），两个函数一起受益。
- [ ] 🔵 **P3 #B18** `test/mdx-pipeline.test.mjs` L79-86 — **注释已经不成立**：
  「颜色不再是编译产物里的字面 `currentColor`（那是旧字符串 regex 的做法）」——本轮起根
  `<svg>` 就带着 `fill="currentColor"` 进编译产物，`test/export.test.mjs` 新增的断言正是在
  钉这个字面量。同时 round 1 的 **#B5 仍然成立**：这条集成断言看的是 `mv-diagram-fg-stroke`
  （描边改动前就是好的），见证不到本次真正的 bug。**建议**：注释改成「颜色值不再由字符串
  regex 改写，而是 class + 根属性两条路」，断言改看根上的 `fill="currentColor"`——它现在是
  核心根因在集成层最直接的证人。
- [ ] 🔵 **P3 #B19** `test/export.test.mjs` L109-113 — **新断言把「根 svg 带缺省 fill」和
  「尺寸声明」用一条正则按位置串起来（`fill:"currentColor"[^}]*maxWidth:"100%"`），于是它
  钉住的是 JSX props 的插入顺序，而不是行为**。实测：把 `applyRootDefaultFill` 与
  `applyRootSizing` 互换（语义完全等价的无害重构）→ **导出用例 exit 1**。也就是说这是
  round 4 唯一"抓到"换序的断言，但它抓的是错的东西，报错信息会把下一个人带偏；反过来它也
  给人一种「次序有测试守着」的错觉（见 #B14）。**建议**：拆成两条独立断言（一条锚
  `xmlns` + `fill:"currentColor"`，一条锚 `maxWidth:"100%"`），别用 `[^}]*` 跨属性串联。
- [ ] 🔵 **P3 #B20** `src/mdx/diagrams.mjs` L275-291（记录，**不建议修**）—
  **`<mask>` 里用 `<use>` 引用遮罩外部、且该外部元素自己写了黑/白时，语义 class 会随影子树
  进遮罩，遮罩亮度因此随主题变化**。实测 `<rect id="s" fill="white"/>` + `<mask><use href="#s"/></mask>`
  → `rect` 拿到 `mv-diagram-bg-fill` → 遮罩亮度变成 `var(--surface)`（浅色≈白=显示，
  深色≈黑=隐藏），同一份遮罩在两个主题下形状不同。这是 round 1 起就存在的既有缺口（不是本轮
  引入），且需要「mask 里用 use 引用外部黑白元素」这种很少见的写法。修它要建 id→节点索引并把
  「被 mask 内 `<use>` 引用到」也算进 color-agnostic 传播，成本远高于收益。**记录在案而非疏漏**。
- [ ] 🔵 **P3 #B21** `openspec/changes/diagram-theme-adaptation/tdd-evidence.md` — **证据文件停在
  round 2**（`grep` 211 / 218 / 93 零命中），round 3/4 的机器事实（`npm test` 211→218、
  `diagram-theme` 87→93、两轮 mutant 结果）只存在于 `PIPELINE.md` 叙述与控制器的分派消息里。
  后果是取样策略失效：本轮门禁审查因此**只能全量重跑**（已跑，218/218）。**建议**：把 round 3/4
  的命令、真实退出码、通过计数与 commit stamp 补进 `tdd-evidence.md`，让下一轮能复用机器事实
  而不是重新付一次全量代价。
- [ ] 🔵 **P3 #B4（round 1 遗留，仍未处理）** `src/app/styles/theme.css` L365-372 — 8 个语义 class
  仍是全局未限定作用域的选择器。命名前缀足够独特、风险很低，写成 `.mv-diagram .mv-diagram-fg-fill`
  可零成本把 `!important` 的爆炸半径收进图内。
- （**round 1 #B7 结项为「不改」**：本轮变成 4 趟树遍历 + 2 个顶层循环，每趟都有独立且写清楚的
  职责，合并只会削弱可读性；SVG 规模下无性能问题。不再列为待办。）

## 逐条回答控制器本轮的问题

1. **根属性缺省有没有洞？** 多个顶层 `<svg>`：都覆盖 ✓（还顺带修好旧实现只补第一个的疏漏）。
   嵌套 `<svg>`：内层靠继承拿到 ✓（不需要也不应该重复补）。顶层不是 `<svg>`：**有洞**，见 #B17
   （注释/文本/`<?xml?>`/DOCTYPE 前导都没问题，只有真正的包裹元素会漏）。作者根
   `fill="none"`/`fill="inherit"`：都判「已声明」不插手 ✓ ——`inherit` 会让整图回落到初始值黑，
   但那是作者写了个语义上没意义的值，尊重作者是对的取向。`fill=""`：**有洞**，见 #B15。
   `dot` 车道若未来 Graphviz 吐根级 fill：**已被前提断言守住**，会红不会静默（测试 L71/L78）。
2. **遮罩钉黑完整且安全吗？** 覆盖面完整（mask 套 mask、子级套 `<g>`、`<defs>` 里的 mask、
   `maskContentUnits`、大小写）✓；`clipPath` 上钉 fill 不可能改变渲染 ✓；`stroke` 确实不需要钉 ✓
   （建议把这个前提写进注释）。**不安全的一点是「无条件钉」**：作者在根或祖先声明 fill 时钉黑
   纯属倒扣，见 **#A4**（含已跑通的修法）。
3. **四个步骤能不能换序？** **能，全部能，且行为完全等价**——不是「测试抓不到」，是「没有可抓的
   行为差异」（实测 5 种换序 + 完全倒序 × 25 组探针逐字节比对）。所以这不是覆盖洞，而是两处
   讲错的次序注释（**#B14**）+ 一条靠属性顺序偶然报红的导出断言（**#B19**）。想让次序真的
   承重，就采纳 #A4 的修法。
4. **`applyRootSizing` 的合并**：引号/转义安全（值原样拼接，序列化转义由 hast 负责，实测
   `url('a;b.png')` 内的 `'` 被转成 `&#x27;`，无注入面）；尾分号剥离是纯美观、**等价 mutant**，
   不必补测试；作者 style 为空串/纯空白时走「无 existing」分支，产出干净 ✓。
   **`theme.css:353` 的 `.mv-diagram svg { max-width:100%; height:auto }` 确实让内联尺寸完全冗余**
   ——两条声明值一模一样；而且**缩放功能不依赖内联样式**（`Layout.tsx:335` 克隆后
   `removeAttribute("style")`，`theme.css:485` 用 `max-width:none!important` 自己接管），
   这是读代码确认的，不是推理。所以内联尺寸可以删（连带 2 处断言），也可以保留（让 markup
   在 `.mv-diagram` 之外也自洽）。**不构成缺陷，纯取舍**；但既然它是那个既存 double-`style`
   缺陷的唯一来源，删掉是更省心的一侧。注意「作者能覆盖我们」这个理由站不住：作者的根内联
   style 本来就赢过 `theme.css` 的规则，不需要我们把声明放在同一个属性里。
5. **注释 / AGENTS.md 的时效**：`AGENTS.md` 新增的「图内颜色的明暗适配」小节与代码一致 ✓
   （两种机制的分野、class 按来源分层、`!important` 只给内联 style、遮罩两条配套约束、
   根 style 必须合并），唯一一句说大了的是 `:165`「非法写法一律判『不是黑白』」，见 **#B16**。
   源码侧：round 3 的 #B12 两处不准确都已消失（`use` 锚点那段随代码删除、hsl 的 `%` 那段改写后
   准确且如实标注了亮度的宽松）；本轮新增的不准确是两处次序注释（**#B14**）与
   pin 的「尊重作者」范围（**#A4**）。测试侧一处 stale 注释（**#B18**）。
6. **round 3 findings 是否有未处理或重新打开的**：见下表，无遗漏、无静默降级。

| round 3 条目 | 状态 | 依据 |
|---|---|---|
| 🟠 P1 #A2 `<use>` 指向非 defs | **Resolved** | 测试 L351 + 我的探针；机制上不可能再犯 |
| 🟠 P1 #A3 祖先经内部 `<style>` 上色 | **Resolved** | 测试 L276 + 探针 |
| 🟡 P2 #B8 背景多边形过度剥离 | **Resolved** | 测试 L120 断言 `bgcolor=red` 存活；mutant「无条件剥」实测 exit 1（已死） |
| 🟡 P2 #B9 defs 里 marker/pattern 停在黑 | **Resolved** | 测试 L374/L385；换锚点后死角消失 |
| 🔵 P3 #B10 `fill=""` 当成已声明 | **仍未处理，半径变大** | 重开为 **#B15** |
| 🔵 P3 #B11 非法 CSS 误判 | **部分处理** | hsl 色相/饱和度已修（实测）；rgb 分隔符类仍在 → **#B16**（同意不修，但要改文档） |
| 🔵 P3 #B12 两处注释不准 | **Resolved** | 两处都消失/改写正确 |
| 🔵 P3 #B13 两个存活 mutant | **Resolved** | 通道夹紧（L416-426）、遮罩内 stroke（L323）都补了用例 |
| 🔵 P3 #B4 全局选择器 | **仍未处理** | 原样保留为 #B4 |
| 🔵 P3 #B5 集成断言选点 | **仍未处理** | 并入 **#B18** |
| 🔵 P3 #B7 两趟遍历 | **结项（不改）** | 本轮 4 趟各有独立职责，合并只会更差 |

## 独立复核记录（不采信自述的部分）

- **全量重跑**（因 `tdd-evidence.md` 无 round 3/4 记录 = 证据缺失）：`npm test` →
  tests 218 / pass 218 / fail 0；隔离副本 `node --test test/export.test.mjs` → exit 0 / pass 10。
- **定向 mutant 6 个：5 死 1 等价**（隔离副本，仓库未动）——无条件剥背景多边形（死，
  验证 #B8 已钉住）／去掉遮罩钉黑（死）／钉白而非钉黑（死）／去掉 `applyRootDefaultFill`
  （死，8 条失败）／尺寸声明改「替换」而非「合并」（死）／去掉尾分号剥离（**存活，但实测为
  等价 mutant，无行为差**，不算覆盖洞）。控制器自报的 8 个 mutant 我抽验了其中 4 个，结论一致。
- **换序实验**：5 种换序 × `diagram-theme`+`mdx-pipeline` 全绿；完全倒序 × 25 组探针属性归一化
  后逐字节相同；仅 `applyRootDefaultFill`↔`applyRootSizing` 会让导出用例红（原因是 JSX props
  顺序，非行为）→ #B14 / #B19。
- **候选修法验证**：#A4 的 pin-before-default + 祖先感知写法在隔离副本上实现并跑通
  （`diagram-theme`+`mdx-pipeline` exit 0），同时确认「无条件钉」与「有条件钉」两个方向
  **都通过现有 93 条测试** → 该行为零覆盖。
- **未重复确定性门禁**：security / a11y / perf 三个门禁由独立节点负责，本审查未代跑；diff 中
  未发现属于它们的问题（无新依赖、无新输入面、无新 I/O；对比度是本次修复对象，已由控制器
  浏览器量测）。
- **未做的事（如实声明）**：我没有开浏览器复核（本轮明确要求不起长驻服务）。因此「像素层面
  两个主题下的观感」这一半仍只由控制器 round 4 的 chrome-devtools 实测承担；我复核的是它的
  可推导性——根属性 + 继承的机制、`theme.css` 声明、导出产物里的真实字面量、
  `html,body{color:var(--ink)}` 到全屏遮罩的解析链，四段都对得上。

---

**Merge gate**: 仅当 A、B 两个判定**同时** HELD 时成立。**当前: HELD**
（A HELD / B HELD；零未解决 P0/P1）。
**唯一门禁前置条件**：上面 Commit 行仍是「HEAD + 未提交工作树」。**落 commit 后必须把该行刷成
merge-candidate HEAD**；若提交时内容与本轮所审工作树有任何差异，门禁必须重新读一次本文件。
**Progress**: 0 / 0 resolved（本轮 P0+P1 合计 **0** 条；P2×1（#A4）+ P3×8（#B14–#B21、#B4）
不计入门禁）

**结论**：round 3 的两条 P1 不是被绕过而是被**结构性消除**了——缺省色从「一条会赢过继承的 CSS
声明」换成「一条 priority-0 的表现属性 + 继承」，于是「作者的任何声明都赢」从需要逐个堵洞
（`FILL_PAINTING_TAGS` / `DEFERRED_FILL_CONTAINERS` / 祖先链遍历）变成机制自带的性质，还顺手
关掉 #B9 并修掉一个改动前就有的既存缺陷（根 `style` 被吃）。代价（遮罩要把初始黑钉回去）被识别
并实现了，只是钉的条件放得太宽（#A4，P2，修法已验证）。剩下 8 条 P3 都是文档/测试选点/罕见
输入层面的记账，没有一条阻塞 merge。

## open questions（需人类决策，审查不代答）

- **OQ-5**：#A4 是否本轮修？我按「触发要三个不常见条件同时成立」定为 P2、不阻塞门禁，但它与
  round 1/3 那两条 P1 是**同一条硬边界**上的同类缺陷。若倾向严格执行硬边界（round 1 对 #A1 的
  先例即如此），可提级为 P1 并按上文修法收口（约 5 行 + 2 条测试，且能把 #B14 的次序问题一并
  变成真承重）。
- **OQ-6**：内联根尺寸声明既然与 `theme.css:353` 完全冗余、缩放功能也不依赖它（已核实），
  是否顺手删掉（连带改 2 条断言）？删掉可彻底消除「在根 `style` 上做手脚」这个曾经产生既存
  缺陷的动作面；保留则让 markup 在 `.mv-diagram` 之外也自洽。属于取舍，不是缺陷。
- **OQ-7（流程）**：`tdd-evidence.md` 是否补齐 round 3/4 的机器事实（#B21）？不补的话，每一轮
  门禁审查都要付一次全量重跑，且 `PIPELINE.md` 的叙述会成为唯一证据来源——那正是取样策略
  要避免的「采信自述」。

---

# Round 5 — 增量审查（**本轮唯一有效判定 / 门禁读这一段**）

- **Mode**: Incremental（merge 前增量审查 / 门禁）。本轮只审 round 5 的 delta：
  `pinInheritedFillInColorAgnosticContainers`（#A4 的新修法：钉**作者字面继承值**，缺省回落
  `black`）、`ownColor` 空值不算声明（#B15）、`forEachRootSvg`（#B17）、**`applyRootSizing`
  整体删除**（OQ-6）、`svgToHast` 次序注释重写（#B14）、导出断言拆分（#B19）、`AGENTS.md`
  「图内颜色的明暗适配」两条配套约束改写（#B16 + release-coordinator 报的发布阻塞项），
  以及 `openspec/changes/RELEASE-NOTES-DRAFT.md`（新增文件，本轮首次进入审查范围）。
  rounds 1–4 已结条目不重复报，状态见下方对照表。
- **Branch**: `dev`
- **Commit**: **`ff94bda4a1f7bdec3ca918dba1507dfa43231a24`** ← 门禁比对用这一行（= merge-candidate HEAD）
  - 产品码与测试**已完全落 commit**：`git diff --stat ff94bda -- src test package.json` 输出为空
    （实测），即本轮判定针对的就是 `ff94bda` 本身，不再有「未提交工作树」的错位风险。
  - 仍未提交的只有**文档**：`M AGENTS.md`（本轮的 #B16 修复）+ `?? openspec/changes/RELEASE-NOTES-DRAFT.md`。
    两者都在本轮审查范围内、都已核对；它们**不改变**门禁 stamp 的含义（不影响运行时行为），
    但若在提交前又被改动，需重读本文件。
  - ⚠️ **审查期间工作树被并发改动**（如实记账）：本轮开始时 `git status` 只有上面两项；结束时
    多出 `M CONTRIBUTING.md` / `M CONTRIBUTING.zh-CN.md` / `M scripts/publish.sh` /
    `M openspec/changes/mdx-compile-check/{PIPELINE.md,tasks.md}` / `M …/diagram-theme-adaptation/PIPELINE.md`。
    我**重新验过** `git diff --stat ff94bda -- src test package.json` 仍为空，所以上面的 stamp 断言
    依然成立；但 **`scripts/publish.sh` 的改动（非 main 分支从 warn 改为 die + `ALLOW_NON_MAIN` 逃生口）
    不属于本变更的 delta，本轮未审**——它是发布工具链的独立改动，需要自己的审查路径，不要把本文件
    的 HELD 读成对它的背书。
- **Reviewer model family**: Anthropic Claude（Opus 5）。独立性由控制器分派决定，本 agent 无法自证
  与实现方是否同族；**本轮是 merge 门禁（pre-merge），不是 merge 后的 unbiased audit**，跑门禁
  不等于交付了那一项（后者必须由**不同模型族**在 merge 后抽样执行）。
- **Spec 基线**：bug 轨道，无 planner 四契约。Verdict A 依据 = `HYPOTHESIS.md`（`:69` 硬边界
  「别动作者故意设的颜色」+ 修复方向 + 验收）+ `PIPELINE.md` 的用户语义决策（黑→前景 / 白→背景；
  **OQ-1「祖先继承与 SVG 内部 `<style>` 上色都算作者故意设的颜色」**；OQ-5「#A4 修」；
  OQ-6「内联尺寸删」）+ round 4 CHECKLIST 的待办条目。
- **验证取样**：`tdd-evidence.md` **仍停在 round 2**（`grep 227 / ff94bda / "Round 5"` 全部零命中，
  文件自己在 r5 记账里也承认停在 r2）→ 属取样策略里的「证据缺失」，**第二轮触发全量重跑**：
  `npm test` → **tests 227 / pass 227 / fail 0 / EXIT=0**（退出码由 `echo EXIT=$?` 直接落盘，
  不是从 `tail`/`grep` 管道里读的）。lint 仍不存在（无 eslint/prettier/biome 配置文件，
  `package.json` scripts 只有 `dev build:html test test:unit test:export test:e2e`）——已核实，
  不是采信自述。
- **额外自证（不采信自述的部分，全部在 scratchpad 隔离副本上做，仓库未被改动）**：
  - 19 组结构探针直接喂 `rehypeDiagrams()`（内部 `<style>` 上色 + mask ×2 / 祖先 stroke 黑白 + mask ×2 /
    嵌套 mask ×3 / clipPath ×2 / 祖先内联 style + mask / 祖先 `currentColor` / 祖先 `fill=""` /
    裸 `<mask>` / `<div>` 包裹根 / `foreignObject` 内嵌 svg / mask 内嵌 svg / 非图 svg 图标 /
    Graphviz 背景多边形 ×2）；
  - 隔离副本基线 `node --test diagram-theme + mdx-pipeline` = **110/110**；
  - **4 个次序/取值 mutant**：M1 钉遮罩↔补根缺省色换序 → **死（2 条失败）**；
    M2 `stripGraphvizBackdrop` 移到 `themeColors` 之后 → **活，且探针输出与基线逐字节相同**；
    M7 `themeColors` 提到最前 → **活，探针输出逐字节相同**；
    M5 钉遮罩时祖先扫描忽略内联 style 来源 → **活（110/110 全绿），但行为回归成 #A4 的反转**；
  - 1 个候选修法（#A6 的 stroke 钉法，约 8 行）在隔离副本实现并跑通 → 110/110 全绿（这本身
    就是覆盖洞的证据）。
  - **没开浏览器**（本轮要求不起长驻服务）。像素层观感仍只由控制器 r5 的 chrome-devtools 实测承担；
    我复核的是其可推导性（机制链 + `theme.css` 声明 + 导出产物字面量），四段都对得上。

## Verdict A — Spec-compliance（code-vs-spec，**不是意图校验**）

**Status: HELD**（零未解决 P0/P1；下列 2 条 P2 可带过 merge）

> 本判定只回答「代码是否落实了 `HYPOTHESIS.md` / `PIPELINE.md` 写下的契约与边界」，**不判断
> 这个修复方向本身是不是用户真正想要的**——那属于人类意图回路，本审查结构上不能替代它。

**round 4 的 #A4 真修好了，而且比我上一轮给的修法正确**（逐条实测，非采信自述）：

- ✅ **#A4 RESOLVED（修法优于本审查上一轮的建议）**。上一轮我建议的是「有作者声明就别钉」——
  控制器实现后在浏览器里量出第二层：`<svg fill="white">` 的白**本身**会被我们语义化成 `--surface`，
  于是遮罩内容算出 `rgb(45,40,43)`。这一层我上一轮没看出来（我只推理了「钉不钉」，没推理
  「钉的那个源头也被我们改了」），控制器的量测抓住了它，**如实记账：这是我的漏判**。
  最终修法「钉最近的作者字面声明、缺省回落 `black`」我逐条实测正确：
  | 输入 | 钉进 `<mask>` 的值 | 与「我们从没改过 fill」是否一致 |
  |---|---|---|
  | `<svg fill="white"><mask>` | `white` | ✅（改动前继承白 = 全显示） |
  | `<svg><mask>` | `black` | ✅（SVG 初始值，抵消我们注入的根 `currentColor`） |
  | `<svg fill="white"><g fill="#3b82f6"><mask>` | `#3b82f6` | ✅ 取最近，不取最外层 |
  | `<svg style="fill:white"><mask>` | `white` | ✅ 内联 style 来源也认（但零测试，见 #B22） |
  | `<svg fill="currentColor"><mask>` | `currentColor` | ✅ 作者自己声明的，亮度随主题是作者行为、非我们引入 |
  | `<svg fill=""><mask>` | `black` | ✅ 空值非法→不算声明，与 #B15 一致 |
  | 嵌套 `<mask>`（3 种形态） | 逐层等于该层真实继承值 | ✅ 钉的值恰等于内层本会继承到的值，**归纳可靠** |
  | `<clipPath>`、`<clipPath>` 套在 `<mask>` 里 | 同上 | ✅（clipPath 只用几何，钉了也不改渲染） |
- ✅ **顺序约束是真的**：M1（钉遮罩与补根缺省色换序）→ **2 条失败**。`svgToHast` 注释宣称的
  「唯一一条真约束」名副其实，且有 mutant 守着（#B14 在这一处修好了）。
- ✅ **#B15 空值**：`<svg fill="">` / `style="fill:"` 都照常补缺省色（测试 L271/L279）。
  **collateral 我逐个查了**：`themeColors` 无行为变化（空串本来就 `classify → other`，不打 class）；
  `applyRootDefaultFill` 是本修复的目标；`pinInherited…` 的祖先扫描正确跳过空值（探针 E3 钉 `black`）；
  **`stripGraphvizBackdrop` 没走 `ownColor`**（它自己拼 `styleValue(...) ?? properties.fill`），
  所以这条修复**没覆盖到它**——见 #B25（理论面，Graphviz 不产生该写法）。
- ✅ **#B17 根 svg 判据**：`<div><svg>`、多个并列根、嵌套 svg 全部正确（测试 L284/L292/L299）。
  **控制器问「会不会误标非图根」——探针结论：不会**。`foreignObject` 内的 svg 有 svg 祖先 → 跳过
  （并经继承拿到前景色，正确）；`<mask>` 内的 svg → 跳过（继承钉在 mask 上的遮罩语义值，正确）；
  作者顺手写的一枚非图 `<svg id="icon">` → 会被补 `fill="currentColor"`，但那**正是意图**
  （它就在 `svg` 车道的作者标记里），且补的是 priority-0 表现属性、输给作者任何声明。
  最坏情况是「多了一个谁都打得过的缺省值」，不存在破坏面。
- ✅ **OQ-6 内联尺寸删除**：`applyRootSizing` 与 `ROOT_SIZING` 在仓库里已零引用（实测 grep）。
  作者根 `style` 现在逐字保留、不写则不造（测试 L256-269）。响应式保证转由
  `theme.css:353 .mv-diagram svg{max-width:100%;height:auto}` 承担，并在**真实导出产物**上被
  钉住（`export.test.mjs` 新增两条断言，我核对了断言读的是产物内联 CSS 而非源文件）。
- ✅ **#B19 导出断言拆分**：不再用 `[^}]*` 跨 props 串联，`xmlns` 前提断言 + `fill:"currentColor"` +
  `.mv-diagram svg` 尺寸声明三段各自独立。
- ✅ **#B16 / release-coordinator 报的发布阻塞项**：`AGENTS.md` 两条配套约束现在与 shipped code
  一致（① 已改为「钉最近的作者字面声明、回落 `black`」，② 已改为「不要往作者根 `<svg>` 注入任何
  `style`」）。我把 `:165` 那句「非法写法」的取舍描述也验了：`rgb(0,0,0,)` 与 `hsl(0,0%,0)`
  **确实**仍被判成黑（探针实测），所以现在的措辞是如实的、不再是保证。**这条阻塞项已解除**
  （唯一残留是 ① 少一句限定语，见 #B23）。
- ✅ **项目硬约束守住**：`src/mdx/plugins.mjs` 与 `src/cli/vite-config.mjs` 不在 `ff94bda` 的
  改动清单里（实测 `git show --stat`）；`mermaid` 车道不走 `svgToHast`，本轮零触碰；导出仍零外链
  （`export.test.mjs` 自包含断言全绿）。
- ✅ **无越界夹带**：`ff94bda` 的非文档改动只有 `src/mdx/diagrams.mjs`、`src/app/styles/theme.css`、
  `package.json`（`test:unit` 补文件 + `unist-util-visit-parents` 显式依赖）、三个测试文件与一个
  fixture。`unist-util-visit-parents` 确实此前已是 `unist-util-visit` 的传递依赖（实测
  `node_modules/unist-util-visit/package.json:53`），发布说明那句成立。

- [ ] 🟡 **P2 #A5** `src/mdx/diagrams.mjs` L274-287（`pinInheritedFillInColorAgnosticContainers`
  的祖先扫描只看表现属性与内联 `style`）— **作者用 SVG 内部 `<style>` 给祖先上色时，钉遮罩会
  把作者的颜色顶掉，且方向是「遮罩全隐藏」**。`ownColor` 读不到 CSS 规则，于是 pin 落到回落值
  `black`；而**钉在 `<mask>` 元素自己身上的表现属性赢过从祖先继承来的 CSS 值**（继承是级联里
  最弱的一环——这正是本次修复反复用到的那条事实，在这里反过来咬我们），遮罩内容因此算出黑
  = 全部挖掉。实测（探针，`rehypeDiagrams()` 直跑）：

  | 输入 | 改动前渲染 | round 5 实际 |
  |---|---|---|
  | `<svg><style>svg{fill:white}</style><mask id="m"><rect/></mask>…` | 继承白 → **全显示** | `mask` 被钉 `black` → **全隐藏**（被遮元素消失，明暗两主题都消失） |
  | `<svg><style>.w{fill:white}</style><g class="w"><mask id="m"><rect/></mask></g>` | 同上 | 同上 |

  **为什么这是 spec 面而不只是工程面**：`PIPELINE.md` 的 OQ-1 用户决策明确把「SVG 内部 `<style>`
  上色」算作**作者故意设的颜色**，`HYPOTHESIS.md:69` 的硬边界因此覆盖它——#A3 就是这条边界在
  叶子上的实例，本条是它在遮罩上的**第三个实例**。而且此处我们是**纯倒扣**：该场景下作者的
  CSS 规则本来就赢过我们注入的根表现属性（`svg{fill:white}` 打赢 `fill="currentColor"`），
  继承链根本没被我们扰动，pin 却把它改坏了。
  **具体怎么改（两条路，我倾向 (a)）**：
  (a) **承认是启发式并如实写下限界**——把源码注释、`AGENTS.md`、发布说明里的绝对化措辞改成
  「只能重建**表现属性 / 内联 style** 表达的继承，SVG 内部 `<style>` 表达的继承看不到」，
  并加一条「记录在案的已知限界」测试（形如 #B20 的处理方式）。理由：hast 层没有 CSS 匹配，
  想真正重建就要实现选择器匹配 + 级联，成本远超收益。
  (b) 若要在代码上收窄：仅当「根 `<svg>` 子树里没有 `<style>` 元素」时才用回落 `black`，
  有 `<style>` 时不钉（代价是那种图的遮罩亮度会随主题变，属于把「确定性破坏」换成
  「主题相关」，未必更好——所以我不建议）。
  **定为 P2 而非 P1 的理由**（沿用 #A4 的先例，便于控制器判断是否提级）：需要三个不常见条件
  同时成立（`svg` 车道手写图 + 图里有 `mask`/`clipPath` + 遮罩内容不写 fill 而靠继承 + 作者
  恰好用内部 `<style>`/class 而非属性上色）；`dot` 车道不产生 mask，设计工具导出的 mask 子元素
  一律显式写 `fill="white"`；后果是视觉而非数据/安全。若按硬边界严格执行（round 1 对 #A1 的
  先例），控制器可提级。

- [ ] 🟡 **P2 #A6** `src/mdx/diagrams.mjs` L274-287（pin 只钉 `fill`）+ L200-205（
  `COLOR_AGNOSTIC_CONTAINERS` 的注释已经承认「描边亮度同样参与遮罩计算」）—
  **主题仍会经 `stroke` 漏进遮罩亮度**。`themeColors` 会把**遮罩外**祖先自己声明的黑/白 `stroke`
  语义化（这是对的，那是要画出来的描边），但 pin 只钉 `fill`，于是遮罩内容经继承拿到的 `stroke`
  变成随主题变的值。实测（探针）：

  | 输入 | 我们做了什么 | 后果 |
  |---|---|---|
  | `<svg stroke="black"><mask id="m"><rect stroke-width="4" fill="black"/></mask></svg>` | 根拿到 `mv-diagram-fg-stroke` → 计算值 `currentColor`；`mask` 未钉 `stroke` | 遮罩内 rect 的描边亮度随主题翻转：浅色≈黑（挖掉）→ 深色≈白（**显示**），同一份遮罩两个主题形状不同 |
  | `<svg stroke="white"><mask id="m"><rect stroke-width="4"/></mask></svg>` | 根拿到 `mv-diagram-bg-stroke` → `var(--surface)` | 反方向同理（浅色显示 → 深色隐藏） |

  这与 #A4 是**同一条缺陷**的 `stroke` 分支，round 5 只关掉了 `fill` 分支。
  **同时更正我上一轮的错误结论**：round 4 我在「逐条回答」第 2 题里写过「`stroke` 确实不需要
  钉 ✓」——**那句是错的**，它只对「遮罩子树内部不语义化」成立，对「遮罩的继承来源」不成立。
  **具体怎么改（我已在隔离副本实现并跑通）**：在同一个 pin 循环里对 `stroke` 再走一遍祖先扫描，
  **只在祖先真的声明过 `stroke` 时才钉**（不需要回落值——我们从不注入 `stroke` 缺省，
  SVG 里 `stroke` 初始值本就是 `none`），约 8 行；实现后 110/110 仍全绿（**这正说明该行为
  零覆盖**，见 #B22 的同类结论），探针确认遮罩拿到 `stroke="black"` 后与主题解耦。
  **P2 而非 P1**：触发条件同样是三个不常见条件同时成立（`svg` 车道 + mask + 遮罩内容靠**继承**
  拿描边 + 祖先声明黑/白 stroke），且 `dot` 车道不产生 mask。

## Verdict B — Code-quality

**Status: HELD**（零未解决 P0/P1；下列 P2/P3 可带过 merge）

工程质量继续高于本仓库既有水平：五个纯函数各自单一职责、注释解释「为什么」、这一轮还主动把
**上一轮讲错的次序理由**改成如实表述并让唯一真约束被 mutant 守住——这是很难得的自我纠错。
`applyRootSizing` 的删除尤其干净：把一整套「与作者 style 合并」的逻辑连根去掉，换成一条已经
存在的 CSS 规则 + 两条打在**真实产物**上的断言。以下无 P0/P1。

- [ ] 🟡 **P2 #B22** `test/diagram-theme.test.mjs`（#A4 的用例组 L345-380）— **round 5 最核心的
  那条修复只覆盖了「表现属性」半边，内联 `style` 半边零覆盖**。实测 mutant M5（pin 的祖先扫描
  改成只读 `properties.fill`、忽略内联 style 来源）→ **110/110 全绿**，而行为已经退回 #A4 的
  渲染反转：`<svg style="fill:white"><mask id="m"><rect/></mask></svg>` 从钉 `white`（全显示）
  变成钉 `black`（全隐藏）。也就是说这条 P2 修复的一半没有任何守卫，下一次重构会静默拆掉它。
  **具体怎么改**：加一条测试，输入即上面那行，断言 `mask.properties.fill === "white"`
  （成本 3 行，与 L345 那条对称）。顺带建议把 #A6 的 stroke 钉法与 #A5 的已知限界也各补一条，
  这三条合起来才让「遮罩绝缘」这个机制被完整见证。

- [ ] 🟡 **P2 #B23** `src/mdx/diagrams.mjs` L252-254 + `AGENTS.md`（「图内颜色的明暗适配」约束 ①）
  + `openspec/changes/RELEASE-NOTES-DRAFT.md` L79-80 / L88-90 — **三处「遮罩完全绝缘」的绝对化
  表述被探针证伪**，其中发布说明那处是**面向用户**的。逐句对照：
  | 位置 | 原文 | 实际 |
  |---|---|---|
  | `diagrams.mjs:252-254` | 「让遮罩子树**完全不受**本文件的任何改写影响」 | 两个反例：内部 `<style>` 上色（#A5）、`stroke`（#A6） |
  | `AGENTS.md` 约束 ① | 「沿祖先链取最近一个**作者声明**的字面值」 | 「作者声明」只含表现属性与内联 `style`；SVG 内部 `<style>` 看不到，会静默回落到 `black` |
  | `RELEASE-NOTES` L88-90 | 「所以**遮罩效果与改动前一致**」 | #A5 的输入下不一致（全显示 → 全隐藏） |
  | `RELEASE-NOTES` L79-80 | 「SVG 内部 `<style>` 里写的…**全部原样保留**」 | 对遮罩子树不成立（该句在遮罩之外成立，我逐条验过 8 条声明通道） |
  **本仓库把注释当承重结构**，而发布说明是用户读到的唯一说明——一句说大了的话在这里的代价
  和代码缺陷同级（这正是 #B14/#B16 两轮反复出现的同一类问题）。**具体怎么改**：三处各加一句
  限定语即可（例：「只能重建表现属性 / 内联 `style` 表达的继承；作者若用 SVG 内部 `<style>`
  给祖先上色，遮罩会回落到 `black`——已知限界」），发布说明那句改成「除极少数用内部 `<style>`
  上色的手写遮罩外，遮罩效果与改动前一致」。**不阻塞门禁，但建议在 publish 前顺手改掉**——
  它是发布物的一部分，改动成本一分钟。

### Tracked（P3 — 可留到 merge 之后）

- [ ] 🔵 **P3 #B24** `src/mdx/diagrams.mjs` L308 / L324-334 / L216-232 — **三处源码注释的事实性
  问题（#B14 的残留 + 新引入）**：
  (a) **L308 引用了一个不存在的函数名**：`pinInitialFillInColorAgnosticContainers`（shipped 名是
  `pinInheritedFill…`），且紧跟的解释「会在 `<mask>` 上钉一个 `fill="black"` 把 SVG 初始值找回来」
  **已经不是 round 5 的行为**（现在钉的是作者字面值，`black` 只是回落）。改名时漏改的一处。
  (b) **L324-334 `stripGraphvizBackdrop` 的注释仍宣称「这一步必须先于 `themeColors` 跑」——实测为假**：
  M2（把它移到 `themeColors` 之后）与 M7（把 `themeColors` 提到最前）**都存活，且 19 组探针输出与
  基线逐字节相同**。原因正是该注释自己括号里的话（它独立判断原始写法）——`themeColors` 只加 class
  不改 `fill`，多边形无论先后都会被同一条判据剥掉。round 5 重写了 `svgToHast` 的注释、**漏了这个
  docblock**，于是 #B14 的问题在此原地保留：下一个人会以为这里有次序约束且有测试守着。
  改成「本步与 `themeColors` 无顺序耦合（它按原始 `fill` 写法独立判断）」即可。
  (c) **L216-232 那段 `applyRootDefaultFill` 的长 docblock 挂错了函数**：它紧挨着的是
  `forEachRootSvg` 的注释与定义，`applyRootDefaultFill` 在两个函数之后。内容本身准确，只是位置
  会让读者（和 IDE 的 hover）把它当成 `forEachRootSvg` 的说明。移到 L244 那个函数头上即可。

- [ ] 🔵 **P3 #B25** `src/mdx/diagrams.mjs` L342（`stripGraphvizBackdrop` 自己拼
  `styleValue(child.properties?.style,"fill") ?? child.properties?.fill`）— **它复制了 `ownColor`
  的取值逻辑，因此拿不到 #B15 的空值修复**。实测探针：`<polygon style="fill:" fill="white">`
  → 空 style 值不为 `null`，`??` 因此**不会**回落到属性 → `classify("") = other` → **背景多边形
  不被剥掉，还被打上 `mv-diagram-bg-fill`**，深色主题下变成一张不透明的纸色底——正是这个函数存在
  的目的所要防止的那件事。Graphviz 不产生该写法，故仅为理论面 + 重复实现的维护面。
  **具体怎么改**：改用 `classify(ownColor(child, "fill")?.value) !== "white"`（语义等价，
  并把「什么算声明」这件事收敛到一处）。

- [ ] 🔵 **P3 #B26** `src/app/Layout.tsx:335`（`clone.removeAttribute("style")`）— **删掉内联尺寸
  之后，全屏缩放会丢掉作者写在根 `<svg>` 上的 style**。在 round 5 之前那个 `style` 属性是**我们的**
  （作者的被字符串拼接吃掉了），删它无损；现在它是**作者的**，于是同一张图在页内渲染尊重
  `style="fill:#3b82f6;stroke-width:2"`（commit message 与测试 L263 都以此为卖点），进全屏后
  这些声明全部消失 → **页内与全屏两种观感不一致**。
  这**不是相对 0.2.0 的回归**（0.2.0 下作者的根 style 在任何视图里都不生效），而是一个既存缺陷
  被收窄后留下的残口，也是 OQ-6 决策唯一没被测到的连带面（控制器的浏览器复测只断言了克隆件
  `max-width:none`）。影响面：`svg` 车道 + 作者在根上写了表现性 style + 用全屏；`dot` 车道
  不受影响（Graphviz 根节点用 `width`/`height` 属性，不写 `style`）。
  **具体怎么改**：别整属性删，只清尺寸相关声明——`clone.style.maxWidth = "none"`（或删
  `width`/`height`/`max-width` 三条声明）即可，`apply()` 本来就会覆写 `width`/`height`。
  **本条仅凭读码得出**（本轮未开浏览器），建议连带补一条 e2e 或在下次浏览器复核时量一下。

- [ ] 🔵 **P3 #B27** `test/diagram-theme.test.mjs` — **嵌套遮罩与几处 pin 边界正确但无守卫**（记录，
  优先级低）：探针验证 `mask` 套 `mask`（3 种形态）、`clipPath` 套在 `mask` 里、祖先 `currentColor`、
  裸 `<mask>`（不在任何 `<svg>` 内，会被钉 `black`——无害噪音）全部正确；但套娃场景的守卫价值不高，
  因为「不给嵌套容器钉」是**等价变异**（内层本会从外层已钉的值继承到同一个值），所以这里只记账、
  不建议为它补测试。真正值得补的是 #B22 / #A6 / #A5 那三条。

### 从 round 4 结转、状态未变的条目

- [ ] 🔵 **P3 #B18** `test/mdx-pipeline.test.mjs` L79-86 — 注释已按 round 5 改写（现在准确），但
  **round 1 #B5 的选点问题仍在**：断言看的是 `mv-diagram-fg-stroke`（描边改动前就是好的），
  而非根 `fill="currentColor"`（核心根因在集成层最直接的证人）。r5 记账为「下次顺手改」，同意。
- [ ] 🔵 **P3 #B21** `openspec/changes/diagram-theme-adaptation/tdd-evidence.md` — **仍停在 round 2**
  （`grep 227 / ff94bda / "Round 5"` 零命中）。后果如上一轮预测：门禁审查**又**付了一次全量重跑
  （227/227）。r3–r5 的机器事实目前只活在 `PIPELINE.md` 的叙述里，而 `PIPELINE.md` 是控制器的
  自述载体、不是证据载体。**建议**：把 r3–r5 的命令 / 真实退出码 / 通过计数 / commit stamp
  （现在有真 stamp 了：`ff94bda`）补进 `tdd-evidence.md`，下一轮才能复用机器事实。
- [ ] 🔵 **P3 #B4**（round 1 遗留）`src/app/styles/theme.css` L370-377 — 8 个语义 class 仍是全局
  未限定作用域选择器；写成 `.mv-diagram .mv-diagram-fg-fill` 可把 `!important` 的爆炸半径收进图内。
- [ ] 🔵 **P3 #B20**（round 4 记录，仍不建议修）`<mask>` 内用 `<use>` 引用遮罩**外部**的黑/白元素时，
  语义 class 随影子树进遮罩 → 遮罩亮度随主题变。本轮复核：仍然存在，且与 #A5/#A6 属同一族
  （「遮罩绝缘」不是全封闭的）。修它要建 id→节点索引，成本远高于收益。**但它现在应当和 #A5/#A6
  一起被写进那句限界说明里**（见 #B23）。
- **#B11 / #B16 代码侧**：少数非法 CSS 写法仍判黑（实测确认 `rgb(0,0,0,)`、`hsl(0,0%,0)`）。
  同意维持不修；`AGENTS.md` 与发布说明已如实描述取舍（本轮已核对措辞成立）。
- **#B7 / #B14(svgToHast 部分) / #B15 / #B17 / #B19 / #A4**：已结，见下表。

## round 4 → round 5 状态对照（**本表是 finding 状态的唯一权威**）

| round 4 条目 | 状态 | 依据（全部实测） |
|---|---|---|
| 🟡 P2 #A4 遮罩无条件钉黑 | **Resolved（修法更优）** | 7 组输入 × 探针逐一对齐「从没改过 fill 会继承到什么」；测试 L345/L357/L362/L370；M1 mutant 死 |
| 🔵 P3 #B14 次序注释讲错 | **Partially resolved** | `svgToHast` 三处改对且唯一真约束有 mutant 守（M1 死）；**`stripGraphvizBackdrop` docblock 仍讲错**（M2/M7 存活）→ 结转 **#B24(b)** |
| 🔵 P3 #B15 `fill=""` 当已声明 | **Resolved** | 测试 L271/L279 + 探针 E3；collateral 三处已查，第四处 `stripGraphvizBackdrop` 未覆盖 → **#B25** |
| 🔵 P3 #B16 AGENTS.md 说大了 | **Resolved** | 措辞改为如实取舍；`rgb(0,0,0,)`/`hsl(0,0%,0)` 判黑经探针确认，描述与实现一致 |
| 🔵 P3 #B17 根 svg 只扫顶层 | **Resolved** | 测试 L284/L292/L299 + 探针 R1–R4（无误标非图根） |
| 🔵 P3 #B18 集成断言选点 | **仍未处理**（注释已修，选点未改） | 见上 |
| 🔵 P3 #B19 导出断言绑属性顺序 | **Resolved** | 拆成三段独立断言，读码核对 |
| 🔵 P3 #B20 mask 内 `<use>` 引外部 | **仍未处理（记录，不建议修）** | 本轮复核仍在；应并入 #B23 的限界说明 |
| 🔵 P3 #B21 tdd-evidence 停在 r2 | **仍未处理** | 本轮因此第二次全量重跑 |
| 🔵 P3 #B4 全局选择器 | **仍未处理** | 原样结转 |
| OQ-6 内联尺寸是否删 | **已删，核对通过** | grep 零引用 + 测试 L256-269 + 导出产物断言；残留 **#B26**（全屏克隆） |
| OQ-5 #A4 是否本轮修 | **已修** | 见 #A4 行 |

## 逐条回答控制器本轮的问题

1. **字面继承值的 pin 对不对？还会不会漏进主题、或反向钉错？**
   **主体正确**——`fill` 一支我按「如果我们从没改过 fill，这里会继承到什么」逐条对齐，7 组输入
   （含嵌套 mask 三形态、`clipPath`、`clipPath` 套 mask、内联 style 祖先、`currentColor` 祖先、
   空值祖先）全部一致；嵌套场景之所以对，是因为**钉的值恰等于内层本会继承到的值**，因此逐层
   传播是幂等的（归纳成立，不是巧合）。
   **两个仍会漏的口子**：`stroke` 分支完全没钉（**#A6**，主题确实还在漏进遮罩亮度，两个方向都验了）；
   作者用 SVG 内部 `<style>` 上色时 pin 反向钉错（**#A5**，方向是「遮罩全隐藏」，属于「钉了一个
   让原本正常的遮罩变错」的那一类）。加上 round 4 记录的 #B20，「遮罩完全绝缘」目前是**三处不闭合**
   的启发式——机制值得保留，但那句绝对化描述必须改（**#B23**）。
2. **删掉内联尺寸还有哪些没测到的后果？（按车道与路径说）**
   - `dot`（dev + 导出）：Graphviz 根节点只有 `width`/`height` 属性、从不写 `style`，
     `.mv-diagram svg{max-width:100%;height:auto}` 完全接管 ✓（控制器已量 1937pt）。
   - `svg`（dev + 导出）：作者根 style 现在逐字保留。最坏情况是作者自己写
     `style="max-width:none"`/`width:3000px` → 内联赢过 `theme.css`；但**页面级不溢出仍有保证**，
     因为 `.mv-diagram{overflow-x:auto}`（L352）把溢出收进图容器内滚动。这是新暴露的行为
     （0.2.0 下作者的这类声明被吃掉），属于「尊重作者」的正确方向，不是缺陷。
   - `mermaid`：从不走 `svgToHast`，本来就没有这条内联声明，零影响 ✓。
   - 全屏缩放：尺寸没问题（`.mv-zoom-canvas svg{max-width:none!important}` + `apply()` 写内联
     `width/height`）；**但克隆件被整属性删 style，作者的根 style 在全屏里丢了 → #B26**。
   - 导出自包含：`theme.css` 被内联进产物，新断言直接读产物文本钉住那条规则 ✓；零外链不受影响 ✓。
   - 打印：`theme.css` 无 `@media print` 块，没有依赖内联尺寸的第二条路径 ✓。
   - 其它消费者：图 markup 永远被 `figureWrap` 包在 `.mv-diagram` 里，选择器一定命中 ✓；
     e2e 三个 spec 无一断言内联尺寸（实测 grep）✓；仓库内 `applyRootSizing`/`ROOT_SIZING` 零引用 ✓。
     唯一失去的性质是「把 svg 单独拷出 `.mv-diagram` 之外也自洽」——OQ-6 已把它当取舍接受。
3. **`ownColor` 空值改动的连带影响？** `themeColors` 无行为变化（空串本来就判 other）；
   `applyRootDefaultFill` 是目标；pin 的祖先扫描正确跳过空值。**控制器提到的第三处
   `stripGraphvizBackdrop` 其实并不走 `ownColor`**（它自己拼取值逻辑），因此这条修复没到那里 →
   **#B25**（探针给出了具体的坏输出：背景多边形不被剥且被打上 `bg-fill`）。
4. **`forEachRootSvg` 会不会误标非图根？** 不会（探针 R1–R4）。`foreignObject` 内的 svg、
   `mask` 内的 svg 都有 svg 祖先 → 正确跳过；作者顺手写的非图 `<svg>` 会被补缺省色，但那正是
   `svg` 车道的语义，且补的是 priority-0 表现属性、输给作者任何声明，最坏情况是「多了一个
   谁都打得过的缺省值」。裸 `<mask>`（不在任何 svg 内）会被 pin 钉 `black` —— 无害噪音，已记入 #B27。
5. **变异意义上的测试充分性（不是用例条数）？** 三个**存活**的关键 mutant：
   M5（pin 忽略内联 style 来源）→ 110/110 全绿而行为退回 #A4 反转 → **#B22**；
   「pin 也钉 stroke」这个**修复**能在不改任何测试的情况下全绿 → 该行为零覆盖（**#A6** 的另一面）；
   M2/M7（次序）存活但是**等价变异**，不算覆盖洞，属于注释问题（**#B24(b)**）。
   已经守好的：pin 字面值 / 钉黑回落 / 取最近祖先 / 容器自声明不覆盖 / pin-before-root-default
   （M1 死）/ 空值两种来源 / 三种根 svg 形态 / 「根 style 一个字都不改」/ 导出产物两半。
   **结论：round 5 的新行为里恰有两处零覆盖，都在遮罩绝缘这一族上，且都能用 3–6 行测试钉住。**
6. **注释 / `AGENTS.md` / 发布说明还有事实错误吗？**
   - `AGENTS.md` 两条约束**现在与 shipped code 一致**（release-coordinator 报的阻塞项已解除），
     唯一残留是约束 ① 少一句「作者声明只含属性/内联 style」的限定语 → #B23。
   - 源码注释：三处 → #B24（改名漏改的函数名 + 已过期的「钉 black」描述、
     `stripGraphvizBackdrop` 讲错的次序、挂错函数的 docblock）；以及 pin docblock 的
     「完全不受影响」→ #B23。
   - 发布说明：两句绝对化表述被证伪 → #B23（**用户可见，建议 publish 前改**）。其余我抽验的
     事实全部成立：三个 commit 清单 ✓、`unist-util-visit-parents` 此前确为传递依赖 ✓、
     `make check-mdx FILE=` 目标存在 ✓、`engines.node>=20` 未变 ✓、非法写法取舍描述与实现一致 ✓、
     「组件/参数/frontmatter 零改动」与 diff 一致 ✓。（`--check` 一节属 `ce99eab`，
     不在本轮 delta 内，已由 `openspec/changes/mdx-compile-check/code-review/CHECKLIST.md` 覆盖；
     我只抽验了退出码与 make 目标两项事实。）
   - `package.json` 仍是 `0.2.0`：版本 bump 属 publish 节点，不在本审查范围（也不是缺陷）。

## 独立复核记录（不采信自述的部分）

- **全量重跑**（`tdd-evidence.md` 无 r3–r5 记录 = 证据缺失）：`npm test` → tests 227 / pass 227 /
  fail 0 / **EXIT=0**（退出码直接落盘，非管道读取）。与控制器自报的 227/227 一致。
- **隔离副本基线**：`node --test test/diagram-theme.test.mjs test/mdx-pipeline.test.mjs` → 110/110。
- **4 个 mutant**：M1 死（2 失败，证明 pin-before-default 是真约束且有守卫）；
  M2 活 + 探针逐字节相同；M7 活 + 探针逐字节相同（两者共同证明 `stripGraphvizBackdrop` 的
  次序注释为假、`themeColors` 的「无耦合」注释为真）；M5 活（110/110 全绿，行为已回归 #A4）。
  控制器自报 r5 新增 9 个 mutant 全死——我抽验了其中 3 个方向（无条件钉黑、钉/补换序、
  只扫顶层找根），结论一致；**但「全死」不等于「行为全被覆盖」**：M5 与 stroke 钉法证明
  mutant 集合本身有盲区（它们是按已实现的代码取变异，没有覆盖到「该做而没做」的分支）。
- **19 组结构探针**：见上文「额外自证」清单；#A5 / #A6 / #B25 / #B27 四条结论均由探针输出直接得出。
- **候选修法验证**：#A6 的 stroke 钉法在隔离副本实现 → 110/110 全绿 + 探针确认遮罩与主题解耦。
- **未重复确定性门禁**：security / a11y / perf 三个门禁由独立节点负责，本审查未代跑；本轮 diff 里
  未见属于它们的问题（无新依赖引入运行时、无新输入面、无新 I/O；对比度是本次修复对象，
  由控制器浏览器实测承担）。
- **未做的事（如实声明）**：未开浏览器（本轮要求）；因此 #B26（全屏克隆丢作者 style）仅凭读码
  得出，未量测；发布说明里的对比度数字（13.42:1 / 13.84:1）无法由我重算，仍只由控制器的量测承担。

---

**Merge gate**: 仅当 A、B 两个判定**同时** HELD 时成立。**当前: HELD**
（A HELD / B HELD；**零未解决 P0/P1**）。
**Stamp 前提已满足**：本轮 Commit 行 = `ff94bda` = merge-candidate HEAD，且 `src/`+`test/` 工作树
与该 commit 逐字节一致（实测）。未提交的两个**文档**（`AGENTS.md` 的 #B16 修复、
`RELEASE-NOTES-DRAFT.md`）已一并审过；若它们在提交前再被改动，需重读本文件。
**Progress**: 0 / 0 resolved（本轮 P0+P1 合计 **0** 条；新增 P2×4（#A5、#A6、#B22、#B23）+
P3×4（#B24–#B27）+ 结转 P3×4（#B18、#B21、#B4、#B20），均不计入门禁）

**结论**：round 5 把 round 4 的 #A4 与四条 P3 都真修好了，其中 #A4 的修法**优于本审查上一轮给出的
建议**（我只推理了「钉不钉」，没推理「钉的源头也被我们改了」——那一层是控制器的浏览器量测抓到的，
如实记为我的漏判）；`applyRootSizing` 的删除是本轮最干净的一笔，用一条既存 CSS 规则 + 两条打在
真实产物上的断言换掉了一整套合并逻辑。代价是「遮罩绝缘」这个机制现在有**三处不闭合**
（#A5 内部 `<style>`、#A6 `stroke`、#B20 mask 内 `<use>`），其中两处是本轮新暴露的，而代码与文档
都把它描述成了绝对性质——这是本轮唯一需要收口的东西，且收口方式主要是**加限定语 + 三条小测试**，
不是重构。四条 P2 全部不阻塞门禁。
