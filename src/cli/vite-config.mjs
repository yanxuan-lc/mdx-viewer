/* ============================================================
   mdx-viewer · 共享 Vite 配置（view 与 build 共用）
   ============================================================ */
import { fileURLToPath } from "node:url";
import { dirname, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import mdx from "@mdx-js/rollup";
import { mdxOptions } from "../mdx/plugins.mjs";
import { mdxvPlugin } from "./plugin.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const APP_DIR = resolve(__dirname, "../app");
const PKG_ROOT = resolve(__dirname, "../..");

const require = createRequire(import.meta.url);

/**
 * 定位一个已安装包在磁盘上的根目录（兼容被 hoist 到上层 node_modules 的情形）。
 * 解析入口文件后，截到 `node_modules/<pkg>` 为止，避开某些包 `exports` 屏蔽 `./package.json`。
 * @param {string} pkg 包名，如 "react" 或 "@mdx-js/react"
 * @returns {string} 包根目录绝对路径
 */
function packageDir(pkg) {
  const entry = require.resolve(pkg);
  const marker = `node_modules${sep}${pkg.split("/").join(sep)}`;
  const idx = entry.lastIndexOf(marker);
  return idx === -1 ? dirname(entry) : entry.slice(0, idx + marker.length);
}

/**
 * 打开包目录树之外的文档时，编译产物里的裸导入（react/jsx-dev-runtime、@mdx-js/react 等）
 * 无法从文档所在目录逐级向上找到 mdx-viewer 的 node_modules，会 Failed to resolve import。
 * 这里把这些包别名到磁盘上的实际目录：字符串 alias 是前缀匹配，指向「目录」后
 * `react` 走包入口、`react/jsx-dev-runtime` 走子路径都能正确解析，也顺带 dedupe 掉多份 react。
 */
const RESOLVE_ALIAS = {
  react: packageDir("react"),
  "react-dom": packageDir("react-dom"),
  "@mdx-js/react": packageDir("@mdx-js/react"),
};

/**
 * @param {object} o
 * @param {"file"|"dir"} o.mode
 * @param {string} [o.target]   单篇模式：目标 .mdx 绝对路径
 * @param {string} [o.root]     目录模式：根目录绝对路径
 * @param {Array}  [o.files]    目录模式：文件树
 * @param {string} [o.firstDoc] 目录模式：默认文档绝对路径
 * @param {string} o.version
 * @param {string} o.license
 * @param {"zh-CN"|"en-US"} [o.initialLocale]
 * @param {"argument"|"environment"|"system"|"fallback"} [o.localeSource]
 * @param {string} [o.outDir]   build 输出目录
 * @param {import('vite').Plugin[]} [o.extraPlugins]
 */
export function buildConfig(o) {
  const allow = [APP_DIR, PKG_ROOT];
  if (o.target) allow.push(dirname(o.target));
  if (o.root) allow.push(o.root);

  return {
    root: APP_DIR,
    configFile: false,
    plugins: [
      { enforce: "pre", ...mdx(mdxOptions()) },
      mdxvPlugin({ mode: o.mode, target: o.target, files: o.files, firstDoc: o.firstDoc, initialLocale: o.initialLocale, localeSource: o.localeSource }),
      ...(o.extraPlugins || []),
    ],
    define: {
      __MDXV_VERSION__: JSON.stringify(o.version || ""),
      __MDXV_LICENSE__: JSON.stringify(o.license || ""),
    },
    base: o.outDir ? "./" : "/",
    resolve: { alias: RESOLVE_ALIAS },
    server: { fs: { allow }, open: false, hmr: { overlay: false } },
    build: o.outDir
      ? {
          outDir: o.outDir,
          emptyOutDir: true,
          cssCodeSplit: false,
          // 字体/图片等资源全部 base64 内联，产物零外链、离线双击可开。
          assetsInlineLimit: 100 * 1024 * 1024,
          chunkSizeWarningLimit: 100000,
        }
      : undefined,
    optimizeDeps: {
      // 预打包重依赖，减少首屏等待；mermaid/graphviz 按需动态载入不在此列。
      include: ["react", "react-dom", "react-dom/client", "@mdx-js/react", "katex"],
    },
    logLevel: "warn",
  };
}
