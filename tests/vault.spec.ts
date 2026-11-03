import { test, expect } from "@playwright/test";
import JSZip from "jszip";
const prefix = `验收-${Date.now()}`;
const created: string[] = [];
test.afterEach(async ({ request }) => {
  for (const id of created.splice(0))
    await request.delete(`/api/vault?id=${id}`);
});
test("保存、分层读取、链接、重命名、冲突、导入和导出形成闭环", async ({
  request,
}) => {
  const create = async (data: Record<string, unknown>) => {
    const r = await request.post("/api/vault", { data });
    expect(r.ok(), await r.text()).toBeTruthy();
    const note = await r.json();
    created.push(note.id);
    return note;
  };
  const a = await create({
    title: `${prefix}-目标`,
    summary: "一句话摘要",
    overview: "核心概览",
    content: "完整细节",
    aliases: [`${prefix}-别名`],
  });
  const b = await create({
    title: `${prefix}-入口`,
    summary: "入口",
    content: `指向 [[${a.title}]] 和 [[${prefix}-别名|显示名称]]，以及 [[${prefix}-未录入]]。\n\n\`[[不应成为链接]]\``,
    prerequisites: [a.title],
  });
  const l0 = await (await request.get(`/api/vault?id=${a.id}&level=L0`)).json();
  expect(l0).not.toHaveProperty("content");
  expect(l0).not.toHaveProperty("overview");
  const l1 = await (await request.get(`/api/vault?id=${a.id}&level=L1`)).json();
  expect(l1.overview).toBe("核心概览");
  expect(l1).not.toHaveProperty("content");
  let vault = await (await request.get("/api/vault")).json();
  expect(
    vault.edges.filter(
      (e: { source: string; target: string }) =>
        e.source === b.id && e.target === a.id,
    ),
  ).toHaveLength(2);
  expect(vault.unresolved).toContainEqual({
    source: b.id,
    title: `${prefix}-未录入`,
  });
  expect(
    vault.unresolved.some((e: { title: string }) => e.title === "不应成为链接"),
  ).toBeFalsy();
  const renamed = await (
    await request.post("/api/vault", {
      data: { ...a, title: `${prefix}-改名`, status: "已掌握" },
    })
  ).json();
  expect(renamed.aliases).toContain(a.title);
  const conflict = await request.post("/api/vault", {
    data: { ...a, content: "陈旧内容" },
  });
  expect(conflict.status()).toBe(409);
  vault = await (await request.get("/api/vault")).json();
  expect(
    vault.edges.some(
      (e: { source: string; target: string }) =>
        e.source === b.id && e.target === a.id,
    ),
  ).toBeTruthy();
  const forbidden = await request.post("/api/vault", {
    headers: { Origin: "https://outside.example" },
    data: { title: "无权写入" },
  });
  expect(forbidden.status()).toBe(403);
  const imported = await request.post("/api/import", {
    data: {
      files: [
        {
          name: "example.md",
          content: `---\ntitle: ${prefix}-导入\nabstract: 导入摘要\n---\n\n导入 [[${b.title}]]`,
        },
        {
          name: "duplicate.md",
          content: `---\ntitle: ${prefix}-导入\n---\n重复`,
        },
      ],
    },
  });
  const result = await imported.json();
  expect(result.imported).toHaveLength(1);
  expect(result.skipped).toHaveLength(1);
  created.push(...result.imported);
  const found = await (
    await request.get("/api/search", {
      params: { q: `${prefix}-改名`, mode: "keyword" },
    })
  ).json();
  expect(found.hits[0].note.id).toBe(a.id);
  const exported = await request.get("/api/export");
  expect(exported.ok()).toBeTruthy();
  const zip = await JSZip.loadAsync(await exported.body());
  const paths = Object.keys(zip.files);
  expect(paths.some((p) => p.endsWith("/.obsidian/app.json"))).toBeTruthy();
  expect(paths.some((p) => p.endsWith("/wiki/index.md"))).toBeTruthy();
  expect(
    await zip
      .file(paths.find((p) => p.endsWith(`${prefix}-改名.md`))!)!
      .async("string"),
  ).toContain("完整细节");
});
test("浏览器编辑双链、反向链接、检索、学习状态和窄屏", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator(".node-core").first().waitFor();
  await page.getByRole("button", { name: "新建知识点", exact: true }).click();
  await page.getByLabel("知识点标题").fill(`${prefix}-浏览器`);
  await page.getByLabel("L0 · 一句话摘要").fill("验证富文本与双向链接");
  await page.locator(".tiptap").click();
  await page.keyboard.type("A note about [[AI Agent]]");
  await expect(page.locator('.tiptap a[data-wiki="AI Agent"]')).toHaveText(
    "AI Agent",
  );
  expect(await page.locator(".tiptap").innerText()).not.toContain("]]");
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith("/api/vault") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存知识点", exact: true }).click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBeTruthy();
  const note = await response.json();
  created.push(note.id);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "搜索知识", exact: false })
    .first()
    .click();
  await page.getByLabel("搜索知识库").fill(`${prefix}-浏览器`);
  await page
    .locator(".search-hit")
    .filter({ hasText: `${prefix}-浏览器` })
    .click();
  await expect(
    page.getByRole("heading", { name: `${prefix}-浏览器`, exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "学习状态", exact: true }).click();
  await page.getByRole("option", { name: "已掌握", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await (await request.get(`/api/vault?id=${note.id}`)).json()).status,
    )
    .toBe("已掌握");
  await page.locator('.reading-content a[data-wiki="AI Agent"]').click();
  await expect(
    page.getByRole("heading", { name: "AI Agent", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".backlinks")).toContainText(`${prefix}-浏览器`);
  await page.getByRole("button", { name: "L0 一句话" }).click();
  await expect(page.locator(".reading-content")).toContainText(
    "让模型围绕一个目标",
  );
  await page.getByRole("button", { name: "返回星图" }).click();
  await page
    .locator('.graph-node[data-note-title="工具调用"] .node-core')
    .click();
  await expect(page.locator(".note-preview h2")).toHaveText("工具调用");
  await page.getByRole("button", { name: "放大图谱" }).click();
  await expect(page.locator(".graph-controls")).toContainText("120%");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/research/atlas-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "切换侧栏" }).click();
  await page.getByRole("button", { name: "学习路径", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "从知道，到真正理解。" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("本地向量模型能返回措辞不同的相关知识", async ({ request }) => {
  const index = await (await request.get("/api/index")).json();
  test.skip(index.indexed === 0, "需要先运行 setup:model 并在设置中建立索引");
  const result = await (
    await request.get("/api/search", {
      params: { mode: "semantic", q: "怎么找到含义接近的文章" },
    })
  ).json();
  expect(
    result.hits
      .slice(0, 5)
      .map((h: { note: { title: string } }) => h.note.title),
  ).toContain("向量检索");
  expect(result.hits[0].vectorScore).toBeGreaterThan(0.3);
});
