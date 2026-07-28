/* ============================================================
   单测 · src/mdx/diagrams.mjs 的语义色处理（黑→前景 / 白→背景）
   —— 背景（openspec/changes/diagram-theme-adaptation/HYPOTHESIS.md）：
      Graphviz 的 <text> 不写 fill，SVG 规范里 fill 的初始值是黑而非
      currentColor，深色主题下框线变白但文字仍黑，从而不可见；且旧版
      themeSvg 只用字符串 regex 认三种黑色写法，漏了大半真实写法。
   —— 直接在 hast 层构造 `<pre><code class="language-x">…</code></pre>`
      结构跑 rehypeDiagrams()，比整段 MDX compile() 更precise、更快
      （spelling 矩阵靠 svg 车道，不需要 Graphviz wasm；核心回归靠
      dot 车道，验证真实 Graphviz 输出）。
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { visit } from "unist-util-visit";
import { rehypeDiagrams } from "../src/mdx/diagrams.mjs";

/** 构造一个只含单个 fenced code 块的 hast 树，跑一遍 rehypeDiagrams()。
 *  返回替换后的 `<pre>`（即 mv-diagram 外壳 div）节点。 */
async function renderLane(lang, source) {
  const tree = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "pre",
        properties: {},
        children: [
          {
            type: "element",
            tagName: "code",
            properties: { className: [`language-${lang}`] },
            children: [{ type: "text", value: source }],
          },
        ],
      },
    ],
  };
  await rehypeDiagrams()(tree);
  return tree.children[0];
}

function classesOf(node) {
  const c = node?.properties?.className;
  return Array.isArray(c) ? c : c ? [c] : [];
}

/** 在渲染结果里找第一个匹配 tagName 的后代元素节点。 */
function findFirst(root, tagName) {
  let found;
  visit(root, "element", (node) => {
    if (!found && node.tagName === tagName) found = node;
  });
  return found;
}

function findAll(root, tagName) {
  const out = [];
  visit(root, "element", (node) => {
    if (node.tagName === tagName) out.push(node);
  });
  return out;
}

// ---------- 核心回归：dot 车道，Graphviz 真实输出（无 fill 的 <text>） ----------

test("dot 车道核心回归：Graphviz 不写 fill 的 <text> 必须能拿到前景色（不能停留在 SVG 默认黑）", async () => {
  const wrapper = await renderLane("dot", `digraph { a [label="X"]; b [label="Y"]; a -> b }`);
  const texts = findAll(wrapper, "text");
  assert.ok(texts.length >= 2, "dot 源里两个节点标签都应生成 <text>");
  for (const t of texts) {
    assert.equal(t.properties.fill, undefined, "Graphviz 原样不写 fill 属性（前提断言，防止未来版本变更悄悄让测试失去意义）");
    assert.equal(classesOf(t).length, 0, "缺省色不靠给叶子打 class（那会盖掉作者用继承表达的颜色）");
  }
  // 缺省色的来源是根 <svg> 上补的表现属性，靠继承流到每个 <text>：
  // Graphviz 的 <text>/<g class="node">/<g id="graph0"> 一路都不声明 fill，
  // 所以继承链一定通到根。
  const svg = findFirst(wrapper, "svg");
  assert.equal(svg.properties.fill, "currentColor", "根 <svg> 必须带缺省前景色，否则文字落进 SVG 初始值黑");
});

test("dot 车道：节点描边 stroke=\"black\" 换成前景语义色", async () => {
  const wrapper = await renderLane("dot", `digraph { a [label="X"] }`);
  const ellipse = findFirst(wrapper, "ellipse");
  assert.ok(ellipse, "默认节点形状应为 ellipse");
  assert.ok(classesOf(ellipse).includes("mv-diagram-fg-stroke"), "stroke=black 应换成前景语义色");
});

test("dot 车道：graph0 背景多边形仍被剥掉（保持与 svg/mermaid 车道一致的透明画布）", async () => {
  const wrapper = await renderLane("dot", `digraph { a [label="X"] }`);
  let graph0;
  visit(wrapper, "element", (node) => {
    if (node.tagName === "g" && node.properties?.id === "graph0") graph0 = node;
  });
  assert.ok(graph0, "应有 id=graph0 的 <g>");
  const backdropPolygons = graph0.children.filter(
    (c) => c.type === "element" && c.tagName === "polygon",
  );
  assert.equal(backdropPolygons.length, 0, "graph0 的白色背景多边形应被移除，不应留下（也不应变成 mv-diagram-bg-fill 的实心矩形）");
});

