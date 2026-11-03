import { test, expect, type Page } from "@playwright/test";

const node = (page: Page, title: string) =>
  page.locator(`.graph-node[data-note-title="${title}"]`);
const core = (page: Page, title: string) =>
  node(page, title).locator(".node-core");
async function labels(page: Page) {
  return page.locator(".graph-svg").evaluate((svg) => {
    const visible = [...svg.querySelectorAll<SVGTextElement>(".node-label")]
      .filter((e) => Number(e.getAttribute("opacity")) > 0.2)
      .map((e) => ({ title: e.textContent, rect: e.getBoundingClientRect() }));
    let overlaps = 0;
    for (let i = 0; i < visible.length; i++)
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i].rect,
          b = visible[j].rect;
        if (
          Math.min(a.right, b.right) - Math.max(a.x, b.x) > 2 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 2
        )
          overlaps++;
      }
    return {
      count: visible.length,
      overlaps,
      heights: visible.map((e) => e.rect.height),
    };
  });
}
async function spread(page: Page) {
  return page.locator(".graph-stage").evaluate((stage) => {
    const points = [...stage.querySelectorAll(".graph-node")].map((e) => {
      const [x, y] = e
        .getAttribute("transform")!
        .slice(10, -1)
        .split(",")
        .map(Number);
      return { x, y };
    });
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length,
      cy = points.reduce((s, p) => s + p.y, 0) / points.length;
    return (
      points.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) /
      points.length
    );
  });
}

test("图谱按缩放分层显示文字，悬浮临时突出关系，点击、拖动和双击各自完成操作", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(core(page, "AI Agent")).toBeVisible();
  await core(page, "AI Agent").hover();
  const initial = await labels(page);
  expect(initial.count).toBeGreaterThan(10);
  expect(initial.count).toBeLessThan(40);
  expect(initial.overlaps).toBe(0);
  expect(
    Math.max(...initial.heights) - Math.min(...initial.heights),
  ).toBeGreaterThan(4);
  await page.mouse.move(290, 200);
  const scene = await page.locator(".graph-stage").getAttribute("transform");
  await core(page, "强化学习").hover();
  await expect(page.getByRole("tooltip")).toContainText("强化学习");
  await expect(node(page, "强化学习")).toHaveAttribute("data-hovered", "true");
  const highlighted = page.locator('.graph-link[data-highlighted="true"]');
  expect(await highlighted.count()).toBeGreaterThan(2);
  expect(
    await page.locator('.graph-link[data-highlighted="false"]').count(),
  ).toBeGreaterThan(10);
  await expect(highlighted.first()).toHaveAttribute("stroke-opacity", "0.9");
  await page.screenshot({ path: test.info().outputPath("graph-gravity-hover.png") });
  await page.mouse.move(290, 200);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(highlighted).toHaveCount(0);
  await core(page, "强化学习").click();
  await expect(page.locator(".note-preview h2")).toHaveText("强化学习");
  await page.mouse.move(290, 200);
  await expect(node(page, "强化学习")).toHaveAttribute("data-selected", "true");
  expect(await highlighted.count()).toBeGreaterThan(2);
  // Selecting a node keeps it under the pointer, allowing a deliberate double click.
  expect(await page.locator(".graph-stage").getAttribute("transform")).toBe(
    scene,
  );
  await page.screenshot({ path: test.info().outputPath("graph-gravity-selected.png") });
  const before = await node(page, "强化学习").getAttribute("transform");
  const b = (await core(page, "强化学习").boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 55, b.y + b.height / 2 - 30, {
    steps: 12,
  });
  expect(await node(page, "强化学习").getAttribute("transform")).not.toBe(
    before,
  );
  expect(await page.locator(".graph-stage").getAttribute("transform")).toBe(
    scene,
  );
  await page.mouse.up();
  await expect(page.locator(".note-preview h2")).toHaveText("强化学习");
  await page.reload();
  await expect(core(page, "AI Agent")).toBeVisible();
  await page.getByLabel("放大图谱", { exact: true }).click();
  await core(page, "AI Agent").hover();
  const zoomed = await labels(page);
  expect(zoomed.count).toBeGreaterThan(initial.count);
  expect(zoomed.overlaps).toBe(0);
  expect(Math.max(...zoomed.heights)).toBeGreaterThan(
    Math.max(...initial.heights),
  );
  await page.screenshot({ path: test.info().outputPath("graph-gravity-zoom.png") });
  await page.getByLabel("查看全图", { exact: true }).click();
  await core(page, "强化学习").dblclick({ delay: 130 });
  await expect(
    page.getByRole("heading", { name: "强化学习", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".graph-svg")).toHaveCount(0);
  await page.getByRole("button", { name: "返回星图", exact: true }).click();
  await page.locator(".graph-svg").focus();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("清除聚焦", { exact: true })).toBeDisabled();
  await page.keyboard.press("+");
  await expect(page.locator(".graph-controls")).toContainText("120%");
  await page.keyboard.press("ArrowRight");
  const moved = await page.locator(".graph-stage").getAttribute("transform");
  await page.keyboard.press("ArrowLeft");
  expect(await page.locator(".graph-stage").getAttribute("transform")).not.toBe(
    moved,
  );
  await page.getByLabel("沉浸模式", { exact: true }).click();
  await expect(page.getByLabel("退出沉浸模式", { exact: true })).toBeVisible();
  await page.getByLabel("退出沉浸模式", { exact: true }).click();
  expect(errors).toEqual([]);
});

