#!/usr/bin/env node
/* ============================================================
   mdxv —— 本地预览 MDX（统一以「根目录 + 默认文档」运作）
     mdxv <file>   以文件所在目录为根，默认打开该文件
     mdxv <dir>    以该目录为根，默认打开首篇（优先 README/index）
     mdxv demo     打开随包内置的组件总览示例
     mdxv --check <file|dir|demo>  只校验能否编译，不起 server（见 src/cli/compile-check.mjs）
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";
import { cac } from "cac";
import openBrowser from "open";
import { resolveInput, scanTree, pickDefaultDoc } from "../src/cli/resolve.mjs";
import { checkDocuments } from "../src/cli/compile-check.mjs";
import { buildConfig } from "../src/cli/vite-config.mjs";
import { CliArgumentsError, formatCliError, resolveCliArguments } from "../src/cli/language.mjs";
import { formatCheckLine, formatCheckSummary, formatError, formatHelp, formatPreviewSuccess, isColorEnabled, resolveCheckColors } from "../src/cli/output.mjs";
import { t } from "../src/i18n/locale.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");
const DEMO_DIR = resolve(PKG_ROOT, "demo");
const pkg = JSON.parse(readFileSync(resolve(PKG_ROOT, "package.json"), "utf8"));
const color = isColorEnabled({ isTTY: process.stderr.isTTY, env: process.env });
// --check 有它自己的一套退出码语义（用法错误 → 2，见 D2）；这个判定必须发生在
// resolveCliArguments 之前的裸探测（同 -h/--help 现有做法），否则 --lang 的三种参数级
// 失败会在 --check 感知之前退成 1（F3）。
// 探测必须匹配 cac 稍后对 `--check` 这个纯布尔选项的真实判定（见下方 cli.option("--check", …)
// 没有 `<value>` 占位符——它从未被广告为带值选项），否则两者会在“该判几号”上打架，
// 这正是 #A1 的成因：裸探测只精确匹配 token "--check"，而 `--check=true` 会滑过去，
// 使参数级失败误判为退 1（“文档破了”）而不是退 2（“你调用错了”），这恰是 D2 要杜绝的误诊。
// 修法：让裸探测复刻 cac/mri 对布尔选项的真实强制转换规则——除了字面 "--check=false"
// 会被强制转换为 false，`--check`、`--check=true`、`--check=<任何其他值>` 全部强制转换为
// true。也就是说“带值拼写”被**接受但值被忽略**（除了这一个被 cac 自己认定为假的字面值），
// 而不是把它当成参数级失败退 2——因为 cac 本身对 `--check=<任何拼写>` 从不报错，
// 把裸探测收得比 cac 自己还严只会制造新的一种「两处判定不一致」。这与 `--lang`
// （src/cli/language.mjs 的 parseLanguageArgument/resolveCliLanguage）不同：locale 字符串
// 本身带语义、值可能是错的，所以 --lang 有专门的校验并在错时报错；`--check` 是纯开关，
// spec/help 从未广告过带值形式，没有语义可校验，只需原样复刻 cac 的强制转换。
const checkMode = process.argv.slice(2).some(
  (arg) => arg === "--check" || (arg.startsWith("--check=") && arg.slice("--check=".length) !== "false"),
);
// 着色按「实际写入的那条流」分别判定（F2）——报告走 stdout、诊断走 stderr，
// 不能像预览/导出面板那样共用一个基于 stderr 的 color。
const checkColors = resolveCheckColors({ stdoutIsTTY: process.stdout.isTTY, stderrIsTTY: process.stderr.isTTY, env: process.env });

await main();

async function main() {
  let language;
  try {
    language = resolveCliArguments({ argv: process.argv.slice(2) });
  } catch (error) {
    const locale = error.locale || "en-US";
    console.error(`${formatError({ locale, message: formatCliError(error, locale), color: checkMode ? checkColors.diagnostic : color })}\n\n${formatHelp({ command: "mdxv", locale, color })}`);
    if (checkMode) { process.exitCode = 2; return; }
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
    .option("--check", t(language.locale, "cli.optionCheck"))
    .action(async (input, opts) => {
      if (opts.check) {
        await runCheck(input, language);
        return;
      }

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
    console.error(`${formatError({ locale: language.locale, parserError: error, color: checkMode ? checkColors.diagnostic : color })}\n\n${formatHelp({ command: "mdxv", locale: language.locale, color })}`);
    // stdout 可能已经是管道且已增量吐出若干篇报告行（F5）：checkMode 下绝不 process.exit()，
    // 只设 exitCode 后让脚本自然结束，交给 Node 冲刷排队中的写入。
    if (checkMode) { process.exitCode = 2; return; }
    process.exit(1);
  }
}

/**
 * `--check` 模式：按 §「输入 → 文档集」解析文档集（文件→自身；目录→scanTree；
 * demo→scanTree(DEMO_DIR)，忽略 resolveInput 给 demo 的 target，见 F11），逐篇校验并
 * 边算边把 `✓`/`✗` 行写 stdout，仅在文档集 >1 篇时补一行汇总；用法/入参级失败与空文档集
 * 退出 2，≥1 篇因内容失败退出 1（D2）。不起 server、不开浏览器、不落任何文件（R5）；
 * 只设 `process.exitCode` 后返回，绝不调用 `process.exit()`（F5）。
 * @param {string | undefined} input 用户给出的位置参数
 * @param {import("../src/cli/language.mjs").CliLanguage} language 已解析的界面语言
 */
async function runCheck(input, language) {
  let documents;
  try {
    documents = input === "demo" ? scanTree(DEMO_DIR) : resolveCheckDocuments(input);
  } catch (error) {
    const diagnostic = formatError({ locale: language.locale, message: formatCliError(error, language.locale), color: checkColors.diagnostic });
    const help = error.code === "INPUT_REQUIRED"
      ? `\n\n${formatHelp({ command: "mdxv", locale: language.locale })}`
      : "";
    console.error(`${diagnostic}${help}`);
    process.exitCode = 2;
    return;
  }
  if (!documents.length) {
    console.error(formatError({ locale: language.locale, message: t(language.locale, "cli.directoryEmpty", { root: input }), color: checkColors.diagnostic }));
    process.exitCode = 2;
    return;
  }

  const { passed, failed } = await checkDocuments(documents, {
    onResult(result) {
      console.log(formatCheckLine(result, { color: checkColors.report }));
    },
  });
  if (documents.length > 1) {
    console.log(formatCheckSummary({ passed, failed }, { locale: language.locale }));
  }
  process.exitCode = failed > 0 ? 1 : 0;
}

/**
 * `--check` 专用的输入解析：不使用 `pickDefaultDoc`（校验没有「默认文档」概念）。
 * @param {string | undefined} input 文件或目录参数
 * @returns {{abs: string}[]} 待校验的文档集
 */
function resolveCheckDocuments(input) {
  const inp = resolveInput(input);
  return inp.target ? [{ abs: inp.target }] : scanTree(inp.root);
}
