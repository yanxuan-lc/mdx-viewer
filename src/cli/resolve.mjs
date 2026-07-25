/* ============================================================
   mdx-viewer · 入参解析 & 目录扫描
   —— 统一模型：预览始终以「一个根目录 + 一个默认打开的文档」运作。
      给文件 → root=文件所在目录，默认打开该文件；
      给目录 → root=该目录，默认打开首篇（优先 README/index）。
   ============================================================ */
import { accessSync, constants, statSync, readdirSync } from "node:fs";
import { resolve, relative, dirname, sep } from "node:path";
import { parseLocalizedDocuments } from "./localized-docs.mjs";

const MDX_RE = /\.mdx?$/i;
const SKIP = new Set(["node_modules", ".git", ".vitepress", "dist", ".cache"]);
const INDEX_NAMES = ["README.mdx", "README.md", "index.mdx", "index.md"];

/** Expected input error with a stable code and original path parameters for CLI localization. */
export class InputError extends Error {
  constructor(code, params, message) {
    super(message);
    this.name = "InputError";
    this.code = code;
    this.params = params;
  }
}

/**
 * Resolve one CLI input path after confirming it is readable.
 * @param {string | undefined} arg user-supplied file or directory argument
 * @returns {{root: string, target: string | undefined}} absolute document root and optional target
 * @throws {InputError} with INPUT_REQUIRED, INPUT_NOT_FOUND, or INPUT_NOT_MDX
 */
export function resolveInput(arg) {
  if (!arg) throw new InputError("INPUT_REQUIRED", {}, "请提供一个 .mdx/.md 文件或目录路径（或 `mdxv demo` 看示例）");
  const abs = resolve(process.cwd(), arg);
  let st;
  try {
    st = statSync(abs);
    accessSync(abs, st.isDirectory() ? constants.R_OK | constants.X_OK : constants.R_OK);
  } catch { throw new InputError("INPUT_NOT_FOUND", { path: arg }, `找不到或无法读取路径：${arg}`); }
  if (st.isDirectory()) return { root: abs, target: undefined };
  if (!MDX_RE.test(abs)) throw new InputError("INPUT_NOT_MDX", { path: arg }, `不是 MDX 文件：${arg}`);
  return { root: dirname(abs), target: abs };
}

/**
 * Scan a readable document root recursively. Any unreadable directory is an input failure,
 * never an empty directory.
 * @param {string} root absolute root directory
 * @returns {{abs: string, rel: string, dir: string}[]} sorted MDX files
 * @throws {InputError} with INPUT_NOT_FOUND when a directory cannot be read
 */
export function scanTree(root) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { throw new InputError("INPUT_NOT_FOUND", { path: dir }, `找不到或无法读取路径：${dir}`); }
    for (const e of entries) {
      if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
      const abs = resolve(dir, e.name);
      if (e.isDirectory()) walk(abs);
      else if (MDX_RE.test(e.name)) {
        const rel = relative(root, abs);
        out.push({ abs, rel, dir: rel.includes(sep) ? dirname(rel) : "" });
      }
    }
  };
  walk(root);
  out.sort((a, b) => a.rel.localeCompare(b.rel));
  return parseLocalizedDocuments(out);
}

/** 选默认打开的文档：显式 target > 根目录 README/index > 首篇。 */
export function pickDefaultDoc(files, root, explicitTarget) {
  if (explicitTarget) return explicitTarget;
  for (const name of INDEX_NAMES) {
    const hit = files.find((f) => f.abs === resolve(root, name));
    if (hit) return hit.abs;
  }
  return files[0]?.abs;
}
