import { test, expect } from "@playwright/test";

test("页面和静态样式属于同一构建，刷新后仍保持完整布局", async ({
  page,
  request,
}) => {
  const failedAssets: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/_next/") && response.status() >= 400)
      failedAssets.push(`${response.status()} ${response.url()}`);
  });
  for (let load = 0; load < 2; load++) {
    await page.goto("/");
    await expect(page.locator(".node-core").first()).toBeVisible();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(12, 15, 20)",
    );
    await expect(page.locator(".atlas-app")).toHaveCSS("display", "flex");
    const styles = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((elements) =>
        elements.map((element) => (element as HTMLLinkElement).href),
      );
    expect(styles.length).toBeGreaterThan(0);
    for (const url of styles) {
      const response = await request.get(url);
      expect(response.ok(), `Missing stylesheet: ${url}`).toBeTruthy();
      expect(response.headers()["content-type"]).toContain("text/css");
    }
  }
  expect(failedAssets).toEqual([]);
});
