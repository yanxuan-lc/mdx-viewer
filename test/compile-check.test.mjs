/* ============================================================
   单元测试 · src/cli/compile-check.mjs + src/cli/output.mjs 的 check-* 呈现
   —— 纯函数 + 直接函数调用为主（子进程级 CLI 场景在 test/compile-check.cli.test.mjs，
      由 e2e-author 负责）。唯一例外：#A1 那条 bin/mdxv.mjs 里的裸 argv 探测本身就是
      「argv 怎么拼」这个问题，无法脱离真实子进程复现，故该组 3 个测试真的 spawn 了
      `bin/mdxv.mjs`（code-review #A1 的回归测试，由本文件负责而非 e2e-author's 文件，
      因为修的是这次的 fix，不是新场景）。
      覆盖 S1-S5、S8-S10、S13、S18、S19（内容层）与 S11（着色纯逻辑）；
      S6/S7/S14/S15/S16（argv 接线 / 流分工 / demo 篇数）与 S12（性能）不在本文件。
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, relative, resolve as resolvePath } from "node:path";
import { compile } from "@mdx-js/mdx";
import { checkDocuments, describeCompileFailure } from "../src/cli/compile-check.mjs";
import { formatCheckLine, formatCheckPath, formatCheckSummary, formatHelp, resolveCheckColors } from "../src/cli/output.mjs";
import { mdxOptions } from "../src/mdx/plugins.mjs";

const FIXTURES = fileURLToPath(new URL("./fixtures/compile-check/", import.meta.url));
const doc = (name) => join(FIXTURES, name);
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const { MDXV_LANG, ...CLEAN_ENV } = process.env;
/** One real `bin/mdxv.mjs` subprocess invocation, for the #A1 argv-probe regression below —
 * the bug lives in a bare-argv probe in `bin/mdxv.mjs` itself, so unlike the rest of this
 * file it cannot be reproduced as a direct function call; the subprocess-level suite for
 * `--check` otherwise lives in `test/compile-check.cli.test.mjs` (e2e-author's). */
function runMdxv(args) {
  return spawnSync(process.execPath, ["bin/mdxv.mjs", ...args], { cwd: REPO_ROOT, encoding: "utf8", env: CLEAN_ENV });
}

// ---- describeCompileFailure：三种实测异常形状 -------------------------------

test("describeCompileFailure: a VFileMessage with a position normalizes to {line, column, reason}", async () => {
  let caught;
  try {
    await compile({ path: doc("broken-jsx.mdx"), value: "a\n<global|tenant|workspace> b\n" }, mdxOptions());
  } catch (error) { caught = error; }
  const described = describeCompileFailure(caught);
  assert.deepEqual(described, {
    line: 2,
    column: 8,
    reason: described.reason,
  });
  assert.match(described.reason, /^Unexpected character `\|` \(U\+007C\) in name/);
});

test("describeCompileFailure: a VFileMessage without a resolvable position keeps only {reason}", async () => {
  let caught;
  try {
    await compile({ path: doc("unclosed.mdx"), value: "before\n\n<Callout>\n\nno close\n" }, mdxOptions());
  } catch (error) { caught = error; }
  const described = describeCompileFailure(caught);
  assert.equal(described.line, undefined);
  assert.equal(described.column, undefined);
  assert.match(described.reason, /Expected a closing tag for `<Callout>`/);
});

test("describeCompileFailure: a bare Error (e.g. a broken dot fence) has no position, and the graph source's own line number is never reinterpreted as a document position", async () => {
  let caught;
  try {
    await compile({ path: doc("broken-dot.mdx"), value: "```dot\ndigraph { a -> b\n```\n" }, mdxOptions());
  } catch (error) { caught = error; }
  const described = describeCompileFailure(caught);
  assert.equal(described.line, undefined);
  assert.equal(described.column, undefined);
  assert.match(described.reason, /syntax error in line 2/);
  assert.equal(described.reason.endsWith("\n"), false, "trailing engine whitespace should not leak into the reason");
});

// ---- checkDocuments：内容层场景 ----------------------------------------------

test("S1: a single passing document reports ok with no position", async () => {
  const { results, passed, failed } = await checkDocuments([{ abs: doc("pass.mdx") }]);
  assert.equal(passed, 1);
  assert.equal(failed, 0);
  assert.deepEqual(results, [{ abs: doc("pass.mdx"), ok: true }]);
});

