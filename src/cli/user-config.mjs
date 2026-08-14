/* ============================================================
   mdx-viewer · 用户级配置（~/.config/mdxv/config.json）
   —— 目前只承载字体族。取值优先级恒为 **CLI 参数 > 用户配置 > 内置默认**；
      内置默认那一层不在这里，而在 `src/app/styles/theme.css` 的 `--font-<role>-default`
      （本模块只负责「前置用户指定的字体名」，兜底链原样留在 CSS 里，见 fontCss）。

   两条硬约束：
   1. **配置坏了绝不阻断预览/导出**。文件不存在是常态（静默）；无法读取、不是 JSON、
      字段类型不对、字体名非法，都只降级为 warning + 回退默认，从不抛出。呈现层拿到的
      是 `{key, params}` 而非成品字符串——本模块不认识 locale，翻译留给 bin/。
   2. **字体名进 CSS 前必须过白名单**。这些值最终会被拼进 `<style>` 并随 `mdxx` 导出物
      分发出去，一个带 `;}` 的值就能把整张样式表撑破，所以宁可整条 role 丢弃并告警，
      也不做「部分生效」——后者会静默改变语义。
   ============================================================ */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

/** 可被配置的四个字体族，顺序即 CSS 与文档里的稳定呈现顺序。 */
export const FONT_ROLES = Object.freeze(["sans", "head", "body", "mono"]);

/**
 * CSS 通用字体族关键字：**必须不加引号**才生效（`"serif"` 是个字体名，serif 才是族）。
 * 只列 CSS Fonts 里的通用族；`Georgia` 这类具体字体照常加引号，加引号也完全合法。
 */
const GENERIC_FAMILIES = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui",
  "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "math", "emoji", "fangsong",
]);

/**
 * 合法字体名：首字符须为字母或数字（含 CJK，走 \p{L}），其后允许字母数字、空格、
 * `.` `_` `+` `-`。这刻意排除了引号、分号、花括号、圆括号、尖括号、反斜杠、冒号、
 * 星号与换行——即所有能逃出 `font-family` 声明的字符。
 * 通用族关键字带 `-`，同样匹配得上（如 sans-serif）。
 */
const FAMILY_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._+-]*$/u;

/**
 * Resolve the user-level config path, honoring `$XDG_CONFIG_HOME` when it is absolute.
 * XDG 规定相对值必须当作未设置处理——照办，否则相对路径会让配置落在 cwd 而非家目录。
 * @param {{env?: NodeJS.ProcessEnv, home?: string}} [options] environment boundary
 * @returns {string} absolute path to config.json
 */
export function userConfigPath({ env = process.env, home } = {}) {
  const xdg = env?.XDG_CONFIG_HOME;
  const base = typeof xdg === "string" && xdg.trim() && isAbsolute(xdg.trim())
    ? xdg.trim()
    : join(home ?? homedir(), ".config");
  return join(base, "mdxv", "config.json");
}

/**
 * Strip `//` and block comments outside of strings, keeping newlines so that a later
 * `JSON.parse` failure still reports a usable position.
 * @param {string} source raw file text
 * @returns {string} comment-free text
 */
function stripComments(source) {
  let out = "";
  let inString = false;
  let escaped = false;
  let inLine = false;
  let inBlock = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inLine) {
      if (char === "\n") { inLine = false; out += char; }
      continue;
    }
    if (inBlock) {
      if (char === "\n") out += char;
      else if (char === "*" && next === "/") { inBlock = false; index += 1; }
      continue;
    }
    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; out += char; continue; }
    if (char === "/" && next === "/") { inLine = true; continue; }
    if (char === "/" && next === "*") { inBlock = true; index += 1; continue; }
    out += char;
  }
  return out;
}

/**
 * Drop a comma that is followed only by whitespace and a closing brace/bracket.
 * @param {string} source comment-free text
 * @returns {string} text without trailing commas
 */
