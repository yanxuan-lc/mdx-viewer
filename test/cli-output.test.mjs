import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatExportSuccess, formatHelp, formatPreviewSuccess, isColorEnabled } from "../src/cli/output.mjs";

test("S1: preview help uses the standard sections without CAC commands", () => {
  const output = formatHelp({ command: "mdxv", locale: "en-US" });

  assert.match(output, /^Usage:\n  mdxv \[OPTIONS\] <file\|dir\|demo>/);
  assert.match(output, /\nArguments:\n/);
  assert.match(output, /\nOptions:\n/);
  assert.doesNotMatch(output, /Commands:/);
});

test("S1: export help is rendered by the command without CAC commands", () => {
  const result = spawnSync(process.execPath, ["bin/mdxx.mjs", "--help"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^Usage:\n  mdxx \[OPTIONS\] <file> \[output\]/);
  assert.match(result.stdout, /\nArguments:\n/);
  assert.match(result.stdout, /\nOptions:\n/);
  assert.doesNotMatch(result.stdout, /Commands:/);
});

test("S1: preview help is rendered by the command without CAC commands", () => {
  const result = spawnSync(process.execPath, ["bin/mdxv.mjs", "--help"], { encoding: "utf8" });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^Usage:\n  mdxv \[OPTIONS\] <file\|dir\|demo>/);
  assert.match(result.stdout, /\nArguments:\n/);
  assert.match(result.stdout, /\nOptions:\n/);
  assert.doesNotMatch(result.stdout, /Commands:/);
});

test("S2: both commands report an unknown option before their complete help page", () => {
  for (const command of ["bin/mdxv.mjs", "bin/mdxx.mjs"]) {
    const result = spawnSync(process.execPath, [command, "--unknown-option"], { encoding: "utf8" });

    assert.equal(result.status, 1, command);
    assert.match(result.stderr, /^Error: Invalid command arguments\. Unknown option: --unknown-option\.\n\nUsage:/, command);
    assert.match(result.stderr, /\nArguments:\n/, command);
    assert.match(result.stderr, /\nOptions:\n/, command);
    assert.doesNotMatch(result.stderr, /CACError|at .*\.mjs:/, command);
  }
});

test("S2: both commands append help after a missing option value", () => {
  for (const [command, args] of [["bin/mdxv.mjs", ["--port"]], ["bin/mdxx.mjs", ["--lang"]]]) {
    const result = spawnSync(process.execPath, [command, ...args], { encoding: "utf8" });

    assert.equal(result.status, 1, command);
    assert.match(result.stderr, /^Error: .*Option requires a value: --(?:port <port>|lang)\./, command);
    assert.match(result.stderr, /\n\nUsage:/, command);
    assert.match(result.stderr, /\nArguments:\n/, command);
    assert.match(result.stderr, /\nOptions:\n/, command);
    assert.doesNotMatch(result.stderr, /CACError|at .*\.mjs:/, command);
  }
});

test("S2: both commands append help when the required input is missing", () => {
  for (const command of ["bin/mdxv.mjs", "bin/mdxx.mjs"]) {
    const result = spawnSync(process.execPath, [command], { encoding: "utf8" });

    assert.equal(result.status, 1, command);
    assert.match(result.stderr, /^Error: /, command);
    assert.match(result.stderr, /\n\nUsage:/, command);
    assert.match(result.stderr, /\nArguments:\n/, command);
    assert.match(result.stderr, /\nOptions:\n/, command);
    assert.doesNotMatch(result.stderr, /CACError|at .*\.mjs:/, command);
  }
});

