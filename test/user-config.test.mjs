/* ============================================================
   L1 进程内单测 · 用户级配置（src/cli/user-config.mjs）
   —— 覆盖三件事：
      1. 优先级 **CLI 参数 > 用户配置 > 内置默认** 的逐 role 判定；
      2. 「配置坏了绝不阻断」——每条降级路径都只产出 warning，且 warning key 在两个
         语料库里都取得到词（少一个 `t()` 就抛，告警反而变成崩溃，正好打破这条约束）；
      3. fontCss 与 theme.css 之间的**变量名契约**——注入方写 `--mv-user-font-<role>`、
         兜底链名叫 `--font-<role>-default`，这两组名字分居两个文件，改一边就静默失效。
   纯函数 + 只读文件，零 spawn、不 import vite（车道判据见 test/test-lanes.test.mjs）。
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONFIG_KEYS,
  FONT_ROLES,
  fontCss,
  fontOverridesFromOptions,
  loadUserConfig,
  parseUserConfig,
  resolveFonts,
  setUserConfigValue,
  userConfigPath,
  validateConfigAssignment,
} from "../src/cli/user-config.mjs";
import { formatConfigError, formatConfigKeys, formatConfigUsage, formatWarning } from "../src/cli/output.mjs";
import { SUPPORTED_LOCALES, t } from "../src/i18n/locale.mjs";

/** 让 loadUserConfig 的 readFile 边界模拟一个缺失文件。 */
function enoent() {
  const error = new Error("ENOENT: no such file or directory");
  error.code = "ENOENT";
  throw error;
}

test("config path: absolute XDG_CONFIG_HOME wins, relative is ignored per the XDG spec", () => {
  assert.equal(
    userConfigPath({ env: { XDG_CONFIG_HOME: "/xdg" }, home: "/home/u" }),
    "/xdg/mdxv/config.json",
  );
  // 相对值按未设置处理，否则配置会落在 cwd 而不是家目录。
  assert.equal(
    userConfigPath({ env: { XDG_CONFIG_HOME: "relative/dir" }, home: "/home/u" }),
    "/home/u/.config/mdxv/config.json",
  );
  assert.equal(userConfigPath({ env: {}, home: "/home/u" }), "/home/u/.config/mdxv/config.json");
  assert.equal(userConfigPath({ env: { XDG_CONFIG_HOME: "   " }, home: "/home/u" }), "/home/u/.config/mdxv/config.json");
});

test("parse tolerates comments and trailing commas, and never throws on garbage", () => {
  const { config, warnings } = parseUserConfig(`{
    // 行注释
    "font": {
      /* 块注释，带 "引号" 干扰 */
      "body": "My Font",
    },
  }`);
  assert.deepEqual(warnings, []);
  assert.deepEqual(config, { font: { body: "My Font" } });

  // 字符串里的注释符与逗号必须留住，不能被剥注释那一趟吃掉。
  assert.deepEqual(parseUserConfig('{"font":{"body":"A // B, C"}}').config, { font: { body: "A // B, C" } });

  const broken = parseUserConfig("{ not json ");
  assert.deepEqual(broken.config, {});
  assert.equal(broken.warnings.length, 1);
  assert.equal(broken.warnings[0].key, "config.unparsable");

  for (const source of ["[1,2]", '"text"', "null"]) {
    const parsed = parseUserConfig(source);
    assert.deepEqual(parsed.config, {}, source);
    assert.equal(parsed.warnings[0].key, "config.notAnObject", source);
  }
});

test("precedence: CLI option beats user config, config beats nothing, per role", () => {
  const config = { font: { body: "Config Body", mono: "Config Mono" } };
  const { fonts, warnings } = resolveFonts({ config, overrides: { body: "Cli Body" } });
  assert.deepEqual(warnings, []);
  assert.deepEqual(fonts.body, ["Cli Body"], "CLI 覆盖同名配置");
  assert.deepEqual(fonts.mono, ["Config Mono"], "CLI 没给的 role 仍用配置");
  assert.equal("head" in fonts, false, "两层都没给的 role 不出现，交给 CSS 默认");
  assert.equal("sans" in fonts, false);
});