test("dot 车道 · #B6 具名图（digraph G {...}）的背景多边形同样必须被剥掉——这是旧字符串 regex 的潜伏疏漏", async () => {
  // Graphviz 对具名图会在 <g id="graph0"> 与背景多边形之间插一个 <title>G</title>；
  // 旧版 `>\s*<polygon` 位置锚定的字符串 regex 因此永远匹配不上具名图（实测：
  // `digraph { a }` 生效，`digraph G { a }` / `graph G { a -- b }` 全部失效），
  // 具名 dot 图在深色主题下曾残留一张白纸底。现在的结构化匹配（按 graph0 的
  // 直接子节点里所有白色多边形，而非「紧跟开标签的第一个」）天然不受位置影响。
  // examples/demo.mdx 里的 dot 图是匿名的，浏览器核对不可能覆盖到这条，只能靠单测钉住。
  const wrapper = await renderLane("dot", `digraph G { a -> b }`);
  let graph0;
  visit(wrapper, "element", (node) => {
    if (node.tagName === "g" && node.properties?.id === "graph0") graph0 = node;
  });
  assert.ok(graph0, "应有 id=graph0 的 <g>");
  const titles = graph0.children.filter((c) => c.type === "element" && c.tagName === "title");
  assert.ok(titles.length > 0, "前提断言：具名图确实会在 graph0 里插入 <title>（否则这条测试就见证不到旧疏漏）");
  const backdropPolygons = graph0.children.filter((c) => c.type === "element" && c.tagName === "polygon");
  assert.equal(backdropPolygons.length, 0, "具名图的白色背景多边形也应被剥掉，不能因为 <title> 插在中间就漏判");
});

test('dot 车道 · #B8 只剥「白色」背景多边形：作者用 bgcolor 指定的背景必须留下', async () => {
  // 上一轮的两条剥离测试都只断言「剥完为 0」，所以把剥离改成「无条件删掉 graph0 的
  // 直接子多边形」也全绿——而那会让 `bgcolor=red` 的整块背景凭空消失。浏览器核对
  // 也发现不了（examples 里的图没设 bgcolor）。这条按「留下」的方向钉住。
  const wrapper = await renderLane("dot", `digraph { bgcolor="red"; a [label="X"] }`);
  let graph0;
  visit(wrapper, "element", (node) => {
    if (node.tagName === "g" && node.properties?.id === "graph0") graph0 = node;
  });
  const polygons = graph0.children.filter((c) => c.type === "element" && c.tagName === "polygon");
  assert.equal(polygons.length, 1, "作者显式要的红色背景是设计意图，不能跟白底一起被剥掉");
  assert.equal(polygons[0].properties.fill, "red", "而且要原样保留，不被语义化");
});

// ---------- 拼写矩阵：黑色写法（fill / stroke / style，大小写与空格不敏感） ----------

// 判定走「解析成通道值再比较」，不是枚举字面写法——所以这份矩阵是抽样见证，
// 不是白名单：每一行代表一类语法（hex 3/4/6/8 位、逗号/空格分隔、百分比通道、
// 显式 alpha、hsl 亮度极值、大小写与空格），任一类退回枚举实现都会红。
const BLACK_SPELLINGS = [
  "black", "#000", "#000000", "rgb(0,0,0)", "RGB(0, 0, 0)", "  black  ",
  "#000f", "#000000ff",              // 带 alpha 的 hex 短/长写法（alpha 满值 = 不透明）
  "rgb(0 0 0)", "rgb(0 0 0 / 100%)", // CSS Color 4 空格分隔 + 斜杠 alpha
  "rgba(0,0,0,1)",                   // 老式 rgba 显式 alpha
  "rgb(0% 0% 0%)",                   // 百分比通道
  "hsl(0,0%,0%)", "HSL(210 80% 0%)", // 亮度 0 一定是黑，与色相/饱和度无关
  "hsl(0 0% 0)",                     // CSS Color 4 允许亮度不带 %
];

for (const spelling of BLACK_SPELLINGS) {
  test(`svg 车道拼写矩阵 · fill="${spelling}" 应换成前景语义色`, async () => {
    const wrapper = await renderLane("svg", `<svg><rect fill="${spelling}" width="10" height="10"/></svg>`);
    const rect = findFirst(wrapper, "rect");
    assert.ok(classesOf(rect).includes("mv-diagram-fg-fill"), `fill="${spelling}" 应被认成黑`);
  });

  test(`svg 车道拼写矩阵 · stroke="${spelling}" 应换成前景语义色`, async () => {
    const wrapper = await renderLane("svg", `<svg><rect stroke="${spelling}" width="10" height="10"/></svg>`);
    const rect = findFirst(wrapper, "rect");
    assert.ok(classesOf(rect).includes("mv-diagram-fg-stroke"), `stroke="${spelling}" 应被认成黑`);
  });
}

test('svg 车道 · style="fill:black" 变体（旧 regex 完全认不出，因为它只看属性不看 style）', async () => {
  const wrapper = await renderLane("svg", `<svg><rect style="fill:black;opacity:.5" width="10" height="10"/></svg>`);
  const rect = findFirst(wrapper, "rect");
  // 来源是内联 style，必须是带 !important 的 `-style` 变体——内联 style 优先级
  // 极高，普通 class（无后缀）打不过它，见 theme.css 里两者的规则区分。
  assert.ok(classesOf(rect).includes("mv-diagram-fg-fill-style"), 'style 里的 fill:black 也应被识别，且用 -style 变体');
  assert.ok(!classesOf(rect).includes("mv-diagram-fg-fill"), "不应同时打上不带 !important 的普通变体");
});

