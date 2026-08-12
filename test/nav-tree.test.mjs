import test from "node:test";
import assert from "node:assert/strict";
import { ancestorDirectories, buildNavTree } from "../src/app/nav-tree.mjs";

const entry = (rel) => ({ rel, abs: `/docs/${rel}`, dir: rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "" });

/** 只留结构，便于断言：目录记 `name/`，文档记标签。 */
const shape = (nodes) => nodes.map((node) => node.kind === "dir" ? { [`${node.name}/`]: shape(node.children) } : node.name);

test("N1: nests every path segment into its own directory level", () => {
  const tree = buildNavTree([entry("guide/deep/nested.mdx"), entry("guide/intro.mdx"), entry("readme.md")]);
  assert.deepEqual(shape(tree), [
    { "guide/": [{ "deep/": ["nested"] }, "intro"] },
    "readme",
  ]);
});

test("N2: carries the full path on every directory level so collapse state can key on it", () => {
  const [guide] = buildNavTree([entry("guide/deep/nested.mdx")]);
  assert.equal(guide.path, "guide");
  assert.equal(guide.children[0].path, "guide/deep");
});

test("N3: orders directories before documents and sorts each group by name", () => {
  const tree = buildNavTree([entry("zeta.mdx"), entry("alpha.mdx"), entry("beta/one.mdx"), entry("alpha/two.mdx")]);
  assert.deepEqual(shape(tree), [{ "alpha/": ["two"] }, { "beta/": ["one"] }, "alpha", "zeta"]);
});

test("N4: keeps the navigation entry on each leaf and drops only the MDX extension", () => {
  const [leaf] = buildNavTree([entry("guide.mdx")]);
  assert.equal(leaf.kind, "file");
  assert.equal(leaf.name, "guide");
  assert.equal(leaf.file.abs, "/docs/guide.mdx");
});

test("N5: splits Windows separators into the same levels as POSIX ones", () => {
  assert.deepEqual(shape(buildNavTree([entry(String.raw`guide\deep\nested.mdx`)])), [{ "guide/": [{ "deep/": ["nested"] }] }]);
});

test("N6: lists ancestor directories outermost first, and none for a root document", () => {
  assert.deepEqual(ancestorDirectories("guide/deep/nested.mdx"), ["guide", "guide/deep"]);
  assert.deepEqual(ancestorDirectories("readme.md"), []);
  assert.deepEqual(ancestorDirectories(undefined), []);
});
