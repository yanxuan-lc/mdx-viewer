# Pipeline — diagram-theme-adaptation

archetype: bug
criticality: supporting
reversibility: reversible
ceiling: auto+spot-check
gate-shape: async spot-check (+ mandatory browser verification in both themes)
intensity: adversarial-N=1; design-it-twice=off; verifier-tier=standard; oracles=unit+visual; sweep=diff-scoped; token-budget=n/a
infra-readiness: off
escalations: []
anomaly-rate: n/a
budget-B: n/a
downgrade-state: none
started: 2026-07-27T18:12:13Z
completed: n/a

track: bug — deterministic, low-blast. NOT escalated to the feature track: the iron law says
criticality is a depth dial, never a spine-switch. No new external contract (no new flag, no new
exit code) — the fix changes how an already-documented lane renders.

- [x] reproduce → HYPOTHESIS.md (controller-diagnosed, empirically evidenced) @ 2026-07-27T18:12:13Z
- [x] regression-test-first + implement → hast-layer theming + semantic classes in theme.css; 26 new tests (verified RED first via git stash: 3 pass / 23 fail before, 26/26 after); npm test 149/149 @ 2026-07-27T18:34:33Z
- [x] browser-verify → dot lane contrast 13.42:1 dark / 13.84:1 light (WCAG AAA is 7:1); dev + export
      paths both checked in both themes; svg lane inspected @ 2026-07-27T18:34:33Z
- [x] code-review r1 → NOT HELD on 1 P1 (author colours clobbered via inheritance / internal
      `<style>`); r2 fixes landed and controller-verified @ 2026-07-27T18:34:33Z → 2026-07-27T19:05:03Z
- [-] e2e-run → no new CLI surface; the visual oracle is browser-verify above @ 2026-07-27T18:12:13Z
- [-] security-gate → no new dependency, no new input surface, no code execution @ 2026-07-27T18:12:13Z
- [-] a11y-gate → deferred: contrast is exactly what this fixes, but there is no a11y budget for
      diagram internals in this project; browser-verify covers the visible outcome @ 2026-07-27T18:12:13Z
- [-] perf-gate → hast walk replaces a string regex over the same SVG; no new I/O. Spot-checked
      via the existing suite runtime rather than a dedicated budget @ 2026-07-27T18:12:13Z
- [x] spot-check (controller hands-on, cascade probe below) @ 2026-07-27T19:05:03Z

- [x] round-3 scope extension (user-requested) → shapes get the default; colour判定 rewritten to
      parsing; mask/clipPath + defs/symbol boundaries; browser-verified on dev + export in both
      themes; npm test 211/211 @ 2026-07-28T02:28:49Z
- [x] docs-sync → AGENTS.md 架构小节新增「图内颜色的明暗适配」三条规矩（语义只认三种、判定要
      解析通道值、class 按来源分层 + 两个子树边界）；excalivibe `blocks.md` 已在上一轮改正
      @ 2026-07-28T02:28:49Z
- [x] code-review r3 (delta) → **NOT HELD** on 2 P1（都是「给叶子打 class 盖掉继承」的同一个根）
      + 2×P2 + 4×P3；审查者同时给出更好的机制方案 @ 2026-07-28T02:28:49Z
- [x] round-4 机制重构（采纳审查者方案）→ 缺省色改由根 `<svg>` 的表现属性 + 继承提供；
      顺带修掉一个既有缺陷（根 style 被吃掉）；8 个 mutant 全部杀死；dev + export × 明暗
      重新实测；npm test 218/218 @ 2026-07-28T03:02:08Z
- [x] code-review r4 → 两判定 HELD、merge gate HELD，带 1×P2 + 8×P3；P2 我修完后自己在浏览器
      里量出第二层（作者根白被语义化后漏进遮罩），一并修掉 @ 2026-07-28T03:02:08Z
- [x] round-5 收口 → 遮罩改钉「作者字面继承值」；空值不算声明；根 svg 不限顶层；删掉与
      theme.css 重复的内联尺寸注入；修正两处讲错的注释与文档；累计 17 个 mutant 全杀；
      dev × 明暗 + 宽图不溢出 + 全屏缩放实测；npm test 227/227 @ 2026-07-28T03:35:42Z
