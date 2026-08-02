# Code Review Checklist — retier-test-lanes

- **Mode**: Incremental（合并前门禁）
- **Branch**: dev
- **Commit**: 46fe6a878013ab995b834a4d5348eb8eeae38f2e
- **Reviewer model family**: Claude (Opus 5)
- **Round**: 2（round 1 审 `3bd40e4`，两条 P1 判 NOT HELD；round 2 审
  `git diff 3bd40e4 46fe6a8`，状态就地更新）
- **Scope**: `3bd40e4` + `46fe6a8`；`280f46f` 及更早不在本轮
  （`check-diff: false` 的意见见文末附录）
- **Lane**: `min`，无 change-local spec 目录。Verdict A 的比对基准取**任务描述 + 车道判据本身**
  （Makefile / AGENTS.md / CONTRIBUTING 里写下的三条判据是这次唯一的可验证契约），
  外加 `genai/` 下的证据载体是否如实描述被审提交。

## 复核证据（round 2 自己重跑，不采信记录）

| 命令 | 我实测（46fe6a8） | evidence「Final numbers」 |
|---|---|---|
| `npm test` | exit 0 · **247 pass / 0 fail / 0 skipped** · suites 1 · 24.6 s | 247 / 0 · 24.8 s ✓ |
| `npm run test:unit` | **185 pass / 0 fail** · wall **0.53 s** | 185 / 0 · 0.5 s ✓ |
| `npm run test:cli` | 46 pass / 0 fail · 8.56 s | 46 / 0 · 8.4 s ✓ |
| `npm run test:build` | 16 pass / 0 fail · 23.58 s | 16 / 0 · 22.1 s ✓ |
| `make lint` | exit 0 | exit 0 ✓ |

四项独立核对（不改仓库，脚本在 scratchpad）：

1. **L1 零 spawn —— 我用静态面核，而不是复现你的探针**（探针本身可能有 bug，你已踩过一次）：
   遍历 `test:unit` 清单的 8 个文件，检索 `child_process` / `spawnSync` / `spawn(` /
   `execSync` / `execFileSync` / `fork(` / `execFile(` —— **零命中**。Node 里没有第八种派生
   子进程的办法，所以「L1 零 spawn」不只是被测出来是 0，而是**结构上不具备派生能力**。
   配合实测 0.53 s（round 1 为 1.33 s，差值正是那四次 spawn）。#A1 关闭。
2. **搬移保真** —— 把 `3bd40e4` 的四个 `#A1`/`#B5` 块与新文件对拉，只做你声明的两处重命名
   （`runMdxv(`→`runCheck(`、`doc(`→`unitFixture(`）后**四条全部 IDENTICAL**。
3. **`describe()` 语义** —— scratchpad 复现同构文件实测，结论见 #B1 与新增的 #B9。
4. **`--test-name-pattern` 成本** —— 对真实文件实测 `^A3`：`tests 1 · suites 0`、wall 1.5 s
   （只剩 A3 自己那次必败构建），矩阵 suite 根本没进。你说的「1 次而非 4 次」属实。

## Verdict A — Spec-compliance（code-vs-spec；不评判该不该做这件事）
**Status: NOT HELD**

- [x] 🟠 **P1 #A1** ~~L1「零 spawn」判据当场即为假：`test/compile-check.test.mjs` 经
  `runMdxv()` 实际 spawn `bin/mdxv.mjs` 四次，却挂在 Makefile / AGENTS.md 宣称「零 spawn」的
  L1 里~~ — **Resolved**。四条 `#A1`/`#B5` 已移入 `test/compile-check.cli.test.mjs:332-354`
  （L2，判据要求的位置），`runMdxv` / `REPO_ROOT` / `CLEAN_ENV` / `spawnSync` import 一并删净。
  独立复核见上表第 1 条。另核判据文本本身现在为真：`Makefile:52,60`、`AGENTS.md:120,171` 的
  「零 spawn / 零子进程」与实际一致；`test:unit` 0.53 s，「亚秒级」也终于成立
  （round 1 是 1.33 s，那句当时是过度宣称）。

- [x] 🟠 **P1 #A2** ~~两份 CONTRIBUTING 仍只教 `test:unit` 一条清单，照做会把构建塞回 L1~~ —
  **Resolved**。`CONTRIBUTING.md:150-159` / `CONTRIBUTING.zh-CN.md:133-141` 补齐了三车道判据，
  并写死了最关键的那条规则——「必须 spawn → `test:cli`，哪怕它很快；必须构建 → `test:build`，
  哪怕只有一条断言」。这句把判据从「按耗时的直觉」钉成了「按依赖表面的规则」，比我原本要求的
  更到位。

