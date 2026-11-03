import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import matter from "gray-matter";
import type { Note, Vault } from "../src/types/knowledge";
const created: string[] = [];
test.afterEach(async ({ request }) => {
  for (const id of created.splice(0))
    await request.delete(`/api/vault?id=${id}`);
});
test("研究笔记的多来源与类型关系经过保存、导出、导入仍然完整", async ({
  request,
}) => {
  const sources = [
    {
      title: "Building effective agents",
      url: "https://www.anthropic.com/research/building-effective-agents",
      publisher: "Anthropic",
      publishedAt: "2024-12-19",
    },
    {
      title: "Attention Is All You Need",
      url: "https://arxiv.org/abs/1706.03762",
      publisher: "Google",
    },
  ];
  const title = `研究验收-${Date.now()}`;
  const response = await request.post("/api/vault", {
    data: {
      title,
      content: "研究 [[AI Agent]]。",
      noteType: "research",
      sources,
      organizations: ["Anthropic"],
      relations: [{ target: "AI Agent", kind: "explains" }],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const note: Note = await response.json();
  created.push(note.id);
  expect(note.sources).toEqual(sources);
  const updated = await (
    await request.post("/api/vault", { data: { ...note, status: "学习中" } })
  ).json();
  expect(updated.sources).toEqual(sources);
  const vault: Vault = await (await request.get("/api/vault")).json();
  const agent = vault.notes.find((n) => n.title === "AI Agent")!;
  expect(vault.edges).toContainEqual({
    source: note.id,
    target: agent.id,
    kind: "explains",
  });
  const org = vault.notes.find((n) => n.title === "Anthropic")!;
  expect(vault.edges).toContainEqual({
    source: note.id,
    target: org.id,
    kind: "publishedBy",
  });
  const zip = await JSZip.loadAsync(
    await (await request.get("/api/export")).body(),
  );
  const file = Object.keys(zip.files).find((p) => p.endsWith(`${title}.md`))!;
  const markdown = await zip.file(file)!.async("string");
  expect(matter(markdown).data.sources).toEqual(sources);
  const imported = await (
    await request.post("/api/import", {
      data: {
        files: [
          {
            name: "roundtrip.md",
            content: markdown.replace(
              `title: ${title}`,
              `title: ${title}-导回`,
            ),
          },
        ],
      },
    })
  ).json();
  expect(imported.errors).toEqual([]);
  expect(imported.imported).toHaveLength(1);
  created.push(...imported.imported);
  const restored = await (
    await request.get(`/api/vault?id=${imported.imported[0]}`)
  ).json();
  expect(restored.sources).toEqual(sources);
  expect(restored.relations).toEqual(note.relations);
  expect(restored.organizations).toEqual(["Anthropic"]);
  const invalid = await request.post("/api/vault", {
    data: {
      title: title + "-坏来源",
      sources: [{ title: "bad", publisher: "bad", url: "javascript:alert(1)" }],
    },
  });
  expect(invalid.status()).toBe(400);
});
test("五家机构的研究通过共用概念交叉连接，每篇都有多个一手来源", async ({
  request,
}) => {
  const vault: Vault = await (await request.get("/api/vault")).json();
  const research = vault.notes.filter((n) => n.noteType === "research");
  expect(research.length).toBeGreaterThanOrEqual(17);
  for (const org of [
    "Anthropic",
    "OpenAI",
    "DeepSeek",
    "Google",
    "Google DeepMind",
  ]) {
    expect(
      vault.notes.some((n) => n.title === org && n.noteType === "organization"),
    ).toBeTruthy();
    expect(research.some((n) => n.organizations?.includes(org))).toBeTruthy();
  }
  for (const n of research) {
    expect(
      new Set(n.sources?.map((s) => s.url)).size,
      n.title,
    ).toBeGreaterThanOrEqual(2);
    expect(
      vault.edges.some((e) => e.source === n.id && e.kind === "publishedBy"),
      n.title,
    ).toBeTruthy();
  }
  const model = vault.notes.find((n) => n.title === "强化学习")!;
  const fromResearch = new Set(
    vault.edges
      .filter(
        (e) => e.target === model.id && research.some((n) => n.id === e.source),
      )
      .map((e) => e.source),
  );
  expect(fromResearch.size).toBeGreaterThanOrEqual(2);
  expect(vault.unresolved).toEqual([]);
});
test("平面拖动、搜索定位、筛选、多来源阅读与移动端形成闭环", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const vault: Vault = await (await request.get("/api/vault")).json();
  await page.goto("/");
  const svg = page.getByLabel("可拖动缩放的平面知识图谱", { exact: true });
  await expect(svg).toBeVisible();
  await expect(page.locator(".page-intro")).toHaveCount(0);
  const box = (await svg.boundingBox())!;
  expect(box.height).toBeGreaterThan(500);
  const transform = await page
    .locator(".graph-stage")
    .getAttribute("transform");
  const before = await page
    .locator('.graph-node[data-note-title="Transformer"]')
    .getAttribute("transform");
  await page.mouse.move(box.x + box.width - 35, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 140, box.y + 150, { steps: 12 });
  await page.mouse.up();
  expect(await page.locator(".graph-stage").getAttribute("transform")).not.toBe(
    transform,
  );
  expect(
    await page
      .locator('.graph-node[data-note-title="Transformer"]')
      .getAttribute("transform"),
  ).toBe(before);
  // Dragging a node changes the spring layout without turning into a canvas pan.
  const node = page.locator('.graph-node[data-note-title="AI Agent"]');
  const nodeBefore = await node.getAttribute("transform");
  const core = (await node.locator(".node-core").boundingBox())!;
  await page.mouse.move(core.x + core.width / 2, core.y + core.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    core.x + core.width / 2 + 50,
    core.y + core.height / 2 - 35,
    { steps: 10 },
  );
  expect(await node.getAttribute("transform")).not.toBe(nodeBefore);
  await page.mouse.up();
  await page
    .getByRole("combobox", { name: "知识类型筛选", exact: true })
    .click();
  await page.getByRole("option", { name: "研究机构", exact: true }).click();
  await expect(page.locator(".graph-node")).toHaveCount(5);
  await page.getByLabel("搜索星图").fill("Transformr");
  const exact = page
    .getByRole("option")
    .filter({ has: page.locator("strong", { hasText: /^Transformer$/ }) });
  await expect(exact).toBeVisible();
  await exact.click();
  await expect(page.locator(".note-preview h2")).toHaveText("Transformer");
  await expect(
    page.getByRole("combobox", { name: "知识类型筛选", exact: true }),
  ).toContainText("全部类型");
  await expect(
    page.locator('.graph-node[data-note-title="Transformer"]'),
  ).toHaveAttribute("data-selected", "true");
  await expect
    .poll(async () =>
      page
        .locator('.graph-node[data-note-title="Transformer"] .node-core')
        .evaluate((el) => {
          const r = el.getBoundingClientRect(),
            svg = el.closest("svg")!.getBoundingClientRect();
          return Math.abs(r.x + r.width / 2 - svg.x - svg.width / 2);
        }),
    )
    .toBeLessThan(3);
  await page.getByLabel("搜索星图").fill("残差");
  await page
    .getByRole("option")
    .filter({ has: page.locator("strong", { hasText: /^残差连接$/ }) })
    .click();
  await expect(page.locator(".note-preview h2")).toHaveText("残差连接");
  await page
    .getByRole("combobox", { name: "知识关系筛选", exact: true })
    .click();
  await page.getByRole("option", { name: "研究解释", exact: true }).click();
  await expect(page.locator(".graph-inline-stats")).not.toContainText("0 关系");
  await page
    .getByRole("combobox", { name: "知识关系筛选", exact: true })
    .click();
  await page.getByRole("option", { name: "全部关系", exact: true }).click();
  await page.getByLabel("清空星图搜索").click();
  await page.screenshot({ path: "docs/research/atlas-flat-research.png" });
  const n = vault.notes.find(
    (n) => n.noteType === "research" && n.organizations?.includes("DeepSeek"),
  )!;
  await page.getByLabel("搜索星图").fill(n.title);
  await page.getByRole("listbox").getByRole("option").first().click();
  await page.getByRole("button", { name: "打开文档", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: n.title, exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("原始文献来源").locator("a")).toHaveCount(
    n.sources!.length,
  );
  await page.screenshot({ path: "docs/research/atlas-research-reading.png" });
  await page.getByRole("button", { name: "返回星图" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(svg).toBeVisible();
  await expect
    .poll(async () =>
      page.locator(".graph-svg").evaluate((el) => {
        const box = el.getBoundingClientRect(),
          nodes = [...el.querySelectorAll(".node-core")];
        return (
          nodes.filter((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.x >= box.x &&
              r.y >= box.y &&
              r.right <= box.right &&
              r.bottom <= box.bottom
            );
          }).length / nodes.length
        );
      }),
    )
    .toBeGreaterThan(0.85);
  await page.getByLabel("搜索星图").fill("注意力");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.screenshot({ path: "docs/research/atlas-flat-mobile.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
