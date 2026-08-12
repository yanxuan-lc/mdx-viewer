# Code Review Checklist — retier-test-lanes

- **Mode**: Incremental（合并前门禁）
- **Branch**: dev
- **Commit**: 016d9c73a5a551f651acee42e5d2acf5fabbbe69
- **Reviewer model family**: Claude (Opus 5)
- **Round**: 6（`3bd40e4` → `46fe6a8` → `0afc3ed` → `2cb7589` → `f1a9166` → `016d9c7`）
- **Scope**: `3bd40e4` → `016d9c7`；`280f46f` 及更早不在本轮
- **Lane**: `min`，无 change-local spec 目录。Verdict A 的基准是**任务描述 + 车道判据本身**，
  外加 `genai/` 证据载体是否如实描述被审提交。

## 复核证据（round 6 自己重跑）

`016d9c7` 与前两个提交一样**未触碰任何可执行文件**（只有 AGENTS.md、两份证据、checklist），
仍在本提交重跑，退出码取自命令本身：

| 命令 | exit | tests | pass | fail | cancelled | suite-report 记录 |
|---|---|---|---|---|---|---|
| `npm test` | **0** | 247 | 247 | 0 | 0 | 247 / 0 / 0 ✓ |
| `npm run test:unit` | 0 | 185 | 185 | 0 | 0 | 185 ✓ |
| `npm run test:cli` | 0 | 46 | 46 | 0 | 0 | 46 ✓ |
| `npm run test:build` | 0 | 16 | 16 | 0 | 0 | 16 ✓ |
| `make lint` | **0** | — | — | — | — | exit 0 ✓ |

## Verdict A — Spec-compliance（code-vs-spec；不评判该不该做这件事）
**Status: HELD**

- [x] 🟠 **P1 #A1** ~~L1「零 spawn」判据当场即为假~~ — Resolved（round 2）。
- [x] 🟠 **P1 #A2** ~~两份 CONTRIBUTING 只教 `test:unit` 一条清单~~ — Resolved（round 2）。
- [x] 🟠 **P1 #A3** ~~`suite-report.md` 只换戳不换数字~~ — Resolved（round 3）。
- [x] 🟠 **P1 #A4** ~~#A3 的修法只落到一个文件~~ — Resolved（round 4）。
- [x] 🟠 **P1 #A6** ~~L2 闭包数 12 错~~ — Resolved（round 5，15 与三段分段经三次独立重推一致）。