test("S2: both commands reject surplus positional arguments before doing work", () => {
  const directory = mkdtempSync(join(tmpdir(), "mdxv-cli-arguments-"));
  try {
    const cases = [
      ["bin/mdxv.mjs", ["examples/demo.mdx", "surplus", "--no-open", "--port", "48123"]],
      ["bin/mdxx.mjs", ["test/fixtures/export-sample.mdx", join(directory, "export.html"), "surplus"]],
    ];
    for (const [command, args] of cases) {
      const result = spawnSync(process.execPath, [command, ...args], { encoding: "utf8", timeout: 3_000 });

      assert.equal(result.status, 1, command);
      assert.match(result.stderr, /^Error: Invalid command arguments\. Too many arguments:/, command);
      assert.match(result.stderr, /\n\nUsage:/, command);
      assert.doesNotMatch(result.stderr, /CACError|at .*\.mjs:/, command);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("S3: plain preview status includes every field and its stop hint", () => {
  const url = "http://localhost:4321/?doc=%2Fdocs%2FREADME.mdx";
  const output = formatPreviewSuccess({
    locale: "en-US",
    version: "1.0.0",
    root: "/docs",
    doc: "/docs/README.mdx",
    count: 2,
    url,
    color: false,
  });

  assert.match(output, /Preview ready/);
  assert.match(output, /Version\s+: mdx-viewer v1\.0\.0/);
  assert.match(output, /Root directory\s+: \/docs/);
  assert.match(output, /Default document\s+: \/docs\/README\.mdx/);
  assert.match(output, /Documents\s+: 2/);
  assert.ok(output.includes(url));
  assert.match(output, /Press Ctrl\+C to stop\./);
  assert.doesNotMatch(output, /\u001B\[/);
});

test("S3: plain export status includes every field and its open hint", () => {
  const output = formatExportSuccess({
    locale: "en-US",
    version: "1.0.0",
    source: "/docs/guide.mdx",
    output: "/docs/guide.html",
    size: "42 KB",
    color: false,
  });

  assert.match(output, /Export complete/);
  assert.match(output, /Version\s+: mdx-viewer v1\.0\.0/);
  assert.match(output, /Source file\s+: \/docs\/guide\.mdx/);
  assert.match(output, /Output file\s+: \/docs\/guide\.html/);
  assert.match(output, /File size\s+: 42 KB/);
  assert.match(output, /Open the HTML file in your browser\./);
  assert.doesNotMatch(output, /\u001B\[/);
});

test("S3: Chinese status labels align by terminal display width", () => {
  const output = formatPreviewSuccess({
    locale: "zh-CN",
    version: "1.0.0",
    root: "/docs",
    doc: "/docs/README.mdx",
    count: 2,
    url: "http://localhost:4321/",
    color: false,
  });

  assert.match(output, /  版本 {5}: mdx-viewer/);
  assert.match(output, /  根目录 {3}: \/docs/);
  assert.match(output, /  默认文档 : \/docs\/README\.mdx/);
  assert.match(output, /  文档数 {3}: 2/);
  assert.match(output, /  访问链接 : → http/);
});

test("S4: color is enabled only for TTY output without NO_COLOR", () => {
  assert.equal(isColorEnabled({ isTTY: true, env: {} }), true);
  assert.equal(isColorEnabled({ isTTY: false, env: {} }), false);
  assert.equal(isColorEnabled({ isTTY: true, env: { NO_COLOR: "" } }), false);

  const colored = formatPreviewSuccess({
    locale: "en-US",
    version: "1.0.0",
    root: "/docs",
    doc: "/docs/README.mdx",
    count: 2,
    url: "http://localhost:4321/",
    color: true,
  });
  assert.match(colored, /\u001B\[32m✓\u001B\[0m/);
  assert.match(colored, /\u001B\[4;36mhttp:\/\/localhost:4321\/\u001B\[0m/);
  assert.match(colored.replace(/\u001B\[[0-9;]*m/g, ""), /Preview ready/);
});

/* ---------- S5：`mdxv config set` 的端到端契约（进程级，见 bin/mdxv.mjs） ---------- */

/** 在隔离的 XDG_CONFIG_HOME 下跑一次 mdxv，绝不碰跑测者真实的 ~/.config。 */
function runConfig(args) {
  const home = mkdtempSync(join(tmpdir(), "mdxv-cli-config-"));
  try {
    const result = spawnSync(process.execPath, ["bin/mdxv.mjs", ...args], {
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, XDG_CONFIG_HOME: home, NO_COLOR: "1" },
    });
    let written;
    try {
      written = readFileSync(join(home, "mdxv", "config.json"), "utf8");
    } catch { written = undefined; }
    return { ...result, written };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test("S5: config set creates the file and reports on stderr, keeping stdout clean", () => {
  const result = runConfig(["config", "set", "font.body", "ChillHuoSong_F"]);

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.written), { font: { body: "ChillHuoSong_F" } });
  // 状态面板与预览/导出一致走 stderr；stdout 留给可被管道消费的东西（今天只有 --check）。
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Config created/);
});

test("S5: config set honors --lang, which is registered per command in CAC", () => {
  // 回归：--lang 只挂在默认命令上时，`config set … --lang` 会被判成「未知选项」。
  const result = runConfig(["config", "set", "font.body", "霞鹜文楷", "--lang", "zh-CN"]);

  assert.equal(result.status, 0);
  assert.equal(JSON.parse(result.written).font.body, "霞鹜文楷");
  assert.match(result.stderr, /配置已创建/);
  assert.doesNotMatch(result.stderr, /Unknown option|未知选项/);
});

test("S5: a rejected assignment exits 1 and leaves no file behind", () => {
  for (const args of [
    ["config", "set", "font.title", "X"],
    ["config", "set", "font.body", 'Evil"; } body {'],
    ["config", "set", "font.body"],
    ["config"],
    ["config", "get", "font.body"],
  ]) {
    const result = runConfig(args);
    assert.equal(result.status, 1, args.join(" "));
    assert.match(result.stderr, /^\S+: \S/u, args.join(" "));
    assert.equal(result.written, undefined, `${args.join(" ")}：失败的 set 不该落下半个配置`);
  }
});

test("S5: an unknown key prints the available list under the diagnostic, not inside it", () => {
  const result = runConfig(["config", "set", "font.title", "X"]);

  assert.equal(result.status, 1);
  // 第一行只说「哪里错了」，列表另起一段——挤在一行里时这条报错要横着读到屏幕外。
  const [first, blank, heading, group, ...items] = result.stderr.trimEnd().split("\n");
  assert.equal(first, 'Error: Unknown setting "font.title".');
  assert.equal(blank, "");
  assert.equal(heading, "Available settings:");
  assert.equal(group, "  Font");
  assert.deepEqual(items.map((line) => line.trim().split(/\s{2,}/)[0]), ["- font.sans", "- font.head", "- font.body", "- font.mono"]);
});

test("S5: config takes three positional arguments, and rejects the fourth", () => {
  const result = runConfig(["config", "set", "font.body", "A", "B"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Too many arguments: B\./);
  assert.equal(result.written, undefined);
});

test("S5: preview help advertises the config command without growing a Commands section", () => {
  const output = formatHelp({ command: "mdxv", locale: "en-US" });

  assert.match(output, /^Usage:\n  mdxv \[OPTIONS\] <file\|dir\|demo>\n  mdxv config set <key> <value>\n/);
  assert.doesNotMatch(output, /Commands:/);
  assert.match(output, /config set writes ~\/\.config\/mdxv\/config\.json/);
  // 导出端没有这条命令，别把它写进 mdxx 的 help。
  assert.doesNotMatch(formatHelp({ command: "mdxx", locale: "en-US" }), /config set/);
});