test("families accept a comma string or an array, trimming blanks", () => {
  assert.deepEqual(resolveFonts({ config: { font: { body: " A , B ,, " } } }).fonts.body, ["A", "B"]);
  assert.deepEqual(resolveFonts({ config: { font: { body: ["A", " B "] } } }).fonts.body, ["A", "B"]);
  // CJK 名字（\p{L} 覆盖）必须原样通过。
  assert.deepEqual(resolveFonts({ config: { font: { head: "霞鹜文楷" } } }).fonts.head, ["霞鹜文楷"]);
});

test("a value of the wrong type or an empty list degrades that role only", () => {
  const wrongType = resolveFonts({ config: { font: { body: 42, mono: "Keep Me" } } });
  assert.equal(wrongType.warnings.length, 1);
  assert.equal(wrongType.warnings[0].key, "config.fontInvalidType");
  assert.equal(wrongType.warnings[0].params.origin, "font.body");
  assert.equal("body" in wrongType.fonts, false);
  assert.deepEqual(wrongType.fonts.mono, ["Keep Me"], "坏的一条不该带走好的一条");

  const empty = resolveFonts({ config: { font: { body: "  , ," } } });
  assert.equal(empty.warnings[0].key, "config.fontEmpty");
  assert.equal("body" in empty.fonts, false);

  const mixedArray = resolveFonts({ config: { font: { body: ["A", 7] } } });
  assert.equal(mixedArray.warnings[0].key, "config.fontInvalidType");

  const notAnObject = resolveFonts({ config: { font: "My Font" } });
  assert.equal(notAnObject.warnings[0].key, "config.fontNotAnObject");
  assert.deepEqual(notAnObject.fonts, {});
});

test("CSS-escaping characters are rejected, and reject the whole role rather than part of it", () => {
  // 这些值最终会被拼进 <style> 并随 mdxx 产物分发；任何能逃出 font-family 声明的
  // 字符都必须在这里被挡住。「部分生效」会静默改变语义，所以整条 role 丢弃。
  const escapes = [
    'A"; } body { display: none } .x {',
    "A; color: red",
    "A} .x {",
    "A/*c*/",
    "A<script>",
    "A\\6c ",
    "A'b'",
    "A(b)",
    "A\nB",
    "A:hover",
    "-leading-dash",
    " ",
  ];
  for (const value of escapes) {
    const { fonts, warnings } = resolveFonts({ config: { font: { body: value } } });
    assert.equal("body" in fonts, false, `accepted an unsafe value: ${JSON.stringify(value)}`);
    assert.equal(warnings.length, 1, JSON.stringify(value));
    assert.match(warnings[0].key, /^config\.font(InvalidName|Empty)$/, JSON.stringify(value));
  }

  // 一条里只要有一个非法名，整条都不生效（而不是只留下合法的那些）。
  const partial = resolveFonts({ config: { font: { body: "Good Font, bad;value" } } });
  assert.equal("body" in partial.fonts, false);
  assert.equal(partial.warnings[0].params.name, "bad;value");
});

test("fontCss prepends the user families ahead of the built-in chain", () => {
  assert.equal(fontCss({}), "", "什么都没配就不该注入任何东西");
  assert.equal(fontCss(), "");

  const css = fontCss({ body: ["My Font"], mono: ["Maple Mono", "ui-monospace"] });
  assert.match(css, /--mv-user-font-body: "My Font", var\(--font-body-default\);/);
  // 通用族关键字必须不带引号才生效（"monospace" 是个字体名，monospace 才是族）。
  assert.match(css, /--mv-user-font-mono: "Maple Mono", ui-monospace, var\(--font-mono-default\);/);
  assert.equal(/--mv-user-font-(sans|head)/.test(css), false, "没配的 role 不该出现");

  // 声明顺序固定为 FONT_ROLES，避免产物随对象键序漂移。
  const all = fontCss(Object.fromEntries(FONT_ROLES.map((role) => [role, [`F-${role}`]])));
  const emitted = [...all.matchAll(/--mv-user-font-(\w+):/g)].map(([, role]) => role);
  assert.deepEqual(emitted, [...FONT_ROLES]);
});