function stripTrailingCommas(source) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      out += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; out += char; continue; }
    if (char === ",") {
      let ahead = index + 1;
      while (ahead < source.length && /\s/.test(source[ahead])) ahead += 1;
      if (source[ahead] === "}" || source[ahead] === "]") continue;
    }
    out += char;
  }
  return out;
}

/**
 * Parse the config text tolerantly (comments + trailing commas) without ever throwing.
 * @param {string} source raw file text
 * @returns {{config: Record<string, unknown>, warnings: Array<{key: string, params?: Record<string, unknown>}>}} parsed object and degradation warnings
 */
export function parseUserConfig(source) {
  /** @type {Array<{key: string, params?: Record<string, unknown>}>} */
  const warnings = [];
  let value;
  try {
    value = JSON.parse(stripTrailingCommas(stripComments(source)));
  } catch (error) {
    return { config: {}, warnings: [{ key: "config.unparsable", params: { reason: String(error?.message || error) } }] };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    warnings.push({ key: "config.notAnObject" });
    return { config: {}, warnings };
  }
  return { config: value, warnings };
}

/**
 * Normalize one font-family value into a validated name list, or reject it whole.
 * @param {unknown} value raw value from CLI or config
 * @param {string} origin human-facing origin for the warning (`--font-body` / `font.body`)
 * @returns {{names?: string[], warning?: {key: string, params: Record<string, unknown>}}} outcome
 */
function normalizeFamilies(value, origin) {
  /** @type {string[]} */
  let raw;
  if (typeof value === "string") raw = value.split(",");
  else if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) raw = value;
  else return { warning: { key: "config.fontInvalidType", params: { origin } } };

  const names = raw.map((name) => name.trim()).filter((name) => name.length > 0);
  if (names.length === 0) return { warning: { key: "config.fontEmpty", params: { origin } } };

  const rejected = names.find((name) => !FAMILY_NAME.test(name));
  if (rejected !== undefined) {
    return { warning: { key: "config.fontInvalidName", params: { origin, name: rejected } } };
  }
  return { names };
}

/**
 * Pick the `--font-<role>` values out of a parsed CAC option bag, keyed by role.
 * CAC exposes `--font-body` as `fontBody`; mapping it here keeps FONT_ROLES the single
 * source of truth for which roles exist, instead of spelling all four out in each binary.
 * @param {Record<string, unknown>} [options] parsed CLI options
 * @returns {Record<string, unknown>} per-role overrides, absent keys omitted
 */
export function fontOverridesFromOptions(options = {}) {
  /** @type {Record<string, unknown>} */
  const overrides = {};
  for (const role of FONT_ROLES) {
    const value = options[`font${role[0].toUpperCase()}${role.slice(1)}`];
    if (value !== undefined) overrides[role] = value;
  }
  return overrides;
}

/**
 * Apply the fixed precedence — CLI option, then user config, then nothing (CSS keeps its
 * built-in default) — for each of the four font roles.
 * @param {{config?: Record<string, unknown>, overrides?: Record<string, unknown>}} [options] resolved inputs
 * @returns {{fonts: Record<string, string[]>, warnings: Array<{key: string, params?: Record<string, unknown>}>}} validated per-role name lists
 */
export function resolveFonts({ config = {}, overrides = {} } = {}) {
  /** @type {Array<{key: string, params?: Record<string, unknown>}>} */
  const warnings = [];
  /** @type {Record<string, string[]>} */
  const fonts = {};

  const configured = config.font;
  const hasFontSection = configured !== undefined;
  const fontSection = hasFontSection && configured !== null && typeof configured === "object" && !Array.isArray(configured)
    ? /** @type {Record<string, unknown>} */ (configured)
    : undefined;
  if (hasFontSection && fontSection === undefined) warnings.push({ key: "config.fontNotAnObject" });

  for (const role of FONT_ROLES) {
    // CLI 参数 > 用户配置：只有 CLI 没给这一 role 时才看配置文件。
    const fromCli = overrides[role];
    const value = fromCli !== undefined ? fromCli : fontSection?.[role];
    if (value === undefined) continue;
    const origin = fromCli !== undefined ? `--font-${role}` : `font.${role}`;
    const { names, warning } = normalizeFamilies(value, origin);
    if (warning) warnings.push(warning);
    else fonts[role] = names;
  }
  return { fonts, warnings };
}

