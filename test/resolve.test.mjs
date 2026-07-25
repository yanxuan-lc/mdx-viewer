/* ============================================================
   单元测试 · src/cli/resolve.mjs
   —— 纯逻辑：入参解析（file/dir 判定）、目录扫描、默认文档选取。
      用 node:test，无第三方依赖；fixture 树在临时目录里现建现清，测试自足。
   ============================================================ */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join, sep } from "node:path";
import { resolveInput, scanTree, pickDefaultDoc } from "../src/cli/resolve.mjs";

let ROOT; // 临时 fixture 根

before(() => {
  ROOT = mkdtempSync(join(tmpdir(), "mdxv-resolve-"));
  const w = (rel, body = "x") => {
    const abs = join(ROOT, rel);
    mkdirSync(resolve(abs, ".."), { recursive: true });
    writeFileSync(abs, body);
  };
  // 应被扫描到的
  w("README.md");
  w("alpha.mdx");
  w("guide/intro.md");
  w("guide/advanced.mdx");
  // 应被忽略的
  w("notes.txt");              // 非 mdx
  w(".hidden.md");             // 点文件
  w("node_modules/pkg/readme.md"); // SKIP 目录
});

after(() => rmSync(ROOT, { recursive: true, force: true }));

test("resolveInput: 无参数抛错", () => {
  assert.throws(() => resolveInput(undefined), /提供一个/);
});

test("resolveInput: 目录 → root=该目录, target 为空", () => {
  const r = resolveInput(ROOT);
  assert.equal(r.root, ROOT);
  assert.equal(r.target, undefined);
});

test("resolveInput: 文件 → root=所在目录, target=该文件", () => {
  const file = join(ROOT, "guide", "intro.md");
  const r = resolveInput(file);
  assert.equal(r.root, join(ROOT, "guide"));
  assert.equal(r.target, file);
});

test("resolveInput: 非 MDX 文件抛错", () => {
  assert.throws(() => resolveInput(join(ROOT, "notes.txt")), /不是 MDX/);
});

test("resolveInput: 不存在的路径抛错", () => {
  assert.throws(() => resolveInput(join(ROOT, "nope.mdx")));
});

test("A2: scanTree 的不可读取根目录是 INPUT_NOT_FOUND，而不是空目录", () => {
  assert.throws(
    () => scanTree(join(ROOT, "missing-directory")),
    (error) => error.code === "INPUT_NOT_FOUND" && error.params.path.endsWith("missing-directory"),
  );
});

test("A2: unreadable files are rejected at the input boundary", (t) => {
  const file = join(ROOT, "unreadable.mdx");
  writeFileSync(file, "# private");
  chmodSync(file, 0o000);
  t.after(() => {
    chmodSync(file, 0o600);
    rmSync(file, { force: true });
  });
  assert.throws(
    () => resolveInput(file),
    (error) => error.code === "INPUT_NOT_FOUND" && error.params.path === file,
  );
});

test("scanTree: 只收 .md/.mdx，跳过点文件 / 非 mdx / node_modules", () => {
  const files = scanTree(ROOT);
  const rels = files.map((f) => f.rel);
  assert.deepEqual(
    [...rels].sort(),
    ["README.md", "alpha.mdx", join("guide", "advanced.mdx"), join("guide", "intro.md")].sort(),
  );
  assert.ok(!rels.some((r) => r.includes("node_modules")), "不应含 node_modules");
  assert.ok(!rels.some((r) => r.includes(".hidden")), "不应含点文件");
  assert.ok(!rels.some((r) => r.endsWith(".txt")), "不应含非 mdx");
});

test("scanTree: 结果按 rel 排序，dir 字段正确", () => {
  const files = scanTree(ROOT);
  const rels = files.map((f) => f.rel);
  assert.deepEqual(rels, [...rels].sort((a, b) => a.localeCompare(b)), "应按 rel 升序");
  const top = files.find((f) => f.rel === "README.md");
  const nested = files.find((f) => f.rel === join("guide", "intro.md"));
  assert.equal(top.dir, "", "顶层文档 dir 为空串");
  assert.equal(nested.dir, "guide", "子目录文档 dir 为相对目录名");
  assert.ok(top.abs.startsWith(ROOT) && top.abs.endsWith("README.md"));
  assert.equal(top.familyRel, "README.md", "无后缀基础文件本身是其逻辑文档名");
});

test("S5: scanTree exposes locale family metadata while retaining every physical document", () => {
  const localized = join(ROOT, "guide", "intro.zh-CN.md");
  writeFileSync(localized, "# 中文");
  const files = scanTree(ROOT);
  const variant = files.find((file) => file.abs === localized);
  assert.equal(variant?.rel, join("guide", "intro.zh-CN.md"));
  assert.equal(variant?.familyRel, join("guide", "intro.md"));
  assert.equal(variant?.locale, "zh-CN");
});

test("pickDefaultDoc: 显式 target 优先", () => {
  const files = scanTree(ROOT);
  const explicit = join(ROOT, "alpha.mdx");
  assert.equal(pickDefaultDoc(files, ROOT, explicit), explicit);
});

test("pickDefaultDoc: 无显式 target 时优先根目录 README", () => {
  const files = scanTree(ROOT);
  assert.equal(pickDefaultDoc(files, ROOT, undefined), join(ROOT, "README.md"));
});

test("pickDefaultDoc: README/index 优先级高于字母序首篇", () => {
  // 构造一个字母序首篇为 aaa.mdx、但存在 index.md 的场景
  const files = [
    { abs: join(ROOT, "aaa.mdx"), rel: "aaa.mdx", dir: "" },
    { abs: join(ROOT, "index.md"), rel: "index.md", dir: "" },
  ];
  assert.equal(pickDefaultDoc(files, ROOT, undefined), join(ROOT, "index.md"));
});

test("pickDefaultDoc: 无 README/index 时取首篇", () => {
  const files = [
    { abs: join(ROOT, "guide", "advanced.mdx"), rel: join("guide", "advanced.mdx"), dir: "guide" },
    { abs: join(ROOT, "guide", "intro.md"), rel: join("guide", "intro.md"), dir: "guide" },
  ];
  assert.equal(pickDefaultDoc(files, ROOT, undefined), files[0].abs);
});

test("pickDefaultDoc: 空文件列表返回 undefined", () => {
  assert.equal(pickDefaultDoc([], ROOT, undefined), undefined);
});

// sep 被引用以示意跨平台路径拼接（join 已处理分隔符）；避免 lint 误报未使用。
void sep;
