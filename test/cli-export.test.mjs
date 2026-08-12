/* ============================================================
   L3 构建车道 · 需要真实导出构建的 CLI 断言 —— A3 / A5 / S3
   —— 这四条都要跑真实 Vite 构建，原先散在 test/cli-language.test.mjs（L2）与
      test/cli-output.test.mjs（L2）里，是那两条「快车道」其实很慢的直接原因。
      搬到这里，进 test:build。共 6 次构建：A3 一次（必须失败）、locale 矩阵四次
      （A5 的两条断言共用，见下）、S3 一次（默认语言路径，不能借矩阵任何一例）。
      两处来源文件里**只跑 dev server、不跑构建**的同族场景（如 mdxv 预览矩阵）留在原地。
   ============================================================ */
import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { environment, systemLocalePreload } from "./helpers/cli-env.mjs";

const { version: PKG_VERSION } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("A3: expected export build failure is localized and stack-free", () => {
  const directory = mkdtempSync(join(tmpdir(), "mdxv-cli-failure-"));
  try {
    const output = join(directory, "broken.html");
    const result = spawnSync(process.execPath, ["bin/mdxx.mjs", "e2e/fixtures/render-error.mdx", output, "--lang", "en-US"], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`Export failed: ${output.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.doesNotMatch(result.stderr, /CACError|Error: Unexpected end|at .*\.mjs:/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

/* 四次矩阵导出包在 describe 里：node:test 的根级 before() 即便用 --test-name-pattern
   只挑一条无关用例也照跑，会让「只跑 A3」白付四次真实构建（约 16s）。包进 describe
   之后 before() 只在这组用例真的要跑时触发，A3 / S3 的失败信息也不再混进矩阵的文案。 */
describe("A5: locale provenance in real exports (four shared builds)", () => {
  /* locale 来源矩阵的四次导出在 before() 里跑一次，两条断言共用。
     「A5: mdxx flag wins」与矩阵的 flag 例是**同一条命令**（同 fixture、同 --lang en-US、
     同 MDXV_LANG=zh-CN），此前各自跑了一次构建。共用之后省掉一次，两条测试名都保留——
     矩阵的用例名不写「flag 压过 environment」，删掉那条会丢掉这层可发现性。 */
  const LOCALE_CASES = [
    { name: "flag", args: ["--lang", "en-US"], env: environment({ MDXV_LANG: "zh-CN" }), preload: undefined, locale: "en-US", source: "argument", output: /self-contained/ },
    { name: "environment", args: [], env: environment({ MDXV_LANG: "zh-CN" }), preload: undefined, locale: "zh-CN", source: "environment", output: /自包含/ },
    { name: "system", args: [], env: environment({ MDXV_LANG: undefined }), preload: systemLocalePreload("zh-SG"), locale: "zh-CN", source: "system", output: /自包含/ },
    { name: "fallback", args: [], env: environment({ MDXV_LANG: undefined }), preload: systemLocalePreload("throw"), locale: "en-US", source: "fallback", output: /self-contained/ },
  ];

  /** @type {Map<string, {result: import("node:child_process").SpawnSyncReturns<string>, html: string}>} */
  const localeExports = new Map();
  let localeDirectory;

  /** 取共享导出结果；矩阵用例改名时报出可读错因，而不是 `Cannot read properties of undefined`。 */
  const sharedExport = (name) => {
    const stored = localeExports.get(name);
    assert.ok(stored, `no shared export recorded for case "${name}" — LOCALE_CASES names and the lookups here have drifted apart`);
    return stored;
  };

  before(() => {
    localeDirectory = mkdtempSync(join(tmpdir(), "mdxv-cli-matrix-"));
    for (const scenario of LOCALE_CASES) {
      const output = join(localeDirectory, `${scenario.name}.html`);
      const result = spawnSync(process.execPath, [
        ...(scenario.preload ? ["--import", scenario.preload] : []),
        "bin/mdxx.mjs", "test/fixtures/export-sample.mdx", output, ...scenario.args,
      ], { encoding: "utf8", env: scenario.env, timeout: 180_000 });
      // 读 html 前先确认成功，否则 readFileSync 的 ENOENT 会盖掉真实的构建失败原因。
      assert.equal(result.status, 0, `${scenario.name} export should succeed: ${result.stderr}`);
      localeExports.set(scenario.name, { result, html: readFileSync(output, "utf8") });
    }
  });

  // localeDirectory 可能因 mkdtempSync 失败而仍是 undefined；那时 rmSync 会抛 TypeError
  // 盖住真正的失败原因，所以这里先判一下。
  after(() => {
    if (localeDirectory) rmSync(localeDirectory, { recursive: true, force: true });
  });

  // status === 0 由 before() 统一把关，这里不重复断（重复断在 before 之后是恒真的）。
  test("A5: mdxx flag wins over environment in a real localized export", () => {
    const { result, html } = sharedExport("flag");
    assert.match(result.stderr, /self-contained/);
    assert.match(html, /<html[^>]+lang="en-US"/i);
  });

  test("A5: real mdxx subprocess matrix bundles Locale provenance for every selection source", () => {
    for (const scenario of LOCALE_CASES) {
      const { result, html } = sharedExport(scenario.name);
      assert.match(result.stderr, scenario.output, scenario.name);
      assert.match(html, new RegExp(`<html[^>]+lang="${scenario.locale}"`, "i"), scenario.name);
      assert.match(html, new RegExp(`initialLocale["']?\\s*:\\s*["']${scenario.locale}["']`), scenario.name);
      assert.match(html, new RegExp(`localeSource["']?\\s*:\\s*["']${scenario.source}["']`), scenario.name);
    }
  });
});

test("S3: export command writes a complete plain-text status panel to stderr", () => {
  const directory = mkdtempSync(join(tmpdir(), "mdxv-cli-output-"));
  const output = join(directory, "export.html");
  try {
    const result = spawnSync(process.execPath, ["bin/mdxx.mjs", "test/fixtures/export-sample.mdx", output], {
      encoding: "utf8",
      timeout: 180_000,
    });

    assert.equal(result.status, 0);
    assert.match(result.stderr, /Export complete/);
    assert.match(result.stderr, new RegExp(`Version\\s+: mdx-viewer v${PKG_VERSION.replace(/\./g, "\\.")}`));
    assert.match(result.stderr, /Source file\s+: .*export-sample\.mdx/);
    assert.match(result.stderr, /Output file\s+: .*export\.html/);
    assert.match(result.stderr, /File size\s+: \d+ KB/);
    assert.match(result.stderr, /Open the HTML file in your browser\./);
    assert.doesNotMatch(result.stderr, /\u001B\[/);
    const displayedSize = result.stderr.match(/File size\s+: (\d+) KB/)?.[1];
    assert.equal(displayedSize, (statSync(output).size / 1024).toFixed(0));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
