import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { relationLabels, type Note } from "@/types/knowledge";
import { normalizeTitle } from "./links";
export const dataDir = path.resolve(
  /* turbopackIgnore: true */ process.env.ATLAS_DATA_DIR ||
    path.join(process.cwd(), "data"),
);
const state = globalThis as unknown as { atlasDb?: DatabaseSync };
function database(): DatabaseSync {
  if (state.atlasDb) return state.atlasDb;
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "atlas.sqlite"));
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY,title TEXT NOT NULL,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS embeddings (note_id TEXT NOT NULL,chunk_key TEXT NOT NULL,model TEXT NOT NULL,text TEXT NOT NULL,level TEXT NOT NULL,vector TEXT NOT NULL,PRIMARY KEY(note_id,chunk_key,model));`);
  state.atlasDb = db;
  seedVault();
  return db;
}
export class VaultError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function allNotes(): Note[] {
  return (
    database().prepare("SELECT data FROM notes ORDER BY title").all() as {
      data: string;
    }[]
  ).map((x) => JSON.parse(x.data));
}
export function getNote(id: string): Note | undefined {
  const row = database()
    .prepare("SELECT data FROM notes WHERE id=?")
    .get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function markdownFile(n: Note) {
  return matter.stringify(n.content, {
    title: n.title,
    id: n.id,
    collection: n.collection,
    abstract: n.summary,
    overview: n.overview,
    tags: n.tags,
    prerequisites: n.prerequisites,
    aliases: n.aliases,
    status: n.status,
    favorite: n.favorite,
    source: n.source,
    sources: n.sources || [],
    noteType: n.noteType || "concept",
    organizations: n.organizations || [],
    relations: n.relations || [],
  });
}
function mirror(n: Note) {
  const folder = path.join(
    dataDir,
    "vault",
    "wiki",
    n.collection.replace(/[^\p{L}\p{N}_ -]/gu, "_"),
  );
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${n.id}.md`);
  fs.writeFileSync(`${file}.tmp`, markdownFile(n));
  fs.renameSync(`${file}.tmp`, file);
}
export function saveNote(
  input: Partial<Note> & { title: string },
  checkRevision = true,
): Note {
  const existing = input.id ? getNote(input.id) : undefined;
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
    allNotes().some(
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
  // ID is generated here, never a user supplied filesystem path.
  database()
    .prepare(
      "INSERT INTO notes(id,title,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,data=excluded.data",
    )
    .run(note.id, note.title, JSON.stringify(note));
  if (
    !existing ||
    existing.content !== note.content ||
    existing.overview !== note.overview ||
    existing.summary !== note.summary ||
    existing.title !== note.title
  )
    database().prepare("DELETE FROM embeddings WHERE note_id=?").run(note.id);
  mirror(note);
  if (existing && existing.collection !== note.collection)
    fs.rmSync(
      path.join(
        dataDir,
        "vault",
        "wiki",
        existing.collection.replace(/[^\p{L}\p{N}_ -]/gu, "_"),
        `${note.id}.md`,
      ),
      { force: true },
    );
  return note;
}
export function deleteNote(id: string) {
  const n = getNote(id);
  if (!n) throw new VaultError("文档不存在。", 404);
  const trash = path.join(dataDir, "trash");
  fs.mkdirSync(trash, { recursive: true });
  fs.writeFileSync(path.join(trash, `${id}-${Date.now()}.md`), markdownFile(n));
  database().prepare("DELETE FROM embeddings WHERE note_id=?").run(id);
  database().prepare("DELETE FROM notes WHERE id=?").run(id);
  const folder = path.join(
    dataDir,
    "vault",
    "wiki",
    n.collection.replace(/[^\p{L}\p{N}_ -]/gu, "_"),
  );
  fs.rmSync(path.join(folder, `${id}.md`), { force: true });
}
export function seedVault() {
  if (
    database()
      .prepare("SELECT value FROM metadata WHERE key='initialized'")
      .get()
  )
    return;
  if (database().prepare("SELECT COUNT(*) AS count FROM notes").get()!.count) {
    database()
      .prepare("INSERT OR REPLACE INTO metadata VALUES('initialized','1')")
      .run();
    return;
  }
  for (const name of [
    "notes.json",
    "research-context.json",
    "research-notes.json",
  ]) {
    const file = path.join(process.cwd(), "seed", name);
    if (fs.existsSync(file))
      for (const note of JSON.parse(fs.readFileSync(file, "utf8")))
        saveNote(note, false);
  }
  database()
    .prepare("INSERT OR REPLACE INTO metadata VALUES('initialized','1')")
    .run();
}
export type EmbeddingRow = {
  note_id: string;
  chunk_key: string;
  model: string;
  text: string;
  level: string;
  vector: string;
};
export function vectorRows(model: string) {
  return database()
    .prepare("SELECT * FROM embeddings WHERE model=?")
    .all(model) as EmbeddingRow[];
}
export function putVector(row: EmbeddingRow, expectedRevision: number) {
  if (getNote(row.note_id)?.revision !== expectedRevision) return;
  database()
    .prepare("INSERT OR REPLACE INTO embeddings VALUES(?,?,?,?,?,?)")
    .run(
      row.note_id,
      row.chunk_key,
      row.model,
      row.text,
      row.level,
      row.vector,
    );
}
