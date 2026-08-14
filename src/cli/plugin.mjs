/* ============================================================
   mdx-viewer · Vite 插件
   —— 提供虚拟模块把「要看哪篇 MDX」注入前端，并为目录模式提供文件树接口。
     virtual:mdxv-config  → { mode, firstDoc, initialLocale, localeSource }
     virtual:mdx-target   → 单篇模式下 re-export 目标 .mdx（交给 @mdx-js 编译）
     GET /__mdxv/tree     → 目录模式的 .md/.mdx 列表（dev 下每次请求现扫磁盘）
     HMR "mdxv:tree"      → 文档增删时通知前端重取上面那份列表
   ============================================================ */
import { scanTree } from "./resolve.mjs";

const CONFIG_ID = "virtual:mdxv-config";
const TARGET_ID = "virtual:mdx-target";
/** 文件树变动的自定义 HMR 事件名；前端在 src/app/main.tsx 里订阅同一个字符串。 */
const TREE_EVENT = "mdxv:tree";
const MDX_RE = /\.mdx?$/i;

/**
 * Create the Vite virtual-module and directory-tree plugin for one preview/export invocation.
 * @param {{mode: "file" | "dir", target?: string, root?: string, files?: Array<{abs: string, rel: string, dir: string, familyRel?: string, locale?: "zh-CN" | "en-US"}>, firstDoc?: string, initialLocale?: "zh-CN" | "en-US", localeSource?: "argument" | "environment" | "system" | "fallback", fontCss?: string}} options invocation configuration
 * @returns {import('vite').Plugin} configured Vite plugin
 */
export function mdxvPlugin({ mode, target, root, files = [], firstDoc: configuredFirstDoc, initialLocale = "en-US", localeSource = "fallback", fontCss = "" }) {
  const firstDoc = mode === "dir" ? configuredFirstDoc ?? files[0]?.abs : target;
  // 目录模式下磁盘才是唯一事实来源：启动时传进来的 files 只是首屏快照。dev 每次请求都重扫，
  // 否则 server 起来之后新增/删除的文档永远进不了抽屉（build 不走 configureServer，仍用快照）。
  // 重扫失败（根目录被删、权限被收紧）时沿用上一次成功的结果——一次瞬时 IO 抖动不该让
  // 抽屉整块消失，也不该把 InputError 抛成 500。
  let lastTree = files;
  const readTree = () => {
    if (mode !== "dir" || !root) return lastTree;
    try { lastTree = scanTree(root); } catch { /* 沿用上一次成功的树 */ }
    return lastTree;
  };
  return {
    name: "mdxv",
    transformIndexHtml(html) {
      const localized = html.replace(/<html\s+lang=["'][^"']*["']/, `<html lang="${initialLocale}"`);
      // 字体走静态 HTML 注入而不是运行时 setProperty：后者要等 JS 执行，首屏会先用默认
      // 字体画一遍再跳字。内容已在 user-config.mjs 过白名单，且是内联样式，`mdxx` 的
      // 「零外链」不受影响。
      if (!fontCss) return localized;
      return localized.replace("</head>", `  <style data-mdxv-fonts>\n${fontCss}  </style>\n</head>`);
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
        res.end(JSON.stringify(readTree()));
      });
      if (mode !== "dir" || !root) return;
      // Vite 的 watcher 只盯 config.root（= src/app）和模块图里的文件，用户文档目录不在其中，
      // 所以「新增一篇 .mdx」本来连事件都没有。显式把根目录挂上去；Vite 已把 ignoreInitial
      // 置为 true 且默认忽略 node_modules/.git，不会有首扫风暴。
      server.watcher.add(root);
      // 只按扩展名过滤：根目录外的 .mdx 变动最多触发一次幂等的重取，不值得再判前缀。
      const notify = (file) => {
        if (MDX_RE.test(file)) server.hot.send({ type: "custom", event: TREE_EVENT });
      };
      server.watcher.on("add", notify);
      server.watcher.on("unlink", notify);
    },
  };
}