test('svg 车道 · style="stroke: BLACK" 变体（大小写 + 空格）', async () => {
  const wrapper = await renderLane("svg", `<svg><rect style="stroke: BLACK" width="10" height="10"/></svg>`);
  const rect = findFirst(wrapper, "rect");
  assert.ok(classesOf(rect).includes("mv-diagram-fg-stroke-style"), "style 里带大小写/空格的黑色写法也应被识别，且用 -style 变体");
});

// ---------- 拼写矩阵：白色写法 → 背景语义色 ----------

const WHITE_SPELLINGS = [
  "white", "#fff", "#ffffff", "rgb(255,255,255)",
  "#ffff", "#ffffffff",
  "rgb(255 255 255)", "rgba(255,255,255,1)",
  "rgb(100%,100%,100%)",
  "hsl(0,0%,100%)", "hsl(140 60% 100%)", // 亮度 100% 一定是白
];

for (const spelling of WHITE_SPELLINGS) {
  test(`svg 车道拼写矩阵 · fill="${spelling}" 应换成背景语义色`, async () => {
    const wrapper = await renderLane("svg", `<svg><rect fill="${spelling}" width="10" height="10"/></svg>`);
    const rect = findFirst(wrapper, "rect");
    assert.ok(classesOf(rect).includes("mv-diagram-bg-fill"), `fill="${spelling}" 应被认成白，映射到背景色`);
  });
}

test('svg 车道 · style="fill:white" 变体应换成背景语义色', async () => {
  const wrapper = await renderLane("svg", `<svg><rect style="fill:white" width="10" height="10"/></svg>`);
  const rect = findFirst(wrapper, "rect");
  assert.ok(classesOf(rect).includes("mv-diagram-bg-fill-style"), 'style 里的 fill:white 也应被识别为背景色，且用 -style 变体');
});

// ---------- 边界：作者显式颜色必须原样保留，不能被语义化 ----------

test("svg 车道 · fill=\"red\" 是作者的表达意图，不应被当成语义色改写", async () => {
  const wrapper = await renderLane("svg", `<svg><rect fill="red" width="10" height="10"/></svg>`);
  const rect = findFirst(wrapper, "rect");
  assert.equal(rect.properties.fill, "red", "作者显式颜色的属性值不应被移除/改写");
  assert.ok(!classesOf(rect).includes("mv-diagram-fg-fill"), "红色不是黑，不该打前景 class");
  assert.ok(!classesOf(rect).includes("mv-diagram-bg-fill"), "红色不是白，不该打背景 class");
});

test('svg 车道 · fill="none" 不是「未指定」，也不是黑/白，不应被语义化（Graphviz 边线常用此值表达透明填充）', async () => {
  const wrapper = await renderLane("svg", `<svg><path fill="none" stroke="black" d="M0,0 L1,1"/></svg>`);
  const path = findFirst(wrapper, "path");
  assert.ok(!classesOf(path).includes("mv-diagram-fg-fill"), 'fill="none" 不应被当成缺省 fill 处理');
  assert.ok(!classesOf(path).includes("mv-diagram-bg-fill"), 'fill="none" 不是白色');
  assert.ok(classesOf(path).includes("mv-diagram-fg-stroke"), "stroke=black 仍应正常换成前景语义色");
});

// ---------- 缺省 fill 的机制：根 <svg> 上补表现属性，靠继承，不给叶子打 class ----------
// 这一段的形状经历过两次修正，机制本身就是结论，值得把理由留在测试里：
//  r2 只给 <text> 打缺省 class，形状留成「待决策边界」——但 SVG 的初始值就是黑，手写
//     `<circle stroke="currentColor"/>` 在深色下是一枚看不见的黑饼，与文字不可见同根同源。
//  r3 把 class 扩到所有会绘制填充区域的形状——随即在浏览器里量出两类回归：作者只在
//     内部 <style> 里给祖先上色时子级被顶掉；`<use fill="…">` 引用的形状被顶掉。
//  r3 收口：缺省色改由**根 <svg> 的表现属性**提供，靠继承流下去。关键事实——
//     **继承是级联里最弱的一环，输给作者的任何声明；而 class 本身就是一条声明，会盖掉
//     作者用继承表达的颜色，跟特异度无关**（零特异度的 :where() 也救不了：特异度只在
//     声明之间比较，继承根本不参与）。于是「哪些标签会绘制填充区域」「哪些容器的内容
//     由引用处上色」这两张必然长期滞后的清单也一并不需要了。

test("svg 车道 · 缺省色来自根 <svg> 的表现属性（不是给叶子打 class）", async () => {
  const wrapper = await renderLane("svg", `<svg><circle cx="5" cy="5" r="4" stroke="currentColor"/></svg>`);
  const svg = findFirst(wrapper, "svg");
  const circle = findFirst(wrapper, "circle");
  assert.equal(svg.properties.fill, "currentColor", "根上补缺省前景色，形状靠继承拿到它");
  assert.equal(classesOf(circle).length, 0, "叶子不打 class——那会盖掉作者用继承表达的颜色");
  assert.equal(circle.properties.stroke, "currentColor", "作者写的 stroke 值不应被改写");
});