test("S2: a single failing document carries the 1-based line/column of the offending character", async () => {
  const { results, failed } = await checkDocuments([{ abs: doc("broken-jsx.mdx") }]);
  assert.equal(failed, 1);
  assert.equal(results[0].ok, false);
  assert.equal(results[0].line, 2);
  assert.equal(results[0].column, 8);
  assert.match(results[0].reason, /^Unexpected character `\|` \(U\+007C\) in name/);
});

test("S3: a mixed batch reports one result per document, in input order, without one failure suppressing the rest", async () => {
  const documents = [{ abs: doc("pass.mdx") }, { abs: doc("broken-jsx.mdx") }, { abs: doc("full-feature.mdx") }];
  const { results, passed, failed } = await checkDocuments(documents);
  assert.deepEqual(results.map((r) => r.abs), documents.map((d) => d.abs));
  assert.deepEqual(results.map((r) => r.ok), [true, false, true]);
  assert.equal(passed, 2);
  assert.equal(failed, 1);
});

test("S4: every document passing counts a failed total of 0", async () => {
  const { passed, failed } = await checkDocuments([{ abs: doc("pass.mdx") }, { abs: doc("full-feature.mdx") }]);
  assert.equal(passed, 2);
  assert.equal(failed, 0);
});

test("S5: a full-feature document (frontmatter, GFM, math, dot, mermaid, highlighted code) compiles under mdxOptions()", async () => {
  const { results } = await checkDocuments([{ abs: doc("full-feature.mdx") }]);
  assert.equal(results[0].ok, true);
});

test("S8: a dot-fence syntax error has no position and degrades to a plain reason", async () => {
  const { results, failed } = await checkDocuments([{ abs: doc("broken-dot.mdx") }]);
  assert.equal(failed, 1);
  assert.equal(results[0].ok, false);
  assert.equal(results[0].line, undefined);
  assert.equal(results[0].column, undefined);
  assert.match(results[0].reason, /syntax error/);
});

test("S9: an unreadable document inside a batch is caught as a failed result carrying the OS reason, and the rest are still checked", async (t) => {
  // mode 000 is not a permission barrier for uid 0, so this scenario cannot be
  // observed as root (the container-CI default) — say so instead of failing.
  if (process.getuid?.() === 0) return t.skip("running as root: mode 000 is still readable");

  // The unreadable file is built in a temp dir rather than chmod'ed in place, mirroring
  // the sibling assertion in compile-check.cli.test.mjs. Doing it to a version-controlled
  // fixture meant a killed test run left the file unreadable in the working tree.
  const dir = mkdtempSync(join(tmpdir(), "mdxv-check-s9-"));
  const file = join(dir, "unreadable.mdx");
  writeFileSync(file, "# unreadable\n");
  chmodSync(file, 0o000);
  t.after(() => {
    chmodSync(file, 0o644);
    rmSync(dir, { recursive: true, force: true });
  });

  const { results, passed, failed } = await checkDocuments([{ abs: doc("pass.mdx") }, { abs: file }]);
  assert.equal(passed, 1);
  assert.equal(failed, 1);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.equal(results[1].line, undefined);
  assert.match(results[1].reason, /EACCES|permission denied/i);
});

test("S10: an undefined component is not detected — the document reports as passing", async () => {
  const { results } = await checkDocuments([{ abs: doc("undefined-component.mdx") }]);
  assert.equal(results[0].ok, true);
});

test("S13: the same content passes as .md and fails as .mdx, because format follows the extension", async () => {
  const mdResult = await checkDocuments([{ abs: doc("broken-jsx.md") }]);
  const mdxResult = await checkDocuments([{ abs: doc("broken-jsx.mdx") }]);
  assert.equal(mdResult.results[0].ok, true, ".md treats the line as text");
  assert.equal(mdxResult.results[0].ok, false, ".mdx parses it as JSX and fails");
});

test("S18: an invalid component prop value is not detected — the document reports as passing", async () => {
  const { results } = await checkDocuments([{ abs: doc("bad-prop.mdx") }]);
  assert.equal(results[0].ok, true);
});

test("S19: malformed math is not detected — the document reports as passing", async () => {
  const { results } = await checkDocuments([{ abs: doc("bad-math.mdx") }]);
  assert.equal(results[0].ok, true);
});