test("CLI option bag maps to roles through FONT_ROLES, not a hand-written list", () => {
  assert.deepEqual(
    fontOverridesFromOptions({ fontBody: "B", fontSans: "S", port: 4321 }),
    { sans: "S", body: "B" },
  );
  assert.deepEqual(fontOverridesFromOptions({}), {});
  assert.deepEqual(fontOverridesFromOptions(), {});
});

test("loadUserConfig never throws: a missing file is silent, an unreadable one warns", () => {
  const missing = loadUserConfig({ env: {}, home: "/home/u", readFile: enoent });
  assert.deepEqual(missing.warnings, [], "没有配置文件是常态，不该告警");
  assert.equal(missing.css, "");
  assert.deepEqual(missing.fonts, {});

  const denied = loadUserConfig({
    env: {},
    home: "/home/u",
    readFile: () => { const error = new Error("EACCES: permission denied"); error.code = "EACCES"; throw error; },
  });
  assert.equal(denied.warnings.length, 1);
  assert.equal(denied.warnings[0].key, "config.unreadable");
  assert.equal(denied.warnings[0].params.path, "/home/u/.config/mdxv/config.json");
  assert.equal(denied.css, "", "读不到就回退内置默认");

  // CLI 参数在配置文件缺失时照样生效——两层互不依赖。
  const cliOnly = loadUserConfig({ env: {}, home: "/home/u", readFile: enoent, overrides: { body: "Cli Font" } });
  assert.match(cliOnly.css, /--mv-user-font-body: "Cli Font", var\(--font-body-default\);/);

  // 坏文件 + 好 CLI 参数：告警照出，CLI 那层照生效。
  const broken = loadUserConfig({ env: {}, home: "/home/u", readFile: () => "{oops", overrides: { mono: "Cli Mono" } });
  assert.equal(broken.warnings[0].key, "config.unparsable");
  assert.match(broken.css, /--mv-user-font-mono: "Cli Mono", var\(--font-mono-default\);/);
});

test("every warning this module can emit renders in both locales", () => {
  // 缺一个 key，`t()` 就抛——一条本该「不阻断」的告警会变成真崩溃。这里把所有降级
  // 路径实际产出的 warning 都过一遍两个语料库，而不是照着 key 清单手抄。
  const emitted = [
    ...loadUserConfig({ env: {}, home: "/h", readFile: () => { const e = new Error("x"); e.code = "EACCES"; throw e; } }).warnings,
    ...loadUserConfig({ env: {}, home: "/h", readFile: () => "{oops" }).warnings,
    ...loadUserConfig({ env: {}, home: "/h", readFile: () => "[1]" }).warnings,
    ...loadUserConfig({ env: {}, home: "/h", readFile: () => '{"font": "x"}' }).warnings,
    ...loadUserConfig({ env: {}, home: "/h", readFile: () => '{"font": {"body": 1}}' }).warnings,
    ...loadUserConfig({ env: {}, home: "/h", readFile: () => '{"font": {"body": ","}}' }).warnings,
    ...loadUserConfig({ env: {}, home: "/h", readFile: () => '{"font": {"body": "a;b"}}' }).warnings,
  ];
  const keys = new Set(emitted.map((warning) => warning.key));
  assert.deepEqual(
    [...keys].sort(),
    ["config.fontEmpty", "config.fontInvalidName", "config.fontInvalidType", "config.fontNotAnObject", "config.notAnObject", "config.unparsable", "config.unreadable"],
    "降级路径变了就更新这张表——它是「两个语料库都得有词」的输入",
  );
  for (const locale of SUPPORTED_LOCALES) {
    for (const warning of emitted) {
      const line = formatWarning({ locale, warning });
      // 「本地化标签 + `: ` + 非空正文」，用 \S 而不是 \w——后者不匹配中文标签「警告」。
      assert.match(line, /^\S+: \S/u, `${locale} / ${warning.key}`);
      assert.equal(line.includes("{"), false, `${locale} / ${warning.key} 有未替换的占位符：${line}`);
    }
  }
});