- [x] 🟠 **P1 #A5** ~~规则收窄了但被规则管的实例没动，所以规则仍为假~~ —
  **Resolved，而且这次是作为做法收口的，不是又一次改措辞。** 我按你要求 grep 了七个文件
  （两份证据 + `AGENTS.md` + 两份 CONTRIBUTING + 两份 README + `Makefile`），
  逐条判归属，**round 5 点到的六处活值全部真的消失了**：
  | round 5 的活值 | 现状 |
  |---|---|
  | L154「185 tests, **0.5 s**」 | 「count and wall time in `suite-report.md`」 |
  | L186「**24.8 s** … **0.5 s** inner loop」 | 「full `npm test`, so the sub-second inner loop」 |
  | L95「1 build saved (**~4 s**)」 | 「**1 build saved**」 |
  | L177「(**~16 s**)」 | 「four real builds where one was needed」 |
  | L99-100「→ **0.5 s**」「余下 **0.8 s**」 | 「to sub-second — current figure in `suite-report.md`」 |
  | `AGENTS.md`「**10 条断言**」 | 「`before()` 里构建一次、摊给全部断言」（我核过 `export.test.mjs:22` 确有 `before()`） |
  幸存的每一处我都判过归属，**全部落在 clause 3**：`tdd-evidence.md:12`（27.5 s / 5.8 s 改造前基线）、
  L99-100 与 L118（同一基线 ＋「first landed at 1.3 s」）、L230（round 4 缺陷的引述）、
  L243（「~7s」的引述）。两份 CONTRIBUTING、两份 README、`Makefile` **零命中**
  （Makefile 唯一的匹配是 `printf` 格式串）。
  **判它 Resolved 而不是继续挂着的理由，正是我三轮来一直在做的那个区分**：前两次
  规则动了而实例没动，这次**实例动了、且规则变得可满足了**。clause 3 是让这条规则第一次
  拥有不动点的东西 —— 没有它，本该留在这份文件里的历史基线是永久违规，于是每轮只能再拧一次
  措辞。你把这个理由写进文件（而不是只写结论）是这六轮里最该留下的一条。
  残留的边界问题另开一条 **#B17（P2）**：那是「规则不完备」，不是「规则为假」，两者不同级。

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
- [x] 🟡 **P2 #B9** ~~汇总行会写「fail 0」~~ — Resolved（round 3，已成为证据格式）。
- [x] 🔵 **P3 #B10** ~~round-1 数字未标轮次~~ — Superseded by #A4（round 3）。
- [x] 🟡 **P2 #B11** ~~`AGENTS.md` 表与判据自相矛盾~~ — Resolved（round 4）。
- [x] 🔵 **P3 #B12** ~~结构论证是文件局部措辞~~ — Resolved（round 4）。
- [x] 🟡 **P2 #B13** ~~`createServer = 4` 少算，成因是探针在那个文件上是瞎的~~ — Resolved（round 5）。
- [x] 🟡 **P2 #B14** ~~`AGENTS.md` 的「63 条」实际 113~~ — Resolved（round 5）。
- [x] 🔵 **P3 #B15** 提交范围（`2cb7589` 混入独立 backlog 处置）— **Won't fix，双方一致**。
- [x] 🔵 **P3 #B16** ~~「injection is overwritten」高估了 shadowing~~ — **Resolved**，改写准确：
  我重读了 `test/compile-check.no-build.test.mjs:31-35`，`probeEnv()` 对 `NODE_OPTIONS` 确实是
  `[CLEAN_ENV.NODE_OPTIONS, "--import …"].filter(Boolean).join(" ")`（保留并追加），
  被重定向的只有 `MDXV_PROBE_OUT` 一个变量，因此「换独立输出变量名即可闭合」成立。
  你还把那条**与你自己草稿相反**的更正也收了进去（三处子进程调用都用 `deepEqual` 断完整调用清单，
  liveness 断的是恰好 `["createServer"]`，因此 build 藏不住）—— 记下一个「我的保证比我以为的更强」
  比记一个缺陷更少见，也更容易在下一轮被人误当缺口重开。

- [ ] 🟡 **P2 #B17** `openspec/changes/retier-test-lanes/genai/tdd-evidence.md:127`
  ＋ `AGENTS.md:175` — **三条 clause 在一个边界上不完备：由「跑」得出、但又不是
  pass/fail/cancelled 的计数 —— 也就是 `tests` 总数 —— 三条都没管。**
  clause 1 只点名 wall times 与 pass / fail / cancelled；clause 2 要求「read off the source」，
  而测试条数**恰恰读不出来** —— 这正是 #B14 的教训（`grep -c "test("` 得 63，跑一遍得 113）。
  于是两处落在三条之外：
  - `tdd-evidence.md:127`「Test count is **247 before and after**」（`suite-report.md:19,25` 也有 247）。
  - `AGENTS.md:175`「曾写「63 条」，**实际 113**」——「63 条」是缺陷引述（clause 3 覆盖），
    「实际 113」是一个当下的、跑出来的计数，加一条测试就漂。
  **和前几轮的区别，也是我把它判 P2 而不是 P1 的理由**：这两个数**今天都是真的**
  （我实测 `npm test` 247、`diagram-theme` 113），而且文件从未声称三条 clause 穷举 ——
  所以这是**规则不完备**，不是**规则为假**。#A1 / #A5 那条「写下来的不变式为假 = P1」的尺子
  在这里不适用。
  **修法**：clause 1 从「wall times, and pass / fail / cancelled counts」扩成
  「wall times, 以及任何**由运行得出**的计数（tests / pass / fail / cancelled / skipped）」；
  然后 `AGENTS.md:175` 删掉「实际 113」（那句话的要点是「63 是把源码 grep 数当成了测试条数」，
  不需要真值就能成立），`tdd-evidence.md:127` 改成它真正想说的结构性主张
  ——「没有测试被丢掉或重复；条数见 `suite-report.md`」。

