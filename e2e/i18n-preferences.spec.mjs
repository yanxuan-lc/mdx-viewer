import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const authorContent = ["作者标题 Author title", "中文正文 / English prose", "作者组件文本 / Author component text", "作者页脚 Author footer"];

/** @param {import('@playwright/test').Page} page */
const clearPreferences = async (page) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.removeItem("mv-locale");
    localStorage.removeItem("mv-theme");
  });
};

/** @param {import('@playwright/test').Page} page */
const languageButton = (page) => page.getByRole("button").filter({ hasText: /^(EN|中)$/ }).first();

/** The external contract places the theme button immediately after the language button. */
const themeButton = (page) => languageButton(page).locator("xpath=following-sibling::button[1]");

/** @param {import('@playwright/test').Page} page */
const storedPreferences = (page) => page.evaluate(() => ({
  locale: localStorage.getItem("mv-locale"), theme: localStorage.getItem("mv-theme"),
}));

/** @param {import('@playwright/test').Page} page @param {string} documentName */
const openDocument = async (page, documentName = "index.mdx") => {
  await page.goto(`/?doc=${encodeURIComponent(`${process.cwd()}/e2e/fixtures/${documentName}`)}`);
  await expect(page.locator("html")).toHaveAttribute("data-theme");
};

test("S1: Simplified Chinese browser default", async ({ browser }) => {
  const context = await browser.newContext({ locale: "zh-CN" });
  const page = await context.newPage();
  await clearPreferences(page);
  await openDocument(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(languageButton(page)).toHaveText("EN");
  await expect.poll(() => storedPreferences(page)).toEqual({ locale: null, theme: null });
  await context.close();
});

for (const browserLocale of ["en-US", "fr-FR", "zh-TW"]) {
  test(`S2: Non-Simplified-Chinese browser default (${browserLocale})`, async ({ browser }) => {
    const context = await browser.newContext({ locale: browserLocale });
    const page = await context.newPage();
    await clearPreferences(page);
    await openDocument(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(languageButton(page)).toHaveText("中");
    await expect.poll(() => storedPreferences(page)).toEqual({ locale: null, theme: null });
    await context.close();
  });
}

test("S3: Switch language and restore it", async ({ browser }) => {
  const context = await browser.newContext({ locale: "zh-CN" });
  const page = await context.newPage();
  await clearPreferences(page);
  await openDocument(page);
  const beforeKeys = await page.evaluate(() => Object.keys(localStorage).sort());
  await languageButton(page).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(languageButton(page)).toHaveText("中");
  await expect.poll(() => storedPreferences(page)).toEqual({ locale: "en-US", theme: null });
  await expect(page.locator("body")).toContainText("Edited by");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual([...beforeKeys, "mv-locale"].sort());
  await context.close();
});

test("S4: Cycle and restore all theme preferences", async ({ page }) => {
  await clearPreferences(page);
  await page.emulateMedia({ colorScheme: "light" });
  await openDocument(page, "auto.mdx");
  for (const [preference, resolvedTheme] of [["light", "light"], ["dark", "dark"], ["auto", "light"]]) {
    await themeButton(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", preference);
    await expect(page.locator("html")).toHaveAttribute("data-theme", resolvedTheme);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("mv-theme"))).toBe(preference);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", preference);
  }
});

test("S5: Follow system only in auto", async ({ page }) => {
  await clearPreferences(page);
  await page.emulateMedia({ colorScheme: "light" });
  await openDocument(page, "auto.mdx");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "auto");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await themeButton(page).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "light");
  const writesAfterSelection = await storedPreferences(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => storedPreferences(page)).toEqual(writesAfterSelection);
});

for (const [documentName, expectedPreference] of [["light.mdx", "light"], ["dark.mdx", "dark"], ["auto.mdx", "auto"], ["invalid-mode.mdx", "auto"], ["index.mdx", "auto"]]) {
  test(`S6: Resolve frontmatter and default theme (${documentName})`, async ({ page }) => {
    await clearPreferences(page);
    await openDocument(page, documentName);
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", expectedPreference);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("mv-theme"))).toBeNull();
  });
}

test("S7: Recover from damaged or unavailable LocalStorage", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("mv-locale", "broken-locale");
    localStorage.setItem("mv-theme", "broken-theme");
  });
  await openDocument(page, "invalid-mode.mdx");
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "auto");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect.poll(() => storedPreferences(page)).toEqual({ locale: "broken-locale", theme: "broken-theme" });
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem"]) {
      Object.defineProperty(Storage.prototype, method, { configurable: true, value: () => { throw new DOMException("blocked"); } });
    }
  });
  await page.reload();
  await expect(languageButton(page)).toBeVisible();
  await languageButton(page).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await themeButton(page).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "light");
});

