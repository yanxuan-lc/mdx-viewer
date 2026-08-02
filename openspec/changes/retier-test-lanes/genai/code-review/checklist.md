# Code Review Checklist — retier-test-lanes

- **Mode**: Incremental（合并前门禁）
- **Branch**: dev
- **Commit**: 0afc3edb827bf83cbda67e085ad3268bbacc9e7e
- **Reviewer model family**: Claude (Opus 5)
- **Round**: 3（round 1 审 `3bd40e4`；round 2 审 `46fe6a8`；round 3 审
  `git diff 46fe6a8 0afc3ed`，状态就地更新）
- **Scope**: `3bd40e4` + `46fe6a8` + `0afc3ed`；`280f46f` 及更早不在本轮
- **Lane**: `min`，无 change-local spec 目录。Verdict A 的比对基准取**任务描述 + 车道判据本身**
  （Makefile / AGENTS.md / CONTRIBUTING 里写下的三条判据是这次唯一的可验证契约），
  外加 `genai/` 下的证据载体是否如实描述被审提交。

## 复核证据（round 3 自己重跑，不采信记录）

退出码取自命令本身，不经 `tail` / `grep` 管道。

| 命令 | exit | tests | pass | fail | cancelled | wall（我实测） | suite-report 记录 |
|---|---|---|---|---|---|---|---|
| `npm test` | **0** | 247 | 247 | 0 | 0 | 24.7 s | 247 / 0 / 0 · 24.8 s ✓ |
| `npm run test:unit` | 0 | 185 | 185 | 0 | 0 | **0.56 s** | 185 · 0.5 s ✓ |
| `npm run test:cli` | 0 | 46 | 46 | 0 | 0 | 8.35 s | 46 · 8.6 s ✓ |
| `npm run test:build` | 0 | 16 | 16 | 0 | 0 | 23.13 s | 16 · 23.6 s ✓ |
| `make lint` | **0** | — | — | — | — | 38 files parsed | exit 0 ✓ |

六项独立核对（不改仓库，脚本在 scratchpad）：

1. **helper 抽取无损** —— 把 `46fe6a8` 里 `cli-language` 与 `cli-export` 各自那两份拷贝、和
   `test/helpers/cli-env.mjs` 的导出版本三方对拉（剥掉 `export ` 前缀后）：
   **两份旧拷贝彼此逐字节相同，抽出来的版本与它们也逐字节相同**。
2. **glob 不收 helper** —— `test/*.test.mjs` 展开为 **15 个文件**，不含 `helpers/cli-env.mjs`；
   `node --test test/*.test.mjs` 实际装载 15 个单元。你的判断成立。
3. **lint 收得到 helper** —— `make lint` 用 `find $(LINT_DIRS) -name '*.mjs'`（**递归**），
   `test/helpers/cli-env.mjs` 确实在集合里，`node --check` 单独跑过也 PARSE_OK，
   全量 38 files parsed / exit 0。
4. **L1 零 spawn 仍成立，且这次按传递闭包核** —— 顺着相对 import 展开三条车道：
   L1 闭包**就是它自己那 8 个文件**（没有任何 `test/` 内的相对 import），spawn 面 0 命中；
   L2 闭包 5 个文件、L3 闭包 4 个（各多出 helper 一枚）。见 #B12。
5. **helper 只有两个消费方** —— `grep -rln` 确认仅 `cli-language`（L2）与 `cli-export`（L3），
   与文件头注释一致；全仓再无 `environment` / `systemLocalePreload` 的本地副本残留。
6. **status 门只剩一处** —— 见 #B7。

## Verdict A — Spec-compliance（code-vs-spec；不评判该不该做这件事）
**Status: NOT HELD**

- [x] 🟠 **P1 #A1** ~~L1「零 spawn」判据当场即为假~~ — **Resolved**（round 2）。
- [x] 🟠 **P1 #A2** ~~两份 CONTRIBUTING 仍只教 `test:unit` 一条清单~~ — **Resolved**（round 2）。

