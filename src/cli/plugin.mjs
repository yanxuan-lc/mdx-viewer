/* ============================================================
   mdx-viewer · Vite 插件
   —— 提供虚拟模块把「要看哪篇 MDX」注入前端，并为目录模式提供文件树接口。
     virtual:mdxv-config  → { mode, firstDoc, initialLocale, localeSource }
     virtual:mdx-target   → 单篇模式下 re-export 目标 .mdx（交给 @mdx-js 编译）
     GET /__mdxv/tree     → 目录模式的 .md/.mdx 列表
   ============================================================ */
const CONFIG_ID = "virtual:mdxv-config";
const TARGET_ID = "virtual:mdx-target";

/**
 * Create the Vite virtual-module and directory-tree plugin for one preview/export invocation.
 * @param {{mode: "file" | "dir", target?: string, files?: Array<{abs: string, rel: string, dir: string, familyRel?: string, locale?: "zh-CN" | "en-US"}>, firstDoc?: string, initialLocale?: "zh-CN" | "en-US", localeSource?: "argument" | "environment" | "system" | "fallback"}} options invocation configuration
 * @returns {import('vite').Plugin} configured Vite plugin
 */
export function mdxvPlugin({ mode, target, files = [], firstDoc: configuredFirstDoc, initialLocale = "en-US", localeSource = "fallback" }) {
  const firstDoc = mode === "dir" ? configuredFirstDoc ?? files[0]?.abs : target;
  return {
    name: "mdxv",
    transformIndexHtml(html) {
      return html.replace(/<html\s+lang=["'][^"']*["']/, `<html lang="${initialLocale}"`);
    },
    resolveId(id) {
      if (id === CONFIG_ID) return "\0" + CONFIG_ID;
      if (id === TARGET_ID) return "\0" + TARGET_ID;
    },
    load(id) {
      if (id === "\0" + CONFIG_ID) {
        return `export default ${JSON.stringify({ mode, firstDoc, initialLocale, localeSource })}`;
      }
      if (id === "\0" + TARGET_ID) {
        return `export { default, frontmatter } from ${JSON.stringify(target)}`;
      }
    },
    configureServer(server) {
      server.middlewares.use("/__mdxv/tree", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(files));
      });
    },
  };
}
