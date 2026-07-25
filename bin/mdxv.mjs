#!/usr/bin/env node
/* ============================================================
   mdxv —— 本地预览 MDX（统一以「根目录 + 默认文档」运作）
     mdxv <file>   以文件所在目录为根，默认打开该文件
     mdxv <dir>    以该目录为根，默认打开首篇（优先 README/index）
     mdxv demo     打开随包内置的组件总览示例
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";
import { cac } from "cac";
import openBrowser from "open";
import { resolveInput, scanTree, pickDefaultDoc } from "../src/cli/resolve.mjs";
import { buildConfig } from "../src/cli/vite-config.mjs";
import { CliArgumentsError, formatCliError, resolveCliArguments } from "../src/cli/language.mjs";
import { formatError, formatHelp, formatPreviewSuccess, isColorEnabled } from "../src/cli/output.mjs";
import { t } from "../src/i18n/locale.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const DEMO_DIR = resolve(PKG_ROOT, "demo");
const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8"));
const color = isColorEnabled({ isTTY: process.stderr.isTTY, env: process.env });

let language;
try {
  language = resolveCliArguments({ argv: process.argv.slice(2) });
} catch (error) {
  const locale = error.locale || "en-US";
  console.error(`${formatError({ locale, message: formatCliError(error, locale), color })}\n\n${formatHelp({ command: "mdxv", locale, color })}`);
  process.exit(1);
}
if (process.argv.slice(2).includes("-h") || process.argv.slice(2).includes("--help")) {
  process.stdout.write(`${formatHelp({ command: "mdxv", locale: language.locale })}\n`);
  process.exit(0);
}

const cli = cac("mdxv");

cli
  .command("[input]", t(language.locale, "cli.viewDescription"))
  .option("--lang <locale>", t(language.locale, "cli.optionLanguage"))
  .option("--port <port>", t(language.locale, "cli.optionPort"), { default: 4321 })
  .option("--host", t(language.locale, "cli.optionHost"))
  .option("--no-open", t(language.locale, "cli.optionOpen"))
  .action(async (input, opts) => {
    let inp;
    try {
      // 特例：`mdxv demo` → 打开随包内置示例目录
      inp = input === "demo"
        ? { root: DEMO_DIR, target: resolve(DEMO_DIR, "index.mdx") }
        : resolveInput(input);
    } catch (error) {
      const diagnostic = formatError({ locale: language.locale, message: formatCliError(error, language.locale), color });
      const help = error.code === "INPUT_REQUIRED"
        ? `\n\n${formatHelp({ command: "mdxv", locale: language.locale })}`
        : "";
      console.error(`${diagnostic}${help}`);
      process.exit(1);
    }

    let files;
    try {
      files = scanTree(inp.root);
    } catch (error) {
      console.error(formatError({ locale: language.locale, message: formatCliError(error, language.locale), color }));
      process.exit(1);
    }
    if (!files.length) {
      console.error(formatError({ locale: language.locale, message: t(language.locale, "cli.directoryEmpty", { root: inp.root }), color }));
      process.exit(1);
    }
    const firstDoc = pickDefaultDoc(files, inp.root, inp.target);

    const config = buildConfig({
      mode: "dir",
      root: inp.root,
      files,
      version: pkg.version,
      license: pkg.license,
      firstDoc,
      initialLocale: language.locale,
      localeSource: language.source,
    });
    const server = await createServer({
      ...config,
      server: { ...config.server, port: Number(opts.port), strictPort: false, host: opts.host },
    });
    await server.listen();

    const base = server.resolvedUrls?.local?.[0] || `http://localhost:${opts.port}/`;
    const url = `${base}?doc=${encodeURIComponent(firstDoc)}`;

    console.error(formatPreviewSuccess({
      locale: language.locale,
      version: pkg.version,
      root: inp.root,
      doc: firstDoc,
      count: files.length,
      url,
      color,
    }));
    if (opts.open) await openBrowser(url);
  });

cli.version(pkg.version);
try {
  const parsed = cli.parse(process.argv, { run: false });
  if (parsed.options.version) {
    process.exit(0);
  }
  const extraArguments = parsed.args.slice(1);
  if (extraArguments.length) {
    throw new CliArgumentsError(extraArguments);
  }
  await cli.runMatchedCommand();
} catch (error) {
  console.error(`${formatError({ locale: language.locale, parserError: error, color })}\n\n${formatHelp({ command: "mdxv", locale: language.locale, color })}`);
  process.exit(1);
}