/** @param {string} name validated family name @returns {string} CSS-safe family token */
function cssFamily(name) {
  return GENERIC_FAMILIES.has(name.toLowerCase()) ? name.toLowerCase() : `"${name}"`;
}

/**
 * Render the `<style>` body that prepends the user's families ahead of the built-in chain.
 * 写的是 `--mv-user-font-<role>`（theme.css 通过 `var()` 读它），而不是直接覆盖
 * `--font-<role>`——那样就得跟 theme.css 抢层叠顺序，而注入的 `<style>` 与 Vite 运行时
 * 插入的 theme.css 谁在后面随 dev/build 而变。换个变量名就与顺序彻底无关。
 * @param {Record<string, string[]>} fonts validated per-role name lists
 * @returns {string} CSS text, empty when nothing is configured
 */
export function fontCss(fonts = {}) {
  const declarations = FONT_ROLES
    .filter((role) => fonts[role]?.length)
    .map((role) => `  --mv-user-font-${role}: ${fonts[role].map(cssFamily).join(", ")}, var(--font-${role}-default);`);
  return declarations.length ? `:root {\n${declarations.join("\n")}\n}\n` : "";
}

/**
 * Read, parse, and resolve the user-level config into ready-to-inject CSS.
 * Never throws: every failure downgrades to a warning plus built-in defaults.
 * @param {{env?: NodeJS.ProcessEnv, home?: string, overrides?: Record<string, unknown>, readFile?: (path: string) => string}} [options] injection boundary
 * @returns {{path: string, fonts: Record<string, string[]>, css: string, warnings: Array<{key: string, params?: Record<string, unknown>}>}} resolved configuration
 */
export function loadUserConfig({ env = process.env, home, overrides = {}, readFile } = {}) {
  const path = userConfigPath({ env, home });
  const read = readFile ?? ((target) => readFileSync(target, "utf8"));
  /** @type {Array<{key: string, params?: Record<string, unknown>}>} */
  const warnings = [];

  let config = {};
  let source;
  try {
    source = read(path);
  } catch (error) {
    // 没有配置文件是绝大多数用户的常态，不是异常——保持静默。其余读取失败（权限、
    // 路径是目录、IO 错误）说明用户确实放了东西却没被用上，必须说一声。
    if (error?.code !== "ENOENT") {
      warnings.push({ key: "config.unreadable", params: { path, reason: String(error?.message || error) } });
    }
  }
  if (typeof source === "string") {
    const parsed = parseUserConfig(source);
    config = parsed.config;
    for (const warning of parsed.warnings) {
      warnings.push({ ...warning, params: { path, ...warning.params } });
    }
  }

  const resolved = resolveFonts({ config, overrides });
  for (const warning of resolved.warnings) {
    warnings.push({ ...warning, params: { path, ...warning.params } });
  }
  return { path, fonts: resolved.fonts, css: fontCss(resolved.fonts), warnings };
}

/* ------------------------------------------------------------
   写入侧（`mdxv config set <key> <value>`）
   —— 读取侧的信条是「坏了也不阻断」，写入侧恰恰相反：**拿不准就不写**。
      一次 set 会整文件重写，猜错等于替用户删配置，所以解析不了、顶层不是对象、
      font 不是对象这三种情况一律拒绝并保持原文件不动，而不是「重建一个干净的」。
   ------------------------------------------------------------ */

/** 可被 `mdxv config set` 写入的设置项（点分路径），顺序即 help 与报错里的展示顺序。 */
export const CONFIG_KEYS = Object.freeze(FONT_ROLES.map((role) => `font.${role}`));

