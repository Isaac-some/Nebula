import { test, expect, type Page } from "@playwright/test";
const node = (page: Page, title: string) =>
  page.locator(`.graph-node[data-note-title="${title}"]`);
const point = async (page: Page, title: string) => {
  const b = (await node(page, title).locator(".node-core").boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width / 2 };
};
test("没有默认高亮；悬浮移开、取消选择和刷新均能回到中性全图", async ({
  page,
}) => {
  await page.goto("/");
  await expect(node(page, "AI Agent")).toBeVisible();
  const selected = page.locator('.graph-node[data-selected="true"]'),
    lit = page.locator('.graph-link[data-highlighted="true"]');
  await expect(selected).toHaveCount(0);
  await expect(lit).toHaveCount(0);
  await node(page, "AI Agent").locator(".node-core").hover();
  await expect(lit.first()).toBeVisible();
  await page.mouse.move(290, 200);
  await expect(lit).toHaveCount(0);
  await node(page, "AI Agent").locator(".node-core").click();
  await expect(selected).toHaveCount(1);
  await node(page, "强化学习").locator(".node-core").hover();
  expect(
    await page.locator('.node-ring[opacity="0.95"]').count(),
  ).toBeLessThanOrEqual(1);
  await page.mouse.move(290, 200);
  await page.getByLabel("清除聚焦", { exact: true }).click();
  await expect(selected).toHaveCount(0);
  await expect(lit).toHaveCount(0);
  await page.reload();
  await expect(node(page, "AI Agent")).toBeVisible();
  await expect(selected).toHaveCount(0);
  await expect(lit).toHaveCount(0);
});

test("拖入另一节点时对方实时让位，关联节点跟随，松手后继续缓动且不误选", async ({
  page,
}) => {
  await page.goto("/");
  await expect(node(page, "AI Agent")).toBeVisible();
  const a = await point(page, "AI Agent"),
    b = await point(page, "RAG"),
    neighbor = await point(page, "工具调用");
  const camera = await page.locator(".graph-stage").getAttribute("transform");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.waitForTimeout(150);
  const held = await point(page, "AI Agent"),
    avoiding = await point(page, "RAG"),
    following = await point(page, "工具调用");
  expect(Math.hypot(avoiding.x - b.x, avoiding.y - b.y)).toBeGreaterThan(4);
  expect(Math.hypot(held.x - avoiding.x, held.y - avoiding.y)).toBeGreaterThan(
    held.r + avoiding.r + 3,
  );
  expect(
    Math.hypot(following.x - neighbor.x, following.y - neighbor.y),
  ).toBeGreaterThan(1);
  await expect(node(page, "AI Agent")).toHaveAttribute("data-dragged", "true");
  await expect(page.locator('.graph-node[data-hovered="true"]')).toHaveCount(0);
  await page.screenshot({ path: "docs/research/drag-live-avoidance.png" });
  expect(await page.locator(".graph-stage").getAttribute("transform")).toBe(
    camera,
  );
  await page.mouse.up();
  await page.mouse.move(290, 200);
  const release = await point(page, "AI Agent");
  await expect
    .poll(
      async () => {
        const p = await point(page, "AI Agent");
        return Math.hypot(p.x - release.x, p.y - release.y);
      },
      { timeout: 2000 },
    )
    .toBeGreaterThan(3);
  await expect(page.locator('.graph-node[data-selected="true"]')).toHaveCount(
    0,
  );
  await expect(
    page.locator('.graph-link[data-highlighted="true"]'),
  ).toHaveCount(0);
});
