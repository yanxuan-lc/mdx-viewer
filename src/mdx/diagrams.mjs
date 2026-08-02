/* ============================================================
   mdx-viewer · 图三车道（rehype 插件，运行在 hast 上）
   —— 借用标准 fenced code block 承载，围栏语言决定引擎：
        dot / graphviz  → 构建期 Graphviz(wasm) 出静态 SVG（零运行时）
        svg             → 原样内联
        mermaid         → 转成 <pre class="mermaid">，客户端渲染
   在 rehype-pretty-code 之前运行，先「吃掉」这三种块，剩下的才交给高亮。
   ============================================================ */
import { visit } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";
import { fromHtml } from "hast-util-from-html";

let graphvizPromise = null;
async function getGraphviz() {
  if (!graphvizPromise) {
    graphvizPromise = import("@hpcc-js/wasm/graphviz").then((m) => m.Graphviz.load());
  }
  return graphvizPromise;
}

const LANG_RE = /(?:^|\s)language-(dot|graphviz|mermaid|svg)(?:\s|$)/;

function langOf(node) {
  const cls = node.properties?.className;
  const arr = Array.isArray(cls) ? cls.join(" ") : String(cls || "");
  const m = LANG_RE.exec(arr);
  return m ? m[1] : null;
}

function textOf(node) {
  let s = "";
  visit(node, "text", (t) => { s += t.value; });
  return s;
}

/** 只做与颜色无关的结构清理：去 XML 序言/DOCTYPE。
 *  黑白语义色改在 hast 层处理（见 themeColors），不再用字符串 regex 猜颜色写法——
 *  那条路永远补不全（大小写、空格、hsl()/rgba()、style 属性内……），
 *  且认不出「文字节点完全不写 fill」这种最关键的一种（SVG 规范里 fill 的初始值是
 *  黑，不是 currentColor，这正是深色主题下图内文字消失的根因）。
 *  （这个函数以前叫 themeSvg——名字是历史遗留：改名是为了不让下一个人把颜色逻辑
 *  加回字符串层，那正是这次要摆脱的路，函数体早已不做任何颜色改写。） */
function normalizeSvgMarkup(svg) {
  return svg
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");
}

/* 这里以前还有一步「往根 SVG 注入 style="max-width:100%;height:auto"」，已删除，理由记下
   免得有人再加回来：
   - 它与 `theme.css` 的 `.mv-diagram svg { max-width: 100%; height: auto }` **完全重复**，
     而那条规则在 dev 与导出两条路径下都生效（导出会内联 theme.css）；
   - 全屏缩放也不依赖它：放大尺寸由 `Layout.tsx` 的 `apply()` 以内联 width/height 写入，
     `max-width` / `max-height` 由 `.mv-zoom-canvas svg` 的 `!important` 接管；
     （这里原本写着「`Layout.tsx` 克隆后就 `removeAttribute("style")`」——那句在删掉本注入
     的同一轮里就被自己作废了：那时删的是我们注入的 style，删完后它删的会是**作者的** style，
     所以那一行也一并去掉了。留这段是为了不让下一个人照着一句过期描述做判断。）
   - 而它有实实在在的害处：原实现在**字符串**上 `replace(/(<svg\b)/, '$1 style="…"')`，
     作者若自己在根上写了 style 就会出现两个 style 属性，HTML 解析规则是**保留第一个**，
     于是作者写在根上的整个 style 被静默吃掉（实测 `<svg style="fill:#3b82f6;stroke-width:2">`
     只剩注入的那条）。
   一句话：为了维护一条冗余声明而引入一套合并逻辑，不如不写——我们干脆不再改作者根节点的
   style。响应式宽度的保证钉在 test/export.test.mjs 对 theme.css 那条规则的断言上。 */

