/* ============================================================
   L1 进程内单测 · 三条测试车道的依赖表面不变式
   —— 车道判据（AGENTS.md / Makefile）声明 L1「进程内、零 spawn」、L2「不跑构建」、
      L3「跑真实构建」。判据一旦只是**声明**就会漂：`test:unit` 曾被标成「快，无 vite
      构建」而实测比「慢车道」慢一个量级数月无人发现；重切车道那一版又在同一个提交里
      让一个 L1 文件经 helper 间接 spawn 了四次，因为当时只测了构建维度、spawn 维度只
      声明未测量（code-review #A1）。本文件把能静态判定的那部分钉住。

      **判据按传递闭包算**，不是按车道清单里那几个文件：文件自己不 spawn 不够，它
      import 的东西也不能——`test/helpers/` 存在之后这一跳必须算进来（#B12）。

      **本文件明确不覆盖的**：L2「不跑构建」无法静态判定——`cli-output` / `cli-language`
      合法地调用 `bin/mdxx.mjs`，只是走的是 `--help`、非法 `--lang` 这类**构建之前就退出**
      的路径。那一维只能靠探针动态测（见 openspec/changes/retier-test-lanes/genai/
      suite-report.md 的实测表），本文件不假装覆盖了它。
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname, relative, normalize } from "node:path";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const { scripts } = JSON.parse(readFileSync(join(REPO, "package.json"), "utf8"));

/* 判据看的是**实际的 import 说明符**，不是自由文本。
   自由文本会把本文件自己判成违规——它必须写出这些名字才能检查它们；而且
   注释里提一句 `child_process` 也会误报。ESM 里拿不到 `child_process` 就调不了它，
   所以「闭包内无人 import 它」与「结构上不具备派生能力」等价。 */
const ANY_IMPORT = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const SPAWN_MODULE = /^node:child_process$|^child_process$/;
/** 相对 import / 动态 import，用来走传递闭包。 */
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g;

/** 一个文件 import 了哪些模块说明符。 */
const importsOf = (file) => [...readFileSync(join(REPO, file), "utf8").matchAll(ANY_IMPORT)].map(([, s]) => s);

const laneFiles = (lane) => [...scripts[lane].matchAll(/test\/[\w./-]+\.test\.mjs/g)].map((m) => m[0]);

/** 从一组文件出发，沿相对 import 走到底；返回仓库相对路径集合。 */
function closureOf(entryFiles) {
  const seen = new Set();
  const stack = [...entryFiles];
  while (stack.length) {
    const file = normalize(stack.pop());
    if (seen.has(file)) continue;
    const abs = join(REPO, file);
    assert.ok(existsSync(abs), `${file} is referenced by a lane list or an import but does not exist`);
    seen.add(file);
    const source = readFileSync(abs, "utf8");
    for (const [, specifier] of source.matchAll(RELATIVE_IMPORT)) {
      stack.push(relative(REPO, join(REPO, dirname(file), specifier)));
    }
  }
  return seen;
}

test("lane membership: every file the gate's glob collects belongs to exactly one lane", () => {
  const onDisk = readdirSync(join(REPO, "test")).filter((n) => n.endsWith(".test.mjs")).map((n) => `test/${n}`);
  const lanes = { "test:unit": laneFiles("test:unit"), "test:cli": laneFiles("test:cli"), "test:build": laneFiles("test:build") };

  for (const file of onDisk) {
    const owners = Object.entries(lanes).filter(([, files]) => files.includes(file)).map(([lane]) => lane);
    assert.deepEqual(owners.length, 1, `${file} is claimed by ${owners.length} lanes (${owners.join(", ") || "none"}) — the gate globs it either way, so a lane run would silently skip or double-run it`);
  }
  for (const [lane, files] of Object.entries(lanes)) {
    for (const file of files) {
      assert.ok(onDisk.includes(file), `${lane} lists ${file}, which the gate's glob does not collect — a renamed or deleted file left behind in the lane list`);
    }
  }
});

test("L1 invariant: nothing in test:unit's transitive closure can spawn a subprocess", () => {
  const offenders = [...closureOf(laneFiles("test:unit"))]
    .filter((file) => importsOf(file).some((specifier) => SPAWN_MODULE.test(specifier)))
    .sort();
  assert.deepEqual(
    offenders,
    [],
    "test:unit is declared in-process and zero-spawn (AGENTS.md, Makefile). These files, reachable from it, " +
      "reference a subprocess API — either they belong in test:cli, or the declared criterion is now false. " +
      "A false lane label is the defect this file exists to prevent, not a cosmetic issue.",
  );
});

test("L1 invariant: test:unit's closure never imports vite, so it cannot reach a build at all", () => {
  const offenders = [...closureOf(laneFiles("test:unit"))]
    .filter((file) => importsOf(file).some((specifier) => specifier === "vite" || specifier.startsWith("vite/")))
    .sort();
  assert.deepEqual(offenders, [], "an L1 file importing vite could run a build without spawning anything");
});

test("L3 is the only lane that may reach a build, and it genuinely does", () => {
  // 反向守卫：若有人把全部构建断言搬走却留下空车道，上面三条仍全绿而 L3 变成空壳。
  const closure = closureOf(laneFiles("test:build"));
  const reachesExport = [...closure].some((file) => /mdxx\.mjs/.test(readFileSync(join(REPO, file), "utf8")));
  assert.ok(reachesExport, "test:build no longer references bin/mdxx.mjs — if the build assertions moved, they moved into a lane that claims not to build");
});
