# Code Review Checklist — retier-test-lanes

- **Mode**: Incremental（合并前门禁）
- **Branch**: dev
- **Commit**: f1a91666c9ae81e4767f6dd42dd1e7fc57710326
- **Reviewer model family**: Claude (Opus 5)
- **Round**: 5（`3bd40e4` → `46fe6a8` → `0afc3ed` → `2cb7589` → `f1a9166`，状态就地更新）
- **Scope**: `3bd40e4` → `f1a9166`；`280f46f` 及更早不在本轮
- **Lane**: `min`，无 change-local spec 目录。Verdict A 的基准是**任务描述 + 车道判据本身**，
  外加 `genai/` 证据载体是否如实描述被审提交。

## 复核证据（round 5 自己重跑 + 自己重推）

`f1a9166` 与 `2cb7589` 一样**未触碰任何可执行文件**（只有 AGENTS.md、两份证据、checklist），
仍在本提交重跑：

| 命令 | exit | tests | pass | fail | cancelled | wall |
|---|---|---|---|---|---|---|
| `npm test` | **0** | 247 | 247 | 0 | 0 | 24.7 s |
| `make lint` | **0** | — | — | — | — | 38 files parsed |

四项独立核对：

1. **闭包 15 我第三次独立重推**，并按你的三段拆分逐项核 —— 见 #A6，**完全一致**。
2. **数字副本全仓 grep**（`tdd-evidence` / `suite-report` / `AGENTS.md` / 两份 CONTRIBUTING /
   两份 README / Makefile）—— 见 #A5，**规则仍为假**。
3. **#B13 的披露我逐条验了成因与后果**，并去读了那个文件三处子进程调用的断言 —— 见 #B13：
   披露是准确的，而且比它自己声称的**更强**。
4. **`63 是 test( 的行数`这条出处声明**：`grep -c "test(" test/diagram-theme.test.mjs` = **63**，
   实测 tests = **113**。你这句是第一手且准确的。

## Verdict A — Spec-compliance（code-vs-spec；不评判该不该做这件事）
**Status: NOT HELD**

- [x] 🟠 **P1 #A1** ~~L1「零 spawn」判据当场即为假~~ — Resolved（round 2）。
- [x] 🟠 **P1 #A2** ~~两份 CONTRIBUTING 只教 `test:unit` 一条清单~~ — Resolved（round 2）。
- [x] 🟠 **P1 #A3** ~~`suite-report.md` 只换戳不换数字~~ — Resolved（round 3）。
- [x] 🟠 **P1 #A4** ~~#A3 的修法只落到一个文件~~ — Resolved（round 4）。

- [x] 🟠 **P1 #A6** ~~L2 闭包数 12 错，实测 15~~ — **Resolved**。我第三次独立重走（不看你的数字），
  逐段核过：**L2 闭包 = 15 = 4 车道文件 + `test/helpers/cli-env.mjs` + 10 个 `src/`**，
  spawn 提及 = 4；L1 = 19 / 0；L3 = 4 / 3。**三条车道、三个分段全部吻合。**
  「打印成员清单让计数可被核对而不是被信任」这个做法本身值得点名 —— 它把「数字对不对」
  从判断降成了核对。另外你把 `8/5/4`（转抄我的）与 `19/12/4`（自称第一手却错）**两版都记进
  文件**，理由写的是「缺陷是出处声明而不是算错」—— 这条比修好数字本身有用。

- [ ] 🟠 **P1 #A5** `openspec/changes/retier-test-lanes/genai/tdd-evidence.md:95,99,100,154,177,186`
  ＋ `AGENTS.md:166` vs `AGENTS.md:173-176` — **规则收窄了，被规则管的实例没动，所以规则仍然为假。**
  你把措辞改成「**timings and pass / fail / cancelled counts** live in exactly one file」，
  语义是对的，也把「为什么必须窄」写下来了。但 round 4 那条 #A5 的修法是两半：
  (a) 收窄规则；(b) 改掉 L147 / L179 / L99-100 那几处**活的**耗时。**(a) 落了，(b) 没落。**
  而收窄并没有让它们合法 —— 那几处**每一处都正是耗时**：
  - **L154**「L1 is now genuinely zero-spawn: **185 tests, 0.5 s**」（round 4 我按当时行号记作
    L147，逐字未改）—— 一个活的测试计数 ＋ 一个活的耗时。
  - **L186**「the full `npm test` (**24.8 s**), so the **0.5 s** inner loop…」（round 4 记作 L179）。
  - **L99**「27.5 s → **0.5 s**」、**L100**「余下 **0.8 s**」、**L95**「~**4 s**」、
    **L177**「(~**16 s**)」。
  按你自己写在 L110-111 的判据 ——「what must not be copied is anything that **changes when you
  re-run the suite**」—— 这六处全部命中：再跑一次就会漂。
  **`AGENTS.md` 同一个形状**：L173-176 的注写着「表里不写耗时、**也不写测试条数**」，
  而表内 **L166** 就写着 `export.test.mjs`「一次构建摊给 **10 条断言**」（实测正是 10 条测试，
  加一条断言即漂）。注对自己上方那张表说了假话。
  **这就是你问的第五次复发，而它的形状值得单独记一句：前四次是「数字错了」，
  这一次是「措辞改对了、被措辞管的东西没改」。修辞归位而实例未归位，账面上像是修完了。**
  **修法（这次建议连收敛条件一起写死，否则第六轮还会来）**：
  1. 规则补第三句**豁免**：「**已被取代的旧状态的历史测量、以及对既往缺陷的引述**不受此限——
     它们不会随重跑而变」。没有这句，L12 的「27.5 s / 5.8 s」（改造前基线）、L219、L232、
     L100 里「1.3 s as first landed」这些**本该保留**的东西会让规则永远为假，
     于是每一轮都只能把措辞再拧一次。
  2. 改掉那六处活的：L154 → 「零 spawn（计数与耗时见 `suite-report.md`）」；L186、L99、L100、
     L95、L177 的耗时改成定性说法或指过去。
  3. `AGENTS.md:166` 删掉「10 条断言」（按 #B14 同一理由：手改表里的计数就是下一个会漂的东西），
     或把注改成与表一致。

