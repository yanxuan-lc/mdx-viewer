/* ============================================================
   集成测试 · src/mdx/plugins.mjs（编译管线）
   —— 用官方 @mdx-js/mdx 的 compile() 跑一遍我们的 mdxOptions()，
      断言各扩展都已生效（frontmatter / GFM / 数学 / 高亮 / 图三车道）。
      compile 产出的是编译后的 JS 模块字符串，故断言其中的标记文本。
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { compile } from "@mdx-js/mdx";
import { mdxOptions } from "../src/mdx/plugins.mjs";

const SOURCE = `---
title: Test Doc
author: Tester
---

# Heading

Inline math $E = mc^2$ works.

| A | B |
|---|---|
| 1 | 2 |

~~struck~~

\`\`\`ts
const answer: number = 42
\`\`\`

\`\`\`dot
digraph { a -> b }
\`\`\`

\`\`\`mermaid
graph TD; X-->Y
\`\`\`

\`\`\`svg
<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>
\`\`\`
`;

let compiled; // 缓存一次编译结果供各断言复用

async function getCompiled() {
  if (!compiled) compiled = String(await compile(SOURCE, mdxOptions()));
  return compiled;
}

test("编译不抛错，产出非空 JS 模块", async () => {
  const js = await getCompiled();
  assert.ok(js.length > 0);
  assert.match(js, /jsx/, "应为 JSX runtime 产物");
});

test("frontmatter：完整 YAML 被导出为 frontmatter", async () => {
  const js = await getCompiled();
  assert.match(js, /export const frontmatter/);
  assert.ok(js.includes("Test Doc") && js.includes("Tester"));
});

test("GFM：表格与删除线生效", async () => {
  const js = await getCompiled();
  assert.ok(js.includes('"table"'), "应生成 table");
  assert.ok(js.includes('"del"'), "删除线应生成 del");
});

test("数学：rehype-katex 产出 katex 结构", async () => {
  const js = await getCompiled();
  assert.ok(js.includes("katex"), "应含 katex 类名");
});

test("代码高亮：rehype-pretty-code(shiki) 生效", async () => {
  const js = await getCompiled();
  assert.ok(js.includes("rehype-pretty-code"), "应含 pretty-code 标记属性");
});

test("图 · dot 车道：构建期出内联 SVG，黑色描边打上前景语义色 class", async () => {
  const js = await getCompiled();
  assert.ok(js.includes("mv-diagram-dot"), "应有 dot 车道包裹");
  assert.ok(js.includes('"svg"'), "应生成内联 svg 元素");
  // 语义 class 这条：真实颜色值在 theme.css 里随主题联动（不再是编译产物里的
  // 字面 "currentColor"，那是旧字符串 regex 的做法）。
  assert.ok(js.includes("mv-diagram-fg-stroke"), "黑色描边应打上前景语义色 class");
  // 根 svg 的缺省色这条才是集成层对**核心根因**的见证：描边在修复前本来就是好的
  // （旧 regex 已处理 stroke="black"），真正不可见的是「谁都没声明 fill」的文字节点，
  // 现在靠根上这一个表现属性顺继承链兜住。少了它，本 bug 能在集成层静默复发。
  // `\s*`：这里读的是**未压缩**的编译产物（`fill: "currentColor"`），
  // export.test.mjs 读的是压缩后的导出包（`fill:"currentColor"`）。
  assert.match(js, /fill:\s*"currentColor"/, "根 <svg> 应带缺省色属性 fill=currentColor");
  // 拼写矩阵与遮罩等细节覆盖见 test/diagram-theme.test.mjs。
});

test("图 · mermaid 车道：保留源码交客户端渲染", async () => {
  const js = await getCompiled();
  assert.ok(js.includes("mv-diagram-mermaid"), "应有 mermaid 车道包裹");
  assert.ok(js.includes("graph TD"), "应保留 mermaid 源码");
});

test("图 · svg 车道：原样内联", async () => {
  const js = await getCompiled();
  assert.ok(js.includes("mv-diagram-svg"), "应有 svg 车道包裹");
});