test("力度改变实际间距且保留视角，文字与节点外观可以调整并在刷新后保留", async ({
  page,
}) => {
  await page.goto("./");
  await expect(core(page, "AI Agent")).toBeVisible();
  await page.getByLabel("图谱设置", { exact: true }).click();
  const panel = page.getByRole("region", { name: "图谱显示与力度设置" });
  await expect(panel.getByRole("slider")).toHaveCount(7);
  const set = async (id: string, value: string) => {
    await page.locator(`#graph-${id}`).fill(value);
  };
  // Leave the camera fixed: repulsion changes the actual geometry, not an automatic fit.
  await set("repelForce", "0");
  const original = await spread(page);
  await expect
    .poll(() => spread(page), { timeout: 8000 })
    .toBeLessThan(original * 0.85);
  await page.waitForTimeout(1500);
  const compact = await spread(page),
    camera = await page.locator(".graph-stage").getAttribute("transform");
  await set("repelForce", "20");
  await expect
    .poll(() => spread(page), { timeout: 8000 })
    .toBeGreaterThan(compact * 1.2);
  expect(await page.locator(".graph-stage").getAttribute("transform")).toBe(
    camera,
  );
  await set("centerForce", "0.3");
  await set("linkForce", "0.5");
  await set("linkDistance", "350");
  await set("lineWidth", "1.5");
  await expect(
    page.locator('.graph-link[data-highlighted="false"]').first(),
  ).toHaveAttribute("stroke-width", "1.5");
  const radius = Number(await core(page, "AI Agent").getAttribute("r"));
  await set("nodeSize", "1.5");
  await expect
    .poll(async () => Number(await core(page, "AI Agent").getAttribute("r")))
    .toBeCloseTo(radius * 1.5);
  await set("labelDensity", "0.15");
  const low = await labels(page);
  await set("labelDensity", "1.4");
  await expect
    .poll(async () => (await labels(page)).count)
    .toBeGreaterThan(low.count);
  await page.screenshot({ path: test.info().outputPath("graph-gravity-settings.png") });
  await page.reload();
  await page.getByLabel("图谱设置", { exact: true }).click();
  await expect(page.locator("#graph-repelForce")).toHaveValue("20");
  await expect(page.locator("#graph-centerForce")).toHaveValue("0.3");
  await expect(page.locator("#graph-linkForce")).toHaveValue("0.5");
  await expect(page.locator("#graph-linkDistance")).toHaveValue("350");
  await expect(page.locator("#graph-lineWidth")).toHaveValue("1.5");
  await expect(page.locator("#graph-nodeSize")).toHaveValue("1.5");
  await expect(page.locator("#graph-labelDensity")).toHaveValue("1.4");
  await page.getByRole("button", { name: "恢复默认", exact: true }).click();
  await expect(page.locator("#graph-repelForce")).toHaveValue("12");
  await expect(page.locator("#graph-labelDensity")).toHaveValue("0.65");
  await page.getByLabel("关闭图谱设置", { exact: true }).click();
  await expect(panel).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("图谱设置", { exact: true }).click();
  await expect(page.locator("#graph-repelForce")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("graph-gravity-mobile.png") });
});
