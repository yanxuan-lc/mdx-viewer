/* ============================================================
   mdx-viewer · 文档语言变体
   —— 识别 .zh-CN/.en-US 文件族；本模块不依赖 Node，供预览客户端复用。
   ============================================================ */

const LOCALIZED_DOCUMENT_RE = /\.(zh-CN|en-US)(\.mdx?)$/;

/**
 * Add the logical family and optional locale metadata to one physical MDX file.
 * @param {{abs: string, rel: string, dir: string}} file physical scanned document
 * @returns {{abs: string, rel: string, dir: string, familyRel: string, locale?: "zh-CN" | "en-US"}} physical document with family metadata
 */
export function parseLocalizedDocument(file) {
  const match = file.rel.match(LOCALIZED_DOCUMENT_RE);
  if (!match) return { ...file, familyRel: file.rel };
  return {
    ...file,
    familyRel: file.rel.replace(LOCALIZED_DOCUMENT_RE, "$2"),
    locale: match[1],
  };
}

/**
 * Add locale metadata to every physical scanned document.
 * @param {Array<{abs: string, rel: string, dir: string}>} files physical scanned documents
 * @returns {Array<{abs: string, rel: string, dir: string, familyRel: string, locale?: "zh-CN" | "en-US"}>} parsed documents
 */
export function parseLocalizedDocuments(files) {
  return files.map(parseLocalizedDocument);
}

function normalizedDocuments(files) {
  return files.map((file) => file.familyRel ? file : parseLocalizedDocument(file));
}

function familyAbsolutePath(filePath) {
  return filePath.replace(LOCALIZED_DOCUMENT_RE, "$2");
}

/**
 * Select the preferred physical member of a document family for a locale.
 * @param {Array<{abs: string, rel: string, dir: string, familyRel?: string, locale?: "zh-CN" | "en-US"}>} files physical documents
 * @param {string | undefined} currentDoc physical document identifying the family
 * @param {"zh-CN" | "en-US"} locale active product locale
 * @returns {{abs: string, rel: string, dir: string, familyRel: string, locale?: "zh-CN" | "en-US"} | undefined} exact locale or base fallback
 */
export function selectLocalizedDocument(files, currentDoc, locale) {
  if (!currentDoc) return undefined;
  const documents = normalizedDocuments(files);
  const current = documents.find((file) => file.abs === currentDoc);
  const familyPath = current ? familyAbsolutePath(current.abs) : familyAbsolutePath(currentDoc);
  const family = documents.filter((file) => familyAbsolutePath(file.abs) === familyPath);
  if (!family.length) return undefined;
  return family.find((file) => file.locale === locale) ?? family.find((file) => file.locale === undefined);
}

/**
 * Resolve a directly addressed physical document without inventing a cross-locale fallback.
 * @param {Array<{abs: string, rel: string, dir: string, familyRel?: string, locale?: "zh-CN" | "en-US"}>} files physical documents
 * @param {string | undefined} currentDoc directly addressed physical document
 * @param {"zh-CN" | "en-US"} locale active product locale
 * @returns {{abs: string, rel: string, dir: string, familyRel: string, locale?: "zh-CN" | "en-US"} | undefined} selected document or direct document
 */
export function resolveCurrentDocument(files, currentDoc, locale) {
  const selected = selectLocalizedDocument(files, currentDoc, locale);
  if (selected) return selected;
  return normalizedDocuments(files).find((file) => file.abs === currentDoc);
}

function familyDirectory(familyRel) {
  const separator = Math.max(familyRel.lastIndexOf("/"), familyRel.lastIndexOf("\\"));
  return separator === -1 ? "" : familyRel.slice(0, separator);
}

/**
 * Produce one locale-available navigation entry for each logical document family.
 * @param {Array<{abs: string, rel: string, dir: string, familyRel?: string, locale?: "zh-CN" | "en-US"}>} files physical documents
 * @param {"zh-CN" | "en-US"} locale active product locale
 * @returns {Array<{abs: string, rel: string, dir: string, familyRel: string, locale?: "zh-CN" | "en-US"}>} deduplicated logical navigation
 */
export function buildLocalizedNavigation(files, locale) {
  const documents = normalizedDocuments(files);
  const families = new Map();
  for (const document of documents) {
    if (!families.has(document.familyRel)) families.set(document.familyRel, []);
    families.get(document.familyRel).push(document);
  }
  return [...families.entries()]
    .map(([familyRel, members]) => {
      const selected = members.find((file) => file.locale === locale) ?? members.find((file) => file.locale === undefined);
      return selected && { ...selected, rel: familyRel, dir: familyDirectory(familyRel) };
    })
    .filter(Boolean)
    .sort((a, b) => a.rel.localeCompare(b.rel));
}