test("theme.css holds up its half of the variable-name contract", () => {
  // fontCss 写 `--mv-user-font-<role>` 并回落到 `--font-<role>-default`；这两组名字住在
  // theme.css 里。任一侧改名都不会报错，只会静默失效——所以在这里对齐。
  const css = readFileSync(fileURLToPath(new URL("../src/app/styles/theme.css", import.meta.url)), "utf8");
  for (const role of FONT_ROLES) {
    assert.match(css, new RegExp(`--font-${role}-default:`), `theme.css 缺 --font-${role}-default`);
    assert.match(
      css,
      new RegExp(`--font-${role}:\\s*var\\(--mv-user-font-${role},\\s*var\\(--font-${role}-default\\)\\)`),
      `theme.css 的 --font-${role} 没有读 --mv-user-font-${role}`,
    );
  }
});

/* ---------- 写入侧（`mdxv config set`，见 setUserConfigValue） ---------- */

/** 造一个隔离的 home，并显式给 `env: {}`——否则跑测试的机器上真有 XDG_CONFIG_HOME 时，
 *  写入会越过这个 home 落到真实配置上，这类测试污染只在别人的机器上炸。 */
function sandbox() {
  const home = mkdtempSync(join(tmpdir(), "mdxv-config-"));
  return { home, env: {}, path: userConfigPath({ env: {}, home }) };
}

test("config set: initializes the file and its directory when nothing exists yet", () => {
  const box = sandbox();
  try {
    const result = setUserConfigValue({ key: "font.body", value: "ChillHuoSong_F", env: box.env, home: box.home });

    assert.equal(result.ok, true);
    assert.equal(result.created, true, "首次写入必须自报「创建」——这是配置文件唯一的初始化入口");
    assert.equal(result.path, box.path);
    assert.deepEqual(JSON.parse(readFileSync(box.path, "utf8")), { font: { body: "ChillHuoSong_F" } });

    // 真正的验收不是「文件长得对」，而是读取侧照原样认得出来——两侧共用一个模块，
    // 但格式约定（单名存字符串）是写入侧单方面定的，只有 round-trip 能钉住它。
    const loaded = loadUserConfig({ env: box.env, home: box.home });
    assert.deepEqual(loaded.fonts.body, ["ChillHuoSong_F"]);
    assert.match(loaded.css, /--mv-user-font-body: "ChillHuoSong_F", var\(--font-body-default\);/);
    assert.deepEqual(loaded.warnings, []);
  } finally {
    rmSync(box.home, { recursive: true, force: true });
  }
});

test("config set: merges into what is already there instead of replacing the file", () => {
  const box = sandbox();
  try {
    mkdirSync(dirname(box.path), { recursive: true });
    writeFileSync(box.path, JSON.stringify({ someFutureSetting: 1, font: { sans: "Inter" } }), "utf8");

    const result = setUserConfigValue({ key: "font.body", value: "Source Han Serif", env: box.env, home: box.home });

    assert.equal(result.ok, true);
    assert.equal(result.created, false);
    // 同级的 font.sans 与顶层的陌生字段都必须活下来：这条命令只认自己那一格。
    assert.deepEqual(JSON.parse(readFileSync(box.path, "utf8")), {
      someFutureSetting: 1,
      font: { sans: "Inter", body: "Source Han Serif" },
    });
  } finally {
    rmSync(box.home, { recursive: true, force: true });
  }
});

