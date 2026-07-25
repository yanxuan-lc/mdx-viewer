import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseLanguageArgument, resolveCliLanguage } from "../src/cli/language.mjs";
import { mdxvPlugin } from "../src/cli/plugin.mjs";

function environment(overrides = {}) {
  const next = { ...process.env, ...overrides };
  if (overrides.MDXV_LANG === undefined) delete next.MDXV_LANG;
  return next;
}

function systemLocalePreload(locale) {
  const source = locale === "throw"
    ? "Intl.DateTimeFormat=()=>{throw new Error('unavailable')};"
    : `Intl.DateTimeFormat=()=>({resolvedOptions:()=>({locale:${JSON.stringify(locale)}})});`;
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

async function startPreview({ args, env, preload, port }) {
  const child = spawn(process.execPath, [
    ...(preload ? ["--import", preload] : []),
    "bin/mdxv.mjs", ...args, "--no-open", "--port", String(port),
  ], { cwd: process.cwd(), env, stdio: ["ignore", "ignore", "pipe"] });
  const output = await new Promise((resolve, reject) => {
    let text = "";
    const timeout = setTimeout(() => reject(new Error("preview did not start")), 15_000);
    child.stderr.on("data", (chunk) => {
      text += String(chunk);
      const url = text.match(/→\s+(http:\/\/[^\s]+)/)?.[1];
      if (!url) return;
      clearTimeout(timeout);
      resolve({ text, url });
    });
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`preview exited before startup: ${code}`)));
  });
  return { child, ...output };
}

async function stopPreview(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => {
    child.once("exit", resolve);
    child.kill("SIGTERM");
  });
}

test("S9: CLI language uses strict flag, environment, system, then fallback precedence", () => {
  assert.deepEqual(resolveCliLanguage({ lang: "en-US", env: { MDXV_LANG: "zh-CN" }, getSystemLocale: () => "zh-CN" }), { locale: "en-US", source: "argument" });
  assert.deepEqual(resolveCliLanguage({ env: { MDXV_LANG: "zh-CN" }, getSystemLocale: () => "en-US" }), { locale: "zh-CN", source: "environment" });
  assert.deepEqual(resolveCliLanguage({ env: {}, getSystemLocale: () => "zh-SG" }), { locale: "zh-CN", source: "system" });
  assert.deepEqual(resolveCliLanguage({ env: {}, getSystemLocale: () => { throw new Error("unavailable"); } }), { locale: "en-US", source: "fallback" });
});

test("S9: invalid selected explicit values fail in the next valid locale", () => {
  assert.throws(
    () => resolveCliLanguage({ lang: "fr", env: { MDXV_LANG: "zh-CN" }, getSystemLocale: () => "en-US" }),
    (error) => error.code === "INVALID_LANGUAGE" && error.locale === "zh-CN" && error.params.value === "fr",
  );
  assert.throws(
    () => resolveCliLanguage({ env: { MDXV_LANG: "fr" }, getSystemLocale: () => "en-US" }),
    (error) => error.code === "INVALID_LANGUAGE" && error.locale === "en-US" && error.params.value === "fr",
  );
  assert.throws(
    () => resolveCliLanguage({ lang: "en", env: {}, getSystemLocale: () => "en-US" }),
    (error) => error.code === "INVALID_LANGUAGE" && error.locale === "en-US" && error.params.value === "en",
  );
});

test("B2: raw --lang parsing rejects missing and duplicate values without consuming --help", () => {
  assert.deepEqual(parseLanguageArgument(["--lang=en-US"]), { lang: "en-US" });
  assert.deepEqual(parseLanguageArgument(["--lang", "zh-CN"]), { lang: "zh-CN" });
  assert.deepEqual(parseLanguageArgument(["--lang"]), { invalidLanguage: "--lang" });
  assert.deepEqual(parseLanguageArgument(["--lang", "--help"]), { invalidLanguage: "--lang" });
  assert.deepEqual(parseLanguageArgument(["--lang", "en-US", "--lang=zh-CN"]), { invalidLanguage: "--lang specified more than once" });
});

