/* ============================================================
   E2E · `mdxv --check` — 校验模式的黑盒 CLI 契约测试
   —— 依据 openspec/specs/compile-check/spec.md 的场景逐条断言：本文件覆盖
      S1–S11 / S13 / S15 / S16 / S18 / S19，外加 #A1 / #B5 裸 argv 探测回归组。
      只驱动真实子进程 `bin/mdxv.mjs`，从 stdout / stderr / exit code 三处分别断言
      —— 不导入、不注入、不替换编译函数（R4）。
      本文件属 L2 子进程车道（test:cli）：只 spawn `bin/mdxv.mjs`，**不跑任何 Vite 构建**。
      两条需要真实 `mdxx` 构建的配对场景 S14 / S20 在 test/compile-check.export-pairing.test.mjs
      （L3，test:build）；S12「--check 不进构建路径」在 test/compile-check.no-build.test.mjs（L2）。
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve } from "node:path";
import { connect } from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");

// 环境干净化：去掉 MDXV_LANG，避免宿主环境影响 locale 相关断言。
const { MDXV_LANG, ...CLEAN_ENV } = process.env;

/** 跑一次 `mdxv`，stdout/stderr/status 分别拿到。 */
function runCheck(args, { timeout = 30_000, env = CLEAN_ENV } = {}) {
  return spawnSync(process.execPath, ["bin/mdxv.mjs", ...args], { cwd: REPO, encoding: "utf8", timeout, env });
}

const rel = (...segments) => join("test", "fixtures", "compile-check-e2e", ...segments).split("\\").join("/");
/** #A1 / #B5 回归组用的是单测那套 fixture（test/fixtures/compile-check/）——
 *  它们只需要一份存在且合法的 .mdx，断言全在 argv 与退出码上，不在文档内容上。 */
const unitFixture = (name) => join(REPO, "test", "fixtures", "compile-check", name);

/** @param {number} port @returns {Promise<void>} resolves on connect, rejects on refused/timeout (S7) */
function connectTo(port) {
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = connect({ host: "127.0.0.1", port, timeout: 1_000 });
    socket.once("connect", () => {
      socket.destroy();
      resolvePromise();
    });
    socket.once("timeout", () => {
      socket.destroy();
      rejectPromise(new Error("ETIMEDOUT"));
    });
    socket.once("error", (error) => {
      socket.destroy();
      rejectPromise(error);
    });
  });
}

test("S1: single passing file prints exactly `✓ <path>`, exits 0, and writes nothing to stderr", () => {
  const result = runCheck(["--check", rel("pass.mdx"), "--lang", "en-US"]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `✓ ${rel("pass.mdx")}`);
  assert.equal(result.stderr, "");
  // 单篇文档集不打汇总行（D4）。
  assert.doesNotMatch(result.stdout, /passed.*failed/);
});

test("S2: single failing file reports the exact `<path>:<line>:<column>` shape with the trigger-bug reason", () => {
  const result = runCheck(["--check", rel("format-asymmetry.mdx"), "--lang", "en-US"]);

  assert.equal(result.status, 1);
  const line = result.stdout.trim();
  const match = line.match(/^✗ (.+):(\d+):(\d+)  (.+)$/);
  assert.ok(match, `stdout should be a single ✗ <path>:<line>:<column> line, got: ${JSON.stringify(line)}`);
  const [, path, lineNo, columnNo, reason] = match;
  assert.equal(path, rel("format-asymmetry.mdx"));
  assert.ok(Number(lineNo) >= 1);
  assert.ok(Number(columnNo) >= 1);
  assert.match(reason, /^Unexpected character `\|` \(U\+007C\) in name/);
  assert.equal(result.stderr, "");
});

test("S3: directory with mixed results reports one line per document in path-sorted order plus a summary", () => {
  const result = runCheck(["--check", rel("mixed-dir"), "--lang", "en-US"]);

  assert.equal(result.status, 1);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines.length, 4, `expected 3 report lines + 1 summary, got:\n${result.stdout}`);
  assert.match(lines[0], new RegExp(`^✓ ${escapeRegex(rel("mixed-dir", "a-ok.mdx"))}$`));
  assert.match(lines[1], new RegExp(`^✗ ${escapeRegex(rel("mixed-dir", "b-broken.mdx"))}:\\d+:\\d+  `));
  assert.match(lines[2], new RegExp(`^✓ ${escapeRegex(rel("mixed-dir", "c-ok.mdx"))}$`));
  assert.equal(lines[3], "2 passed, 1 failed");
});

