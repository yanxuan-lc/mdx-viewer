/* ============================================================
   mdx-viewer · 本地文档链接
   —— 浏览器侧的纯路径解析，统一 POSIX/Windows 物理文档路径。
   ============================================================ */

function isWindowsPath(filePath) {
  return /^[A-Za-z]:[\\/]/.test(filePath);
}

function parentDirectory(filePath) {
  const separator = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return separator === -1 ? "" : filePath.slice(0, separator + 1);
}

function fileUrlDirectory(filePath) {
  const directory = parentDirectory(filePath);
  if (isWindowsPath(filePath)) return `file:///${directory.replaceAll("\\", "/")}`;
  return `file://${directory}`;
}

/**
 * Resolve a relative Markdown target against a physical POSIX or Windows document path.
 * @param {string | undefined} currentDocument current physical MD/MDX document
 * @param {string} href local Markdown link
 * @returns {{document: string, search: string, hash: string} | undefined} resolved physical target and target URL parts
 */
export function resolveLocalDocumentLink(currentDocument, href) {
  if (!currentDocument) return undefined;
  const windows = isWindowsPath(currentDocument);
  const url = new URL(windows ? href.replaceAll("\\", "/") : href, fileUrlDirectory(currentDocument));
  const pathname = decodeURIComponent(url.pathname);
  return {
    document: windows ? pathname.replace(/^\//, "").replaceAll("/", "\\") : pathname,
    search: url.search,
    hash: url.hash,
  };
}

/**
 * Build an internal preview URL while preserving the original target query and fragment.
 * @param {string} pageUrl current preview URL
 * @param {string} document localized physical document path
 * @param {string} search target query string
 * @param {string} hash target fragment
 * @returns {string} internal preview URL
 */
export function buildLocalizedDocumentUrl(pageUrl, document, search = "", hash = "") {
  const url = new URL(pageUrl);
  url.search = search;
  url.searchParams.set("doc", document);
  url.hash = hash;
  return url.toString();
}