- [x] 🟠 **P1 #A3** ~~`suite-report.md` 只换了戳，一个数字都没改~~ — **Resolved**。整份按本提交
  重测重写：Result 表换成 exit + 四个计数器、数字 185 / 46 / 16 / 247，算式改成
  「185 + 46 + 16」，Lane invariant 表补上 spawn 列并记下「两个探针必须分开注入」。
  我把每个数字都对了一遍实测，全部吻合（见上表）。另外两处做法值得点名认可:
  提交里该文件的戳是 `Commit: PENDING`、由工作区最后一次动作补实 hash —— 这是这类
  「戳必须晚于被戳提交」的自指约束**唯一正确的不动点**，不是遗漏;
  文首那句「measured at the commit stamped above — **not carried over from an earlier round**」
  把判据写进了文件本身，下一轮想再犯得先删掉这句话。

- [ ] 🟠 **P1 #A4** `openspec/changes/retier-test-lanes/genai/tdd-evidence.md` —
  **#A3 的修法只落到了一个文件，没有落到做法上；同一个缺陷现在在旁边这份证据里。**
  这份文件的戳已经推到 `0afc3ed`，但内容停在 round 1 + 「Review round 1」那一节，
  比戳落后**两轮**。具体四处：
  - **L96** 「the inner loop went **27.5 s → 1.3 s**」—— 在本提交是 0.5 s。而同一份文件
    L177 自己写着「the 0.5 s inner loop」，**文件内部自相矛盾**。
  - **L99-108「## Commands run」** 仍未标注属于 round 1，表里是 189 / 42 / 16 ·
    1.3 / 7.7 / 22.6 s —— 在 `0afc3ed` 上四行全错，且没有任何标签把它框回历史。
  - **无 round 2 / round 3 记述**：`#B1` describe 化、`#B2`、`#B5`、`#B8`，以及本轮四条内联
    修复（helper 抽取 / `sharedExport` / `after` 守卫 / 去掉恒真断言）在这份文件里**完全没有
    痕迹**。`min` 车道没有 spec，这份文件就是「做了什么、为什么」的唯一记录。
  - **L181「## Final numbers」仍是 pass/fail-only 格式** —— 正是本提交在 `suite-report.md` 里
    刚刚论证为不安全的那个格式（#B9：describe 作用域 hook 抛错会记成 `cancelled` 而非
    `fail`）。同一次提交里，一个文件采纳了新格式，旁边这个没有。
  **修法**：补一节「## Review rounds 2–3」列清六条修复与 #B9 的格式决定；L99 标题改成
  「## Commands run（round 1，改造前基线）」；L96 改成 0.5 s；「Final numbers」要么转成
  exit + 计数器格式，要么删掉、改为指向 `suite-report.md`（**数字只留一份来源**，两份必然再漂）。
  **我要明说自己判错过**：round 2 我把这条的轻量版记成了 P3 #B10，理由是「Final numbers 存在
  且正确所以能覆盖前文」。那个理由不成立 —— #A3 的判据是「戳即断言这些数字测于此提交」，它不因
  文件后面某一节恰好是对的而豁免。现在同一份文件的戳已越过两轮、还漏掉整轮改动、并且违反了它
  兄弟文件在同一提交里刚立的规矩，所以按 #A3 同一把尺子升到 P1。这就是你让我找的第四个自伤，
  而它真正的信号不是「又漏一处数字」，而是**第三个缺陷的修法被当成一次性修补,而不是一条做法**。

## Verdict B — Code-quality
**Status: HELD**（无未解决的 P0/P1）

## Tracked（P2 / P3，可留到 merge 之后）

- [x] 🟡 **P2 #B1** ~~根级 `before()` 放大失败面、name-pattern 过滤仍付四次构建~~ —
  **Resolved**（round 2，`describe()` 化）。
