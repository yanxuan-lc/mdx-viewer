# Code Review Checklist — retier-test-lanes

- **Mode**: Incremental（合并前门禁）
- **Branch**: dev
- **Commit**: 3bd40e4ddabb98e2a7741ab0fb5def00dda052d6
- **Reviewer model family**: Claude (Opus 5)
- **Round**: 1
- **Scope**: 仅 `3bd40e4`；`280f46f` 及更早不在本轮（`check-diff: false` 的意见另附于文末）
- **Lane**: `min`，无 change-local spec 目录。Verdict A 的比对基准取**任务描述 + 车道判据本身**
  （Makefile / AGENTS.md 里写下的三条判据是这次唯一的可验证契约），不因缺 spec 目录扣分。

## 复核证据（自己重跑，不采信记录）

| 命令 | 我实测结果 | evidence 记录 |
|---|---|---|
| `npm test` | exit 0 · **247 pass / 0 fail / 0 skipped** · 24.7 s | 247 / 0 · 24.4 s ✓ |
| `npm run test:unit` | 189 pass / 0 fail · duration 1196 ms（wall 1.33 s） | 189 / 0 · 1.3 s ✓ |
| `npm run test:cli` | 42 pass / 0 fail · 7.45 s | 42 / 0 · 7.7 s ✓ |
| `npm run test:build` | 16 pass / 0 fail · 22.4 s | 16 / 0 · 22.6 s ✓ |
| `make lint` | exit 0 | exit 0 ✓ |

另外三项独立核对（不改仓库，脚本在 scratchpad）：

1. **搬移保真** — 把 `3bd40e4^` 的原块与新文件逐字节比对：`S14` / `S20` /
   `assertGenuinelyThrowsAt` / `A3` / `S3` / `environment` / `systemLocalePreload` /
   `runCheck` / `runExport` / `rel` / `abs` **全部 IDENTICAL**。ESC 那处在源码里已是
   六字符转义序列而非裸控制字节（`cli-export.test.mjs:109`）；五个被动过的测试文件里
   `[[:cntrl:]]` 零命中。
2. **车道覆盖** — 磁盘 15 个 `test/*.test.mjs`，三条清单合计 15，无重复、无幽灵、无遗漏。
3. **`before()` 失败行为** — 在 scratchpad 复现同构文件实测，见 #B1。

## Verdict A — Spec-compliance（code-vs-spec；不评判该不该做这件事）
**Status: NOT HELD**

- [ ] 🟠 **P1 #A1** `package.json:48` · `Makefile:52` · `AGENTS.md:120,171` —
  **L1「零 spawn」判据当场即为假**。`test/compile-check.test.mjs` 在 `test:unit` 清单里，却通过
  `runMdxv()`（`test/compile-check.test.mjs:31`）真的 spawn 了 `bin/mdxv.mjs` **4 次**
  （L256 / L262 / L268 / L274，#A1 argv 探测回归组）。而 Makefile 注释写「L1 test-unit
  进程内 import src/，**零 spawn**」、`make test-unit` 帮助行写「亚秒级，**零子进程**」、
  AGENTS.md:171 写「L1 `test:unit` 进程内 import `src/`、**零 spawn**」——这正是本次改动要
  消灭的那一类假标签，在同一个提交里被重新造了出来。
  为什么没被发现：evidence「Lane invariant verified with the probe：`test:unit` build=0
  server=0」用的是 vite-call 探针，它只数 `build` / `createServer`，**判据里 spawn 那一半从
  未被测量过**，只是被声明。而按名字 grep `spawnSync` 同样看不见——调用走 `runMdxv` 这层
  helper 间接，跟 commit message 里说 S20「因为没有 mdxx.mjs 字面量而逃过每一次 grep」是同一个
  盲点。
  **修法（二选一）**：(a) 把这 4 条 argv 探测测试搬进 L2（它们 spawn `bin/mdxv.mjs`，
  `test/compile-check.cli.test.mjs` 就是它们的位置），L1 判据保持不变；或 (b) 把 L1 判据改成
  实际为真的那句——「不跑 vite 构建、不起 dev server」——同步改 Makefile 注释 + 帮助行 +
  AGENTS.md 两处，并从 `make test-unit` 的帮助行里去掉「零子进程」。