test("svg 车道 · 用表现属性而非 class 是刻意的：表现属性优先级为 0，作者的内部 <style> 仍能赢", async () => {
  const wrapper = await renderLane("svg", `<svg><style>svg{fill:#3b82f6}</style><rect width="9" height="9"/></svg>`);
  const svg = findFirst(wrapper, "svg");
  assert.equal(svg.properties.fill, "currentColor", "属性照常补");
  assert.equal(
    classesOf(svg).length, 0,
    "但不能顺手再打个 class——那就变成一条 CSS 声明，会与作者的 svg{fill:…} 争胜，属性则天然输给它",
  );
});

test("svg 车道 · 作者已在根上声明 fill 时不插手", async () => {
  const wrapper = await renderLane("svg", `<svg fill="#3b82f6"><rect width="9" height="9"/></svg>`);
  assert.equal(findFirst(wrapper, "svg").properties.fill, "#3b82f6", "作者的根 fill 必须原样保留");
});

test('svg 车道 · 作者用内联 style="fill:…" 在根上声明也算声明，同样不插手', async () => {
  const wrapper = await renderLane("svg", `<svg style="fill:#3b82f6;stroke-width:2"><rect width="9" height="9"/></svg>`);
  const svg = findFirst(wrapper, "svg");
  assert.equal(svg.properties.fill, undefined, "不应再补一个表现属性上去");
  // 作者写在根上的 style 必须**逐字**留下。历史：以前这里会被我们注入的响应式尺寸
  // 声明整条吃掉（字符串层拼出两个 style 属性，HTML 只保留第一个）；那条注入已删除
  // （与 theme.css 的 `.mv-diagram svg` 规则完全重复），所以现在根本不该改这个属性。
  assert.equal(svg.properties.style, "fill:#3b82f6;stroke-width:2", "作者的根 style 应原样保留，一个字都不改");
});

test("svg 车道 · 作者没写根 style 时也不该凭空造一个（响应式宽度由 theme.css 负责）", async () => {
  const wrapper = await renderLane("svg", `<svg><rect width="9" height="9"/></svg>`);
  assert.equal(findFirst(wrapper, "svg").properties.style, undefined, "不再往作者的根节点注入 style");
});

test('svg 车道 · #B15 `fill=""` 是非法空值、不算声明——否则一个空属性就让整张图失去缺省色', async () => {
  const wrapper = await renderLane("svg", `<svg fill=""><text x="0" y="0">hi</text></svg>`);
  assert.equal(
    findFirst(wrapper, "svg").properties.fill, "currentColor",
    'CSS 里空值非法、会被丢弃并回落到初始值黑，所以必须照常补缺省色',
  );
});

test('svg 车道 · #B15 `style="fill:"` 同理（空值不算声明）', async () => {
  const wrapper = await renderLane("svg", `<svg style="fill:"><text x="0" y="0">hi</text></svg>`);
  assert.equal(findFirst(wrapper, "svg").properties.fill, "currentColor", "内联 style 里的空值同样不算声明");
});

test("svg 车道 · #B17 根 <svg> 不在顶层（外面包了一层 <div>）时，缺省色仍必须生效", async () => {
  const wrapper = await renderLane("svg", `<div><svg><text x="0" y="0">hi</text></svg></div>`);
  assert.equal(
    findFirst(wrapper, "svg").properties.fill, "currentColor",
    "只扫顶层节点会漏掉这种写法，整张图就没有缺省色了",
  );
});

test("svg 车道 · 多个并列的根 <svg> 每一个都要补缺省色", async () => {
  const wrapper = await renderLane("svg", `<svg><text x="0" y="0">a</text></svg><svg><text x="0" y="0">b</text></svg>`);
  const svgs = findAll(wrapper, "svg");
  assert.equal(svgs.length, 2, "前提断言：两个根 svg 都在树里");
  for (const s of svgs) assert.equal(s.properties.fill, "currentColor", "每个根都要补，不能只补第一个");
});

test("svg 车道 · 嵌套 <svg> 不重复补（它靠继承拿到外层的值）", async () => {
  const wrapper = await renderLane("svg", `<svg><svg id="inner"><text x="0" y="0">hi</text></svg></svg>`);
  const inner = findAll(wrapper, "svg").find((s) => s.properties?.id === "inner");
  assert.equal(inner.properties.fill, undefined, "内层 svg 交给继承，不该被当成根");
});