- [x] 🟡 **P2 #B2** ~~`cli-output.test.mjs` 孤儿 import `readFileSync`~~ — **Resolved**（round 2）。
- [x] 🔵 **P3 #B5** ~~`compile-check.cli.test.mjs` 头注释残留旧场景范围~~ — **Resolved**（round 2）。
- [x] 🔵 **P3 #B8** ~~backlog 判据只覆盖构建维度~~ — **Resolved**（round 2）。

- [x] 🟡 **P2 #B9** ~~describe 作用域 `before()` 失败时汇总行写「fail 0」，抄进证据会把红的记成
  绿的~~ — **Resolved（在证据格式上）**。`suite-report.md` 改成记 exit + 四个计数器，并把成因
  写进文件。这条你处理得比我建议的更好：我只说「加一列 exit」，你把**为什么**也写进去了，
  下一个人不会把它当冗余列删掉。**但只落到了一个文件** —— `tdd-evidence.md` 的「Final numbers」
  仍是旧格式，已并入 #A4。

- [x] 🟡 **P2 #B3** ~~`environment()` / `systemLocalePreload()` 两份逐字节相同的拷贝~~ —
  **Resolved**。抽到 `test/helpers/cli-env.mjs`，三方逐字节比对无差异（复核 1）；命名刻意避开
  `*.test.mjs` 且**双重安全**（既不在 `test/` 顶层、也不以 `.test.mjs` 结尾），glob 不收、
  lint 收得到（复核 2、3）。两个消费方行为不变：`environment()` 仍在**调用时**读 `process.env`，
  从同模块函数变成跨模块导入不改变这一点；`cli-language` 的 preview 路径（L2）与 `cli-export`
  的 export 路径（L3）用的是同一份实现，此前也是同一份字节，所以无一处依赖过本地定义。

- [x] 🔵 **P3 #B4** ~~`localeExports.get()` 无守卫~~ — **Resolved**。
  `sharedExport()`（`test/cli-export.test.mjs:51-55`）用 `assert.ok` 断存在并点名
  「LOCALE_CASES names and the lookups here have drifted apart」，比我建议的措辞更能指向病因。

- [x] 🔵 **P3 #B6** ~~`after` 未守卫 `localeDirectory`~~ — **Resolved**
  （`test/cli-export.test.mjs:73-75`，附成因注释）。

- [x] 🔵 **P3 #B7** ~~A5 两条测试里的 `assert.equal(result.status, 0)` 恒真~~ — **Resolved**，
  且我核过没有留下静默放过的路径。全文件只剩三处 status 断言：L24（A3，必须为 1）、
  **L67（`before()` 内，四次矩阵导出的唯一门）**、L105（S3，必须为 0）。
  `before()` 是 describe 作用域钩子，**必然先于**组内两条测试执行；任一导出非 0 就在 L67 抛错，
  两条测试转 cancelled、退出码 1，不存在「非零退出却绿」的路径。被删掉的两处读的正是 L67 已经
  把过关的同一个 `result` 对象，所以确实是恒真断言，删除无损。附带一层冗余保护：矩阵仍断
  `stderr` 匹配 `/self-contained/` 或 `/自包含/`，那两句只在成功路径出现。

- [ ] 🟡 **P2 #B11** `AGENTS.md:152-162`（round 3 新增）— **同一份文件里，测试清单表与 13 行后
  的新判据自相矛盾**。表的「层次」列仍是改造前的词汇（单元 / 集成 / 端到端冒烟），其中两行现在
  是错的：`test/cli-language.test.mjs`（L157）与 `test/cli-output.test.mjs`（L158）都标着
  「单元 / 纯逻辑」，而两者都在 `test:cli`、都 spawn `bin/mdxv.mjs` 与 `bin/mdxx.mjs`
  （L2 那 39 次 spawn 主要就来自它们）；而 L170-174 恰好写着「L1 `test:unit` 进程内 import
  `src/`、**零 spawn**」。另外这张表只列了 9 个 `test/` 文件（盘上 15 个），本次新建的
  `cli-export.test.mjs` 与 `compile-check.export-pairing.test.mjs` 都没进表，
  `export.test.mjs` 的「较慢（~7s）」也是错标时代的数字。
  层次列的漂移是**改造前就有的**，不是本次引入；但本次编辑的正是这一节、新建的两个文件正该进这张
  表、而矛盾正是与本次新加的判据之间的矛盾 —— 按 #A2 同样的理由（贡献者文档不一致就会让缺陷复发）
  应当一起收口。**修法**：「层次」列换成 L1 / L2 / L3，把 L157 / L158 改成 L2，补上缺的 6 行
  （或明确写「非穷举，穷举见 `package.json` 三条清单」），删掉 `~7s` 这个具体数字。