- [ ] 🟠 **P1 #A3** `openspec/changes/retier-test-lanes/genai/suite-report.md:3` —
  **只换了戳，一个数字都没改**。工作区对该文件的全部改动就是第 3 行
  `3bd40e4…` → `46fe6a8…`（`git diff` 确认：1 insertion / 1 deletion），而表里仍是 round 1
  的数据：L1「189 pass / 1.3 s」、L2「42 pass / 7.7 s」，算式仍写「189 + 42 + 16 = 247」，
  且「Lane invariant, measured」那节**只有 build / createServer 两列**。这三处在 `46fe6a8`
  上都不成立——我实测 L1 是 185 pass / 0.53 s、L2 是 46 pass / 8.56 s，而不变式已经是三维
  （spawn 维度你自己测了，数字进了 INBOX 和给我的消息，却没进这份文件）。
  为什么是 P1 而不是文档瑕疵：`min` 车道没有 spec，`suite-report.md` 自称「The minimal lane's
  verification carrier」，它**就是**这次变更的验证记录；戳的唯一作用是断言「这些数字是在这个
  提交上测出来的」。只挪戳不挪数字，等于让这份记录对 `46fe6a8` 说了假话——和这次要消灭的
  「27.5 s 的车道贴着『快』的标签」是同一种缺陷，只换了个载体。这就是你让我假设的第三个自伤。
  **修法**：Result 表换成 185 / 46 / 16（0.5 / 8.4 / 22.1 s），算式改「185 + 46 + 16」，
  Lane invariant 表补 spawn 列（L1 0 / L2 39 / L3 6）与「两个探针必须分开注入」那条实测注记；
  或干脆让它指向 `tdd-evidence.md` 的「Final numbers」，不再自己维护第二份数字。
  **戳与数字必须在同一次动作里改。**

## Verdict B — Code-quality
**Status: HELD**（无未解决的 P0/P1）

## Tracked（P2 / P3，可留到 merge 之后）

- [x] 🟡 **P2 #B1** ~~根级 `before()` 把失败面从 1 条放大到 4 条，且 name-pattern 过滤也要付
  四次构建~~ — **Resolved**。矩阵已包进
  `describe("A5: locale provenance in real exports (four shared builds)")`
  （`test/cli-export.test.mjs:47-98`）。两项目标实测都达成：`--test-name-pattern='^A3'` 只跑
  1 条、1.5 s、`suites 0`（矩阵未进）；hook 抛错时 A3 / S3 **确实保持 pass**，不再被无关文案
  污染。但这个修法引入了一个新的呈现问题，见 #B9。

- [ ] 🟡 **P2 #B9** `test/cli-export.test.mjs:47-98`（#B1 修法的副作用，round 2 新增）—
  **describe 作用域内 `before()` 失败时，汇总行会写「fail 0」**。scratchpad 同构实测：

  ```
  ℹ tests 4   ℹ pass 2   ℹ fail 0   ℹ cancelled 2       REAL_EXIT=1
  ```

  两条 A5 被记为 **cancelled 而非 fail**，suite 自身标 ✖ 并带真实错因。**退出码仍是 1，门禁
  照样会红**，所以不是 P0/P1。但本仓的证据纪律恰恰是把「N pass / 0 fail」当机器事实抄进
  `suite-report.md` / `tdd-evidence.md`——round 1 与 round 2 两份都是这个句式。一旦矩阵构建
  挂掉，这两份文件会记成「245 pass / 0 fail」，读起来完全是绿的。对照 round 1 的根级
  `before()`：它报 `fail 4`，吵但一眼是红的；换成 describe 之后反而更像绿的。
  **修法**：证据表里除 pass/fail 外**同时记录退出码与 `cancelled` 计数**（退出码才是判据，
  pass/fail 行不是）；`suite-report.md` 加一列 `exit` 即可。代码侧不必改。

- [x] 🟡 **P2 #B2** ~~`test/cli-output.test.mjs:4` 孤儿 import `readFileSync`~~ —
  **Resolved**，已从该行删除。

- [ ] 🟡 **P2 #B3** `test/cli-export.test.mjs:18-30` vs `test/cli-language.test.mjs:10-21` —
  **仍 Pending**。`environment()` 与 `systemLocalePreload()` 依旧是两份逐字节相同的拷贝。
  **修法**：抽到 `test/helpers/cli-env.mjs`（不能以 `.test.mjs` 结尾，否则被 `npm test` 的
  glob 收成测试文件）。

- [ ] 🔵 **P3 #B4** `test/cli-export.test.mjs:80,88` — **仍 Pending**。
  `localeExports.get("flag")` 无守卫，矩阵用例改名会得到
  `Cannot read properties of undefined` 而非可读错因。

- [x] 🔵 **P3 #B5** ~~`test/compile-check.cli.test.mjs:3-4` 头注释残留「S1–S16」与
  「部分场景配对 `bin/mdxx.mjs`」~~ — **Resolved**，且我逐条核过新头注释**完全准确**：
  文件里 21 条测试的场景 ID 实际是 S1–S11 / S13 / S15 / S16 / S18 / S19 + `#A1`×3 / `#B5`，
  与头注释一字不差；`openspec/specs/compile-check/spec.md` 的场景全集是
  S1–S16 / S18 / S19 / S20（**无 S17**，所以头注释跳过 S17 是对的，不是漏写），
  余下 S12 → `compile-check.no-build`、S14 / S20 → `compile-check.export-pairing`，
  头注释都点了名。三份文件的场景归属现在是闭合的。

