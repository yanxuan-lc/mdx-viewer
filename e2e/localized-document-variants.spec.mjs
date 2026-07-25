import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

const fixtureRoot = `${process.cwd()}/e2e/fixtures/localized`;
const demoPort = 4192;

/** @param {string} relativePath */
const fixturePath = (relativePath) => `${fixtureRoot}/${relativePath}`;

/** @param {import('@playwright/test').Page} page */
const clearLocale = async (page) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("mv-locale"));
};

/** @param {import('@playwright/test').Page} page @param {string} locale */
const setLocale = async (page, locale) => {
  await page.evaluate((nextLocale) => localStorage.setItem("mv-locale", nextLocale), locale);
};

/** @param {import('@playwright/test').Page} page @param {string} relativePath */
const openFixture = async (page, relativePath) => {
  await page.goto(`/?doc=${encodeURIComponent(fixturePath(relativePath))}`);
  await expect(page.locator("html")).toHaveAttribute("lang");
};

/** @param {import('@playwright/test').Page} page */
const languageButton = (page) => page.getByRole("button").filter({ hasText: /^(EN|中)$/ }).first();

/** @param {import('@playwright/test').Page} page */
const menuButton = (page) => page.getByRole("button", { name: /^(File menu|文件菜单)$/ });

/** @param {import('@playwright/test').Page} page */
const activeDocument = (page) => new URL(page.url()).searchParams.get("doc");

const startDemoServer = async () => {
  const server = spawn(process.execPath, ["bin/mdxv.mjs", "demo", "--no-open", "--port", String(demoPort)], {
    cwd: process.cwd(), stdio: "ignore",
  });
  await expect.poll(async () => {
    try {
      return (await fetch(`http://localhost:${demoPort}`)).ok;
    } catch {
      return false;
    }
  }, { timeout: 30_000 }).toBe(true);
  return server;
};

/** @param {import('node:child_process').ChildProcess} server */
const stopServer = async (server) => {
  if (server.exitCode !== null || server.signalCode !== null) return;
  await new Promise((resolve) => {
    server.once("exit", resolve);
    server.kill("SIGTERM");
  });
};

test("S1: Exact zh-CN locale renders the Chinese physical variant", async ({ page }) => {
  await clearLocale(page);
  await setLocale(page, "zh-CN");
  await openFixture(page, "README.mdx");

  await expect(page.getByRole("heading", { name: "README 中文文档" })).toBeVisible();
  expect(activeDocument(page)).toBe(fixturePath("README.zh-CN.mdx"));
});

test("S2: Missing exact locale falls back to the base physical file", async ({ page }) => {
  await clearLocale(page);
  await setLocale(page, "en-US");
  await openFixture(page, "base-only.mdx");

  await expect(page.getByRole("heading", { name: "Base-only fallback document" })).toBeVisible();
  expect(activeDocument(page)).toBe(fixturePath("base-only.mdx"));
});

test("S3: Exact en-US locale wins before base fallback", async ({ page }) => {
  await clearLocale(page);
  await setLocale(page, "en-US");
  await openFixture(page, "README.mdx");

  await expect(page.getByRole("heading", { name: "README English document" })).toBeVisible();
  expect(activeDocument(page)).toBe(fixturePath("README.en-US.mdx"));
});

test("S4: Switching language persists mv-locale and changes the current document variant", async ({ page }) => {
  await clearLocale(page);
  await setLocale(page, "en-US");
  await openFixture(page, "README.mdx");
  await expect(page.getByRole("heading", { name: "README English document" })).toBeVisible();

  await languageButton(page).click();

  await expect(page.getByRole("heading", { name: "README 中文文档" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("mv-locale"))).toBe("zh-CN");
  expect(activeDocument(page)).toBe(fixturePath("README.zh-CN.mdx"));

  await clearLocale(page);
  await setLocale(page, "en-US");
  await openFixture(page, "broken-variant.mdx");
  await expect(page.getByRole("heading", { name: "Broken-family English document" })).toBeVisible();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await languageButton(page).click();

  await expect(page.locator("body")).toContainText("MDX 渲染失败");
  await expect(page.getByRole("heading", { name: "Broken-family English document" })).toHaveCount(0);
  expect(activeDocument(page)).not.toBe(fixturePath("broken-variant.zh-CN.mdx"));
  expect(pageErrors).toEqual([]);

  await clearLocale(page);
  await openFixture(page, "README.mdx");
  await expect(page.getByRole("heading", { name: "README English document" })).toBeVisible();
  await page.evaluate(() => {
    const unavailableStorage = () => {
      throw new DOMException("Storage unavailable");
    };
    Object.defineProperty(Storage.prototype, "getItem", { configurable: true, value: unavailableStorage });
    Object.defineProperty(Storage.prototype, "setItem", { configurable: true, value: unavailableStorage });
  });
  const storageIsUnavailable = await page.evaluate(() => {
    try {
      localStorage.setItem("mv-locale", "zh-CN");
      return false;
    } catch {
      return true;
    }
  });
  expect(storageIsUnavailable).toBe(true);

  await languageButton(page).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: "README 中文文档" })).toBeVisible();
  expect(activeDocument(page)).toBe(fixturePath("README.zh-CN.mdx"));
});

