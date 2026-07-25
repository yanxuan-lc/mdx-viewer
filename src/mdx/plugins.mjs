/* ============================================================
   mdx-viewer · MDX 编译插件清单（view 与 build 共用）
   —— 全部走官方 remark/rehype 生态，语法 100% 对齐官方 MDX v3。
   分歧补齐：
     · frontmatter → remark-frontmatter + remark-mdx-frontmatter（完整 YAML，导出 `frontmatter`）
     · GFM        → remark-gfm（表格 / 任务清单 / 删除线 / 自动链接）
     · 数学 $..$  → remark-math + rehype-katex（官方原版 `$...$` / `$$...$$`）
     · 代码高亮   → rehype-pretty-code(shiki)，主题走 CSS 变量
     · 图         → dot(构建期 SVG) / mermaid(客户端) / svg(内联)  见 diagrams.mjs
   ============================================================ */
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypePrettyCode from "rehype-pretty-code";
import { rehypeDiagrams } from "./diagrams.mjs";

/** rehype-pretty-code(shiki) 配置：双主题，配合 CSS 变量随明暗切换。 */
const prettyCodeOptions = {
  theme: { light: "github-light", dark: "github-dark" },
  keepBackground: false, // 背景交给我们的 theme.css，保证与整页配色一致
};

/**
 * 返回传给 @mdx-js/rollup 的选项。
 * providerImportSource 让 MDXProvider 注入的组件映射对所有文档生效
 * —— 用户写 <Callout> 无需 import，正是官方推荐机制。
 */
export function mdxOptions() {
  return {
    providerImportSource: "@mdx-js/react",
    remarkPlugins: [
      remarkGfm,
      remarkFrontmatter,
      [remarkMdxFrontmatter, { name: "frontmatter" }],
      remarkMath,
    ],
    rehypePlugins: [
      rehypeDiagrams,               // dot/svg → 构建期处理；mermaid → 客户端占位
      rehypeKatex,
      [rehypePrettyCode, prettyCodeOptions],
    ],
  };
}