test("svg 车道 · #A3 回归：祖先仅通过 SVG 内部 <style> 的 class 上色时，子级不得被缺省色顶掉", async () => {
  // r3 首版实测：<g class="wrap"> 的蓝色只写在内部 <style> 里，ownColor() 读不到
  // （它只看表现属性与内联 style），于是子级被判成「无继承来源」而打上缺省 class，
  // 作者的蓝就被顶掉了。改用根属性 + 继承后，g 的声明天然赢过从根继承来的值。
  const wrapper = await renderLane(
    "svg",
    `<svg><style>.wrap{fill:#3b82f6}</style><g class="wrap"><text x="0" y="0">hi</text><rect width="9" height="9"/></g></svg>`,
  );
  assert.equal(classesOf(findFirst(wrapper, "text")).length, 0, "text 不得被打 class，否则盖掉祖先的蓝");
  assert.equal(classesOf(findFirst(wrapper, "rect")).length, 0, "rect 同理");
});

test("svg 车道 · 祖先用表现属性声明 fill 时，子级同样不打任何 class（交给继承）", async () => {
  const wrapper = await renderLane("svg", `<svg><g fill="#3b82f6"><rect width="10" height="10"/><text x="0" y="0">hi</text></g></svg>`);
  assert.equal(classesOf(findFirst(wrapper, "rect")).length, 0, "rect 会继承到祖先的蓝色，那是作者的选择");
  assert.equal(classesOf(findFirst(wrapper, "text")).length, 0, "text 同理");
});

// ---------- <mask> / <clipPath> 子树：这里的黑白不是颜色，是遮罩语义，动了就是改语义 ----------

test("svg 车道 · <mask> 子树里的黑/白必须原样保留——亮度遮罩里白=显示、黑=隐藏，改颜色等于改遮罩", async () => {
  const wrapper = await renderLane(
    "svg",
    `<svg><mask id="m"><rect fill="white" width="10" height="10"/><circle fill="black" cx="5" cy="5" r="3"/></mask></svg>`,
  );
  const rect = findFirst(wrapper, "rect");
  const circle = findFirst(wrapper, "circle");
  assert.equal(classesOf(rect).length, 0, "遮罩里的白是「全部显示」，换成 --surface 会让遮罩随主题变形");
  assert.equal(classesOf(circle).length, 0, "遮罩里的黑是「挖掉这块」，换成前景色会让被挖的区域重新出现");
});

test("svg 车道 · <mask> 上必须把 SVG 初始值 fill=black 钉回去——否则根上的缺省前景色会继承进遮罩", async () => {
  // 这是「根上补缺省色」带来的唯一代价，必须显式抵消：遮罩里没写 fill 的区域本该是
  // 黑（=挖掉），继承到 currentColor 后会变成「显示」，深色下遮罩还会随主题变形。
  const wrapper = await renderLane("svg", `<svg><mask id="m"><rect width="10" height="10"/></mask></svg>`);
  const mask = findFirst(wrapper, "mask");
  assert.equal(mask.properties.fill, "black", "遮罩容器要钉回初始值黑");
  assert.equal(classesOf(mask).length, 0, "而且这个 black 不能反过来被「黑→前景」语义化，否则等于没钉");
});

test('svg 车道 · #A4 祖先声明的白必须以**字面值**钉进遮罩，不能钉黑、也不能让它被语义化', async () => {
  // 复审抓到的 P2 + 我在浏览器里量出的第二层：`<svg fill="white">` 时
  //  - 无条件钉黑 → 遮罩全隐藏（改动前是全显示，渲染反转）；
  //  - 什么都不钉 → 根上的白被我们语义化成 --surface，深色下遮罩亮度掉到近 0，
  //    被遮元素几乎整个消失（实测遮罩内 rect 的 computed fill 是 rgb(45,40,43)）。
  // 正解是钉回「如果我们从没改过 fill，这里会继承到什么」= 作者的字面 white。
  const wrapper = await renderLane("svg", `<svg fill="white"><mask id="m"><rect width="10" height="10"/></mask></svg>`);
  const mask = findFirst(wrapper, "mask");
  assert.equal(mask.properties.fill, "white", "钉回作者的字面值，遮罩明暗两主题下都照常全显示");
  assert.equal(classesOf(mask).length, 0, "钉回的白不能反过来被语义化成 --surface，否则等于没钉");
});

test("svg 车道 · #A4 反方向：谁都没声明时钉 SVG 初始值黑（不能因为修 A4 就把钉这件事整个关掉）", async () => {
  const wrapper = await renderLane("svg", `<svg><mask id="m"><rect width="10" height="10"/></mask></svg>`);
  assert.equal(findFirst(wrapper, "mask").properties.fill, "black", "我们注入了根缺省色，就必须在遮罩处抵消");
});

test("svg 车道 · #A4 取最近的祖先声明，不是最外层", async () => {
  const wrapper = await renderLane(
    "svg",
    `<svg fill="white"><g fill="#3b82f6"><mask id="m"><rect width="10" height="10"/></mask></g></svg>`,
  );
  assert.equal(findFirst(wrapper, "mask").properties.fill, "#3b82f6", "最近的祖先声明才是真实的继承来源");
});