test("S5: Direct locale-suffixed URLs canonicalize to the active exact variant or base fallback", async ({ page }) => {
  await clearLocale(page);
  await setLocale(page, "zh-CN");
  await openFixture(page, "README.en-US.mdx");
  await expect(page.getByRole("heading", { name: "README 中文文档" })).toBeVisible();
  expect(activeDocument(page)).toBe(fixturePath("README.zh-CN.mdx"));

  await setLocale(page, "en-US");
  await openFixture(page, "base-only.zh-CN.mdx");
  await expect(page.getByRole("heading", { name: "Base-only fallback document" })).toBeVisible();
  expect(activeDocument(page)).toBe(fixturePath("base-only.mdx"));
});

test("S6: Navigation lists each localized document family once with its neutral label", async ({ page }) => {
  await clearLocale(page);
  await openFixture(page, "README.mdx");
  await menuButton(page).click();

  await expect(page.getByRole("link", { name: "README", exact: true })).toHaveCount(1);
  await expect(page.getByRole("link", { name: /README\.(en-US|zh-CN)/ })).toHaveCount(0);
});

test("S7: A dotted basename remains a base document while a final locale suffix is selected", async ({ page }) => {
  await clearLocale(page);
  await setLocale(page, "zh-CN");
  await openFixture(page, "release.v2.mdx");
  await expect(page.getByRole("heading", { name: "Release v2 中文文档" })).toBeVisible();
  expect(activeDocument(page)).toBe(fixturePath("release.v2.zh-CN.mdx"));

  await setLocale(page, "en-US");
  await openFixture(page, "release.v2.mdx");
  await expect(page.getByRole("heading", { name: "Release v2 base document" })).toBeVisible();
  expect(activeDocument(page)).toBe(fixturePath("release.v2.mdx"));
});

test("S8: Relative Markdown links route and then select the active locale variant", async ({ page }) => {
  await clearLocale(page);
  await setLocale(page, "zh-CN");
  await openFixture(page, "guide/links.mdx");
  await page.getByRole("link", { name: "打开带参数目标" }).click();

  await expect(page.getByRole("heading", { name: "相对目标中文文档" })).toBeVisible();
  expect(activeDocument(page)).toBe(fixturePath("guide/target.zh-CN.mdx"));
  expect(new URL(page.url()).searchParams.get("view")).toBe("compact");
  expect(new URL(page.url()).hash).toBe("#localized-target");
});

test("S9: Demo has an English and Simplified-Chinese physical document counterpart", async ({ page }) => {
  const demoServer = await startDemoServer();

  try {
    await page.goto(`http://localhost:${demoPort}`);
    await page.evaluate(() => localStorage.setItem("mv-locale", "en-US"));
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(page.locator("main")).toBeVisible();

    await languageButton(page).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("heading", { name: "mdx-viewer 组件总览" })).toBeVisible();
    await expect.poll(() => activeDocument(page)).toBe(`${process.cwd()}/demo/index.zh-CN.mdx`);
  } finally {
    await stopServer(demoServer);
  }
});

test("S10: mdxx exports only the explicitly selected variant and opens offline", async ({ page }) => {
  const outputDirectory = mkdtempSync(join(tmpdir(), "mdxv-localized-export-"));
  const outputFile = join(outputDirectory, "localized.html");

  try {
    execFileSync(process.execPath, ["bin/mdxx.mjs", "e2e/fixtures/localized/README.zh-CN.mdx", outputFile], {
      cwd: process.cwd(), timeout: 180_000, stdio: "pipe",
    });
    const externalRequests = [];
    page.on("request", (request) => {
      if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
    });
    await page.context().setOffline(true);
    await page.goto(pathToFileURL(outputFile).href);

    await expect(page.getByRole("heading", { name: "README 中文文档" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "README English document" })).toHaveCount(0);
    expect(externalRequests).toEqual([]);
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("S11: Topbar computes to 36px and its controls do not overflow", async ({ page }) => {
  await clearLocale(page);
  await openFixture(page, "README.mdx");
  const topbar = page.locator(".mv-topbar");

  await expect(topbar).toHaveCSS("height", "36px");
  await expect.poll(() => topbar.evaluate((element) => ({
    controlsFit: [...element.querySelectorAll("button")].every((button) =>
      button.offsetTop >= 0 && button.offsetTop + button.offsetHeight <= element.clientHeight),
    hasOverflow: element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth,
  }))).toEqual({ controlsFit: true, hasOverflow: false });
});

test("S12: Topbar buttons have matching localized hints and visible keyboard focus", async ({ browser }) => {
  for (const locale of ["en-US", "zh-CN"]) {
    const context = await browser.newContext({ locale: locale === "en-US" ? "en-US" : "zh-CN" });
    const page = await context.newPage();
    await clearLocale(page);
    await setLocale(page, locale);
    await openFixture(page, "README.mdx");

    const controls = [
      menuButton(page),
      languageButton(page),
      page.locator('button[aria-label*="auto"], button[aria-label*="light"], button[aria-label*="dark"], button[aria-label*="自动"], button[aria-label*="浅色"], button[aria-label*="深色"]').first(),
    ];

    for (const control of controls) {
      await expect(control).toBeVisible();
      const ariaLabel = await control.getAttribute("aria-label");
      expect(await control.getAttribute("title")).toBe(ariaLabel);
      expect(ariaLabel).toBeTruthy();
    }

    const focusBefore = await menuButton(page).evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.outline, style.boxShadow, style.borderColor, style.backgroundColor];
    });
    await menuButton(page).focus();
    await expect(menuButton(page)).toBeFocused();
    const focusAfter = await menuButton(page).evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.outline, style.boxShadow, style.borderColor, style.backgroundColor];
    });
    expect(focusAfter).not.toEqual(focusBefore);
    await context.close();
  }
});