/* ---------- 颜色判定：解析到通道值再比较，不枚举字面写法 ----------
   枚举拼写永远补不全（hex 3/4/6/8 位、逗号与空格两种分隔、百分比通道、显式
   alpha、hsl 亮度极值、大小写与空格……），漏判的后果正是本次要修的 bug：一个
   语义上的纯黑没被认出来，深色主题下就是一块看不见的图形。所以这里解析。

   刻意不解析 lab()/oklab()/oklch()/color()：它们的亮度轴语义不统一（lab 的 L 是
   0–100，oklch 的 L 是 0–1），猜错会把作者的颜色改坏，而改坏作者颜色比漏判一个
   罕见写法更糟——没有任何图生成器（Graphviz / mermaid / 常见编辑器）输出这些
   写法。漏判的方向是「原样保留」，是安全的那一侧。判定见 test/diagram-theme.test.mjs
   的 NOT_SEMANTIC 矩阵（oklch 在里面，是记录在案的取舍，不是疏漏）。 */

const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;
const ANGLE_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:deg|grad|rad|turn)?$/;   // 色相：角度或裸数，不接受 %
const PERCENT_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)%$/;                      // 饱和度：CSS 要求带 %

/** 解析一个 0–255 通道（支持百分比），越界按 CSS 规则夹紧；认不出返回 null。 */
function channel8(raw) {
  if (raw == null) return null;
  const pct = raw.endsWith("%");
  const num = pct ? raw.slice(0, -1) : raw;
  if (!NUMBER_RE.test(num)) return null;
  const n = pct ? (Number(num) * 255) / 100 : Number(num);
  return Math.min(255, Math.max(0, Math.round(n)));
}

/** 解析 alpha（缺省视为 1 = 不透明）；认不出返回 null。 */
function parseAlpha(raw) {
  if (raw == null) return 1;
  const pct = raw.endsWith("%");
  const num = pct ? raw.slice(0, -1) : raw;
  if (!NUMBER_RE.test(num)) return null;
  return pct ? Number(num) / 100 : Number(num);
}

/** hex 三/四/六/八位 → "black" | "white" | "other"。 */
function classifyHex(hex) {
  if (!/^[0-9a-f]+$/.test(hex)) return "other";
  let r, g, b, a;
  if (hex.length === 3 || hex.length === 4) {
    [r, g, b] = [...hex.slice(0, 3)].map((c) => parseInt(c + c, 16));
    a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) : 255;
  } else if (hex.length === 6 || hex.length === 8) {
    [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
  } else {
    return "other";
  }
  if (a !== 255) return "other";
  if (r === 0 && g === 0 && b === 0) return "black";
  if (r === 255 && g === 255 && b === 255) return "white";
  return "other";
}

/** 判定一个颜色写法是不是语义上的纯黑 / 纯白。
 *  半透明一律判 other：把 rgba(0,0,0,.5) 换成 currentColor 会丢掉 alpha，
 *  那是把作者的颜色改成另一个颜色，不是适配主题。 */