- [ ] 🔵 **P3 #B12** `openspec/changes/retier-test-lanes/genai/suite-report.md`（结构论证那段）—
  我给的那句结构论证被原样收进了证据，但它是**文件局部**的措辞：「none of its eight files
  mentions `child_process` / …」。`test/helpers/` 现在存在了，于是这句话差一跳：将来某个会 spawn
  的 helper 被 L1 文件 import，**满足这句检查却违反判据**。今天不成立 —— 我按传递闭包核过，
  L1 的闭包就是它自己那 8 个文件（复核 4）。**修法**：把论证改成传递闭包的说法
  （「L1 及其相对 import 闭包内的文件都不出现这七个 API」），`test-lane-invariant-unguarded`
  真正落地时也按闭包写，否则它会漏掉 helper 这条路径。

- [x] 🔵 **P3 #B10** ~~`tdd-evidence.md` 的 round-1 数字未标轮次~~ — **Superseded**：
  升级并并入 **#A4**（升级理由与我自己的判错都写在 #A4 里）。

## Round 3 已核为干净、不构成 finding（列出以说明查过）

- **没有第四个代码缺陷**（你的问题 4）：本轮四条修复我逐条核过实现，没有一条改变了行为面 ——
  helper 是逐字节搬移、`sharedExport` 只增加断言、`after` 只增加守卫、删掉的两处断言可证明恒真。
  第四个缺陷在证据面（#A4），不在代码面。
- `test/helpers/cli-env.mjs` 的 JSDoc 把 `MDXV_LANG: undefined` **表示删除而非设成字符串
  "undefined"** 这条易错语义写明了 —— 这正是抽成共享模块后最容易被下一个人改坏的一处，写下来是对的。
- **A5 flag-wins 的断言现在是矩阵 flag 例的严格子集**（stderr + html lang，矩阵还多断
  initialLocale / localeSource）。这不是本轮引入的 —— 去掉 status 之前它也是子集。你在 evidence
  里给的保留理由（「flag wins over environment」这层语义只有这条测试名能被搜到）成立，接受不改。
- 车道覆盖仍闭合：glob 15 个 / 三条清单 15 个 / 无重复无幽灵；185 + 46 + 16 = 247。
- `package.json` 的 `files` 字段是 `["bin","src","demo",…]`，不含 `test/`，新增 helper 目录
  不改变发布产物。
- 门禁承重面未被本轮触及：`npm test` 仍是 glob，`scripts/publish.sh:111` 仍走 `npm test`。

## 附：已明确判为 out of scope

「没有任何一条车道是门禁，只有全量 `npm test` 是」—— 同意留到本 change 之外，且你已把这句写进
`tdd-evidence.md` 的 round-2 记述。它与 #B9 相关：门禁只看 `npm test` 的**退出码**，所以 #B9
的风险完全落在「人 / agent 抄 pass-fail 行」这个动作上，而不在自动化上 —— 这也正是 #A4 里
「Final numbers 仍是旧格式」值得收口的原因。

`genai/config.json` 的 `commands.check-diff: false`（`280f46f`，不在判定内）与本仓现状相符，不算错。

---
<!-- genai:code-review.verdict blocking-open=1 -->
**Merge gate**: HELD only when BOTH verdicts are HELD. Currently: **NOT HELD**
**Progress**: 3 / 4 resolved（#A1 #A2 #A3 已解决；#A4 待修）
