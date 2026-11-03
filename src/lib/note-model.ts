import { relationLabels, type Note } from "@/types/knowledge";
import { normalizeTitle } from "./links";
export class VaultError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function prepareNote(input: Partial<Note> & { title: string }, notes: Note[], checkRevision = true): Note {
  const existing = input.id ? notes.find((n) => n.id === input.id) : undefined;
  if (typeof input.title !== "string")
    throw new VaultError("请填写知识点标题。");
  for (const key of [
    "content",
    "summary",
    "overview",
    "collection",
    "source",
  ] as const)
    if (input[key] !== undefined && typeof input[key] !== "string")
      throw new VaultError("文档字段格式不正确。");
  for (const key of [
    "tags",
    "aliases",
    "prerequisites",
    "organizations",
  ] as const)
    if (
      input[key] !== undefined &&
      (!Array.isArray(input[key]) ||
        input[key]!.some((x) => typeof x !== "string"))
    )
      throw new VaultError("标签、别名和前置知识应为文本列表。");
  if (
    input.noteType &&
    !["concept", "research", "organization"].includes(input.noteType)
  )
    throw new VaultError("无效的文档类型。");
  if (
    input.sources !== undefined &&
    (!Array.isArray(input.sources) ||
      input.sources.length > 50 ||
      input.sources.some(
        (s) =>
          !s ||
          typeof s.title !== "string" ||
          typeof s.publisher !== "string" ||
          typeof s.url !== "string" ||
          !/^https?:\/\//i.test(s.url) ||
          (s.publishedAt !== undefined &&
            (typeof s.publishedAt !== "string" ||
              !/^\d{4}-\d{2}-\d{2}$/.test(s.publishedAt))),
      ))
  )
    throw new VaultError("来源需要包含标题、机构和有效的网页链接。");
  if (
    input.relations !== undefined &&
    (!Array.isArray(input.relations) ||
      input.relations.length > 100 ||
      input.relations.some(
        (r) =>
          !r ||
          typeof r.target !== "string" ||
          !Object.hasOwn(relationLabels, r.kind) ||
          ["link", "prerequisite", "publishedBy"].includes(r.kind),
      ))
  )
    throw new VaultError("知识关系格式不正确。");
  const title = input.title.trim();
  if (!title || title.length > 180)
    throw new VaultError("标题需要填写，且不能超过 180 个字。");
  if (
    notes.some(
      (n) =>
        n.id !== input.id &&
        [n.title, ...n.aliases].some(
          (name) => normalizeTitle(name) === normalizeTitle(title),
        ),
    )
  )
    throw new VaultError("标题与已有文档或别名重复，请换一个名字。", 409);
  if (existing && checkRevision && input.revision !== existing.revision)
    throw new VaultError(
      "这篇文档已在其他页面更新。请保留当前内容并重新打开后再保存。",
      409,
    );
  const now = new Date().toISOString();
  const note: Note = {
    id: existing?.id || crypto.randomUUID(),
    title,
    collection: input.collection || "我的笔记",
    summary: input.summary || "",
    overview: input.overview || "",
    content: input.content || "",
    tags: input.tags || [],
    prerequisites: input.prerequisites || [],
    aliases: [
      ...new Set([
        ...(input.aliases || []),
        ...(existing && existing.title !== title ? [existing.title] : []),
      ]),
    ],
    status: input.status || "未开始",
    favorite: input.favorite || false,
    source: input.source || "",
    sources: input.sources ?? existing?.sources ?? [],
    noteType: input.noteType ?? existing?.noteType ?? "concept",
    organizations: input.organizations ?? existing?.organizations ?? [],
    relations: input.relations ?? existing?.relations ?? [],
    updatedAt: now,
    revision: (existing?.revision || 0) + 1,
  };
  if (
    note.content.length > 500000 ||
    note.overview.length > 50000 ||
    note.summary.length > 2000
  )
    throw new VaultError(
      "文档过大：全文最多 50 万字，概览 5 万字，摘要 2000 字。",
    );
  if (!["未开始", "学习中", "已掌握"].includes(note.status))
    throw new VaultError("无效的学习状态。");
  return note;
}