test("S8: Exercise every fixed-message family", async ({ browser }) => {
  const context = await browser.newContext({ locale: "zh-CN" });
  const page = await context.newPage();
  await clearPreferences(page);
  await openDocument(page);
  const fileMenu = page.getByRole("button", { name: "文件菜单" });
  await expect(fileMenu).toBeVisible();
  await fileMenu.click();
  await expect(page.getByText("文件", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭" })).toBeVisible();
  await expect(page.getByText("目录", { exact: true })).toBeVisible();
  await expect(page.getByText("全部", { exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText("由 作者 Author 编辑于 2026-07-25 12:00:00");
  await expect(languageButton(page)).toHaveAttribute("aria-label", "切换到英文");
  await expect(themeButton(page)).toBeVisible();
  await expect(themeButton(page)).toHaveAttribute("aria-label", /自动|浅色|深色/);
  await expect(page.getByRole("link", { name: /GitHub/ })).toBeVisible();
  await expect(page.locator("body")).toContainText("作者组件文本 / Author component text");
  await page.goto(`/?doc=${encodeURIComponent(`${process.cwd()}/e2e/fixtures/missing-document.mdx`)}`);
  await expect(page.locator("body")).toContainText("找不到该文档");
  await expect(page.locator("body")).not.toContainText("Document not found");
  await openDocument(page);
  if (await fileMenu.getAttribute("aria-expanded") !== "true") {
    await fileMenu.click();
  }
  await openDocument(page, "author-only.mdx");
  await expect(page.locator("body")).toContainText("由 作者 Author 编辑");
  await openDocument(page, "time-only.mdx");
  await expect(page.locator("body")).toContainText("编辑于 2026-07-25 12:00:00");
  await openDocument(page);
  if (await fileMenu.getAttribute("aria-expanded") !== "true") {
    await fileMenu.click();
  }
  await page.getByRole("button", { name: "关闭" }).click();
  await languageButton(page).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await page.getByRole("button", { name: "File menu" }).click();
  await expect(page.getByText("Files", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "File menu" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(page.getByText("Contents", { exact: true })).toBeVisible();
  await expect(page.getByText("All", { exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText("Edited by 作者 Author on 2026-07-25 12:00:00");
  await expect(languageButton(page)).toHaveAttribute("aria-label", "Switch to Chinese");
  await expect(themeButton(page)).toHaveAttribute("aria-label", /auto|light|dark/);
  await expect(page.getByRole("link", { name: /GitHub/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("mv-locale"))).toBe("en-US");

  await openDocument(page, "author-only.mdx");
  await expect(page.locator("body")).toContainText("Edited by 作者 Author");
  await openDocument(page, "time-only.mdx");
  await expect(page.locator("body")).toContainText("Edited on 2026-07-25 12:00:00");

  await page.goto(`/?doc=${encodeURIComponent(`${process.cwd()}/e2e/fixtures/missing-document.mdx`)}`);
  await expect(page.locator("body")).toContainText("Document not found");
  await expect(page.locator("body")).not.toContainText("找不到该文档");
  await page.goto(`/?doc=${encodeURIComponent(`${process.cwd()}/e2e/fixtures/render-error.mdx`)}`);
  await expect(page.locator("body")).toContainText("MDX render failed");
  await context.close();
});

test("S11: Preserve author-provided content", async ({ page }) => {
  await clearPreferences(page);
  await openDocument(page);
  await page.getByRole("button", { name: "File menu" }).click();
  await expect(page.getByRole("link", { name: "中文文档" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();
  const before = await Promise.all(authorContent.map((content) => page.getByText(content, { exact: true }).allTextContents()));
  await languageButton(page).click();
  const after = await Promise.all(authorContent.map((content) => page.getByText(content, { exact: true }).allTextContents()));
  expect(after).toEqual(before);
  await expect.poll(() => storedPreferences(page)).toEqual({ locale: "zh-CN", theme: null });
  await page.getByRole("button", { name: "文件菜单" }).click();
  await expect(page.getByRole("link", { name: "中文文档" })).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).click();
});

test("S12: Preserve drawer navigation and relative Markdown links", async ({ page }) => {
  await clearPreferences(page);
  await openDocument(page);
  await page.getByRole("button", { name: "File menu" }).click();
  await page.getByRole("link", { name: "中文文档" }).click();
  await expect(page.getByRole("heading", { name: "非 ASCII 文档内容 / Non-ASCII document content" })).toBeVisible();
  await page.getByRole("link", { name: "打开相对 Markdown / Open relative Markdown" }).click();
  await expect(page.getByRole("heading", { name: "Linked Markdown document" })).toBeVisible();
  await page.getByRole("link", { name: "返回非 ASCII 文档 / Back to non-ASCII document" }).click();
  await expect(page.getByRole("heading", { name: "非 ASCII 文档内容 / Non-ASCII document content" })).toBeVisible();
});

test("S10: Use preferences in an offline export", async ({ page }) => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "mdxv-e2e-export-"));
  const outputFile = join(outputDirectory, "localized.html");

  try {
    execFileSync(process.execPath, ["bin/mdxx.mjs", "test/fixtures/export-sample.mdx", outputFile, "--lang", "en-US"], {
      cwd: process.cwd(), timeout: 180_000, stdio: "pipe",
    });
    const externalRequests = [];
    page.on("request", (request) => {
      if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
    });
    await page.context().setOffline(true);
    await page.goto(pathToFileURL(outputFile).href);

    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(languageButton(page)).toHaveText("中");
    await languageButton(page).click();
    await themeButton(page).click();
    await expect.poll(() => storedPreferences(page)).toEqual({ locale: "zh-CN", theme: "light" });
    expect(externalRequests).toEqual([]);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "light");
    expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(["mv-locale", "mv-theme"]);
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});