test("svg 车道 · #A4 作者用非黑白颜色声明祖先时也照样钉字面值（亮度随作者，我们不评判）", async () => {
  const wrapper = await renderLane("svg", `<svg><g fill="#3b82f6"><mask id="m"><rect width="10" height="10"/></mask></g></svg>`);
  assert.equal(findFirst(wrapper, "mask").properties.fill, "#3b82f6", "作者的蓝原样钉进遮罩");
});

test("svg 车道 · 作者自己在 <mask> 上声明了 fill 时尊重作者，不覆盖", async () => {
  const wrapper = await renderLane("svg", `<svg><mask id="m" fill="white"><rect width="10" height="10"/></mask></svg>`);
  const mask = findFirst(wrapper, "mask");
  assert.equal(mask.properties.fill, "white", "作者的值原样保留");
  assert.equal(classesOf(mask).length, 0, "作者在遮罩上写的白也是遮罩语义，不该被语义化成背景色");
});

test("svg 车道 · <mask> 子树里的 stroke 同样不参与语义化（描边亮度也参与遮罩计算）", async () => {
  const wrapper = await renderLane(
    "svg",
    `<svg><mask id="m"><rect stroke="black" fill="white" width="10" height="10"/></mask></svg>`,
  );
  assert.equal(classesOf(findFirst(wrapper, "rect")).length, 0, "遮罩里的 stroke=black 也是亮度，不是颜色");
});

test("svg 车道 · <clipPath> 子树不参与颜色语义化——裁剪只用几何，fill 与渲染无关", async () => {
  const wrapper = await renderLane("svg", `<svg><clipPath id="c"><rect width="10" height="10"/></clipPath></svg>`);
  const rect = findFirst(wrapper, "rect");
  assert.equal(classesOf(rect).length, 0, "裁剪路径里的 fill 不影响渲染，标注它只是噪音");
});

// ---------- <use> 影子树：作者在引用处设的色必须能传进去 ----------
// 两条 P1（#A2/#A3 见 CHECKLIST round 3）都是「给叶子打 class 盖掉继承」的同一个根：
// r3 首版只豁免了 defs/symbol 子树，`<use>` 指向不在 defs 里的元素时照样被顶掉。
// 改用「根属性 + 继承」后，被引用形状根本不带 class，两种指向都对。

test('svg 车道 · <use fill="…"> 指向 <defs> 里的形状：颜色必须能传进影子树', async () => {
  const wrapper = await renderLane(
    "svg",
    `<svg><defs><path id="icon" d="M0,0 L20,0 L10,18 Z"/></defs><use href="#icon" fill="#a855f7"/></svg>`,
  );
  assert.equal(classesOf(findFirst(wrapper, "path")).length, 0, "被引用形状不带 class，影子树才能继承到 use 的紫色");
  assert.equal(classesOf(findFirst(wrapper, "use")).length, 0, "use 自己写了非黑白颜色，原样保留");
});

test('svg 车道 · #A2 回归：<use fill="…"> 指向不在 <defs> 里的普通元素时，颜色同样必须能传进影子树', async () => {
  // r3 首版的豁免只看 defs/symbol，所以这个 <g id="tri"> 里的 polygon 照样被打了缺省
  // class，`<use>` 实例渲染成前景色而不是紫色。注意这里的 polygon 是**双重渲染**的
  // （原位置直接画一份，use 处再实例化一份）：原位置那份靠继承拿缺省色，实例那份靠
  // 继承拿 use 的紫色——两份各自正确，这正是不打 class 才能同时成立的效果。
  const wrapper = await renderLane(
    "svg",
    `<svg><g id="tri"><polygon points="0,0 20,0 10,18"/></g><use href="#tri" fill="#a855f7" x="30"/></svg>`,
  );
  assert.equal(classesOf(findFirst(wrapper, "polygon")).length, 0, "不在 defs 里的被引用形状也不能带 class");
  assert.equal(findFirst(wrapper, "svg").properties.fill, "currentColor", "原位置那份仍由根继承拿到缺省前景色");
});

test("svg 车道 · 谁都没设 fill 的 <use>：影子树靠继承拿到根上的缺省前景色", async () => {
  const wrapper = await renderLane(
    "svg",
    `<svg><defs><path id="icon" d="M0,0 L20,0 L10,18 Z"/></defs><use href="#icon"/></svg>`,
  );
  assert.equal(findFirst(wrapper, "svg").properties.fill, "currentColor", "缺省色在根上");
  assert.equal(classesOf(findFirst(wrapper, "use")).length, 0, "use 不需要也不应该带 class");
  assert.equal(classesOf(findFirst(wrapper, "path")).length, 0, "被引用形状同样不带");
});

test("svg 车道 · <defs>/<marker> 里没写 fill 的内容也能跟随主题（继承一路通到根，不再是停在初始值黑的死角）", async () => {
  // r3 首版把 defs 整棵子树排除在缺省之外，代价是 defs 里不写 fill 的 marker/pattern
  // 内容停在初始值黑（当时如实记了这个代价）。换成继承机制后这个死角自然消失。
  const wrapper = await renderLane(
    "svg",
    `<svg><defs><marker id="a"><path d="M0,0 L4,2 L0,4"/></marker></defs></svg>`,
  );
  assert.equal(findFirst(wrapper, "svg").properties.fill, "currentColor", "继承链从根一路通到 defs 内部");
  assert.equal(classesOf(findFirst(wrapper, "path")).length, 0, "不靠 class");
});