test("S4: directory where every document passes reports a summary with a failed count of 0", () => {
  const result = runCheck(["--check", rel("all-pass-dir"), "--lang", "en-US"]);

  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith("✓ ") && lines[1].startsWith("✓ "));
  assert.equal(lines[2], "2 passed, 0 failed");
});

test("S5: full-feature document (frontmatter/GFM/math/dot/mermaid/highlighted fence) passes through the real plugin set", () => {
  const result = runCheck(["--check", rel("full-feature.mdx"), "--lang", "en-US"]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `✓ ${rel("full-feature.mdx")}`);
  assert.equal(result.stderr, "");
});

test("S6: usage and input errors exit 2 with one stack-free Error: diagnostic on stderr and nothing on stdout", () => {
  const tmp = mkdtempSync(join(tmpdir(), "mdxv-check-s6-"));
  const unreadableFile = join(tmp, "unreadable.mdx");
  writeFileSync(unreadableFile, "# unreadable\n");
  chmodSync(unreadableFile, 0o000);
  const emptyDir = mkdtempSync(join(tmpdir(), "mdxv-check-s6-empty-"));

  try {
    const inputLevelCases = [
      { name: "no path", args: ["--check"] },
      { name: "nonexistent path", args: ["--check", "no/such/file.mdx"] },
      { name: "directly-addressed unreadable file", args: ["--check", unreadableFile] },
      { name: "path that is neither directory nor .md/.mdx", args: ["--check", "package.json"] },
      { name: "directory holding no documents", args: ["--check", emptyDir] },
    ];
    for (const { name, args } of inputLevelCases) {
      const result = runCheck([...args, "--lang", "en-US"]);
      assert.equal(result.status, 2, name);
      assert.match(result.stderr, /^Error: /, name);
      assert.doesNotMatch(result.stderr, /at .*\.mjs:/, `${name} should carry no stack`);
      assert.equal(result.stdout, "", name);
    }

    // 参数级失败（F3）：unknown option / --lang 非法・缺值・重复，均退 2 且带完整 help。
    const argumentLevelCases = [
      { name: "unknown option", args: ["--check", rel("pass.mdx"), "--unknown-option"] },
      { name: "--lang invalid", args: ["--check", rel("pass.mdx"), "--lang", "xx-XX"] },
      { name: "--lang missing value", args: ["--check", rel("pass.mdx"), "--lang"] },
      { name: "--lang repeated", args: ["--check", rel("pass.mdx"), "--lang", "en-US", "--lang", "zh-CN"] },
    ];
    for (const { name, args } of argumentLevelCases) {
      const result = runCheck(args);
      assert.equal(result.status, 2, name);
      assert.match(result.stderr, /^Error: /, name);
      assert.doesNotMatch(result.stderr, /at .*\.mjs:/, `${name} should carry no stack`);
      assert.match(result.stderr, /\nUsage:/, `${name} should append complete help`);
      assert.match(result.stderr, /\nArguments:\n/, name);
      assert.match(result.stderr, /\nOptions:\n/, name);
      assert.equal(result.stdout, "", name);
    }
  } finally {
    chmodSync(unreadableFile, 0o644);
    rmSync(tmp, { recursive: true, force: true });
    rmSync(emptyDir, { recursive: true, force: true });
  }
});

test("S7: --port/--host/--no-open are accepted but inert under --check, and the report is unchanged", async () => {
  const PORT = 59321;
  const baseline = runCheck(["--check", rel("pass.mdx"), "--lang", "en-US"]);
  const withServerOptions = runCheck(
    ["--check", rel("pass.mdx"), "--lang", "en-US", "--port", String(PORT), "--host", "--no-open"],
    { timeout: 5_000 },
  );

  // 进程没被 timeout kill（signal 为 null 才代表正常退出，证明没有起 server 常驻）。
  assert.equal(withServerOptions.signal, null);
  // 断言真的走到了校验路径本身（exit 0 是真结果，不是参数解析提前失败）——否则下面的
  // "输出相同" 就可能只是「两边都提前同样地报错」这种假阳性（第一轮曾这样误判过）。
  assert.equal(withServerOptions.status, 0, `expected a real passing check, got: ${withServerOptions.stderr}`);
  assert.equal(withServerOptions.status, baseline.status);
  assert.equal(withServerOptions.stdout, baseline.stdout);
  assert.equal(withServerOptions.stderr, baseline.stderr);

  // 直接证明「未绑定端口」，而不是只靠输出相同去推断：进程已退出后再去连那个端口，
  // 必须被拒绝（ECONNREFUSED），证明校验模式真的没有起 server 监听它。
  await assert.rejects(
    () => connectTo(PORT),
    /ECONNREFUSED|ETIMEDOUT/,
    `port ${PORT} should not be listening after --check exits`,
  );
});

