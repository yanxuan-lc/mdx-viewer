/* ============================================================
   L3 构建车道 · `mdxv --check` 与 `mdxx` 的配对场景 —— S14 / S20
   —— 这两条**每条都要跑真实 Vite 构建**（S14 两次、S20 两次，共 4 次），所以从
      test/compile-check.cli.test.mjs（L2 子进程车道）搬到这里，进 test:build。
      为什么整条搬而不是只搬构建那一半：它们断的是**差值**——S14 断「同一份文档
      --check 过、mdxx 不过」，S20 断「两个都过、于是这个子集无人见证」。把 --check
      那一半留在 L2、mdxx 这一半挪过来，两边各自都不再是一条完整的判断，场景就没了。
      其余 S1–S13 / S15–S19 仍在 test/compile-check.cli.test.mjs。
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { join, dirname, resolve } from "node:path";
import { evaluate } from "@mdx-js/mdx";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const FIXTURES = join(REPO, "test", "fixtures", "compile-check-e2e");
const { MDXV_LANG, ...CLEAN_ENV } = process.env;

/** 跑一次 `mdxv`，stdout/stderr/status 分别拿到。 */
function runCheck(args, { timeout = 30_000, env = CLEAN_ENV } = {}) {
  return spawnSync(process.execPath, ["bin/mdxv.mjs", ...args], { cwd: REPO, encoding: "utf8", timeout, env });
}

/** 跑一次 `mdxx`——真实 Vite 构建，本文件属慢车道的原因。 */
function runExport(args, { timeout = 120_000, env = CLEAN_ENV } = {}) {
  return spawnSync(process.execPath, ["bin/mdxx.mjs", ...args], { cwd: REPO, encoding: "utf8", timeout, env });
}

const rel = (...segments) => join("test", "fixtures", "compile-check-e2e", ...segments).split("\\").join("/");
const abs = (...segments) => join(FIXTURES, ...segments);

test("S14: an unresolvable top-level import passes --check but fails mdxx; the same import fenced in ```js passes both", () => {
  const importFixture = rel("boundary", "unresolvable-import.mdx");
  const fencedFixture = rel("boundary", "fenced-import.mdx");

  const checkOnImport = runCheck(["--check", importFixture, "--lang", "en-US"]);
  assert.equal(checkOnImport.status, 0, "unresolvable top-level import is compile-only clean, so --check must pass it");
  assert.equal(checkOnImport.stdout.trim(), `✓ ${importFixture}`);

  const tmp = mkdtempSync(join(tmpdir(), "mdxv-check-s14-"));
  try {
    const exportOnImport = runExport([importFixture, join(tmp, "import.html"), "--lang", "en-US"]);
    assert.equal(exportOnImport.status, 1, "mdxx must fail on the same document — the real pipeline can't resolve the specifier");

    const exportOnFenced = runExport([fencedFixture, join(tmp, "fenced.html"), "--lang", "en-US"]);
    assert.equal(exportOnFenced.status, 0, "import lines inside a ```js fence are inert text and must not fail export");

    const checkOnFenced = runCheck(["--check", fencedFixture, "--lang", "en-US"]);
    assert.equal(checkOnFenced.status, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("S20: an evaluation-time-only tier-B subset is witnessed by neither --check nor mdxx — regression-pinned, not extended onto S14's build-time assertion", async () => {
  // 乙档不是均匀可见的：specifier 无法解析在 build 期就死（mdxx exit 1，S14 已钉住）；
  // 而「顶层初始化器自身抛错」与「{…} 表达式自身抛错」只在浏览器求值/渲染期才炸——
  // mdxx 照样吐出一份会在浏览器里炸掉的 5MB 自包含 HTML，exit 0。命令行层没有任何一道
  // 现有门能见证这个子集；本场景钉住这个事实本身，而不是去悄悄扩展 S14 的 mdxx 断言
  // （R6 明确禁止——那样写出来的断言是假的）。
  const initializerFixture = rel("boundary", "throwing-initializer.mdx");
  const expressionFixture = rel("boundary", "throwing-expression.mdx");

  // B7 见证断言：先独立证明两份 fixture 真的会在预期阶段抛错，而不是只信任它们的文件名。
  // 少了这一步，下面两组 exit 0 断言在 fixture 被误改成正常文档后照样全绿，场景就悄悄失真了。
  await assertGenuinelyThrowsAt(abs("boundary", "throwing-initializer.mdx"), "evaluation");
  await assertGenuinelyThrowsAt(abs("boundary", "throwing-expression.mdx"), "render");

  for (const fixture of [initializerFixture, expressionFixture]) {
    const checkResult = runCheck(["--check", fixture, "--lang", "en-US"]);
    assert.equal(checkResult.status, 0, `--check must not detect ${fixture} — it never evaluates the module`);
    assert.equal(checkResult.stdout.trim(), `✓ ${fixture}`);
  }

  const tmp = mkdtempSync(join(tmpdir(), "mdxv-check-s20-"));
  try {
    for (const fixture of [initializerFixture, expressionFixture]) {
      const exportResult = runExport([fixture, join(tmp, `${fixture.replace(/[\\/]/g, "-")}.html`), "--lang", "en-US"]);
      assert.equal(
        exportResult.status,
        0,
        `mdxx must also exit 0 on ${fixture} — the browser never runs during build, so the throw is invisible at build time too: ${exportResult.stderr}`,
      );
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

/**
 * 独立见证一份文档是否真的在预期阶段抛错——不经过 `--check` / `mdxx`，直接用
 * `@mdx-js/mdx` 自己的 `evaluate()` + `react-dom/server` 跑一遍（本仓库已有依赖，不引入新依赖）。
 * 防的是 B7：S20 的两条断言全是 exit 0，若 fixture 后来被改成不再抛错的普通文档，
 * 场景会静默失真——两条 exit 0 断言仍然全绿，却什么都没验证到「求值期/渲染期真的会炸」。
 * @param {string} absPath 文档绝对路径 @param {"evaluation" | "render"} expectedStage 期望的抛错阶段
 */
async function assertGenuinelyThrowsAt(absPath, expectedStage) {
  const value = readFileSync(absPath, "utf8");
  let Content;
  try {
    ({ default: Content } = await evaluate({ path: absPath, value }, { ...jsxRuntime, baseUrl: pathToFileURL(absPath).href }));
  } catch (evaluationError) {
    assert.equal(
      expectedStage,
      "evaluation",
      `${absPath} threw during module evaluation ("${evaluationError.message}") — expected it to survive evaluation and throw at render instead`,
    );
    return;
  }
  assert.throws(
    () => renderToStaticMarkup(Content({})),
    undefined,
    `${absPath} did not throw at module evaluation, and did not throw at render either — this fixture no longer witnesses tier B, ` +
      "which would make S20's exit-0 assertions vacuous (they'd read as coverage of the evaluation-time boundary while asserting nothing about it)",
  );
  assert.equal(expectedStage, "render");
}