- [ ] 🟠 **P1 #A2** `CONTRIBUTING.md:150-151` · `CONTRIBUTING.zh-CN.md:133-134` —
  **贡献者文档仍在教旧车道，且教的正是会复发本缺陷的做法**。两处都还写着「新增纯逻辑模块 →
  补 `test/*.test.mjs`，并把文件加进 `package.json` 的 `test:unit` 清单」，只提 `test:unit`
  一条清单，完全没有 L1/L2/L3 的存在。照这句话执行，一个跑真实构建的新测试会被登记进 L1 ——
  就是这次要还的那笔债。AGENTS.md 和两个 README 都改了，唯独最直接驱动贡献者行为的这两份
  没改；commit message 的「Docs updated in Makefile, AGENTS.md and both READMEs」把这个遗漏
  说成了完成。
  **修法**：把两份 CONTRIBUTING 的那条 bullet 换成三车道判据 + 该改哪条清单，与
  AGENTS.md:169-174 对齐；顺带 `CONTRIBUTING.md:145` / `CONTRIBUTING.zh-CN.md:128` 的
  `make test` 注释「unit + integration + export smoke」也可与新说法统一。

## Verdict B — Code-quality
**Status: HELD**（无未解决的 P0/P1）

## Tracked（P2 / P3，可留到 merge 之后）

- [ ] 🟡 **P2 #B1** `test/cli-export.test.mjs:59-73` — **根级 `before()` 把失败面从 1 条放大到
  4 条，且让过滤跑也要付构建代价**。实测（scratchpad 同构复现）：根级 `before()` 抛错时
  node:test 把**文件内全部 4 条测试**都标红，每条附的都是同一句 hook 错误——A3 和 S3 根本不碰
  locale 矩阵，却会以「matrix export failed」的文案红掉，定位时得先排除两条无关项。
  另实测：`node --test --test-name-pattern="A3"` 仍会执行根级 `before()`，即只想跑 A3 也要先
  付 4 次真实构建（约 16 s）——对一次以内环速度为目的的改动，这是反向的。
  **修法**：把 `LOCALE_CASES` / `before` / `after` / 两条 A5 收进
  `describe("A5 locale source matrix", …)`，hook 作用域只覆盖那两条；A3 与 S3 恢复独立，
  name-pattern 过滤也不再触发矩阵构建。

- [ ] 🟡 **P2 #B2** `test/cli-output.test.mjs:4` — 搬走 S3 后 `readFileSync` 成了未使用 import
  （随它一起删的 `PKG_VERSION` 是它唯一的使用点）。`make lint` 只做语法解析，抓不到。
  **修法**：从该行 import 中删掉 `readFileSync`。

- [ ] 🟡 **P2 #B3** `test/cli-export.test.mjs:18-30` vs `test/cli-language.test.mjs:10-21` —
  `environment()` 与 `systemLocalePreload()` 被复制而非共享，两份逐字节相同（已核）。今天行为
  一致，但 `environment()` 里「override 为 undefined 就 delete MDXV_LANG」这条语义很容易在
  一边被改而另一边不动。**修法**：抽到 `test/helpers/cli-env.mjs`，两处 import；注意该文件不能
  以 `.test.mjs` 结尾，否则会被 `npm test` 的 glob 当成测试文件收走。

- [ ] 🔵 **P3 #B4** `test/cli-export.test.mjs:76,84` — `localeExports.get("flag")` /
  `.get(scenario.name)` 无守卫。若日后有人把矩阵里的 `flag` 用例改名，A5 flag-wins 会以
  `Cannot read properties of undefined` 报错，而不是一句「共享的 flag 导出不存在」。
  **修法**：取值前 `assert.ok(localeExports.has(name), ...)`。