- [x] merge → dev → `ff94bda`（用户明确要求后提交并推送）@ 2026-07-28T03:50:00Z
- [~] code-review r5（r5 改了产品码却无复审留痕，release-coordinator 判为发布阻塞）→ dispatched
- [ ] archive        （随 0.3.0 发布一起归档）

manual: none
waived: none

## Why no planner / arch-review this time

The previous change (`mdx-compile-check`) justified the full feature_generic lane because it added a
**new external contract** that another repo would hardcode. This one does not: no new flag, no new
exit code, no new module boundary. The root cause is already localized with direct evidence, and the
user has decided the one open semantic question (black→foreground, white→background). Dispatching
`planner` to author four contracts, or `arch-reviewer` to review an interface that isn't changing,
would be process for its own sake. Recorded here so the omission is a decision, not an oversight.

## Why `debugger` was not dispatched

Its job is hypothesis-driven investigation plus a RED regression test. The investigation is done and
evidenced in HYPOTHESIS.md (Graphviz emits `<text>` with no `fill`; SVG's initial `fill` is `black`,
not `currentColor`; 6 of 8 black spellings escape the string regex). Re-deriving that would be pure
waste. The RED-test half moves to `developer`, which does TDD anyway.

## User decision on record (2026-07-27)

**Black → foreground, white → background** — both treated as semantic colors. Only fixing black
would leave the bug in another form: Graphviz nodes carry `fill="white"` by default, so a dark theme
would render white-on-white once the text became light.

## browser-verify — controller, hands-on (2026-07-27T18:34:33Z)

Framework: chrome-devtools MCP. `claude --chrome` was unavailable (extension not connected — two
independent agents hit the same degradation earlier this session), which is the documented level-1 to
level-2 fallback. Used an **isolated browser context** so a concurrent run could not steal the
selected page, and asserted `location.href` on every probe — an earlier pair of parallel agents each
captured screenshots of the *other's* document before catching it that way.

Measured (not eyeballed), `.mv-diagram-dot svg text` computed fill vs page background:

| theme | page bg | text fill | contrast |
|---|---|---|---|
| dark | `rgb(36,32,34)` | `rgb(241,233,227)` = dark `--ink` | **13.42:1** |
| light | `rgb(248,246,240)` | `rgb(41,39,31)` = light `--ink` | **13.84:1** |

WCAG AAA wants 7:1, so both clear it with margin. Verified on the **dev server** and on the
**`mdxx` export** (opened the real file, not just the markup), toggling with the app's own control.
Light mode is visually unchanged from before, which was the regression requirement.

**A false alarm I raised and then eliminated, recorded so nobody re-reports it:** forcing
`document.documentElement.dataset.theme` from JS changes CSS but does not run the app's React state
update, so `Layout.tsx`'s mermaid re-render never fires — producing a light page with a
dark-themed mermaid. That is an artifact of the probe, not a product defect: the real toggle button
(`.mv-theme-toggle`) re-renders mermaid correctly. Verified by reading the button's `aria-label`,
which showed the app still believed it was in dark mode.