test("S9: both command entry points reject invalid language before work starts", () => {
  for (const command of ["bin/mdxv.mjs", "bin/mdxx.mjs"]) {
    const result = spawnSync(process.execPath, [command, "examples/demo.mdx", "--lang", "fr"], { encoding: "utf8" });
    assert.equal(result.status, 1, command);
    assert.match(result.stderr, /Unsupported language "fr"; expected zh-CN or en-US\./, command);
    assert.doesNotMatch(result.stderr, /Root |self-contained|构建|根目录/, command);
  }
});

test("A5: both command entry points reject an invalid MDXV_LANG before work starts", () => {
  const directory = mkdtempSync(join(tmpdir(), "mdxv-cli-invalid-env-"));
  try {
    for (const command of ["bin/mdxv.mjs", "bin/mdxx.mjs"]) {
      const output = join(directory, `${command.includes("mdxx") ? "export" : "preview"}.html`);
      const args = command.includes("mdxx")
        ? [command, "test/fixtures/export-sample.mdx", output]
        : [command, "examples/demo.mdx", "--no-open", "--port", "47990"];
      const result = spawnSync(process.execPath, args, {
        encoding: "utf8",
        env: environment({ MDXV_LANG: "fr" }),
      });
      assert.equal(result.status, 1, command);
      assert.match(result.stderr, /Unsupported language "fr"; expected zh-CN or en-US\./, command);
      assert.doesNotMatch(result.stderr, /Root |self-contained|构建|根目录|CACError|at .*\.mjs:/, command);
      assert.equal(existsSync(output), false, command);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("A5: invalid mdxx invocation leaves the requested output absent", () => {
  const directory = mkdtempSync(join(tmpdir(), "mdxv-cli-invalid-"));
  try {
    const output = join(directory, "must-not-exist.html");
    const result = spawnSync(process.execPath, ["bin/mdxx.mjs", "test/fixtures/export-sample.mdx", output, "--lang", "fr"], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("S9: environment selection localizes CLI help for both commands", () => {
  for (const command of ["bin/mdxv.mjs", "bin/mdxx.mjs"]) {
    const result = spawnSync(process.execPath, [command, "--help"], {
      encoding: "utf8",
      env: { ...process.env, MDXV_LANG: "zh-CN" },
    });
    assert.equal(result.status, 0, command);
    assert.match(result.stdout, /界面语言（zh-CN 或 en-US）/, command);
  }
});

test("B2: malformed --lang values produce one localized diagnostic without a CAC stack", () => {
  for (const command of ["bin/mdxv.mjs", "bin/mdxx.mjs"]) {
    const result = spawnSync(process.execPath, [command, "--lang", "--help"], { encoding: "utf8" });
    assert.equal(result.status, 1, command);
    assert.match(result.stderr, /Option requires a value: --lang\./, command);
    assert.match(result.stderr, /\n\nUsage:/, command);
    assert.doesNotMatch(result.stderr, /CACError|at .*\.mjs:/, command);
  }
});

test("B2: CAC option errors are localized instead of escaping as stacks", () => {
  for (const command of ["bin/mdxv.mjs", "bin/mdxx.mjs"]) {
    const result = spawnSync(process.execPath, [command, "--unknown-option"], { encoding: "utf8" });
    assert.equal(result.status, 1, command);
    assert.match(result.stderr, /Invalid command arguments\./, command);
    assert.doesNotMatch(result.stderr, /CACError|at .*\.mjs:/, command);
  }
});

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

test("A5: mdxx flag wins over environment in a real localized export", () => {
  const directory = mkdtempSync(join(tmpdir(), "mdxv-cli-success-"));
  try {
    const output = join(directory, "localized.html");
    const result = spawnSync(process.execPath, ["bin/mdxx.mjs", "test/fixtures/export-sample.mdx", output, "--lang", "en-US"], {
      encoding: "utf8",
      env: { ...process.env, MDXV_LANG: "zh-CN" },
    });
    assert.equal(result.status, 0);
    assert.match(result.stderr, /self-contained/);
    assert.match(readFileSync(output, "utf8"), /<html[^>]+lang="en-US"/i);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("A5: real mdxv subprocess matrix exposes Locale provenance through the virtual module", async () => {
  const cases = [
    { name: "flag", args: ["examples/demo.mdx", "--lang", "en-US"], env: environment({ MDXV_LANG: "zh-CN" }), locale: "en-US", source: "argument", output: /Root / },
    { name: "environment", args: ["examples/demo.mdx"], env: environment({ MDXV_LANG: "zh-CN" }), locale: "zh-CN", source: "environment", output: /根目录/ },
    { name: "system", args: ["examples/demo.mdx"], env: environment({ MDXV_LANG: undefined }), preload: systemLocalePreload("zh-SG"), locale: "zh-CN", source: "system", output: /根目录/ },
    { name: "fallback", args: ["examples/demo.mdx"], env: environment({ MDXV_LANG: undefined }), preload: systemLocalePreload("throw"), locale: "en-US", source: "fallback", output: /Root / },
  ];
  for (const [index, scenario] of cases.entries()) {
    const preview = await startPreview({ ...scenario, port: 47_000 + index });
    try {
      assert.match(preview.text, scenario.output, scenario.name);
      const module = await (await fetch(new URL("/@id/__x00__virtual:mdxv-config", preview.url))).text();
      assert.match(module, new RegExp(`initialLocale["']?\\s*:\\s*["']${scenario.locale}["']`), scenario.name);
      assert.match(module, new RegExp(`localeSource["']?\\s*:\\s*["']${scenario.source}["']`), scenario.name);
    } finally {
      await stopPreview(preview.child);
    }
  }
});

test("A5: real mdxx subprocess matrix bundles Locale provenance for every selection source", () => {
  const directory = mkdtempSync(join(tmpdir(), "mdxv-cli-matrix-"));
  const cases = [
    { name: "flag", args: ["--lang", "en-US"], env: environment({ MDXV_LANG: "zh-CN" }), preload: undefined, locale: "en-US", source: "argument", output: /self-contained/ },
    { name: "environment", args: [], env: environment({ MDXV_LANG: "zh-CN" }), preload: undefined, locale: "zh-CN", source: "environment", output: /自包含/ },
    { name: "system", args: [], env: environment({ MDXV_LANG: undefined }), preload: systemLocalePreload("zh-SG"), locale: "zh-CN", source: "system", output: /自包含/ },
    { name: "fallback", args: [], env: environment({ MDXV_LANG: undefined }), preload: systemLocalePreload("throw"), locale: "en-US", source: "fallback", output: /self-contained/ },
  ];
  try {
    for (const scenario of cases) {
      const output = join(directory, `${scenario.name}.html`);
      const result = spawnSync(process.execPath, [
        ...(scenario.preload ? ["--import", scenario.preload] : []),
        "bin/mdxx.mjs", "test/fixtures/export-sample.mdx", output, ...scenario.args,
      ], { encoding: "utf8", env: scenario.env, timeout: 180_000 });
      assert.equal(result.status, 0, scenario.name);
      assert.match(result.stderr, scenario.output, scenario.name);
      const html = readFileSync(output, "utf8");
      assert.match(html, new RegExp(`<html[^>]+lang="${scenario.locale}"`, "i"), scenario.name);
      assert.match(html, new RegExp(`initialLocale["']?\\s*:\\s*["']${scenario.locale}["']`), scenario.name);
      assert.match(html, new RegExp(`localeSource["']?\\s*:\\s*["']${scenario.source}["']`), scenario.name);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("S9: virtual configuration preserves document fields and injects locale provenance", () => {
  const plugin = mdxvPlugin({
    mode: "dir",
    files: [{ abs: "/docs/README.mdx", rel: "README.mdx", dir: "" }],
    firstDoc: "/docs/README.mdx",
    initialLocale: "zh-CN",
    localeSource: "environment",
  });
  assert.equal(plugin.transformIndexHtml('<html lang="en-US">'), '<html lang="zh-CN">');
  assert.equal(plugin.resolveId("virtual:mdxv-config"), "\0virtual:mdxv-config");
  assert.match(plugin.load("\0virtual:mdxv-config"), /"initialLocale":"zh-CN"/);
  assert.match(plugin.load("\0virtual:mdxv-config"), /"localeSource":"environment"/);
});