test("S8: a failure with no position degrades to `✗ <path>  <reason>` with no :line:column and no stack", () => {
  const result = runCheck(["--check", rel("no-position", "dot-broken.mdx"), "--lang", "en-US"]);

  assert.equal(result.status, 1);
  const line = result.stdout.trim();
  assert.doesNotMatch(line, /:\d+:\d+/, "no position segment should be fabricated");
  assert.match(line, new RegExp(`^✗ ${escapeRegex(rel("no-position", "dot-broken.mdx"))}  \\S`));
  assert.doesNotMatch(result.stderr, /at .*\.mjs:/);
});

test("S9: an unreadable document inside a scanned directory counts as failed but does not stop the rest", () => {
  const dir = mkdtempSync(join(tmpdir(), "mdxv-check-s9-"));
  try {
    writeFileSync(join(dir, "a-ok.mdx"), "# ok\n\nfine.\n");
    const unreadable = join(dir, "b-unreadable.mdx");
    writeFileSync(unreadable, "# unreadable\n");
    chmodSync(unreadable, 0o000);
    writeFileSync(join(dir, "c-ok.mdx"), "# ok\n\nfine too.\n");

    const result = runCheck(["--check", dir, "--lang", "en-US"]);

    assert.equal(result.status, 1);
    const lines = result.stdout.trim().split("\n");
    assert.equal(lines.length, 4);
    assert.match(lines[0], /^✓ /);
    assert.match(lines[1], /^✗ .*b-unreadable\.mdx  \S/, "unreadable file gets a ✗ line with a reason, no position");
    assert.doesNotMatch(lines[1], /:\d+:\d+/);
    assert.match(lines[2], /^✓ /);
    assert.equal(lines[3], "2 passed, 1 failed");
  } finally {
    chmodSync(join(dir, "b-unreadable.mdx"), 0o644);
    rmSync(dir, { recursive: true, force: true });
  }
});

test("S10: an undefined component is not detected — the document still passes, and --help names this boundary", () => {
  const result = runCheck(["--check", rel("boundary", "undefined-component.mdx"), "--lang", "en-US"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `✓ ${rel("boundary", "undefined-component.mdx")}`);

  // 断言承重部分，不整段字符串相等（那样一改文案措辞就得改测试，属维护税）。
  // 承重点（controller 定的 A3 重写要求）：compilation-only、措辞是「顶层 ESM 语句」而非裸
  // "import"、带围栏代码块的例外说明、以及「例子而非清单」的开放式标记——收紧成闭集清单
  // 正是这次重写要消灭的东西。
  const HELP_BOUNDARY_MARKERS = {
    "en-US": [
      { name: "compilation-only", pattern: /verifies compilation only/i },
      { name: "top-level ESM wording (never bare \"import\")", pattern: /top-level ESM/ },
      { name: "fenced-code exemption", pattern: /fenced code block/i },
      { name: "open-list marker", pattern: /examples, not an exhaustive list/i },
    ],
    "zh-CN": [
      { name: "compilation-only", pattern: /只校验编译/ },
      { name: "top-level ESM wording (never bare \"import\")", pattern: /顶层 ESM/ },
      { name: "fenced-code exemption", pattern: /围栏代码块/ },
      { name: "open-list marker", pattern: /例子，不是清单/ },
    ],
  };
  // 负向护栏（B7 同类要求，先在 en-US 上做过、这轮补 zh-CN）：先把「围栏代码块里的 import
  // 不受影响」那句合法例外抠掉，再断言剩下的正文里不能再出现裸的 "import" ——
  // R6 的措辞要求是「顶层 ESM 语句」，绝不能退化成笼统的一句「有 import」。
  const FENCED_CODE_ASIDE = {
    "en-US": /\(import inside a fenced code block[^)]*\)/i,
    "zh-CN": /（围栏代码块[^）]*）/,
  };
  for (const locale of ["en-US", "zh-CN"]) {
    const help = runCheck(["--help", "--lang", locale]);
    assert.equal(help.status, 0, locale);
    assert.match(help.stdout, /--check/, `${locale}: help should document --check at all`);
    for (const { name, pattern } of HELP_BOUNDARY_MARKERS[locale]) {
      assert.match(help.stdout, pattern, `${locale}: help text should carry the "${name}" marker`);
    }
    const withoutFencedCodeAside = help.stdout.replace(FENCED_CODE_ASIDE[locale], "");
    assert.doesNotMatch(
      withoutFencedCodeAside,
      /import/i,
      `${locale}: the boundary description must never describe tier B using a bare "import" mention outside the fenced-code aside`,
    );
  }
});