**~~Known boundary, deliberately not expanded~~ — SUPERSEDED by round 3 (see the round-3 section
below): the user decided shapes get the default too, and the reasoning here (that "no fill on a
shape" is ambiguous) was wrong to treat as decisive — `<text>` is exactly as ambiguous, and we had
already decided it. Kept verbatim below because the round-3 section argues against it.**

The foreground default
is applied to `<text>` with no `fill`, not to shapes. A hand-written `<circle stroke="currentColor"/>`
with no `fill` still renders as a black-filled circle, because SVG's initial `fill` is black. Left
alone because "no fill on a shape" is genuinely ambiguous — it may mean "I want the default" or "I
forgot" — and Graphviz always sets `fill="none"` explicitly, so the `dot` lane is unaffected. In the
bundled demo the only black-computed fills are `<line>` elements (which never paint a fill area) and
one `<g>` container (which does not paint itself), so there is no visible defect today.

One console error appears when opening the export via `file://`:
`Unsafe attempt to load URL … 'file:' URLs are treated as unique security origins`. Confirmed
unrelated to this change — the diff introduces no URL, fetch, or location access.

## code-review round 1 -> round 2 (2026-07-27T19:05:03Z)

**Verdict B (code-quality) HELD; Verdict A (spec-compliance) NOT HELD** on one P1, now fixed.

**#A1 (P1)** - the classifier read only an element's own `fill`/`style`, but SVG `fill` is
**inherited** and authors also colour via an in-SVG `<style>`. So `<g fill="#3b82f6"><text>` had its
blue replaced by `--ink`, and `!important` left the author no escape - a **regression against the old
behaviour**, where a presentation attribute could still be overridden by the author's own CSS. I
reproduced all four cases before routing it. **I decided the semantic question the reviewer parked
(OQ-1): a colour arriving by inheritance or an internal `<style>` DOES count as author-chosen** -
setting `fill` on a container is a standard SVG idiom, not an accident.

Fixed by ancestor-aware walking (`unist-util-visit-parents`, promoted from transitive to an explicit
dependency) plus splitting the 4 classes into 9 tiered by provenance: attribute-sourced (no
`!important`), style-sourced (`!important` - the only case that needs it), and the true default
(`:where(...)`, zero specificity, since it only stands in for SVG's initial value).

**Three P2s also fixed.** #B2: deleting all four CSS rules left the suite green - class placement had
26 tests, the class->colour binding had none, so one bad edit would have silently restored the bug at
full marks. Now pinned in `test/export.test.mjs` against the real exported HTML. #B6: **the old
backdrop regex was broken for named graphs** - `digraph G { … }` interposes a `<title>` before the
polygon, so the id-anchored regex never matched and named dot diagrams kept a white backing sheet in
dark mode. The structural rewrite fixed that latently; nobody realised, and `examples/demo.mdx:58` is
anonymous so no browser check could have caught it. Now pinned. #B1: `themeSvg` renamed to
`normalizeSvgMarkup` - the body no longer themes anything, and the stale name invited putting colour
logic back into the string layer.

Left alone, recorded not dropped: **#B3** (`hsl(0,0%,0%)`, `rgba(0,0,0,1)`, `#000f`, `rgb(0 0 0)` are
semantically pure black but unmatched; the real fix is parsing to RGBA rather than enumerating
spellings - the same ceiling the replaced regex had. `dot` lane unaffected). The `<text>`-only default
stays, and the reviewer confirmed **`tspan` must NOT get it** - it would break `<text fill="red"><tspan>`
inheritance.

> **Round-3 update:** #B3 is now CLOSED (parsing landed, exactly as this paragraph prescribed) and the
> `<text>`-only default is GONE (extended to every fill-painting shape). The `tspan` exclusion the
> reviewer asked for **still holds** and is now pinned by its own test.

### Controller cascade probe - measured in a real browser, both themes

The CSS went from 4 rules to 9 with mixed specificity, so the visible outcome had to be re-measured
rather than inferred - a zero-specificity `:where()` default could have lost to something unexpected
and made the text invisible again.

| probe | expected | dark | light |
|---|---|---|---|
| author internal `<style>` amber `#f59e0b` | preserved | `rgb(245,158,11)` | same |
| inherited ancestor blue `#3b82f6` | preserved | `rgb(59,130,246)` | same |
| own colour green `#10b981` | preserved | `rgb(16,185,129)` | same |
| text with no fill | follows theme | `rgb(241,233,227)` | `rgb(41,39,31)` |
| dot anonymous **and named** graph | follows theme | both | both |

Cascade behaves as the developer argued: the theme selectors are single-class (0-1-0), tying with an
author's `.brand`, and the author's in-SVG `<style>` comes later in document order, so the author
wins. **Author colours are all preserved while the original bug stays fixed** - both halves hold
simultaneously, which is what the P1 was about.

`npm test` **159/159**. Zero diff still confirmed on `vite-config.mjs` and `plugins.mjs`.

## Round 3 — 用户要求把上一轮记账未修的两项一并做掉 (2026-07-28T02:28:49Z)

上一轮结尾我把两件事记在案上没做：`<text>` 以外的形状缺省 fill 仍是黑（列为「待决策的边界」），
以及 `#B3`「近黑近白写法漏判」。用户读过后要求两项都做，并且「你觉得会有影响的都优化」。

**决策反转（形状缺省 fill）：** 上一轮把默认只给 `<text>`，理由是「形状没写 fill」语义暧昧
（可能想要默认，也可能忘了写）。这个理由不成立——`<text>` 同样暧昧，而我们已经给它定了。SVG 的
初始值就是黑，所以手写 `<circle stroke="currentColor"/>` 在深色下是一枚看不见的黑饼，与图内文字
不可见是同一个根因、同一种不可见。现在形状与文字同规则。

**颜色判定改成解析（#B3 关掉）：** `classify()` 从枚举字面写法改成解析到通道值——命名色、hex
3/4/6/8 位、`rgb()/rgba()` 的逗号与空格两种语法、百分比通道、`/` 分隔的 alpha、`hsl()` 的亮度
极值。alpha≠1 一律判 other（把 `rgba(0,0,0,.5)` 换成 `currentColor` 会丢掉 alpha，那是把作者的
颜色改成另一个颜色）。`lab()/oklab()/oklch()/color()` 刻意不解析：亮度轴语义不统一（lab 的 L 是
0–100，oklch 的 L 是 0–1），猜错会改坏作者颜色，而没有任何图生成器输出这些写法；漏判的方向是
「原样保留」，是安全的那一侧。这条取舍钉在 `NOT_SEMANTIC` 矩阵里（`oklch(0 0 0)` 在其中），
是记录在案的决定，不是疏漏。

**两个新边界，都不是「顺手加的保险」，各自挡住一类真实错误：**

- `<mask>` / `<clipPath>` 子树整体跳过。亮度遮罩里白 = 显示、黑 = 隐藏——那是遮罩语义不是颜色，
  按「白→背景色」改写会让遮罩随主题变形，深色下还会把被挖掉的区域重新显示出来。**这是上一轮
  就已经存在的缺陷**（上一轮的黑白改写同样会命中遮罩内容），只是没人构造过带 mask 的图；现在
  单测钉住，浏览器里也看到 mask 仍正常挖洞。
- `<defs>` / `<symbol>` 只跳过「缺省」分支。**这一条是我在浏览器里量出来的回归**，不是推理出来
  的：给 `<defs>` 里没写 fill 的形状打上缺省 class 后，`<use fill="#a855f7" href="#icon"/>` 的
  三角形渲染成了前景色而不是紫色——CSS 声明永远赢过继承，跟特异度无关，零特异度的 `:where()`
  也救不了。缺省色改由 `<use>` 自己承担（它是自己影子树在 hast 上的唯一可标注锚点），于是
  「use 处设了色」和「谁都没设色」两种情况同时正确。截图证据：修前两个三角形是白的，修后是紫的。

### 浏览器实测 — controller 亲自做，dev 与 export 两条路径 × 明暗两主题

`chrome-devtools` MCP，隔离浏览器上下文，每次探针都断言 `location.href`，用应用自己的主题控件
切换（不是从 JS 改 `data-theme`——上一轮记过那个假警报）。

| 探针 | 期望 | 深色实测 | 浅色实测 |
|---|---|---|---|
| dot 车道 `<text>`（本 bug 原点） | 跟随主题 | `rgb(241,233,227)` | `rgb(41,39,31)` |
| `<circle stroke="currentColor"/>` 无 fill（本轮新修） | 跟随主题 | `rgb(241,233,227)` | `rgb(41,39,31)` |
| `<rect>` 完全裸（本轮新修） | 跟随主题 | `rgb(241,233,227)` | `rgb(41,39,31)` |
| `fill="hsl(0,0%,0%)"`（#B3 关掉的写法） | 跟随主题 | `rgb(241,233,227)` | `rgb(41,39,31)` |
| `fill="rgba(0,0,0,0.5)"` | 原样保留 | `rgba(0,0,0,0.5)` | 同 |
| 作者内部 `<style>` 琥珀 / 继承祖先蓝 / 自身绿 | 全部保留 | 三色都对 | 三色都对 |
| `mask` 挖洞的红方块 | 遮罩仍生效 | 红底 + 圆洞 | 同 |
| `<use fill="#a855f7">` ×2（含 symbol 版） | 紫色 | 两个都紫 | 两个都紫 |

`mdxx` 导出的 HTML 用 `file://` 打开逐项复测，与 dev 一致（截图逐像素同形）。

顺带澄清一件上一轮留下的疑惑：主题按钮「第一次点了没反应」不是缺陷——它是 `cycleTheme`
三态循环（auto → light → dark），初始 `auto` 解析成浅色，第一次点击落到显式 `light`，
视觉自然不变。上一轮据 `aria-label` 推断「应用仍以为自己是深色」的说法可以作废。

### 影响面核对（不是「应该没问题」）

- `examples/demo.mdx` 编译后的 class 计数与上一轮**逐项相同**，5 个 `fg-fill-default` 全在
  `<text>` 上——Graphviz 对形状一律显式写 `fill`（`fill="none"` 或具体色），所以「缺省默认扩到
  形状」provably 不动 dot 车道。`examples/` 下没有任何 `svg` 车道块，这也说明**上一轮的浏览器
  核对从未覆盖 svg 车道的形状**，本轮的探针文档补上了这个空白。
- `theme.css` 本轮零改动：9 条按来源分层的规则原样承载新增的形状缺省。
- `src/cli/vite-config.mjs` / `src/mdx/plugins.mjs` 仍零 diff（双端一致硬约束）。
- 导出产物零外链未受影响（本轮不引入任何资源）。
- `npm test` **211/211**（本轮 +52：`diagram-theme.test.mjs` 87 条）。实施前先验红：
  34 fail / 50 pass。

## Round 4 — 采纳审查者的机制方案，两条 P1 一起消失 (2026-07-28T03:02:08Z)

r3 交出去复审，判 **Verdict A NOT HELD**：两条 P1，而且是**同一个根**——「给叶子打 class」
本身就是错的手段。

- **#A2**：`<use fill="…">` 指向**不在 `defs` 里**的元素时照样被顶掉。r3 的豁免只看
  `defs`/`symbol`，是我把一个洞堵了一半。**这是 r3 引入的新回归**（r2 时形状不打 class，
  这个 case 反而是好的），零测试覆盖。
- **#A3**：祖先**仅通过 SVG 内部 `<style>` 的 class** 上色时，子级被缺省色顶掉。这是 r1 #A1
  的残留面被 r3 从 `<text>` 放大到了所有形状：`ownColor()` 只读表现属性与内联 style，读不到
  内部 `<style>`，于是判成「无继承来源」。r2 那次浏览器实测的琥珀色恰好是「内部 `<style>`
  命中元素**自己**」，**祖先变体单测和探针都没覆盖**——所以两轮都没抓到。

两条我都先独立复现，确认属实，再动手。

**采纳审查者的方案，因为它比我的对**：缺省色不再打 class，改成**在根 `<svg>` 上补一个表现
属性 `fill="currentColor"`**，靠继承流下去。关键事实是——**继承是级联里最弱的一环，输给作者
的任何声明（元素自己的、祖先的、属性的、内联 style 的、内部 `<style>` 的、`<use>` 引用处
的）；而 class 是一条声明，会盖掉作者用继承表达的颜色，跟特异度无关**（零特异度 `:where()`
也救不了：特异度只在声明之间比，继承根本不参与）。这不是打补丁，是换用级联自己的机制，于是：

| r3 维护的东西 | r4 |
|---|---|
| `FILL_PAINTING_TAGS`（哪些标签会绘制填充区域） | 删除——不需要知道 |
| `DEFERRED_FILL_CONTAINERS`（哪些容器的内容由引用处上色） | 删除——不需要知道 |
| 祖先链 `inheritsFill` 遍历 | 删除——继承自己会算 |
| `:where(.mv-diagram-fg-fill-default)` CSS 规则 | 删除——9 条规则回到 8 条 |
| `themeColors` 的 fill/stroke 两段分支 | 合成一个循环 |

代价只有一处，审查者也预告了：根上的缺省色会继承进 `<mask>`，所以要在 `<mask>`/`<clipPath>`
上把初始值 `fill="black"` 钉回去，**并且容器自身也要排除在语义化之外**——否则刚钉回去的黑
立刻被「黑→前景」改写，等于没钉（这一条我自己补的，mutant 测过会红）。

顺带白拿一个修复：r3 记账的「`defs` 里不写 fill 的 marker/pattern 内容停在初始值黑」自动消失
——继承一路通到 `defs` 内部。浏览器里能看到那支箭头现在是可见的。

### 一个既有缺陷被测试意外撞出来（不是本次回归）

写「作者已在根上声明 fill 时不插手」这条测试时它红了，查下去发现：`normalizeSvgMarkup` 一直
是在**字符串**上 `replace(/(<svg\b)/, '$1 style="…"')` 注入响应式尺寸。作者若自己在根上写了
`style`，就会出现两个 `style` 属性，而 HTML 解析规则是**保留第一个**——作者写在根上的整个
`style` 被静默吃掉（实测 `<svg style="fill:#3b82f6;stroke-width:2">` 只剩我们注入的那条）。
改成 hast 层合并，我们的声明放前面（同一 style 属性里后写的赢，作者仍能覆盖我们）。
这个缺陷早于本次改动的所有轮次，属于顺手治好。

### 变异测试 — 8 个 mutant，全部杀死

r3 复审指出 3 个存活 mutant，说明「行为被测试真咬住」不能只看用例数量。本轮逐个验证：

| mutant | 结果 |
|---|---|
| 不给根补缺省 fill | 8 条红 |
| 去掉通道夹紧 + 取整 | 3 条红 |
| 无条件剥掉 graph0 直接子多边形（#B8） | 1 条红 |
| 不给 `<mask>` 钉回初始值黑 | 1 条红 |
| 容器自身不跳过（钉回的黑被语义化） | 2 条红 |
| 不注入根尺寸声明 | 2 条红 |
| 尺寸声明替换而非合并（吃掉作者 style） | 1 条红 |
| hsl 色相/饱和度不校验 | 起初 **0 条红**，补了两条非法 hsl 用例后 2 条红 |

最后一行是这轮唯一一次「先存活后补测」，如实记下。

### 浏览器实测 — 机制换了，上一轮的证据一律作废，从头重测

dev（`mdxv`）与导出（`mdxx`）两条路径 × 明暗两主题，chrome-devtools 隔离上下文，
每次断言 `location.href`，用应用自己的三态控件（auto→light→dark）切到位。

| 探针 | 深色 | 浅色 |
|---|---|---|
| dot 车道 `<text>`（bug 原点） | `rgb(241,233,227)` | `rgb(41,39,31)` |
| 裸 `<circle stroke>` / 裸 `<rect>` | 跟随主题 | 跟随主题 |
| `fill="hsl(0,0%,0%)"` | 跟随主题 | 跟随主题 |
| `fill="rgba(0,0,0,0.5)"` | 原样保留 | 原样保留 |
| 作者内部 `<style>` 琥珀 / 继承蓝 / 自身绿 | 三色全保留 | 三色全保留 |
| **#A3 祖先仅内部 `<style>` 上色（text + rect 两个子级）** | **都是蓝** | **都是蓝** |
| **#A2 `<use fill>` 指向非 defs 元素** | **实例紫、原位置跟随主题** | 同 |
| 谁都没设色的 `<use>` | 跟随主题 | 跟随主题 |
| 无 fill 的 `<marker>` 箭头（r3 记账项） | 可见 | 可见 |
| `mask` 挖洞的红方块 | 红底 + 圆洞 | 同 |

导出产物截图与 dev 逐像素同形；导出零外链复核通过。

### 测试与文档

- `test/diagram-theme.test.mjs` 93 条（旧机制的用例是**改写**而非删除，把「两次修正的来龙去脉」
  留在注释里，让机制本身成为写下来的结论）。
- `test/export.test.mjs` 新增一条：在**真实导出产物**里断言根 `svg` 带 `fill:"currentColor"`
  且 `.mv-diagram` 带 `color:var(--ink)`——缺省色这一半靠这两者合起来生效，任何一半掉了深色
  下文字就又不可见，而 class 断言发现不了。发现 `test/fixtures/export-sample.mdx` **根本没有
  图**（所以 #B2 那条只验到了内联 CSS），补了一个 `dot` 块（构建期出图、零运行时、不破坏自包含）。
- `AGENTS.md` 的「图内颜色的明暗适配」小节按新机制重写：两种情形两种机制、为什么不能给叶子
  打 class、两条配套约束。

## Round 5 — r4 复审的 P2 + 三处 P3，以及我在浏览器里量出的第二层 (2026-07-28T03:35:42Z)

r4 复审：**两个判定 HELD、merge gate HELD**，但带一条 P2 与几条 P3。全部处理，逐条记：

**#A4（P2，遮罩钉黑无条件 → 渲染反转）**——复审给的例子是
`<svg fill="white"><mask><rect/></mask></svg>`：作者的白本该继承进遮罩（= 全部显示），
无条件钉黑变成全部隐藏。我按「只在没有作者声明时才钉」修完，**在浏览器里量了一下，发现
自己只修了一半**：遮罩内 rect 的 computed fill 是 `rgb(45,40,43)` 而不是白——作者写在根上的
白，被我们自己的「白→背景色」语义化换成了 `--surface`，于是深色下遮罩亮度掉到近 0，被遮
元素几乎整个消失。**这是推理推不出来、只有量才会撞见的一层**（复审也没提到）。

正解不是「钉黑 / 不钉」的二选一，而是钉回**「如果我们从没改过 fill，这里会继承到什么」**：
沿祖先链取最近一个作者声明的**字面值**，找不到才用 SVG 初始值 `black`。于是
`<svg fill="white">` 钉回 `white`（遮罩明暗两主题一致、与改动前一致），`<svg fill="#3b82f6">`
钉回蓝（亮度随作者，我们不评判），谁都没声明则钉黑（抵消我们注入的根缺省色）。函数因此
改名 `pinInheritedFillInColorAgnosticContainers`。浏览器复测：深浅两主题下红块都是满亮度
`rgb(239,68,68)`，遮罩内 rect computed fill = 纯白。

**#B15 `fill=""`**：空值在 CSS 里非法、会被丢弃回落初始值，但 `ownColor` 当成「已声明」，
于是一个 `<svg fill="">` 就让**整张图**失去缺省色、深色下全黑不可见。改成空值不算声明。

**#B17 根 `<svg>` 不在顶层**：作者写 `<div><svg>…</svg></div>` 时缺省色完全落空（原实现只扫
顶层数组）。改成「自身是 svg 且祖先里没有别的 svg」，顺带覆盖多个并列根（原实现也只补第一个）
与嵌套 svg（交给继承）。

**#B14 两处讲错的承重注释**：复审实测四步完全可换序、输出逐字节一致，而我的注释宣称有强序
约束。现在注释只声明**真实存在**的那一条（钉遮罩必须先于补根缺省色，否则会把我们自己写的
`currentColor` 误当成作者声明），并有 mutant 守着；其余步骤如实标注「无顺序耦合」。

**#B19 导出断言绑在 JSX 属性书写顺序上**：拆成两条独立断言。

**OQ-6 内联尺寸声明 —— 删掉了。** 复审说它与 `theme.css` 的 `.mv-diagram svg` 完全重复、
缩放也不依赖它，我自己核对了两处代码确认（`Layout.tsx:335` 克隆后 `removeAttribute("style")`；
`theme.css:485` 用 `max-width:none!important` 接管）。既然为了维护一条冗余声明才需要那套
「与作者 style 合并」的逻辑，不如不写——现在我们**完全不改作者根节点的 style**（一条测试
按「一个字都不改」钉住），响应式宽度的保证钉在导出用例对 `theme.css` 那条规则的断言上。
浏览器复测：1937pt 宽的 dot 图仍然不溢出、页面无横向滚动；全屏缩放正常（克隆 svg
`max-width:none`、Esc 退出正常）。

**#B16 文档说大了**：AGENTS.md 原写「非法写法一律判『不是黑白』」，实测仍有几种非法 rgb/hsl
判成黑。改成如实描述取舍，并写清「唯一还会咬人的是祖先声明了颜色那一种」，别让下一个人拿它
当保证。#B11 本体仍不修（理由同复审：非法声明被丢弃后回落的继承值通常就是我们的
`currentColor`，肉眼无差）。

### 变异测试累计 17 个，全部杀死

r5 新增 9 个：遮罩无条件钉黑、钉黑与补根缺省色换序、空属性算声明、style 空值算声明、
嵌套 svg 也当根、只扫顶层找根、一律钉黑而非字面值、钉成 currentColor、取最外层祖先而非最近
——全部变红。加上 r4 的 8 个。

### 仍然记账未修

- **#B11 / #B16**：少数非法 CSS 写法仍被判成黑（`rgb(0,0,0,)`、逗号写法里亮度不带 `%` 的
  `hsl(0,0%,0)` 等）。根治要区分逗号/空格两种语法各自的合法性，收益不抵复杂度；影响面已在
  AGENTS.md 与本文件如实写清。
- **#B4 / #B7**：沿用 r3 的处置。
- **#B18**：`mdx-pipeline.test.mjs` 里一句注释现在说得不准（根 svg 确实带着字面
  `currentColor` 进产物）——纯注释，下次顺手改。
- `tdd-evidence.md` 停在 r2（复审因此付了一次全量重跑）。本文件已承载 r3–r5 的机器事实，
  是否回填该文件留给后续决定。