test("config set: one name stores a string, several store an array — both read back the same", () => {
  const box = sandbox();
  try {
    setUserConfigValue({ key: "font.sans", value: "Inter, PingFang SC", env: box.env, home: box.home });
    assert.deepEqual(JSON.parse(readFileSync(box.path, "utf8")).font.sans, ["Inter", "PingFang SC"]);

    setUserConfigValue({ key: "font.mono", value: "  JetBrains Mono  ", env: box.env, home: box.home });
    assert.equal(JSON.parse(readFileSync(box.path, "utf8")).font.mono, "JetBrains Mono", "两端空白应被裁掉");

    const loaded = loadUserConfig({ env: box.env, home: box.home });
    assert.deepEqual(loaded.fonts.sans, ["Inter", "PingFang SC"]);
    assert.deepEqual(loaded.fonts.mono, ["JetBrains Mono"]);
  } finally {
    rmSync(box.home, { recursive: true, force: true });
  }
});

test("config set: refuses to overwrite a config it cannot understand, leaving it byte-identical", () => {
  // 写入侧会整文件重写，所以「读不懂」必须等于「不动手」——猜错就是替用户删配置。
  for (const [label, content] of [
    ["不是合法 JSON", '{ "font": { broken'],
    ["顶层不是对象", "[1, 2]"],
    ["font 不是对象", '{ "font": "Inter" }'],
  ]) {
    const box = sandbox();
    try {
      mkdirSync(dirname(box.path), { recursive: true });
      writeFileSync(box.path, content, "utf8");

      const result = setUserConfigValue({ key: "font.body", value: "Inter", env: box.env, home: box.home });

      assert.equal(result.ok, false, label);
      assert.equal(readFileSync(box.path, "utf8"), content, `${label}：原文件必须一字未动`);
    } finally {
      rmSync(box.home, { recursive: true, force: true });
    }
  }
});

test("config set: an invalid key or value writes nothing at all", () => {
  const box = sandbox();
  try {
    for (const [key, value] of [["font.title", "X"], ["font.body", ""], ["font.body", 'a"; } body {'], ["font.body", ","]]) {
      const result = setUserConfigValue({ key, value, env: box.env, home: box.home });
      assert.equal(result.ok, false, `${key} = ${JSON.stringify(value)}`);
    }
    // 一次都没成功，就连文件都不该被创建出来。
    assert.throws(() => readFileSync(box.path, "utf8"), /ENOENT/);
  } finally {
    rmSync(box.home, { recursive: true, force: true });
  }
});

test("config set: rewriting a commented config succeeds but says the comments are gone", () => {
  const box = sandbox();
  try {
    mkdirSync(dirname(box.path), { recursive: true });
    writeFileSync(box.path, '{\n  // 我挑了很久的字体\n  "font": { "body": "Old" },\n}\n', "utf8");

    const result = setUserConfigValue({ key: "font.body", value: "New Face", env: box.env, home: box.home });

    assert.equal(result.ok, true);
    assert.deepEqual(result.warnings.map((warning) => warning.key), ["config.commentsDropped"]);
    assert.equal(JSON.parse(readFileSync(box.path, "utf8")).font.body, "New Face");
  } finally {
    rmSync(box.home, { recursive: true, force: true });
  }
});

test("config set: the key list is the single source for what may be written", () => {
  // CONFIG_KEYS 同时喂给 help、报错文案与校验；写死一张平行清单是它最可能的漂法。
  assert.deepEqual(CONFIG_KEYS, FONT_ROLES.map((role) => `font.${role}`));
  for (const key of CONFIG_KEYS) {
    assert.equal(validateConfigAssignment(key, "Inter").error, undefined, key);
  }
  assert.equal(validateConfigAssignment("font", "Inter").error?.key, "config.setUnknownKey");
});

