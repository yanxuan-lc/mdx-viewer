#!/usr/bin/env node
/* ============================================================
   mdxx —— 把单篇 MDX 导出为自包含离线 HTML（零外链，双击即开）
     mdxx <file> [output.html]
   ============================================================ */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { build } from "vite";
import { cac } from "cac";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolveInput } from "../src/cli/resolve.mjs";
import { buildConfig } from "../src/cli/vite-config.mjs";
import { CliArgumentsError, CliOutputError, formatCliError, resolveCliArguments } from "../src/cli/language.mjs";
import { formatError, formatExportSuccess, formatHelp, isColorEnabled } from "../src/cli/output.mjs";
import { t } from "../src/i18n/locale.mjs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const color = isColorEnabled({ isTTY: process.stderr.isTTY, env: process.env });

let language;
try {
  language = resolveCliArguments({ argv: process.argv.slice(2) });
} catch (error) {
  const locale = error.locale || "en-US";
  console.error(`${formatError({ locale, message: formatCliError(error, locale), color })}\n\n${formatHelp({ command: "mdxx", locale, color })}`);
  process.exit(1);
}
if (process.argv.slice(2).includes("-h") || process.argv.slice(2).includes("--help")) {
  process.stdout.write(`${formatHelp({ command: "mdxx", locale: language.locale })}\n`);
  process.exit(0);
}
const cli = cac("mdxx");

cli
  .command("[input] [output]", t(language.locale, "cli.exportDescription"))
  .option("--lang <locale>", t(language.locale, "cli.optionLanguage"))
  .action(async (input, output) => {
    let inp;
    try {
      inp = resolveInput(input);
    } catch (error) {
      const diagnostic = formatError({ locale: language.locale, message: formatCliError(error, language.locale), color });
      const help = error.code === "INPUT_REQUIRED"
        ? `\n\n${formatHelp({ command: "mdxx", locale: language.locale })}`
        : "";
      console.error(`${diagnostic}${help}`);
      process.exit(1);
    }
    if (!inp.target) {
      console.error(formatError({ locale: language.locale, message: t(language.locale, "cli.exportRequiresFile"), color }));
      process.exit(1);
    }

    const outFile = resolve(process.cwd(), output || inp.target.replace(/\.mdx?$/i, ".html"));
    const tmp = mkdtempSync(resolve(tmpdir(), "mdxx-"));

    try {
      const config = buildConfig({
        mode: "file",
        target: inp.target,
        version: pkg.version,
        license: pkg.license,
        initialLocale: language.locale,
        localeSource: language.source,
        outDir: tmp,
        extraPlugins: [viteSingleFile()],
      });
      await build({ ...config, logLevel: "silent" });
      const html = readFileSync(resolve(tmp, "index.html"), "utf8");
      writeFileSync(outFile, html);
      console.error(formatExportSuccess({
        locale: language.locale,
        version: pkg.version,
        source: inp.target,
        output: outFile,
        size: `${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`,
        color,
      }));
    } catch (cause) {
      const error = new CliOutputError(outFile, cause);
      console.error(formatError({ locale: language.locale, message: formatCliError(error, language.locale), color }));
      process.exitCode = 1;
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

cli.version(pkg.version);
try {
  const parsed = cli.parse(process.argv, { run: false });
  if (parsed.options.version) {
    process.exit(0);
  }
  const extraArguments = parsed.args.slice(2);
  if (extraArguments.length) {
    throw new CliArgumentsError(extraArguments);
  }
  await cli.runMatchedCommand();
} catch (error) {
  console.error(`${formatError({ locale: language.locale, parserError: error, color })}\n\n${formatHelp({ command: "mdxx", locale: language.locale, color })}`);
  process.exit(1);
}
