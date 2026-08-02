# Code Review Checklist — retier-test-lanes

- **Mode**: Incremental（合并前门禁）
- **Branch**: dev
- **Commit**: 2cb7589414649342d2cf30a4f7802f9acb74b06a
- **Reviewer model family**: Claude (Opus 5)
- **Round**: 4（round 1 `3bd40e4` / round 2 `46fe6a8` / round 3 `0afc3ed` / round 4
  `git diff 0afc3ed 2cb7589`，状态就地更新）
- **Scope**: `3bd40e4` → `2cb7589`；`280f46f` 及更早不在本轮
- **Lane**: `min`，无 change-local spec 目录。Verdict A 的基准是**任务描述 + 车道判据本身**
  （Makefile / AGENTS.md / CONTRIBUTING 的三条判据），外加 `genai/` 证据载体是否如实描述被审提交。

## 复核证据（round 4 自己重跑 + 自己重推，不采信记录）

`2cb7589` **未触碰任何可执行文件**（`git diff --name-status` 只有 AGENTS.md、两份 backlog、
两份证据、checklist），所以 `0afc3ed` 的测量在本提交依然成立；即便如此仍重跑一遍：

| 命令 | exit | tests | pass | fail | cancelled | wall（我实测） |
|---|---|---|---|---|---|---|
| `npm test` | **0** | 247 | 247 | 0 | 0 | 24.2 s |
| `make lint` | **0** | — | — | — | — | 38 files parsed |

三项独立推导（脚本在 scratchpad，不改仓库）：

1. **传递闭包我自己重走了一遍**，按 `suite-report.md` 现在写下的定义（从车道清单出发，
   递归跟随所有相对 import，含进入 `src/` 的）。结果见 #A6：L1 与 L3 **和你完全一致**，
   L2 **不一致**。
2. **数字副本全仓 grep**（不靠读）：仍有第五份，见 #A5。
3. **AGENTS.md 新表逐行核对**车道清单与文件内容：车道归属 16 行全对，一处计数错，见 #B14。

## Verdict A — Spec-compliance（code-vs-spec；不评判该不该做这件事）
**Status: NOT HELD**

- [x] 🟠 **P1 #A1** ~~L1「零 spawn」判据当场即为假~~ — **Resolved**（round 2）。
- [x] 🟠 **P1 #A2** ~~两份 CONTRIBUTING 仍只教 `test:unit` 一条清单~~ — **Resolved**（round 2）。
- [x] 🟠 **P1 #A3** ~~`suite-report.md` 只换戳不换数字~~ — **Resolved**（round 3）。
- [x] 🟠 **P1 #A4** ~~#A3 的修法只落到一个文件，`tdd-evidence.md` 比戳落后两轮~~ —
  **Resolved**，而且是按我建议的**结构性**做法而非再手改一遍：测量数字撤出该文件、
  「三条车道」表删掉 wall 列、「Commands run」与「Final numbers」改为指向 `suite-report.md`、
  补上 rounds 2–4 记述。你把「我曾把轻量版判成 P3 后又升级、以及为什么」也写进了证据 ——
  这一点值得点名：一份只记成功路径的证据，下一轮就会重犯同一个错。

- [ ] 🟠 **P1 #A5** `openspec/changes/retier-test-lanes/genai/tdd-evidence.md:99-100,147,179`
  ＋ `AGENTS.md:181-182` — **「数字只有一处来源」这条规则本身现在是假的：第五份副本在同一份
  文件的正文里。** 你把表格里的数字撤干净了，散在 prose 里的没有：
  - **L147**「L1 is now genuinely zero-spawn: **185 tests, 0.5 s**」—— 一个测试计数 + 一个耗时。
  - **L179**「the full `npm test` (**24.8 s**), so the **0.5 s** inner loop…」—— 两个耗时。
  - **L99-100**「27.5 s → **0.5 s**（**1.3 s** as first landed；余下 **0.8 s**…）」—— 三个耗时。
  这些今天**都还是对的**（我核过：185 / 0.5 s / 24.8 s 都成立），所以它不是「又一处假数字」，
  而是**规则声明比实现宽**：`tdd-evidence.md` 第 105 行写着「Numbers live in exactly one file」，
  而它自己有五处；`AGENTS.md:181-182` 那条注也写着「当前实测数字只有一处来源」，
  它上方那张表里就有「63 条」「6 次构建」「4 次构建」「4 次真实 dev server」「10 条断言」。
  按 #A1 同一条判据（**写下来的不变式为假 = P1**）判 P1：下一次加测试，L147 的 185 会静默变错，
  而读者已被告知不必来这里查。这是本轮里同一主题的第四次复发，也是你让我 grep 的那个第五份。
  **修法（建议按语义收窄而不是逐个删）**：把规则从「实测数字」改成它真正想守的那类 ——
  **耗时与 pass/fail 计数只在 `suite-report.md`**；然后 L147 改成「零 spawn（计数与耗时见
  `suite-report.md`）」、L179 与 L99-100 的耗时改成定性说法或指过去。
  结构性事实（构建次数、文件数）留在 AGENTS.md 是合理的，只要规则别把它们也一起声称掉。

