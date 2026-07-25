import { expect, test } from "@playwright/test";

for (const [locale, port, directoryEmpty] of [
  ["zh-CN", 4184, "此目录下没有可显示的 .md / .mdx 文档"],
  ["en-US", 4185, "This directory has no displayable .md or .mdx documents"],
]) {
  test(`S8: Empty directory state (${locale})`, async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("body")).toContainText(directoryEmpty);
  });
}

for (const [locale, port, selectDocument] of [
  ["zh-CN", 4186, "从菜单选择一个文档开始阅读"],
  ["en-US", 4187, "Choose a document from the menu to start reading"],
]) {
  test(`S8: Select-document state (${locale})`, async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("body")).toContainText(selectDocument);
  });
}
