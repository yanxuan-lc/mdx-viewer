/* ============================================================
   mdx-viewer · 文件抽屉的树形结构
   —— 把扁平的 NavFile[]（按 rel 相对路径）折成嵌套目录树；不依赖 Node / DOM，可单测。
   ============================================================ */

const SEPARATOR_RE = /[\\/]/;

/** 目录节点的排序键：目录在前、文件在后，同类按名称本地化排序。 */
function compareNodes(a, b) {
  if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
  const byName = a.name.localeCompare(b.name);
  return byName !== 0 ? byName : (a.kind === "file" ? a.file.rel.localeCompare(b.file.rel) : 0);
}

function fileLabel(segment) {
  return segment.replace(/\.mdx?$/i, "");
}

function emptyDirectory(name, path) {
  return { kind: "dir", name, path, dirs: new Map(), files: [] };
}

function toNodes(directory) {
  const nodes = [
    ...[...directory.dirs.values()].map(toNodes),
    ...directory.files,
  ];
  return directory.path === undefined
    ? nodes.sort(compareNodes)
    : { kind: "dir", name: directory.name, path: directory.path, children: nodes.sort(compareNodes) };
}

/**
 * Fold flat navigation entries into a nested directory tree.
 * @param {Array<{rel: string, abs: string, dir: string}>} files navigation entries in drawer order
 * @returns {Array<{kind: "dir", name: string, path: string, children: any[]} | {kind: "file", name: string, file: any}>} tree roots, directories first
 */
export function buildNavTree(files) {
  const root = emptyDirectory("", undefined);
  for (const file of files) {
    const segments = String(file.rel).split(SEPARATOR_RE).filter(Boolean);
    if (!segments.length) continue;
    const name = segments.pop();
    let directory = root;
    let path = "";
    for (const segment of segments) {
      path = path ? `${path}/${segment}` : segment;
      if (!directory.dirs.has(segment)) directory.dirs.set(segment, emptyDirectory(segment, path));
      directory = directory.dirs.get(segment);
    }
    directory.files.push({ kind: "file", name: fileLabel(name), file });
  }
  return toNodes(root);
}

/**
 * List every directory path enclosing a navigation entry, outermost first.
 * @param {string | undefined} rel relative path of the entry
 * @returns {string[]} ancestor directory paths (`["a", "a/b"]` for `a/b/c.mdx`)
 */
export function ancestorDirectories(rel) {
  if (!rel) return [];
  const segments = String(rel).split(SEPARATOR_RE).filter(Boolean);
  segments.pop();
  const paths = [];
  let path = "";
  for (const segment of segments) {
    path = path ? `${path}/${segment}` : segment;
    paths.push(path);
  }
  return paths;
}