test("every message the write side can emit renders in both locales", () => {
  const box = sandbox();
  const emitted = [];
  try {
    mkdirSync(dirname(box.path), { recursive: true });
    writeFileSync(box.path, "{oops", "utf8");
    emitted.push(setUserConfigValue({ key: "font.body", value: "Inter", env: box.env, home: box.home }).error);
    writeFileSync(box.path, "[1]", "utf8");
    emitted.push(setUserConfigValue({ key: "font.body", value: "Inter", env: box.env, home: box.home }).error);
    writeFileSync(box.path, '{"font": "x"}', "utf8");
    emitted.push(setUserConfigValue({ key: "font.body", value: "Inter", env: box.env, home: box.home }).error);
    emitted.push(setUserConfigValue({ key: "font.nope", value: "Inter", env: box.env, home: box.home }).error);
    emitted.push(setUserConfigValue({ key: "font.body", value: ",", env: box.env, home: box.home }).error);
    emitted.push(setUserConfigValue({ key: "font.body", value: "a;b", env: box.env, home: box.home }).error);
    writeFileSync(box.path, '{\n  // c\n  "font": {}\n}\n', "utf8");
    emitted.push(...setUserConfigValue({ key: "font.body", value: "Inter", env: box.env, home: box.home }).warnings);
  } finally {
    rmSync(box.home, { recursive: true, force: true });
  }

  assert.deepEqual(
    [...new Set(emitted.map((entry) => entry.key))].sort(),
    ["config.commentsDropped", "config.setEmpty", "config.setFontNotAnObject", "config.setInvalidName", "config.setNotAnObject", "config.setUnknownKey", "config.setUnparsable"],
    "写入侧的失败路径变了就更新这张表——它是「两个语料库都得有词」的输入",
  );
  // setUnreadable / setFailed 走的是 IO 失败，无法在测试里稳定制造，但同样必须有词。
  for (const locale of SUPPORTED_LOCALES) {
    for (const entry of [...emitted, { key: "config.setUnreadable", params: { path: "/p", reason: "r" } }, { key: "config.setFailed", params: { path: "/p", reason: "r" } }]) {
      const line = t(locale, entry.key, entry.params);
      assert.match(line, /\S/u, `${locale} / ${entry.key}`);
      assert.equal(line.includes("{"), false, `${locale} / ${entry.key} 有未替换的占位符：${line}`);
    }
    // 面板与用法提示同样要两边都在。
    for (const key of ["cli.configUsage", "cli.configNote"]) {
      assert.equal(t(locale, key, { allowed: CONFIG_KEYS.join(", ") }).includes("{"), false, `${locale} / ${key}`);
    }
    for (const key of ["cli.configUpdated", "cli.configCreated", "cli.configFileLabel", "cli.configKeyLabel", "cli.configValueLabel", "cli.configApplyHint", "cli.configDescription"]) {
      assert.match(t(locale, key), /\S/u, `${locale} / ${key}`);
    }
  }
});

test("config set: an unknown key answers with the whole list, other failures stay one line", () => {
  for (const locale of SUPPORTED_LOCALES) {
    // 分组标签与逐项说明都住在语料库里，缺一个 `t()` 就抛——所以这条同时是「两个语料库
    // 都得有词」的守卫：新增一个设置项却忘了配文案，这里立刻炸，而不是等用户敲错 key 时。
    const block = formatConfigKeys({ locale });
    for (const key of CONFIG_KEYS) {
      assert.match(block, new RegExp(`- ${key.replace(/\./g, "\\.")}\\s`), `${locale} 的可用项列表缺 ${key}`);
    }

    const unknown = formatConfigError({ locale, error: { key: "config.setUnknownKey", params: { key: "font.title" } } });
    assert.match(unknown, /\n\n/, "敲错 key 时，答案是一张可挑选的列表——必须分段，不能挤成一行");
    assert.ok(unknown.includes(block), `${locale} 的未知 key 报错没带上列表`);
    assert.equal(unknown.includes("{"), false, `${locale} 有未替换的占位符：${unknown}`);

    // 其余失败已经把「怎么办」说清楚了，再灌一屏列表只会淹没真正的原因。
    const single = formatConfigError({ locale, error: { key: "config.setEmpty", params: { key: "font.body" } } });
    assert.equal(single.includes("\n"), false, `${locale} 的 config.setEmpty 不该多行`);

    assert.ok(formatConfigUsage({ locale }).includes(block), `${locale} 的用法提示没带上列表`);
  }
});
