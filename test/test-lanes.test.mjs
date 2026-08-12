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

/* 判据看的是**import 说明符**，不是自由文本：自由文本会把本文件自己判成违规——它必须
   写出这些名字才能检查它们。

   **这不是零误报的判据**（code-review #B2/#B3）：正则不是解析器，JSDoc 类型位置上的
   动态 import 表达式会被一并算进来。方向是安全的一侧——把类型引用误判成派生能力，
   只会让人把那行改成别的写法，不会放过真的派生。
   附带后果：**本文件自己不能把那个模式原样写出来**，否则它会判自己违规（写这段注释时
   就踩了一次）。所以上面只描述、不举字面例子。

   **能绕过它的**（实测）：计算出来的动态说明符、`createRequire`、以及经**包名**（而非
   相对路径）import 到达的 helper——闭包只跟相对 import。这些都不是「本仓今天会出现的
   写法」，但也不该被读成「查不到就等于没有」。 */
const ANY_IMPORT = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const SPAWN_MODULE = /^node:child_process$|^child_process$/;
/** 相对 import / 动态 import，用来走传递闭包。 */
const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g;

/** 一个文件 import 了哪些模块说明符。 */
const importsOf = (file) => [...readFileSync(join(REPO, file), "utf8").matchAll(ANY_IMPORT)].map(([, s]) => s);

/** 递归收集一个目录下的 .mjs（用真实遍历而非写死清单，新增文件自动纳入）。 */
function walkMjs(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) return walkMjs(abs);
    return entry.name.endsWith(".mjs") ? [abs] : [];
  });
}

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

test("no CJS load of child_process or vite exists in bin/ or src/ — the half the probe cannot see", () => {
  // 探针是 ESM loader 钩子，看不见 `require("child_process")` / `require("vite")`。
  // 本仓是纯 ESM，`createRequire` 只用于 `require.resolve`（定位包目录）。这条把那个
  // 事实钉住：一旦有人真的用 require 去**加载**这两者，探针的覆盖声明就不再成立。
  const sources = ["bin", "src"].flatMap((dir) => walkMjs(join(REPO, dir)));
  const offenders = sources
    .map((abs) => [relative(REPO, abs), readFileSync(abs, "utf8")])
    .filter(([, source]) => /\brequire\s*\(\s*["'](?:node:)?(?:child_process|vite)["']\s*\)/.test(source))
    .map(([file]) => file)
    .sort();
  assert.deepEqual(
    offenders,
    [],
    "these load child_process or vite through CJS require(), which the ESM loader probe cannot observe — " +
      "S12's 'never spawned, never entered Vite' claim would no longer hold for them",
  );
});

test("L3 is the only lane that may reach a build, and it genuinely does", () => {
  // 反向守卫：若有人把全部构建断言搬走却留下空车道，上面三条仍全绿而 L3 变成空壳。
  const closure = closureOf(laneFiles("test:build"));
  const reachesExport = [...closure].some((file) => /mdxx\.mjs/.test(readFileSync(join(REPO, file), "utf8")));
  assert.ok(reachesExport, "test:build no longer references bin/mdxx.mjs — if the build assertions moved, they moved into a lane that claims not to build");
});