test("S11: colour follows the written stream, wording follows the locale, and marks/paths/positions/reasons stay identical across locales", () => {
  const en = runCheck(["--check", rel("mixed-dir"), "--lang", "en-US"]);
  const zh = runCheck(["--check", rel("mixed-dir"), "--lang", "zh-CN"]);

  assert.equal(en.status, 1);
  assert.equal(zh.status, 1);
  const enLines = en.stdout.trim().split("\n");
  const zhLines = zh.stdout.trim().split("\n");
  assert.equal(enLines.length, zhLines.length);
  // 逐篇 ✓/✗ 行（marks/paths/positions/reasons）必须逐字节相同，只有 summary 行可随 locale 变化。
  for (let i = 0; i < enLines.length - 1; i += 1) {
    assert.equal(enLines[i], zhLines[i], `report line ${i} should be locale-invariant`);
  }
  const enSummary = enLines[enLines.length - 1];
  const zhSummary = zhLines[zhLines.length - 1];
  assert.notEqual(enSummary, zhSummary, "the summary line's wording must follow --lang");

  // 着色决策必须按「实际写入的流」分别判定：非 TTY stdout 配 TTY stderr（广告用法 `>report 2>err`）
  // 下报告不能带 ANSI。子进程管道下两条流都不是 TTY，只能验证这一退化情形：
  // 报告不带颜色、诊断也不带颜色。TTY 混合分支见下面第二个 S11 测试。
  assert.doesNotMatch(en.stdout, /\u001B\[/, "stdout must carry no ANSI when it is not a TTY");
  const errWithLang = runCheck(["--check", "no/such/file.mdx", "--lang", "en-US"]);
  assert.doesNotMatch(errWithLang.stderr, /\u001B\[/, "stderr must carry no ANSI when it is not a TTY either");
});

test("S11: the colour decision is resolved per stream — a non-TTY stdout paired with a TTY stderr must not bleed ANSI into the report", async () => {
  // 黑盒子进程无法伪造一条真 TTY stderr（本仓库零第三方测试依赖，不引入 pty）。
  // design.md §2 把这条判定钉成 output.mjs 的命名导出 resolveCheckColors({stdoutIsTTY, stderrIsTTY, env})
  // → {report, diagnostic}，正是为了让这一分支可以脱离 pty 直接断言（F2 的落地形式）。
  let outputModule;
  try {
    outputModule = await import("../src/cli/output.mjs");
  } catch (error) {
    assert.fail(`could not import src/cli/output.mjs: ${error.message}`);
    return;
  }
  assert.equal(
    typeof outputModule.resolveCheckColors,
    "function",
    "src/cli/output.mjs must export resolveCheckColors per design.md §2 (F2) so S11's per-stream branch is testable without a pty",
  );

  const advertisedInvocation = outputModule.resolveCheckColors({ stdoutIsTTY: false, stderrIsTTY: true, env: {} });
  assert.equal(advertisedInvocation.report, false, "stdout is a non-TTY pipe (the `>report` half) — the report must never carry ANSI");
  assert.equal(advertisedInvocation.diagnostic, true, "stderr is still a TTY (the `2>err` half) — the diagnostic may carry ANSI");

  const bothTty = outputModule.resolveCheckColors({ stdoutIsTTY: true, stderrIsTTY: true, env: {} });
  assert.equal(bothTty.report, true);
  assert.equal(bothTty.diagnostic, true);

  const noColorEnv = outputModule.resolveCheckColors({ stdoutIsTTY: true, stderrIsTTY: true, env: { NO_COLOR: "" } });
  assert.equal(noColorEnv.report, false);
  assert.equal(noColorEnv.diagnostic, false);
});

test("S13: format follows the extension in both directions — .md passes, byte-identical .mdx fails", () => {
  const mdResult = runCheck(["--check", rel("format-asymmetry.md"), "--lang", "en-US"]);
  const mdxResult = runCheck(["--check", rel("format-asymmetry.mdx"), "--lang", "en-US"]);

  assert.equal(mdResult.status, 0, `mdResult stdout: ${mdResult.stdout} stderr: ${mdResult.stderr}`);
  assert.equal(mdResult.stdout.trim(), `✓ ${rel("format-asymmetry.md")}`);

  assert.equal(mdxResult.status, 1);
  assert.match(mdxResult.stdout, /^✗ .+:\d+:\d+  Unexpected character `\|` \(U\+007C\) in name/);
});

// ---- #A1: the `--check` bare-argv probe must agree with cac's own boolean coercion ----------

test("#A1: `--check=true` is detected by the bare-argv probe, so an argument-level failure alongside it exits 2 (not 1)", () => {
  const result = runCheck(["--check=true", unitFixture("pass.mdx"), "--lang", "xx-XX"]);
  assert.equal(result.status, 2, `previously exited 1 (misdiagnosed as a broken document): stderr=${result.stderr}`);
  assert.match(result.stderr, /^Error: /);
});

test("#A1: bare `--check` still exits 2 on the same argument-level failure (control, must not regress)", () => {
  const result = runCheck(["--check", unitFixture("pass.mdx"), "--lang", "xx-XX"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Error: /);
});

test("#A1: `--check=false` is cac's one literal falsy spelling, so it must NOT be swept into check-mode's exit-2 accounting", () => {
  const result = runCheck(["--check=false", unitFixture("pass.mdx"), "--lang", "xx-XX"]);
  assert.equal(result.status, 1, "an argument-level failure while --check is off exits 1, same as with no --check flag at all");
  assert.match(result.stderr, /^Error: /);
});

test("#B5: after a bare `--`, `--check` is no longer an option to cac, so the probe must not claim check-mode either", () => {
  const result = runCheck(["--lang", "xx-XX", "--", "--check"]);
  assert.equal(result.status, 1, `cac gives opts.check === undefined here, so the contract is exit 1; previously the probe saw the token and exited 2: stderr=${result.stderr}`);
  assert.match(result.stderr, /^Error: /);
});

test("S15: a piped report for a >=20-document directory loses no line to an early process exit", () => {
  const dir = mkdtempSync(join(tmpdir(), "mdxv-check-s15-"));
  try {
    const DOC_COUNT = 24;
    for (let i = 0; i < DOC_COUNT; i += 1) {
      writeFileSync(join(dir, `doc-${String(i).padStart(2, "0")}.mdx`), `# Doc ${i}\n\nfine.\n`);
    }

    const result = runCheck(["--check", dir, "--lang", "en-US"]);

    assert.equal(result.status, 0);
    const lines = result.stdout.split("\n").filter(Boolean);
    assert.equal(lines.length, DOC_COUNT + 1, "one ✓/✗ line per document plus exactly one summary line, none dropped");
    assert.equal(lines[lines.length - 1], `${DOC_COUNT} passed, 0 failed`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("S16: `--check demo` covers exactly the two packaged demo documents, naming both", () => {
  const result = runCheck(["--check", "demo", "--lang", "en-US"]);

  assert.equal(result.status, 0);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines.length, 3, `expected exactly 2 documents + summary, got:\n${result.stdout}`);
  assert.equal(lines[2], "2 passed, 0 failed");
  assert.ok(lines.some((line) => line.includes("demo/index.mdx")), "should name demo/index.mdx");
  assert.ok(lines.some((line) => line.includes("demo/index.zh-CN.mdx")), "should name the localized demo/index.zh-CN.mdx");
});

test("S18: an invalid component prop value is not detected — the document still passes", () => {
  const result = runCheck(["--check", rel("boundary", "invalid-prop.mdx"), "--lang", "en-US"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `✓ ${rel("boundary", "invalid-prop.mdx")}`);
});

test("S19: malformed math is not detected — the document still passes", () => {
  const result = runCheck(["--check", rel("boundary", "malformed-math.mdx"), "--lang", "en-US"]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), `✓ ${rel("boundary", "malformed-math.mdx")}`);
});

/** @param {string} value @returns {string} regex-escaped literal */
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