- [ ] 🔵 **P3 #B5** `test/compile-check.cli.test.mjs:3-4` — 头注释残留旧事实：仍写「场景
  S1–S16 / S18 / S19」和「部分场景配对 `bin/mdxx.mjs`」，但 S14 已搬走、文件里再无任何 mdxx
  调用（grep 只剩注释里的字面量），与紧邻第 6 行新写的「只 spawn `bin/mdxv.mjs`」自相矛盾。
  **修法**：范围改为 S1–S13 / S15 / S16 / S18 / S19，删掉「部分场景配对 mdxx」这半句。

- [ ] 🔵 **P3 #B6** `test/cli-export.test.mjs:73` —
  `after(() => rmSync(localeDirectory, …))`；若 `before()` 的 `mkdtempSync` 本身失败，
  `localeDirectory` 为 `undefined`，`after` 会再抛一个 `TypeError` 盖在真实原因上。
  **修法**：`after(() => { if (localeDirectory) rmSync(...); })`。

- [ ] 🔵 **P3 #B7** `test/cli-export.test.mjs:77` — `assert.equal(result.status, 0)` 在
  `before()` 已断过同一件事之后是恒真的，读者会误以为这条测试自己验证了导出成功。
  **修法**：删掉，或换成对共享结果来源的断言。

- [ ] 🔵 **P3 #B8** `genai/backlog/INBOX.md:11` — 新填的 `test-lane-invariant-unguarded` 提出的
  可验证判据只断 build / createServer 计数，**不含 spawn 维度**，因此即便实现了也抓不到 #A1
  那一类混入。**修法**：判据里补一条「L1 的子进程数为 0」（例如 `--import` 一个记录
  `child_process.spawn*` 的钩子），或在 #A1 采用改判据方案时同步把这条改掉。

## 已核为干净、不构成 finding（列出以说明查过）

- 7 个搬移块 + 5 个 helper 逐字节相同；作者自己抓到的那处 ESC 字面量已修正，全仓无残留控制字符。
- 车道归属：L2 的 `cli-output` / `cli-language` 里所有 `bin/mdxx.mjs` 调用都是 `--help`、
  非法 `--lang`、多余实参这类**在构建之前就退出**的路径，L2「不跑构建」成立；
  `compile-check.no-build.test.mjs` 只起 dev server，按判据留在 L2 正确。
- S14 / S20 整条搬移的论证成立：两条都断「`--check` 与 `mdxx` 的差值」，拆开后任何一半都不再是
  一条完整判断，而两个文件都还会显示绿——这是真实的失真模式，不是过度设计。
- `test:export` 全仓无残留引用（`openspec/changes/archive/` 与本 change 的 evidence 除外）。
- 门禁承重面未变：`npm test` 仍是 glob；`scripts/publish.sh:111` 调的也是 `npm test`，
  不经三条清单；仓库无 CI 配置，车道纯属开发者内环。
- 构建次数自洽：A3 1 + 矩阵 4 + S3 1 + export 1 + S14 2 + S20 2 = 11，与「12 → 11」一致。

## 附：被问到的 `commands.check-diff: false`（`280f46f`，不在本轮判定内）

`genai/config.json` 声明 `check-diff: false` 与本仓现状相符——没有任何 scoped diff 检查命令
存在，声明「无」比留一个跑不通的命令诚实。但它与 `"test": "make test"` 合在一起的后果值得记一笔：
本仓的 scoped 门禁**只能**是全量 `npm test`（24 s），三条车道谁都不是门禁。这次改动把内环
做到了 1.3 s，却没有任何机制让门禁享受到分层——如果将来想让 `check-diff` 按改动面只跑相关车道，
那正是它该被填上的时候。现在留 `false` 不算错。

---
<!-- genai:code-review.verdict blocking-open=2 -->
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **NOT HELD**
**Progress**: 0 / 2 resolved