- [ ] 🔵 **P3 #B6** `test/cli-export.test.mjs:77` — **仍 Pending**。若 `before()` 的
  `mkdtempSync` 失败，`localeDirectory` 为 `undefined`，`after` 会再抛 `TypeError` 盖住真因。

- [ ] 🔵 **P3 #B7** `test/cli-export.test.mjs:81` — **仍 Pending**。
  `assert.equal(result.status, 0)` 在 `before()` 已断过同一件事之后是恒真的。

- [x] 🔵 **P3 #B8** ~~backlog 判据只覆盖构建维度~~ — **Resolved**。
  `genai/backlog/INBOX.md:11` 已改成两维，并把「首版只测构建、spawn 只声明未测量」这个失败
  机理和三维实测基线（L1 0/0/0、L2 0/4/39、L3 11/-/6）都写了进去，还记下了「两个探针合用会
  互相干扰」这条踩坑事实。

- [ ] 🔵 **P3 #B10** `openspec/changes/retier-test-lanes/genai/tdd-evidence.md:96,99-106` —
  round 1 的「## Commands run」小节没标注它属于 round 1，而全文戳的是 `46fe6a8`，里面的
  189 / 42 / 16 · 1.3 / 7.7 / 22.6 s 会被当成本提交的数据（第 181 行的「## Final numbers」
  才是）。第 96 行「27.5 s → 1.3 s」现在也低报了，实际 0.5 s。
  **修法**：99 行标题改成「## Commands run（round 1）」，96 行改成 0.5 s。比 #A3 轻得多，
  因为「Final numbers」确实存在且正确。

## Round 2 已核为干净、不构成 finding（列出以说明查过）

- **四条搬移测试无损**（你的问题 2）：除声明的两处重命名外逐字节相同。两个差异都核了——
  `unitFixture("pass.mdx")` 与 `doc("pass.mdx")` 解析到**同一个绝对路径**
  （`<repo>/test/fixtures/compile-check/pass.mdx`，实测字符串相等），`pass.mdx` 在盘上存在；
  `cwd` 从 `REPO_ROOT`（带尾斜杠）变成 `REPO`（不带），`realpathSync` 相同。
  新增的 `timeout: 30_000` 是**严格增强**：超时后 `spawnSync` 返回 `status: null`，与断言的
  `2` / `1` 都不相等，只会把挂死从「无限等」变成「红」。这四条只断退出码与 `/^Error: /`，
  不断 stdout 里的路径文本，所以绝对/相对路径形态的差异无影响。
- **`compile-check.test.mjs` 清理干净**（你的问题 3）：删除组后无孤儿 import（逐个符号核过
  `chmodSync` / `mkdtempSync` / `rmSync` / `writeFileSync` / `tmpdir` / `fileURLToPath` /
  `join` / `relative` / `resolvePath` / `compile` / 五个 output 函数 / `mdxOptions` /
  `FIXTURES` / `doc`，全部仍有使用点）；全文再无 `spawn` / `child_process` 字样；头注释新的
  场景清单「S1-S5、S8-S10、S13、S18、S19 与 S11」与实际 12 个 S-ID **完全吻合**；
  文件内无任何残留引用指向被搬走的那组。
- **归位是对的，没有伤到可追溯性**（你的问题 1）：`compile-check.cli.test.mjs` 现在同时装
  spec 场景与 `#A1`/`#B5` 回归组，但头注释把两类**分开点名**，回归组前也有独立的
  `// ---- #A1: ...` 分隔注释。它们共享同一个判据（都必须 spawn 真实 argv），按依赖表面这就是
  它们的位置；混的是「来源」不是「车道」，而车道才是这次要立的规矩。
- **`describe()` 的隔离目标达成**（你的问题 4）：hook 抛错时 A3 / S3 实测仍 pass，真实错因挂在
  suite 上并完整打印。唯一代价是汇总行的呈现，已单列为 #B9。
- 车道覆盖仍闭合：15 文件 / 15 覆盖 / 无重复无幽灵；185 + 46 + 16 = 247。
- `npm test` 仍是 glob，`scripts/publish.sh:111` 仍走 `npm test`，门禁承重面未被这次改动触及。

## 附：仍未收口、但已明确判为 out of scope

「没有任何一条车道是门禁，只有全量 `npm test` 是」——同意留到本 change 之外。记一笔是因为它与
#B9 相关：门禁既然只看 `npm test` 的**退出码**，#B9 的风险就完全落在「人/agent 抄 pass-fail
行」这个动作上，而不在自动化上。

`genai/config.json` 的 `commands.check-diff: false`（`280f46f`，不在本轮判定内）与本仓现状相符，
声明「无」比留一个跑不通的命令诚实，不算错。

---
<!-- genai:code-review.verdict blocking-open=1 -->
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **NOT HELD**
**Progress**: 2 / 3 resolved（#A1 #A2 已解决；#A3 待修）
