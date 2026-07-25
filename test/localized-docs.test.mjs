import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalizedNavigation,
  parseLocalizedDocument,
  parseLocalizedDocuments,
  resolveCurrentDocument,
  selectLocalizedDocument,
} from "../src/cli/localized-docs.mjs";

const files = parseLocalizedDocuments([
  { abs: "/docs/guide.mdx", rel: "guide.mdx", dir: "" },
  { abs: "/docs/guide.zh-CN.mdx", rel: "guide.zh-CN.mdx", dir: "" },
  { abs: "/docs/guide.en-US.mdx", rel: "guide.en-US.mdx", dir: "" },
  { abs: "/docs/only.zh-CN.md", rel: "only.zh-CN.md", dir: "" },
  { abs: "/docs/release.v1.mdx", rel: "release.v1.mdx", dir: "" },
]);

test("S1: recognizes only the supported locale suffix immediately before an MDX extension", () => {
  assert.deepEqual(
    parseLocalizedDocument({ abs: "/docs/guide.zh-CN.mdx", rel: "guide.zh-CN.mdx", dir: "" }),
    {
      abs: "/docs/guide.zh-CN.mdx",
      rel: "guide.zh-CN.mdx",
      dir: "",
      familyRel: "guide.mdx",
      locale: "zh-CN",
    },
  );
  assert.equal(
    parseLocalizedDocument({ abs: "/docs/release.v1.mdx", rel: "release.v1.mdx", dir: "" }).locale,
    undefined,
  );
  assert.equal(
    parseLocalizedDocument({ abs: "/docs/guide.zh-cn.mdx", rel: "guide.zh-cn.mdx", dir: "" }).locale,
    undefined,
  );
  assert.equal(
    parseLocalizedDocument({ abs: "/docs/guide.en.mdx", rel: "guide.en.mdx", dir: "" }).locale,
    undefined,
  );
});

test("S2: selects the exact locale before the unsuffixed base document", () => {
  assert.equal(selectLocalizedDocument(files, "/docs/guide.mdx", "zh-CN")?.abs, "/docs/guide.zh-CN.mdx");
  assert.equal(selectLocalizedDocument(files, "/docs/guide.zh-CN.mdx", "en-US")?.abs, "/docs/guide.en-US.mdx");
  assert.equal(selectLocalizedDocument(files, "/docs/guide.en-US.mdx", "zh-CN")?.abs, "/docs/guide.zh-CN.mdx");
});

test("S3: falls back only to the family base and keeps an unavailable direct variant addressable", () => {
  const noEnglish = files.filter((file) => file.abs !== "/docs/guide.en-US.mdx");
  assert.equal(selectLocalizedDocument(noEnglish, "/docs/guide.zh-CN.mdx", "en-US")?.abs, "/docs/guide.mdx");
  assert.equal(selectLocalizedDocument(files, "/docs/only.zh-CN.md", "en-US"), undefined);
  assert.equal(resolveCurrentDocument(files, "/docs/only.zh-CN.md", "en-US")?.abs, "/docs/only.zh-CN.md");
});

test("S4: navigation has one logical entry per available family in the active locale", () => {
  const englishNav = buildLocalizedNavigation(files, "en-US");
  assert.deepEqual(
    englishNav.map((file) => [file.rel, file.abs]),
    [
      ["guide.mdx", "/docs/guide.en-US.mdx"],
      ["release.v1.mdx", "/docs/release.v1.mdx"],
    ],
  );
  assert.deepEqual(
    buildLocalizedNavigation(files, "zh-CN").map((file) => file.rel),
    ["guide.mdx", "only.md", "release.v1.mdx"],
  );
});

test("S6: family selection preserves the exact-locale then base-only invariant for every member combination", () => {
  const variants = [
    { locale: undefined, suffix: "" },
    { locale: "zh-CN", suffix: ".zh-CN" },
    { locale: "en-US", suffix: ".en-US" },
  ];

  for (let mask = 1; mask < 2 ** variants.length; mask += 1) {
    const family = variants
      .filter((_, index) => mask & (1 << index))
      .map(({ locale, suffix }) => ({
        abs: `/docs/guide${suffix}.mdx`, rel: `guide${suffix}.mdx`, dir: "", locale,
      }));

    for (const current of family) {
      for (const locale of ["zh-CN", "en-US"]) {
        const expected = family.find((file) => file.locale === locale) ?? family.find((file) => file.locale === undefined);
        assert.equal(selectLocalizedDocument(family, current.abs, locale)?.abs, expected?.abs);
      }
    }
  }
});

test("S7: a relative link can select an existing locale variant even when its base target is absent", () => {
  const variantOnlyFamily = files.filter((file) => file.abs !== "/docs/guide.mdx");
  assert.equal(
    selectLocalizedDocument(variantOnlyFamily, "/docs/guide.mdx", "en-US")?.abs,
    "/docs/guide.en-US.mdx",
  );
});