test("svg 车道 · <defs> 里显式写死的黑仍照常语义化（作者写死的黑箭头深色下也得跟随主题）", async () => {
  const wrapper = await renderLane(
    "svg",
    `<svg><defs><marker id="a"><path fill="black" d="M0,0 L4,2 L0,4"/></marker></defs></svg>`,
  );
  const path = findFirst(wrapper, "path");
  assert.ok(classesOf(path).includes("mv-diagram-fg-fill"), "箭头是画在页面上的，黑色箭头必须跟随主题");
});

// ---------- 「近黑近白」与非颜色值：必须判为 other，原样保留 ----------

const NOT_SEMANTIC = [
  "rgba(0,0,0,0.5)",  // 半透明黑：换成 currentColor 会丢掉 alpha，视觉上是另一个颜色
  "#0008",
  "hsl(0,0%,1%)",     // 差一点点就是黑，但不是黑
  "rgb(0,0,1)",
  "rgb(255 255 254)",
  "transparent",
  "currentColor",
  "none",
  "url(#grad)",
  "rgb(0,0)",         // 残缺写法：解析不出三个通道，一律不动
  "oklch(0 0 0)",     // 语义上是黑，但 lab/oklch/color() 一族刻意不解析，见 diagrams.mjs 注释
  // 下面两条是**非法** CSS，必须判 other：非法声明在浏览器里整条丢弃、回落到继承值，
  // 我们要是反而认成黑白，就会用一条 class 盖掉作者通过继承表达的颜色。
  "hsl(50%,0%,0%)",   // 色相不允许写成百分比
  "hsl(0,0,0%)",      // 饱和度必须带 %
];

// CSS 的通道值要按规范夹紧到 0–255 再取整，这两条按「夹紧/取整的结果」钉住——
// 去掉 channel8 里的 clamp 或 Math.round，下面两条会红（上一轮它们能存活）。
test("svg 车道 · 越界通道按 CSS 规则夹紧：rgb(300,300,300) 就是白", async () => {
  const wrapper = await renderLane("svg", `<svg><rect fill="rgb(300,300,300)" width="9" height="9"/></svg>`);
  assert.ok(classesOf(findFirst(wrapper, "rect")).includes("mv-diagram-bg-fill"), "浏览器会夹到 255，我们也必须");
});

test("svg 车道 · 负通道同样夹紧：rgb(-5,-5,-5) 就是黑", async () => {
  const wrapper = await renderLane("svg", `<svg><rect fill="rgb(-5,-5,-5)" width="9" height="9"/></svg>`);
  assert.ok(classesOf(findFirst(wrapper, "rect")).includes("mv-diagram-fg-fill"), "浏览器会夹到 0，我们也必须");
});

test("svg 车道 · 小数通道按四舍五入判定：rgb(0.4,0.4,0.4) 渲染出来就是黑", async () => {
  const wrapper = await renderLane("svg", `<svg><rect fill="rgb(0.4,0.4,0.4)" width="9" height="9"/></svg>`);
  assert.ok(classesOf(findFirst(wrapper, "rect")).includes("mv-diagram-fg-fill"), "0.4 四舍五入到 0，与浏览器一致");
});

for (const spelling of NOT_SEMANTIC) {
  test(`svg 车道 · fill="${spelling}" 不是纯黑/纯白，必须原样保留`, async () => {
    const wrapper = await renderLane("svg", `<svg><rect fill="${spelling}" width="10" height="10"/></svg>`);
    const rect = findFirst(wrapper, "rect");
    assert.equal(rect.properties.fill, spelling, "属性值不应被改写");
    assert.equal(classesOf(rect).length, 0, `"${spelling}" 不该被判成黑或白`);
  });
}

test("svg 车道 · 未写 fill 的 <text> 必须能拿到前景色，这正是本次要修的核心语义", async () => {
  const wrapper = await renderLane("svg", `<svg><text x="0" y="0">Hi</text></svg>`);
  assert.equal(findFirst(wrapper, "svg").properties.fill, "currentColor", "缺省色由根提供，text 继承");
  assert.equal(classesOf(findFirst(wrapper, "text")).length, 0, "不给叶子打 class");
});

test("svg 车道 · 隔着几层不声明 fill 的容器，缺省色仍应一路继承到底", async () => {
  const wrapper = await renderLane("svg", `<svg><g><g><text x="0" y="0">Hi</text></g></g></svg>`);
  assert.equal(findFirst(wrapper, "svg").properties.fill, "currentColor", "根上有就够了——继承不受中间层数影响");
  assert.equal(classesOf(findFirst(wrapper, "text")).length, 0, "中间层与叶子都不需要打 class");
});

