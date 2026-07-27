/* ============================================================
   mdx-viewer · --check 编译校验逻辑
   —— 逐篇 compile({path, value}, mdxOptions())：path 是硬要求，库据此按扩展名推导
      format（.md 不过 MDX 解析器）。不复用单个 processor（会把 format 钉死成 mdx，
      令 .md 假失败 —— 这是上一版的根因缺陷，也是本模块存在的理由）。
      本模块只读文件与编译，不 console.*、不 process.exit、不本地化、不格式化——
      呈现在 src/cli/output.mjs，进程与流在 bin/mdxv.mjs。
   ============================================================ */
import { readFileSync } from "node:fs";
import { compile } from "@mdx-js/mdx";
import { mdxOptions } from "../mdx/plugins.mjs";

/**
 * @typedef {{abs: string, ok: boolean, line?: number, column?: number, reason?: string}} DocumentCheckResult
 */

/**
 * Normalize one compile failure into a presentable position and reason.
 * Pure function — no I/O — covering the three exception shapes actually observed:
 * a `VFileMessage` with a position, one without, and a bare `Error` (e.g. a broken
 * `dot` fence, whose own line number belongs to the graph source, never reinterpreted
 * as a position in the document).
 * @param {unknown} error the exception thrown or rejected by `compile()`
 * @returns {{line?: number, column?: number, reason: string}} presentable failure shape
 */
export function describeCompileFailure(error) {
  const line = typeof error?.line === "number" ? error.line : undefined;
  const column = typeof error?.column === "number" ? error.column : undefined;
  const reason = String(error?.reason ?? error?.message ?? error).trim();
  return line !== undefined && column !== undefined ? { line, column, reason } : { reason };
}

/**
 * Check a batch of documents against this project's own compile pipeline (`mdxOptions()`),
 * one at a time. A single failure never stops the remaining documents; an unreadable
 * document is caught here as a failed result (carrying the OS reason, no position)
 * rather than thrown upward.
 * @param {{abs: string}[]} documents documents in `scanTree` shape
 * @param {{onResult?: (result: DocumentCheckResult) => unknown}} [options] per-document callback
 * @returns {Promise<{results: DocumentCheckResult[], passed: number, failed: number}>} aggregate outcome
 */
export async function checkDocuments(documents, { onResult } = {}) {
  const results = [];
  let passed = 0;
  let failed = 0;
  for (const document of documents) {
    const result = await checkOneDocument(document.abs);
    results.push(result);
    if (result.ok) passed += 1;
    else failed += 1;
    if (onResult) await onResult(result);
  }
  return { results, passed, failed };
}

/**
 * @param {string} abs absolute path of the document to compile
 * @returns {Promise<DocumentCheckResult>} this document's outcome
 */
async function checkOneDocument(abs) {
  let value;
  try {
    value = readFileSync(abs, "utf8");
  } catch (error) {
    return { abs, ok: false, reason: String(error?.message ?? error).trim() };
  }
  try {
    await compile({ path: abs, value }, mdxOptions());
    return { abs, ok: true };
  } catch (error) {
    return { abs, ok: false, ...describeCompileFailure(error) };
  }
}
