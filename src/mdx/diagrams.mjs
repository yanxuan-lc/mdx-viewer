/* ============================================================
   mdx-viewer · 图三车道（rehype 插件，运行在 hast 上）
   —— 借用标准 fenced code block 承载，围栏语言决定引擎：
        dot / graphviz  → 构建期 Graphviz(wasm) 出静态 SVG（零运行时）
        svg             → 原样内联
        mermaid         → 转成 <pre class="mermaid">，客户端渲染
   在 rehype-pretty-code 之前运行，先「吃掉」这三种块，剩下的才交给高亮。
   ============================================================ */
import { visit } from "unist-util-visit";
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

/** 让生成的 SVG 跟随明暗：把 Graphviz 默认黑色描边/文字换成 currentColor。 */
function themeSvg(svg) {
  return svg
    .replace(/<\?xml[^>]*\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/stroke="black"/g, 'stroke="currentColor"')
    .replace(/fill="black"/g, 'fill="currentColor"')
    .replace(/fill="#000000"/gi, 'fill="currentColor"')
    .replace(/(<svg\b)/, '$1 style="max-width:100%;height:auto"');
}

function svgToHast(svg) {
  const root = fromHtml(svg, { fragment: true });
  return root.children.filter((c) => c.type === "element" || c.type === "text");
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
        const svg = themeSvg(gv.dot(source));
        replacement = figureWrap(svgToHast(svg), "dot");
      } else if (lang === "svg") {
        replacement = figureWrap(svgToHast(themeSvg(source)), "svg");
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
