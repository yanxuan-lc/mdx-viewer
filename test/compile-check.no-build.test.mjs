/* ============================================================
   E2E · `mdxv --check` 不跑构建 —— 场景 S12
   —— S12 守的回归是「`--check` 没有偷偷变成第二个 mdxx」：它存在的全部理由就是绕开
      那一整轮 Vite 构建（见 BRIEF）。判据直接断这件事本身，而不是断它的症状：
      用 `--import` 注册 ESM loader 钩子把 `vite` 包一层，记录 `build` / `createServer`
      有没有被调用过，`--check` 全程必须一次都没有。
      **旧判据（check 挂钟耗时 ≤ mdxx 的 1/5）已废弃**，它有三个毛病：把 mdxx 改慢反而
      让它更绿；check 慢一倍它也不红（实测余量 ~10x vs 阈值 5x）；而且拿一个 350ms 的
      进程去比一个 3.6s 的进程，固定启动成本对调度延迟的敏感度远高于吞吐型构建，
      并行负载下会假失败（INBOX perf-s12-wallclock-ratio-flaky）。
      新判据确定性、亚秒级、不跑任何构建，因此本文件进 test:unit 快车道。
   ============================================================ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const PRELOAD = join("test", "fixtures", "vite-call-probe", "preload.mjs");
const FULL_FEATURE_DOC = "examples/demo.mdx";
const { MDXV_LANG, ...CLEAN_ENV } = process.env;

/** 每次调用建一个空的记录文件，钩子把被调用的 vite 导出名逐行追加进去。 */
async function withProbe(run) {
  const dir = mkdtempSync(join(tmpdir(), "mdxv-vite-probe-"));
  const out = join(dir, "calls.txt");
  writeFileSync(out, "");
  try {
    return await run({ out, env: { ...CLEAN_ENV, MDXV_PROBE_OUT: out } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const callsIn = (out) => readFileSync(out, "utf8").split("\n").filter(Boolean);

test("S12: `mdxv --check` completes without ever calling Vite's build or createServer", async () => {
  await withProbe(({ out, env }) => {
    const result = spawnSync(
      process.execPath,
      ["--import", `./${PRELOAD}`, "bin/mdxv.mjs", "--check", FULL_FEATURE_DOC, "--lang", "en-US"],
      { cwd: REPO, encoding: "utf8", env, timeout: 30_000 },
    );
    assert.equal(result.status, 0, `--check should pass on the project's own full-feature example: ${result.stderr}`);
    assert.deepEqual(callsIn(out), [], "--check must not enter Vite at all — no build, no dev server");
  });
});

// 反向对照：证明探针此刻确实还能抓到调用。少了这条，上面那条会在探针失效时静默变空洞
// （同 compile-check.cli.test.mjs 里 assertGenuinelyThrowsAt 的用意）。用预览模式而不是
// mdxx 做对照，是因为起一个 dev server 亚秒级，而跑一轮真实构建要数秒。
test("S12 (probe liveness): the same probe records `createServer` when the very same binary starts a preview", async () => {
  await withProbe(async ({ out, env }) => {
    const child = spawn(
      process.execPath,
      ["--import", `./${PRELOAD}`, "bin/mdxv.mjs", FULL_FEATURE_DOC, "--no-open", "--port", "47311", "--lang", "en-US"],
      { cwd: REPO, env, stdio: "ignore" },
    );
    try {
      for (let attempt = 0; attempt < 100 && callsIn(out).length === 0; attempt += 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
      assert.deepEqual(callsIn(out), ["createServer"], "preview mode must be seen entering Vite, or the probe is dead");
    } finally {
      child.kill();
      await new Promise((r) => child.once("exit", r));
    }
  });
});

// 上面的对照只走了 createServer 这一个导出。这条补上另一半：确认 build 也真的被包过，
// 否则「--check 改成调 build」这个回归会从探针的缺口里漏过去。
test("S12 (probe coverage): the probe wraps both `build` and `createServer`, not just the one the control exercises", () => {
  const probe = `
    import { __mdxvProbedExports as covered, build, createServer } from "vite";
    process.stdout.write(JSON.stringify({ covered, kinds: [typeof build, typeof createServer] }));
  `;
  const result = spawnSync(
    process.execPath,
    ["--import", `./${PRELOAD}`, "--input-type=module", "-e", probe],
    { cwd: REPO, encoding: "utf8", env: { ...CLEAN_ENV, MDXV_PROBE_OUT: join(tmpdir(), "unused-probe-log") }, timeout: 30_000 },
  );
  assert.equal(result.status, 0, `probe self-check should run: ${result.stderr}`);
  assert.deepEqual(JSON.parse(result.stdout), {
    covered: ["build", "createServer"],
    kinds: ["function", "function"],
  });
});
