/* ============================================================
   mdx-viewer · 共享 Vite 配置（view 与 build 共用）
   ============================================================ */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import mdx from "@mdx-js/rollup";
import { mdxOptions } from "../mdx/plugins.mjs";
import { mdxvPlugin } from "./plugin.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const APP_DIR = resolve(__dirname, "../app");
const PKG_ROOT = resolve(__dirname, "../..");

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