// ---- checkDocuments：onResult 契约（F12） ------------------------------------

test("F12: onResult is invoked exactly once per document, in input order", async () => {
  const documents = [{ abs: doc("pass.mdx") }, { abs: doc("broken-jsx.mdx") }, { abs: doc("full-feature.mdx") }];
  const seen = [];
  await checkDocuments(documents, { onResult: (result) => seen.push(result.abs) });
  assert.deepEqual(seen, documents.map((d) => d.abs));
});

test("F12: a thenable returned by onResult is awaited before the next document starts", async () => {
  const documents = [{ abs: doc("pass.mdx") }, { abs: doc("pass.mdx") }, { abs: doc("pass.mdx") }];
  let busy = false;
  let overlapped = false;
  await checkDocuments(documents, {
    onResult: async () => {
      if (busy) overlapped = true;
      busy = true;
      await new Promise((r) => setTimeout(r, 5));
      busy = false;
    },
  });
  assert.equal(overlapped, false);
});

test("F12: onResult throwing aborts the round and rejects checkDocuments, without processing the remaining documents", async () => {
  const documents = [{ abs: doc("pass.mdx") }, { abs: doc("pass.mdx") }, { abs: doc("pass.mdx") }];
  let calls = 0;
  await assert.rejects(
    () => checkDocuments(documents, {
      onResult: () => {
        calls += 1;
        if (calls === 2) throw new Error("boom");
      },
    }),
    /boom/,
  );
  assert.equal(calls, 2);
});

// ---- output.mjs：check-* 呈现纯函数 -------------------------------------------

test("formatCheckPath: relative to cwd, absolute when the relative form would escape upward", () => {
  const cwd = process.cwd();
  assert.equal(formatCheckPath(join(cwd, "a", "b.mdx"), cwd), join("a", "b.mdx"));

  const outside = resolvePath(tmpdir(), "mdxv-outside", "c.mdx");
  const escapesUpward = relative(cwd, outside).startsWith("..");
  assert.equal(escapesUpward, true, "precondition: tmpdir must be outside cwd for this assertion to be meaningful");
  assert.equal(formatCheckPath(outside, cwd), outside);
});

test("formatCheckLine: a passing document renders '✓ <path>' with no reason and no position", () => {
  const line = formatCheckLine({ abs: "/x/doc.mdx", ok: true }, { cwd: "/x" });
  assert.equal(line, "✓ doc.mdx");
});

test("formatCheckLine: a failure with a position renders '✗ <path>:<line>:<column>  <reason>'", () => {
  const line = formatCheckLine({ abs: "/x/doc.mdx", ok: false, line: 2, column: 8, reason: "Unexpected character" }, { cwd: "/x" });
  assert.equal(line, "✗ doc.mdx:2:8  Unexpected character");
});

test("formatCheckLine: a failure without a position renders '✗ <path>  <reason>' with no fabricated position", () => {
  const line = formatCheckLine({ abs: "/x/doc.mdx", ok: false, reason: "syntax error in line 2" }, { cwd: "/x" });
  assert.equal(line, "✗ doc.mdx  syntax error in line 2");
});

test("formatCheckLine: colour applies only to the mark, never to the path or reason", () => {
  const ok = formatCheckLine({ abs: "/x/doc.mdx", ok: true }, { cwd: "/x", color: true });
  assert.equal(ok, "[32m✓[0m doc.mdx");
  const fail = formatCheckLine({ abs: "/x/doc.mdx", ok: false, reason: "bad" }, { cwd: "/x", color: true });
  assert.equal(fail, "[31m✗[0m doc.mdx  bad");
});

test("formatCheckSummary: renders localized 'N passed, M failed' text and follows the given locale", () => {
  assert.equal(formatCheckSummary({ passed: 2, failed: 1 }, { locale: "en-US" }), "2 passed, 1 failed");
  assert.equal(formatCheckSummary({ passed: 2, failed: 1 }, { locale: "zh-CN" }), "2 通过，1 失败");
});

test("S11: resolveCheckColors decides colour per stream, not from one shared decision", () => {
  assert.deepEqual(resolveCheckColors({ stdoutIsTTY: false, stderrIsTTY: true, env: {} }), { report: false, diagnostic: true });
  assert.deepEqual(resolveCheckColors({ stdoutIsTTY: true, stderrIsTTY: false, env: {} }), { report: true, diagnostic: false });
  assert.deepEqual(resolveCheckColors({ stdoutIsTTY: true, stderrIsTTY: true, env: { NO_COLOR: "" } }), { report: false, diagnostic: false });
});

