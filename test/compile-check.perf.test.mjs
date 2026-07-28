/* ============================================================
   E2E · `mdxv --check` 性能场景 S12 — 慢车道，独立于 test:unit
   —— 唯一断言判据是相对倍数（机器无关）：同一会话内 `mdxv --check` 单篇满特性文档
      耗时须 ≤ `mdxx` 同文件耗时的 1/5（R8）。绝对秒数只是记录用预算，不写进断言（F9）。
      本文件跑一整轮真实 Vite 生产构建（`mdxx`），秒级，故与 test/export.test.mjs 同侧，
      **不进 package.json 的 test:unit 显式清单**——只有开发者需要显式改 package.json 才会
      把它接进 `make test-unit`；本 e2e-author 无权改 package.json，此处仅记录、由调用方路由
      （见 openspec/changes/mdx-compile-check/e2e-manifest.md 的 registration 提醒）。
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const FULL_FEATURE_DOC = "examples/demo.mdx";
const { MDXV_LANG, ...CLEAN_ENV } = process.env;

/** @param {number[]} startArgs high-resolution timer helper */
function timeMs(fn) {
  const start = process.hrtime.bigint();
  const result = fn();
  const end = process.hrtime.bigint();
  return { result, ms: Number(end - start) / 1_000_000 };
}

test("S12: `mdxv --check` on the full-feature example is at most 1/5 of `mdxx`'s wall time in the same session", { timeout: 180_000 }, () => {
  const tmp = mkdtempSync(join(tmpdir(), "mdxv-check-perf-"));
  try {
    const { result: checkResult, ms: checkMs } = timeMs(() =>
      spawnSync(process.execPath, ["bin/mdxv.mjs", "--check", FULL_FEATURE_DOC, "--lang", "en-US"], {
        cwd: REPO,
        encoding: "utf8",
        env: CLEAN_ENV,
        timeout: 30_000,
      }),
    );
    assert.equal(checkResult.status, 0, `--check should pass on the project's own full-feature example: ${checkResult.stderr}`);

    const outHtml = join(tmp, "out.html");
    const { result: exportResult, ms: exportMs } = timeMs(() =>
      spawnSync(process.execPath, ["bin/mdxx.mjs", FULL_FEATURE_DOC, outHtml, "--lang", "en-US"], {
        cwd: REPO,
        encoding: "utf8",
        env: CLEAN_ENV,
        timeout: 150_000,
      }),
    );
    assert.equal(exportResult.status, 0, `mdxx should succeed on the same document: ${exportResult.stderr}`);

    // 判据只断相对倍数（R8/F9），不断绝对秒数；记录数值方便 perf-gate 读基线，不作为断言依据。
    console.log(`[S12] check=${checkMs.toFixed(1)}ms export=${exportMs.toFixed(1)}ms ratio=${(exportMs / checkMs).toFixed(2)}x`);
    assert.ok(checkMs <= exportMs / 5, `--check (${checkMs.toFixed(1)}ms) should be at most 1/5 of mdxx (${exportMs.toFixed(1)}ms)`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