- [ ] 🟠 **P1 #A6** `openspec/changes/retier-test-lanes/genai/suite-report.md`（闭包段）—
  **L2 的闭包文件数 12 是错的，实测 15。** 我按你现在写下的定义独立重走（不看你的数字），
  并留下了每一条边：
  | 车道 | 你写的 | 我推导的 | spawn 提及 |
  |---|---|---|---|
  | L1 | 19 / 0 | **19 / 0** ✓ | 一致 |
  | L2 | **12** / 4 | **15** / 4 ✗ | 提及数一致 |
  | L3 | 4 / 3 | **4 / 3** ✓ | 一致 |
  L2 闭包的 15 个是：4 个车道文件 + `test/helpers/cli-env.mjs` + 10 个 `src/`
  （`cli/language` `cli/plugin` ← 车道文件；`cli/output` ← `compile-check.cli`；
  再经 `cli/output → cli/compile-check → mdx/plugins → mdx/diagrams`、
  `cli/output → i18n/locale → i18n/messages`、`cli/plugin → cli/resolve → cli/localized-docs`
  展开）。**12 对不上任何一种可辩护的定义**：传递闭包含 `src/` = 15；只算 `test/` 下 = 5
  （那是我 round 3 给的 5）；车道文件 + 一跳直接 import = 8。
  结论不受影响（L2 该 spawn、L1 不 spawn 都成立），但这个数字所在的那句话恰恰是
  「the numbers above are my own walk」—— 出处声明挂在了一个错数字上，而这正是本文件存在的理由。
  按 #A3 / #A4 同一把尺子（戳即断言这些数字测于此提交）判 P1，虽然改动只是两个字符。
  **修法**：12 → 15；顺带把定义里「follow every relative `from "./…"` import」补上
  `import("./…")` 与无 `from` 的副作用 import 两种写法（我的推导已含这两种，今天没有实例，
  但定义要能自证）。

## Verdict B — Code-quality
**Status: HELD**（无未解决的 P0/P1）

## Tracked（P2 / P3，可留到 merge 之后）

- [x] 🟡 **P2 #B1** ~~根级 `before()` 放大失败面~~ — Resolved（round 2）。
- [x] 🟡 **P2 #B2** ~~`cli-output.test.mjs` 孤儿 import~~ — Resolved（round 2）。
- [x] 🟡 **P2 #B3** ~~两份逐字节相同的 env helper~~ — Resolved（round 3）。
- [x] 🔵 **P3 #B4** ~~`localeExports.get()` 无守卫~~ — Resolved（round 3）。
- [x] 🔵 **P3 #B5** ~~`compile-check.cli` 头注释旧场景范围~~ — Resolved（round 2）。
- [x] 🔵 **P3 #B6** ~~`after` 未守卫 `localeDirectory`~~ — Resolved（round 3）。
- [x] 🔵 **P3 #B7** ~~A5 两条恒真的 status 断言~~ — Resolved（round 3）。
- [x] 🟡 **P2 #B8** ~~backlog 判据只覆盖构建维度~~ — Resolved（round 2）。
- [x] 🟡 **P2 #B9** ~~汇总行会写「fail 0」~~ — Resolved（round 3，并已成为证据格式）。
- [x] 🔵 **P3 #B10** ~~round-1 数字未标轮次~~ — Superseded by #A4（round 3）。
- [x] 🟡 **P2 #B11** ~~`AGENTS.md` 测试表与 13 行后的判据自相矛盾~~ — **Resolved**。
  新表 16 行我逐行对过 `package.json` 三条清单：L1 八行、L2 四行、L3 三行**与清单完全一致**，
  `cli-language` / `cli-output` 已正确标 L2 并注明「spawn 两个 binary」，`~7s` 已删，
  helper 单列一行标 `—` 并写明为何不叫 `*.test.mjs`。表下那条「不写耗时」的注是对的方向
  （但措辞过宽，见 #A5）。
- [x] 🔵 **P3 #B12** ~~结构论证是文件局部措辞~~ — **Resolved**：论证与 backlog 判据都改成
  传递闭包，且 backlog 那条还点明了「`test/helpers/` 存在之后这一跳必须算进来」。

