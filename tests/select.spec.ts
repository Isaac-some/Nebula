import { test, expect, request as apiRequest } from "@playwright/test";
const pending: string[] = [];
test.afterEach(async () => {
  const cleanup = await apiRequest.newContext({
    baseURL: process.env.ATLAS_TEST_URL || "http://127.0.0.1:3210",
  });
  try {
    for (const id of pending.splice(0))
      await cleanup.delete(`/api/vault?id=${id}`);
  } finally {
    await cleanup.dispose();
  }
});
test("领域和学习状态下拉菜单可见、对齐、不越界，选择与键盘操作有效", async ({
  page,
  request,
}) => {
  const created = await request.post("/api/vault", {
    data: {
      title: `下拉验收-${Date.now()}`,
      summary: "菜单验收",
      content: "关联 [[AI Agent]]",
      status: "未开始",
    },
  });
  const note = await created.json();
  pending.push(note.id);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".node-core").first()).toBeVisible();
  const domain = page.getByRole("combobox", {
    name: "图谱领域筛选",
    exact: true,
  });
  await domain.click();
  const menu = page.getByRole("listbox", { name: "图谱领域筛选", exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("option")).toHaveCount(5);
  const inViewport = () =>
    page.locator(".atlas-select-popup:visible").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight
      );
    });
  expect(await inViewport()).toBeTruthy();
  expect(
    await page
      .locator(".atlas-select-popup:visible")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(23, 33, 39)");
  await page.screenshot({ path: "docs/research/select-domain-fixed.png" });
  await menu.getByRole("option", { name: "基础层", exact: true }).click();
  await expect(domain).toContainText("基础层");
  await domain.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(domain).toBeFocused();
  await domain.click();
  await expect(menu).toBeVisible();
  await menu.getByRole("option", { name: "全部领域", exact: true }).click();
  await page.getByLabel("搜索星图", { exact: true }).fill(note.title);
  await page.getByRole("listbox").getByRole("option").first().click();
  const status = page.getByRole("combobox", {
    name: "我的学习状态",
    exact: true,
  });
  await status.click();
  const states = page.getByRole("listbox", {
    name: "我的学习状态",
    exact: true,
  });
  await expect(states.getByRole("option")).toHaveCount(3);
  expect(await inViewport()).toBeTruthy();
  await page.screenshot({ path: "docs/research/select-status-fixed.png" });
  await states.getByRole("option", { name: "学习中", exact: true }).click();
  await expect(status).toContainText("学习中");
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/vault?id=${note.id}`)).json()).status,
    )
    .toBe("学习中");
  await expect(status).toBeEnabled();
  await status.click();
  await expect(states).toBeVisible();
  await expect(
    states.getByRole("option", { name: "学习中", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    states.getByRole("option", { name: "已掌握", exact: true }),
  ).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Enter");
  await expect(status).toContainText("已掌握");
  await page.setViewportSize({ width: 390, height: 844 });
  await domain.click();
  await expect(menu).toBeVisible();
  expect(await inViewport()).toBeTruthy();
  await page.screenshot({ path: "docs/research/select-mobile-fixed.png" });
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