/**
 * Validate one `<key> <value>` assignment without touching disk.
 * 白名单与读取侧共用 FAMILY_NAME，但文案分开：读取侧说的是「本项回退内置默认」——
 * 那是「已经继续跑下去了」的语气；写入侧此刻什么都还没写，命令直接失败、配置维持原样。
 * @param {unknown} key dotted setting path, e.g. `font.body`
 * @param {unknown} value raw CLI value; a comma list names several families
 * @returns {{role?: string, names?: string[], error?: {key: string, params: Record<string, unknown>}}} outcome
 */
export function validateConfigAssignment(key, value) {
  if (typeof key !== "string" || !CONFIG_KEYS.includes(key)) {
    return { error: { key: "config.setUnknownKey", params: { key: String(key ?? ""), allowed: CONFIG_KEYS.join(", ") } } };
  }
  const role = key.slice("font.".length);
  const names = String(value ?? "").split(",").map((name) => name.trim()).filter((name) => name.length > 0);
  if (names.length === 0) return { error: { key: "config.setEmpty", params: { key } } };
  const rejected = names.find((name) => !FAMILY_NAME.test(name));
  if (rejected !== undefined) return { error: { key: "config.setInvalidName", params: { key, name: rejected } } };
  return { role, names };
}

/**
 * Write one setting into the user-level config, creating the file (and its directory)
 * when it does not exist yet — this is the only entry point that initializes it.
 * 单个字体名存成字符串、多个存成数组，与读取侧接受的两种写法一致，也让手写过配置的人
 * 认得出自己的文件。写入走「临时文件 + rename」，中途失败不会留下半个 JSON。
 * @param {{key?: unknown, value?: unknown, env?: NodeJS.ProcessEnv, home?: string}} [options] assignment and environment boundary
 * @returns {{ok: boolean, path: string, key?: string, names?: string[], created?: boolean, warnings?: Array<{key: string, params?: Record<string, unknown>}>, error?: {key: string, params: Record<string, unknown>}}} outcome
 */
export function setUserConfigValue({ key, value, env = process.env, home } = {}) {
  const path = userConfigPath({ env, home });
  const { role, names, error } = validateConfigAssignment(key, value);
  if (error) return { ok: false, path, error };

  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch (readError) {
    if (readError?.code !== "ENOENT") {
      return { ok: false, path, error: { key: "config.setUnreadable", params: { path, reason: String(readError?.message || readError) } } };
    }
  }

  const created = source === undefined;
  /** @type {Record<string, unknown>} */
  let config = {};
  /** @type {Array<{key: string, params?: Record<string, unknown>}>} */
  const warnings = [];

  if (!created) {
    const parsed = parseUserConfig(source);
    const unparsable = parsed.warnings.find((warning) => warning.key === "config.unparsable");
    if (unparsable) {
      return { ok: false, path, error: { key: "config.setUnparsable", params: { path, reason: String(unparsable.params?.reason ?? "") } } };
    }
    if (parsed.warnings.some((warning) => warning.key === "config.notAnObject")) {
      return { ok: false, path, error: { key: "config.setNotAnObject", params: { path } } };
    }
    config = parsed.config;
    // 重写走 JSON.stringify，注释无法保留。这不该静默发生——用户是特意写下那些注释的。
    if (stripComments(source) !== source) warnings.push({ key: "config.commentsDropped", params: { path } });
  }

  const section = config.font;
  if (section !== undefined && (section === null || typeof section !== "object" || Array.isArray(section))) {
    return { ok: false, path, error: { key: "config.setFontNotAnObject", params: { path } } };
  }
  const next = { ...config, font: { ...(section ?? {}), [role]: names.length === 1 ? names[0] : names } };

  const temporary = `${path}.${process.pid}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    renameSync(temporary, path);
  } catch (writeError) {
    rmSync(temporary, { force: true });
    return { ok: false, path, error: { key: "config.setFailed", params: { path, reason: String(writeError?.message || writeError) } } };
  }
  return { ok: true, path, key, names, created, warnings };
}