## Verdict B — Code-quality
**Status: HELD**（无未解决的 P0/P1）

## Tracked（P2 / P3）

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
- [x] 🟡 **P2 #B11** ~~`AGENTS.md` 表与判据自相矛盾~~ — Resolved（round 4；车道归属 16 行仍全对）。
- [x] 🔵 **P3 #B12** ~~结构论证是文件局部措辞~~ — Resolved（round 4）。

- [x] 🟡 **P2 #B13** ~~L2 的 `createServer = 4` 少算一次，成因是探针在那一个文件上是瞎的~~ —
  **Resolved（按建议披露而非重测）**，且我把成因与后果逐条验过，披露**准确**：
  `no-build:34` 确实给每个子进程重设 `MDXV_PROBE_OUT` 到私有临时文件并在 `finally` 删掉；
  真值 5 = `cli-language` 矩阵 4 例（L143-148，每例一次 `startPreview`）＋ 该文件 liveness 1 次。
  **一处更正，方向是对你有利的**：披露说 build=0「on the strength of that file's own S12
  assertion」，实际比这更强 —— 该文件三处子进程调用**每一处都用 `deepEqual` 断了完整调用清单**：
  `--check` 断 `[]`、liveness 断**恰好** `["createServer"]`（因此 build 也被排除）、
  probe-coverage 断 `[]`。所以那个文件的 build=0 不是只被一条断言覆盖，而是三条都钉住了。
  我原本怀疑 liveness 只断 createServer 存在、不排除 build，去读了才发现是 `deepEqual` 全等 ——
  记在这里，免得下一轮有人"发现"一个并不存在的缺口。
  你说这条最有用，我同意方向：它把「一个承重测量有洞」和「backlog 那条守卫要怎么写才值得写」
  连起来了，而你在两处都记了这个依赖。

- [x] 🟡 **P2 #B14** ~~`AGENTS.md` 的「63 条」实际 113~~ — **Resolved**，且删而未改，理由（手改表
  不放计数）也记下了。出处声明我核过：`grep -c "test("` 恰为 **63**，实测 **113**，你这句准确。
  但同一张表里还剩一处计数，见 #A5。

- [ ] 🔵 **P3 #B16** `openspec/changes/retier-test-lanes/genai/suite-report.md`（#B13 披露段）—
  措辞不精确：「A lane-level probe injection is therefore **overwritten** for that one file」。
  实际 `probeEnv()` 对 `NODE_OPTIONS` 是
  `[CLEAN_ENV.NODE_OPTIONS, "--import …"].filter(Boolean).join(" ")` —— **保留并追加**，
  车道级 loader 在那些子进程里照样加载、钩子照样跑；被覆盖的只有 `MDXV_PROBE_OUT` 这一个变量，
  于是记录写去了私有文件。这点值得写准，因为它直接决定修法有多便宜：
  **换一个 `no-build` 不会覆盖的输出变量名即可**，不需要改探针架构。
  **修法**：把 "injection is overwritten" 改成 "the injection still loads, but its **output path**
  (`MDXV_PROBE_OUT`) is shadowed"，并补一句「因此车道级注入改用独立变量名即可闭合」。

- [x] 🔵 **P3 #B15** 提交范围（`2cb7589` 混入独立的 backlog 处置）— **Won't fix，我同意你的判断。**
  为一条 P3 重写已发布历史，代价明显大于收益；内容本身是对的（不改反而多出一处不实陈述）。
  按「记下来、不回溯」处理即可。

## Round 5 已核为干净、不构成 finding

- **两份 CONTRIBUTING、两份 README、Makefile 现在完全不含耗时或计数** —— README 的「~7s」已消失，
  Makefile 里唯一的命中是 `printf` 格式串。数字外泄面只剩 #A5 点到的两个文件。
- **戳推进到 `f1a9166` 正当**：本提交零可执行改动，我在本提交重跑 `npm test` 得 247 / 0 / 0 exit 0。
  （round 4 提过的那半句「本提交未触碰可执行文件，故沿用上一提交测量」仍建议补，仍不作为 finding。）
- 车道覆盖仍闭合：glob 15 / 三条清单 15 / 无重复无幽灵；185 + 46 + 16 = 247。
- `AGENTS.md` 表的车道归属 16 行仍与 `package.json` 三条清单完全一致（重核）。
- 门禁承重面未被本轮触及：`npm test` 仍是 glob，`scripts/publish.sh:111` 仍走 `npm test`。
- **本轮新引入的所有第一手数字我都核过**，无一处失实：闭包 15 与其三段分段、createServer 真值 5、
  「63 = `test(` 行数 / 实测 113」。第二类复发（自称第一手却未推导）**本轮没有出现**。

## 附：已明确判为 out of scope

「没有任何一条车道是门禁，只有全量 `npm test` 是」—— 留到本 change 之外，已记入证据。
`genai/config.json` 的 `commands.check-diff: false`（`280f46f`）与现状相符，不算错。

---
<!-- genai:code-review.verdict blocking-open=1 -->
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **NOT HELD**
**Progress**: 5 / 6 resolved（#A1 #A2 #A3 #A4 #A6 已解决；#A5 待修）