function classify(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  if (!v) return "other";
  if (v === "black") return "black";
  if (v === "white") return "white";
  if (v.startsWith("#")) return classifyHex(v.slice(1));

  const fn = /^(rgba?|hsla?)\(([^()]*)\)$/.exec(v);
  if (!fn) return "other";
  // 逗号写法与 CSS Color 4 的空格写法（alpha 用 `/` 分隔）在这里统一切开，
  // 两种写法下第 4 个值都是 alpha。
  const parts = fn[2].split(/[,/\s]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return "other";
  if (parseAlpha(parts[3]) !== 1) return "other";

  if (fn[1].startsWith("rgb")) {
    const ch = parts.slice(0, 3).map(channel8);
    if (ch.some((c) => c === null)) return "other";
    if (ch.every((c) => c === 0)) return "black";
    if (ch.every((c) => c === 255)) return "white";
    return "other";
  }

  // hsl：亮度 0 一定是黑、100% 一定是白，与色相/饱和度无关（所以不必换算成 RGB）。
  // 亮度在 CSS Color 4 的空格写法里允许不带 %（逗号旧写法要求带，这里放宽了一点，
  // 见下）；色相不接受 %、饱和度必须带 %，否则整条判 other——写法非法时浏览器会
  // 整条声明丢弃并回落到继承值，我们要是反而认成黑白，就会用一条 class 盖掉作者
  // 通过继承表达的颜色。宁可漏判（原样保留）也不误判。
  if (!ANGLE_RE.test(parts[0]) || !PERCENT_RE.test(parts[1])) return "other";
  const lRaw = parts[2].endsWith("%") ? parts[2].slice(0, -1) : parts[2];
  if (!NUMBER_RE.test(lRaw)) return "other";
  const l = Number(lRaw);
  if (l <= 0) return "black";
  if (l >= 100) return "white";
  return "other";
}

/** 从 style="k:v;k2:v2" 字符串里取某个声明的值（键名大小写不敏感）。 */
function styleValue(style, prop) {
  if (!style) return undefined;
  for (const decl of String(style).split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    if (decl.slice(0, i).trim().toLowerCase() === prop) return decl.slice(i + 1).trim();
  }
  return undefined;
}

/** 取元素「本体」声明的颜色（内联 style 优先于表现属性，与 CSS 层叠一致），
 *  并标注来源（style/attr）——两种来源在真实级联里的优先级不同（内联 style
 *  几乎打不过，表现属性谁都打得过），下游按来源分层选 CSS 规则正是靠这个标注
 *  （见 semanticClass）。只看这个元素自己，不看祖先——继承判断是调用方的事
 *  （见 themeColors）。
 *  空值（`fill=""`、`style="fill:"`）**不算声明**：CSS 里空值是非法的，浏览器会
 *  丢弃这条声明、回落到继承/初始值。当成「声明了」会让我们跳过缺省色注入——一个
 *  `<svg fill="">` 就能让整张图失去缺省前景色、深色下全黑不可见。 */
function ownColor(node, prop) {
  const styleVal = styleValue(node.properties?.style, prop);
  if (styleVal) return { value: styleVal, source: "style" };
  const attrVal = node.properties?.[prop];
  if (attrVal != null && String(attrVal).trim() !== "") return { value: String(attrVal), source: "attr" };
  return undefined;
}

function addClass(node, name) {
  const props = node.properties || (node.properties = {});
  const existing = Array.isArray(props.className) ? props.className : props.className ? [props.className] : [];
  if (!existing.includes(name)) props.className = [...existing, name];
}

/** class 名按「语气(fg/bg) × 属性(fill/stroke) × 来源(attr/style)」组合；
 *  来源=attr 用不带 `-style` 的基础类（SVG 表现属性天然输给任何 CSS 规则，
 *  普通选择器足够，不必 !important——留出空间让作者仅在 SVG 内部 <style> 里
 *  表达的颜色仍能按级联规则赢：presentation attribute 优先级为 0，我们的类
 *  与作者内部 <style> 的类选择器同优先级，届时按文档顺序决出胜负，作者的
 *  <style> 在 SVG 内部、比 theme.css 更靠后，天然赢）；来源=style 用 `-style`
 *  后缀类（theme.css 里带 !important，因为内联 style 优先级极高，只有
 *  !important 能稳定盖过）。 */
function semanticClass(tone, prop, source) {
  return source === "style" ? `mv-diagram-${tone}-${prop}-style` : `mv-diagram-${tone}-${prop}`;
}

/** `<mask>` / `<clipPath>` 子树里的黑白不是「颜色」，是遮罩/裁剪语义：亮度遮罩里
 *  白 = 显示、黑 = 隐藏，把它们换成主题色等于改遮罩形状（深色下还会把被挖掉的
 *  区域重新显示出来）；裁剪路径只用几何，fill 根本不参与渲染。所以整条子树跳过
 *  ——`stroke` 也一并跳过，亮度遮罩里描边的亮度同样参与遮罩计算。
 *  `<defs>` / `<marker>` / `<pattern>` 不在此列——它们的内容会被真正画到页面上，
 *  一个黑色箭头同样需要跟随主题。 */
const COLOR_AGNOSTIC_CONTAINERS = new Set(["mask", "clippath"]);

function isColorAgnosticContainer(node) {
  return node.type === "element" && COLOR_AGNOSTIC_CONTAINERS.has(String(node.tagName).toLowerCase());
}

function insideColorAgnosticContainer(ancestors) {
  return ancestors.some(isColorAgnosticContainer);
}

/** 遍历「最外层的 `<svg>`」——即自身是 svg、祖先里又没有别的 svg 的元素。
 *  不能只扫 nodes 的顶层：作者完全可以写 `<div><svg>…</svg></div>`，那时 svg
 *  不在顶层，缺省色与尺寸就都落空了（实测过）。嵌套 svg 不处理，它靠继承。 */
function forEachRootSvg(nodes, fn) {
  visitParents({ type: "root", children: nodes }, "element", (node, ancestors) => {
    if (String(node.tagName).toLowerCase() !== "svg") return;
    if (ancestors.some((a) => a.type === "element" && String(a.tagName).toLowerCase() === "svg")) return;
    fn(node);
  });
}

/**
 * 「谁都没声明 fill」的缺省色：在**根 `<svg>`** 上补一个表现属性 `fill="currentColor"`，
 * 让缺省色顺着继承链流下去，而不是逐个给叶子节点打 class。
 *
 * 这是修 P1 后的做法，值得记下为什么：**继承是级联里最弱的一环，输给作者的任何声明**
 * ——元素自己的、祖先的、表现属性的、内联 style 的、SVG 内部 `<style>` 里的，甚至
 * `<use>` 引用处设的，全都赢过继承。而反过来，一旦我们给叶子打 class，那就是一条
 * **声明**，它会盖掉作者通过继承表达的颜色，跟特异度无关（零特异度的 `:where()`
 * 也救不了——特异度只在声明之间比，继承根本不参与比较）。实测踩过两次：
 *   - `<g class="wrap">` 只在内部 `<style>` 里上色时，子级被打上缺省 class → 作者的蓝丢了；
 *   - `<use fill="#a855f7" href="#tri">` 引用的形状被打上缺省 class → 实例渲染成前景色而非紫色。
 * 改成「根上补一个属性」后这两种情况自动正确，也不再需要维护「哪些标签会绘制填充区域」
 * 「哪些容器的内容由引用处上色」这两张必然长期滞后的清单。
 *
 * 用表现属性（而不是 class）是有意的：表现属性优先级为 0，所以作者哪怕只在 SVG 内部
 * `<style>` 里写 `svg { fill: … }` 也照样赢。作者已在根上声明 fill 时不插手。
 */
function applyRootDefaultFill(nodes) {
  forEachRootSvg(nodes, (node) => {
    if (ownColor(node, "fill") === undefined) {
      (node.properties || (node.properties = {})).fill = "currentColor";
    }
  });
}

/** 某个 SVG 的内部 `<style>` 里是否**声明**过 `fill` / `stroke`。
 *
 *  只看**声明块内部**（`{…}` 里），并且先剥掉 CSS 注释——否则 `.fill:hover{…}` 这样的
 *  选择器、注释里的 `fill: white`、`url("…fill:red…")` 这样的值内文本都会被当成声明，
 *  于是本该钉的遮罩不钉（复审 #A7 的探针矩阵）。
 *
 *  仍然**不解析选择器**——那需要在 hast 层实现 CSS matching。所以 `.foo{fill:red}` 这类
 *  「可能命中、也可能不命中遮罩祖先」的规则一律按「可能命中」处理（不钉，把遮罩留给作者
 *  的 CSS）。这是唯一残留的粗判，代价写在下面 pin 函数的限界段里。 */
function hasInternalStyleFor(root, prop) {
  const declRe = new RegExp(`(^|[;{\\s])${prop}\\s*:`, "i");
  let found = false;
  visit(root, "element", (node) => {
    if (found || String(node.tagName).toLowerCase() !== "style") return;
    let css = "";
    visit(node, "text", (t) => { css += t.value; });
    css = css.replace(/\/\*[\s\S]*?\*\//g, "");           // 注释不是声明
    for (const block of css.matchAll(/\{([^{}]*)\}/g)) {  // 只看声明块内部，不看选择器
      if (declRe.test(block[1])) { found = true; break; }
    }
  });
  return found;
}

/** 把 `<mask>` / `<clipPath>` 的继承来源钉成**作者原本的字面值**，让遮罩子树尽可能不受
 *  本文件的改写影响。
 *
 *  为什么需要这一步：遮罩里的颜色是**亮度语义**（白 = 显示、黑 = 隐藏），而我们对颜色
 *  动了两处手脚，两处都会顺着继承漏进遮罩、把遮罩变成随主题变形的东西：
 *    1. 根上补的缺省 `currentColor`——本该「不写 fill = 黑 = 挖掉」的区域变成前景色，
 *       深色下等于把挖掉的部分又显示出来；
 *    2. 祖先自己声明的黑/白被我们语义化成 `--ink` / `--surface`——**实测踩到的就是这一种**：
 *       `<svg fill="white"><mask><rect/></mask></svg>`，作者的白在根上被换成 `--surface`，
 *       深色下遮罩内容的亮度掉到近 0，被遮元素几乎整个消失（浏览器里量到遮罩内 rect 的
 *       computed fill 是 `rgb(45,40,43)` 而不是白）。`stroke` 同样会漏（复审 #A6 实测：
 *       `<svg stroke="black">` 下遮罩内的描边亮度在浅色下≈黑、深色下≈白，同一份遮罩两个
 *       主题形状不同），所以两个属性都要处理。
 *
 *  钉的值是**沿祖先链找最近一个作者声明的字面值**——等价于「如果我们从没改过颜色，这里会
 *  继承到什么」。`fill` 找不到时回落 SVG 初始值 `black`；`stroke` **没有**回落值（初始值
 *  就是 `none`、我们也从不注入 stroke，所以只在祖先真声明过时才需要钉）。容器自己声明了
 *  对应属性时完全不插手。钉上去的值必须**不被语义化**，否则刚钉回的 white 立刻又变成
 *  `--surface`——themeColors 因此连容器自身一起跳过（不只是子树）。
 *
 *  **这一步必须跑在 applyRootDefaultFill 之前**：等根上补完 currentColor 再看，就分不清
 *  那个 fill 是作者写的还是我们刚写的了。这条顺序约束是真的、有 mutant 守着。
 *
 *  ## 限界（这是启发式，不是「完全绝缘」，别把它当保证）
 *
 *  `ownColor` 只看得见表现属性与内联 style，**看不见 SVG 内部 `<style>` 里的规则**——hast
 *  层没有选择器匹配。而内部 `<style>` 的优先级高于我们注入的表现属性，所以那种情形下我们
 *  根本没有扰动继承链，钉反而会把作者的遮罩改坏（复审 #A5 实测：`<style>svg{fill:white}</style>`
 *  时钉 `black` 会让遮罩从「全显示」翻成「全隐藏」，两个主题都消失，纯倒扣）。
 *  因此：**同一个根 svg 的内部 `<style>` 里声明过该属性时，这张图里的遮罩一律不钉**——宁可
 *  放弃抵消我们自己的注入（代价：那张图的遮罩可能随主题变形），也不去改一个作者已经用 CSS
 *  掌控住的遮罩。这与本改动的硬边界一致：别动作者故意设的颜色。
 *
 *  这个判断本身是粗判且**偏保守**：`hasInternalStyleFor` 只认声明块里的声明（注释、选择器、
 *  值内文本都已排除，作用域也限定在这一个根 svg），但**不做选择器匹配**——所以
 *  `.foo{fill:red}` 这种「可能命中也可能不命中遮罩祖先」的规则会让整张图不钉，即使那条规则
 *  与遮罩毫无关系。后果是我们没能抵消自己注入的缺省色，遮罩亮度可能随主题变；作者的颜色
 *  始终没被动过。真正闭合需要在 hast 层实现 CSS 级联，不在本次范围。 */
function pinInheritedColorInColorAgnosticContainers(nodes) {
  // 「作者用内部 <style> 掌控着」这个判断按**每个根 svg** 分别算：一个围栏里可以有多个
  // 并列的根，A 里的 <style> 不该让 B 里的遮罩不钉（复审 #A7 的跨 svg 串味）。
  const controlsByRoot = new Map();
  forEachRootSvg(nodes, (svg) => {
    controlsByRoot.set(svg, {
      fill: hasInternalStyleFor(svg, "fill"),
      stroke: hasInternalStyleFor(svg, "stroke"),
    });
  });
  visitParents({ type: "root", children: nodes }, "element", (node, ancestors) => {
    if (!isColorAgnosticContainer(node)) return;
    const root = ancestors.find((a) => controlsByRoot.has(a));
    const styleControls = controlsByRoot.get(root) ?? { fill: false, stroke: false };
    for (const prop of ["fill", "stroke"]) {
      if (styleControls[prop]) continue;              // 作者用内部 <style> 掌控着，见限界说明
      if (ownColor(node, prop) !== undefined) continue; // 容器自己声明了，尊重作者
      // fill 的 SVG 初始值是 black，需要一个回落值；stroke 的初始值是 none 且我们从不注入
      // stroke，所以只在祖先真声明过时才钉（回落值留空 = 不钉）。
      let inherited = prop === "fill" ? "black" : undefined;
      for (let i = ancestors.length - 1; i >= 0; i--) {
        const a = ancestors[i];
        if (a.type !== "element") continue;
        const declared = ownColor(a, prop);
        if (declared) { inherited = declared.value; break; }
      }
      if (inherited !== undefined) (node.properties || (node.properties = {}))[prop] = inherited;
    }
  });
}

/**
 * 在 hast 树上把**元素自己声明的**黑/白标记为语义色 class，真实颜色值留在 theme.css
 * （随主题联动）。「谁都没声明」那一种缺省不在这里处理——见 applyRootDefaultFill，
 * 它靠继承而不是靠打 class，因为打 class 会盖掉作者用继承表达的颜色。
 *
 * 只认黑与白；其余写法（含 "none"、半透明黑、作者显式颜色如 fill="red"）原样保留
 * ——改掉作者的表达意图是另一个 bug。
 *
 * 只看元素**自己**声明的值（表现属性或内联 style），不看继承：一个元素从祖先继承到
 * 的颜色是作者的选择，不该由我们在子级这一层改写；祖先自己的黑白会在祖先那一层被
 * 分类，继承会把结果带下来，不必也不应该重复标注。
 *
 * `stroke` 与 `fill` 同规则，只是没有「缺省」那一支（SVG 里 `stroke` 的初始值是
 * `none` 而不是黑，本来就不可见，不是本次要修的 bug）。
 *
 * `dot`/`svg` 两条车道共用这一处，行为在 `mdxv`(dev) 与 `mdxx`(导出) 下一致。
 */
function themeColors(nodes) {
  visitParents({ type: "root", children: nodes }, "element", (node, ancestors) => {
    // 容器自己也要跳过，不只是它的子树：pinInheritedColorInColorAgnosticContainers 会在
    // `<mask>` 上钉回「作者原本会继承到的字面值」（没有作者声明时是 SVG 初始值 black），
    // 那是遮罩亮度语义而不是颜色，若在这里被当成「黑/白→主题色」改写，等于把刚钉回去的
    // 值又拆掉。
    if (isColorAgnosticContainer(node) || insideColorAgnosticContainer(ancestors)) return;

    for (const prop of ["fill", "stroke"]) {
      const declared = ownColor(node, prop);
      if (!declared) continue;
      const tone = classify(declared.value);
      if (tone === "black") addClass(node, semanticClass("fg", prop, declared.source));
      else if (tone === "white") addClass(node, semanticClass("bg", prop, declared.source));
      // tone === "other"：作者显式颜色（含 "none"），原样保留
    }
  });
}

/** Graphviz 会在 <g id="graph0" class="graph"> 里铺一张白色整图背景多边形；
 *  剥掉它让 dot 图与 mermaid/svg 车道一样透明。这里是**结构清理**，不是颜色语义化，
 *  两者是两件事，故意分开决策。
 *  （早先这里写着「这一步必须先于 themeColors 跑」——**那是错的**，复审实测把两者换序
 *  后输出逐字节相同：themeColors 只加 class，不改 fill 属性，所以本函数读到的写法不受它
 *  影响。旧的字符串实现会改写属性，那时约束是真的；改到 hast 层后它就退化了。留这段是
 *  为了不让下一个人再从那句错误约束里推出别的结论。）
 *  用 id 锚定，不影响 `svg` 车道的作者原图（作者极不会用这个 id+class 组合）。
 *  按「graph0 的直接子节点里所有白色多边形」匹配，而非「紧跟开标签的第一个」
 *  ——具名图（如 `digraph G {...}`）会在两者之间插一个 <title>G</title>，按
 *  位置匹配会漏掉它（这正是旧字符串 regex 的疏漏：具名 dot 图在深色主题下曾
 *  残留一张白纸底；结构化匹配顺带修掉了它，见 test/diagram-theme.test.mjs 的
 *  具名图用例）。 */
function stripGraphvizBackdrop(nodes) {
  visit({ type: "root", children: nodes }, "element", (g) => {
    if (g.tagName !== "g" || g.properties?.id !== "graph0") return;
    const cls = Array.isArray(g.properties?.className) ? g.properties.className : [];
    if (!cls.includes("graph")) return;
    g.children = g.children.filter((child) => {
      if (child.type !== "element" || child.tagName !== "polygon") return true;
      // 走 ownColor 而不是自己拼「style ?? 属性」：那份手写逻辑漏掉了空值处理，
      // `style="fill:"` 会盖掉后面真实的 fill="white"，于是背景剥不掉、深色下留一张纸色底。
      return classify(ownColor(child, "fill")?.value) !== "white";
    });
  });
}

function svgToHast(svg) {
  const root = fromHtml(svg, { fragment: true });
  const nodes = root.children.filter((c) => c.type === "element" || c.type === "text");
  stripGraphvizBackdrop(nodes);
  // 这一对的先后是**真约束**（有 mutant 守着）：钉遮罩初始值要判断「祖先链上有没有
  // 作者声明的 fill」，必须在我们自己往根上写 currentColor 之前问，否则问到的是自己。
  pinInheritedColorInColorAgnosticContainers(nodes);
  applyRootDefaultFill(nodes);
  // themeColors 与上面两步之间没有顺序耦合（它只加 class，不改 fill 属性）。如实说明，
  // 免得下一个人以为这几步是一条强序链——早先一版注释就那么写过，复审实测那条约束
  // 当时并不存在。
  themeColors(nodes);
  return nodes;
}

function figureWrap(children, kind) {
  return {
    type: "element",
    tagName: "div",
    properties: { className: ["mv-diagram", `mv-diagram-${kind}`] },
    children,
  };
}

export function rehypeDiagrams() {
  return async (tree) => {
    const jobs = [];
    // 收集目标（visit 是同步的，异步渲染在收集后统一做）
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "code" || !parent || index == null) return;
      const lang = langOf(node);
      if (!lang) return;
      // 父节点通常是 <pre>；以 <pre> 为替换单位
      const isPre = parent.tagName === "pre";
      const target = isPre ? parent : node;
      jobs.push({ lang, source: textOf(node), target });
    });
    if (!jobs.length) return;

    const gv = jobs.some((j) => j.lang === "dot" || j.lang === "graphviz")
      ? await getGraphviz()
      : null;

    for (const { lang, source, target } of jobs) {
      let replacement;
      if (lang === "dot" || lang === "graphviz") {
        const svg = normalizeSvgMarkup(gv.dot(source));
        replacement = figureWrap(svgToHast(svg), "dot");
      } else if (lang === "svg") {
        replacement = figureWrap(svgToHast(normalizeSvgMarkup(source)), "svg");
      } else if (lang === "mermaid") {
        // 保留源码，客户端 mermaid.run() 渲染；用 data 存原文，便于明暗重渲。
        replacement = figureWrap(
          [{
            type: "element",
            tagName: "pre",
            properties: { className: ["mermaid"] },
            children: [{ type: "text", value: source }],
          }],
          "mermaid",
        );
      }
      if (replacement) Object.assign(target, replacement);
    }
  };
}