// ---- #A1: the `--check` bare-argv probe must agree with cac's own boolean coercion ----------

test("#A1: `--check=true` is detected by the bare-argv probe, so an argument-level failure alongside it exits 2 (not 1)", () => {
  const result = runMdxv(["--check=true", doc("pass.mdx"), "--lang", "xx-XX"]);
  assert.equal(result.status, 2, `previously exited 1 (misdiagnosed as a broken document): stderr=${result.stderr}`);
  assert.match(result.stderr, /^Error: /);
});

test("#A1: bare `--check` still exits 2 on the same argument-level failure (control, must not regress)", () => {
  const result = runMdxv(["--check", doc("pass.mdx"), "--lang", "xx-XX"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /^Error: /);
});

test("#A1: `--check=false` is cac's one literal falsy spelling, so it must NOT be swept into check-mode's exit-2 accounting", () => {
  const result = runMdxv(["--check=false", doc("pass.mdx"), "--lang", "xx-XX"]);
  assert.equal(result.status, 1, "an argument-level failure while --check is off exits 1, same as with no --check flag at all");
  assert.match(result.stderr, /^Error: /);
});

test("#B5: after a bare `--`, `--check` is no longer an option to cac, so the probe must not claim check-mode either", () => {
  const result = runMdxv(["--lang", "xx-XX", "--", "--check"]);
  assert.equal(result.status, 1, `cac gives opts.check === undefined here, so the contract is exit 1; previously the probe saw the token and exited 2: stderr=${result.stderr}`);
  assert.match(result.stderr, /^Error: /);
});

test("S10 (help clause): mdxv --help names --check's compile-only boundary as a mechanism (not a closed list), worded as a top-level ESM statement rather than a bare 'import', marks its examples as non-exhaustive, and carves out fenced code", () => {
  const help = formatHelp({ command: "mdxv", locale: "en-US" });
  assert.match(help, /--check/);
  assert.match(help, /Notes:/);
  assert.match(help, /verifies compilation only/i);
  assert.match(help, /top-level ESM statement/, "must name the mechanism as a top-level ESM statement, not a bare 'import'");
  assert.doesNotMatch(help, /`import`/, "must not narrow the boundary itself down to the bare 'import' keyword");
  // #A3 (review finding, planner-revised wording): a closed two-item enumeration licenses the
  // false inference "no import, no {...}, therefore this document is safe to ship" — the exact
  // inference R6 exists to prevent. The rewrite trades the closed list for mechanism + examples,
  // explicitly marked as non-exhaustive.
  assert.match(help, /examples, not an exhaustive list/i, "must mark the tier-B examples as non-exhaustive, not a closed enumeration");
  assert.match(help, /fenced code block/, "must carve out fenced code so 'documenting JavaScript' is never implicated");
});

// #B6 (code review, P3): the above only pinned the en-US wording. zh-CN is this project's
// primary audience language and had no content assertion at all — the pre-existing locale
// tests only check that message keys exist, not their prose, so the zh-CN note could drift
// back to a closed-set enumeration (the exact thing #A3 fixed) without ever turning red.
// Mirrors the same four load-bearing markers, in zh-CN wording.
test("S10 (help clause, zh-CN): mdxv --help 的 --check 边界说明镜像英文版的承重措辞，未退化成封闭清单", () => {
  const help = formatHelp({ command: "mdxv", locale: "zh-CN" });
  assert.match(help, /--check/);
  assert.match(help, /只校验编译，不保证文档能加载/, "必须声明「只校验编译，不保证能加载」这条编译-only 边界");
  assert.match(help, /顶层 ESM 语句/, "机制措辞必须是「顶层 ESM 语句」，而不是把边界收窄成裸 import");
  assert.doesNotMatch(help, /`import`/, "不能把边界本身收窄成带反引号的裸 `import` 形式");
  assert.match(help, /这些只是例子，不是清单/, "必须带非穷举标记——这是 #A3 重写的核心，不是可有可无的措辞");
  assert.match(help, /围栏代码块里的 import 不受影响/, "必须保留围栏代码豁免，否则「写文档讲 JavaScript」会被误伤");
});