// ---------- #A1 回归：fill/stroke 是可继承属性，只看本元素属性会误判并clobber 祖先/内部 <style> 表达的作者颜色 ----------
// 背景：openspec/changes/diagram-theme-adaptation/CHECKLIST.md #A1（P1，controller 已判 OQ-1
// 为「祖先继承与内部 <style> 上色都算作者故意设的颜色」）。旧实现只读本元素的 fill/style，
// 对下面这些「元素自己没写 fill，颜色是继承来的」的情况会误当成「未指定→默认前景」，
// 用 !important 把作者颜色打成 --ink，属于相对旧代码（旧代码用不带 !important 的表现属性
// currentColor，作者的 <style> 规则还能翻盘）的真回归。

test("svg 车道 · #A1 祖先 <g fill=\"...\"> 的显式颜色必须原样保留，子级 <text> 不应被打上任何语义色 class", async () => {
  const wrapper = await renderLane("svg", `<svg><g fill="#3b82f6"><text x="0" y="0">hi</text></g></svg>`);
  const text = findFirst(wrapper, "text");
  assert.equal(classesOf(text).length, 0, "text 自己没写 fill，但祖先 g 声明了 fill——应整个交给继承，不打任何 class");
});

test('svg 车道 · #A1 <svg fill="red"> 根节点自身的颜色也算祖先声明，子级 <text> 不应被打上任何语义色 class', async () => {
  const wrapper = await renderLane("svg", `<svg fill="red"><text x="0" y="0">hi</text></svg>`);
  const text = findFirst(wrapper, "text");
  assert.equal(classesOf(text).length, 0, "svg 根节点自己声明了 fill，子级 text 应整个交给继承");
});

test('svg 车道 · #A1 祖先通过内联 style="fill:var(--accent)" 表达的颜色同样算继承来源', async () => {
  const wrapper = await renderLane("svg", `<svg><g style="fill:var(--accent)"><text x="0" y="0">hi</text></g></svg>`);
  const text = findFirst(wrapper, "text");
  assert.equal(classesOf(text).length, 0, "祖先的颜色即便来自内联 style 也算声明了 fill，子级不应被动手");
});

test("svg 车道 · #A1 祖先感知的继承判断要走完整条链，不能只看直接父节点", async () => {
  const wrapper = await renderLane("svg", `<svg fill="red"><g><text x="0" y="0">hi</text></g></svg>`);
  const text = findFirst(wrapper, "text");
  assert.equal(classesOf(text).length, 0, "隔着一层不声明 fill 的 <g>，仍应看到再上一层 svg 根的 fill 声明");
});

test('svg 车道 · #A1 元素自己的显式黑色（如 fill="black"）走「本体优先」分支，不受祖先影响，且用不带 !important 的普通变体', async () => {
  const wrapper = await renderLane(
    "svg",
    `<svg><style>.brand{fill:#f59e0b}</style><rect class="brand" fill="black" width="10" height="10"/></svg>`,
  );
  const rect = findFirst(wrapper, "rect");
  // rect 自己写了 fill="black"（表现属性），这不是继承场景——按黑色语义打前景 class；
  // 但必须是不带 !important 的普通变体，这样真实级联里 SVG 内部 <style> 的
  // `.brand{fill:#f59e0b}` 规则（与我们的类选择器同特异度、且在文档里更靠后）
  // 仍能按顺序赢，最终显示琥珀色而不是被我们的语义色钉死。
  assert.ok(classesOf(rect).includes("mv-diagram-fg-fill"), "元素自身的 fill=\"black\" 仍应被分类为前景黑");
  assert.ok(!classesOf(rect).includes("mv-diagram-fg-fill-style"), "颜色来源是表现属性，不是内联 style，不应用 !important 变体");
});

test('svg 车道 · #A1 控制组：<text fill="#3b82f6"> 元素自己声明了非黑白颜色，正确保留（走「本体优先」分支的另一半）', async () => {
  const wrapper = await renderLane("svg", `<svg><text fill="#3b82f6" x="0" y="0">hi</text></svg>`);
  const text = findFirst(wrapper, "text");
  assert.equal(classesOf(text).length, 0, "text 自己声明了非黑白颜色，不应被当成语义色改写，也不应触发缺省前景分支");
});

test('svg 车道 · #A1 祖先自身的黑色由祖先自己承担分类，子级 <text> 仍不打 class（正确分工：继承交给 CSS，我们不用替 text 打两次色）', async () => {
  const wrapper = await renderLane("svg", `<svg><g fill="black"><text x="0" y="0">hi</text></g></svg>`);
  const g = findFirst(wrapper, "g");
  const text = findFirst(wrapper, "text");
  assert.ok(classesOf(g).includes("mv-diagram-fg-fill"), "祖先 g 自己的 fill=\"black\" 应在 g 这一层被分类为前景黑");
  assert.equal(classesOf(text).length, 0, "text 没有自己的 fill，交给继承，不应在 text 这一层重复打 class");
});