- [ ] 🔵 **P3 #B18** `openspec/changes/retier-test-lanes/genai/tdd-evidence.md:116-118`
  （回答你的问题 2：**clause 3 确实开了一个口子**）— 边界目前是按**语义/意图**画的
  （「narrative about what *was* true」），而意图无法被检查：把一个当下值改写成
  「it was 0.5 s when I measured it」就能逃出 clause 1，而这正是 #A3 那次的形状
  （数字没动、只让措辞看起来像历史）。
  **建议把判据换成机械可检的「在 HEAD 上能否重现」**：
  能在 HEAD 重跑出来的值，永远归 clause 1，无论句子怎么写；只有**因为被描述的状态已不存在、
  所以再也测不出来**的值才归 clause 3。按这个判据现有幸存项全部合法且不需改动 ——
  「旧 `test:unit` 清单的 27.5 s」重现不了（那份清单没了）、「first landed at 1.3 s」重现不了
  （那个提交的 L1 含四次 spawn，现已移走）；而「L1 的 0.5 s」永远可重现，
  因此永远不可能是历史值。**修法**：clause 3 补一句「判据是可重现性而非叙述意图 ——
  若能在 HEAD 重新测出，即归 clause 1」。

## Round 6 已核为干净、不构成 finding

- **戳推进到 `016d9c7` 正当**：本提交零可执行改动，三条车道 ＋ `npm test` ＋ `make lint`
  我都在本提交重跑，与 `suite-report.md` 逐格吻合。
- 车道覆盖仍闭合：glob 15 / 三条清单 15 / 无重复无幽灵；185 + 46 + 16 = 247。
- `AGENTS.md` 表车道归属 16 行仍与 `package.json` 三条清单完全一致（第三次重核）。
  `export.test.mjs` 那行改成结构性表述后**更准确**：该文件确实在 `before()`（L22）里构建一次。
- 门禁承重面未被触及：`npm test` 仍是 glob，`scripts/publish.sh:111` 仍走 `npm test`。
- 本轮新引入的第一手数字无一失实。第二类复发（自称第一手却未推导）连续两轮未出现。

## 门禁语义（避免被读成它没说的话）

- 两条判定同时 HELD，**合并门禁开**。
- Verdict A 是 **code-vs-spec**（此处为 code-vs-任务描述与车道判据），**不是意图校验**：
  它不说明「按依赖表面重切车道」是不是该做的事，那属于人的意图回路。
- **本门禁不等于合并后审计**：门禁在合并前跑、跑每一次改动；审计在合并后抽样跑，
  且必须换一个模型族。跑完这道门禁**不替代**那次审计。
- 仍有 2 条未解决的 P2/P3（#B17 / #B18），按定义可留到 merge 之后；两条都在证据/文档面，
  不涉及产品或测试代码。

## 附：已明确判为 out of scope

「没有任何一条车道是门禁，只有全量 `npm test` 是」—— 留到本 change 之外，已记入证据。
`genai/config.json` 的 `commands.check-diff: false`（`280f46f`）与现状相符，不算错。

---
<!-- genai:code-review.verdict blocking-open=0 -->
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **HELD**
**Progress**: 6 / 6 resolved（#A1 #A2 #A3 #A4 #A5 #A6 全部解决）