- [ ] 🟡 **P2 #B13** `openspec/changes/retier-test-lanes/genai/suite-report.md`（不变式表）
  ＋ `test/compile-check.no-build.test.mjs:31-35` — **L2 的 `createServer = 4` 少算一次，
  而少算的原因是探针在那一个文件上是瞎的。** 真值是 **5**：`cli-language` 的 mdxv 矩阵
  4 例（L143-148，每例经 `startPreview` 起一次真实 dev server）＋ `no-build` 的
  「probe liveness」1 次（L69）。之所以只记到 4：`no-build` 自己用
  `probeEnv()` 给子进程重设 `MDXV_PROBE_OUT` 指向**它自己的临时记录文件**，并在 `finally` 里
  删掉 —— 车道级注入的 `MDXV_PROBE_OUT` 被就地覆盖，那个 dev server 落进了私有文件。
  更值得记的是推论：**车道级探针对 `compile-check.no-build.test.mjs` 的子进程完全没有覆盖**，
  所以 L2 那个承重的 `build = 0` 在这一个文件上是**未被测量**的（它今天为真，由该文件自己的
  断言保证，但不是由车道级测量保证）。我判 P2 而非 P1，是因为这两个数字要说明的事
  （L2 合法起 dev server、L2 不跑构建）都不受影响，且正确的修法是**披露**而不是重测。
  **修法**：在不变式表下加一句 —— 「`compile-check.no-build.test.mjs` 会覆盖
  `MDXV_PROBE_OUT`，其子进程不计入本表；该文件的 build=0 由它自身的断言保证」；
  真想合进来的话，车道级注入得用一个 `no-build` 不会覆盖的变量名。

- [ ] 🟡 **P2 #B14** `AGENTS.md:158` — `test/diagram-theme.test.mjs` 那行写「**63 条**，
  全进程内」，实测 **113**（`node --test` 的 `ℹ tests`）。同表其余可核计数我都核了且正确：
  `export.test.mjs`「10 条断言」✓、`cli-export`「6 次构建」✓（A3 1 + 矩阵 4 + S3 1）、
  `export-pairing`「4 次构建」✓（S14 2 + S20 2）、`cli-language`「4 次真实 dev server」
  ✓（就该文件而言，另见 #B13）。
  **修法**：既然表下已声明不放实测数字，最省事且与 #A5 一致的做法是**删掉「63 条」**
  而不是改成 113 —— 一个测试计数放在手改表里，就是下一个会漂的东西。

- [ ] 🔵 **P3 #B15** 提交范围 —— `2cb7589` 里混进了与车道无关的 backlog 处置：
  把 `probe-wrapped-list-vs-repo-vite-surface` 从 `genai/backlog/INBOX.md` 移入
  `genai/backlog/archive/BACKLOG-ARCHIVE.md`（status `dropped`），并相应改写
  `openspec/changes/fix-s12-structural-criterion/genai/tdd-evidence.md:88-97`。
  **内容我核过，是对的**：那条 drop 之后，原文「Filed to INBOX rather than fixed here」就成了
  假陈述，不改才会多出第六处不实之处；而且被改的那份 evidence **没有 `Commit:` 戳**，
  所以不存在戳被弄假的问题（它的 checklist 戳 `17dfdf0` 且判 HELD，属于另一次已结门禁）。
  只是这三处改动是一次独立的 backlog 处置，按提交卫生该自成一提交。
  另核：`openspec/changes/close-probe-and-lane-guards/` 在仓库里确实不存在，
  「新 change 的内容没有进 `2cb7589`」这句成立。

## Round 4 已核为干净、不构成 finding（列出以说明查过）

- **`tdd-evidence.md` 仍然是「做了什么」的完整记录**（你的问题 4）：被撤掉的只有测量值。
  判据表（三条车道 + 判据文字）、文件数、构建归因表（12 次的逐条出处）、S20 逃过 grep 的
  那段成因、「什么搬了 / 什么故意不搬」、step 3 为什么只省下 1 次构建的逐条理由、
  Docs updated、Backlog、rounds 1–4 记述 —— 全在。没有一处结构性事实被连带删掉。
  反过来说它现在比之前更完整：rounds 2–4 那一节把六条非阻断修复和 #B9 的格式决定都记了名。
- **戳推进到 `2cb7589` 是正当的**：本提交零可执行改动，我在本提交重跑 `npm test` 得 247 / 0 / 0
  exit 0，与 `suite-report.md` 的记录一致。不过该文件自称「measured at the commit stamped
  above — not carried over」，严格读会与「上一提交测量、本提交只推戳」相冲；
  若要更严谨可加半句「本提交未触碰可执行文件，故沿用上一提交的测量」。不作为 finding。
- 车道覆盖仍闭合：`test/*.test.mjs` glob 15 个 / 三条清单 15 个 / 无重复无幽灵；
  185 + 46 + 16 = 247。`test/helpers/cli-env.mjs` 不被 glob 收、被 `make lint` 收（38 files）。
- 门禁承重面未被本轮触及：`npm test` 仍是 glob，`scripts/publish.sh:111` 仍走 `npm test`。

## 附：已明确判为 out of scope

「没有任何一条车道是门禁，只有全量 `npm test` 是」—— 同意留到本 change 之外，已记入证据。
`genai/config.json` 的 `commands.check-diff: false`（`280f46f`）与现状相符，不算错。

---
<!-- genai:code-review.verdict blocking-open=2 -->
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **NOT HELD**
**Progress**: 4 / 6 resolved（#A1 #A2 #A3 #A4 已解决；#A5 #A6 待修）
