import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Fuse from "fuse.js";
import { allNotes, dataDir, vectorRows, putVector } from "./store";
import { chunks, buildVault } from "./links";
import type { SearchHit } from "@/types/knowledge";
export const MODEL =
  "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
type Extractor = (
  text: string,
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;
type IndexState = {
  state: "idle" | "loading" | "indexing" | "ready" | "error";
  done: number;
  total: number;
  error: string;
  model: string;
};
const globalState = globalThis as unknown as {
  atlasSemantic?: {
    extractor?: Promise<Extractor>;
    job?: Promise<void>;
    status: IndexState;
  };
};
const service = (globalState.atlasSemantic ??= {
  status: { state: "idle", done: 0, total: 0, error: "", model: MODEL },
});
async function extractor() {
  if (!service.extractor)
    service.extractor = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = path.join(dataDir, ".models");
      const local = path.join(dataDir, "models");
      if (
        fs.existsSync(path.join(local, MODEL, "onnx", "model_quantized.onnx"))
      ) {
        env.localModelPath = `${local}/`;
        env.allowRemoteModels = false;
      }
      return (await pipeline(
        "feature-extraction",
        fs.existsSync(path.join(local, MODEL, "onnx", "model_quantized.onnx"))
          ? MODEL
          : "Xenova/paraphrase-multilingual-MiniLM-L12-v2",
        {
          dtype: "q8",
          device: "cpu",
          session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
        },
      )) as unknown as Extractor;
    })().catch((e) => {
      service.extractor = undefined;
      throw e;
    });
  return service.extractor;
}
export async function embed(text: string) {
  const pipe = await extractor();
  return Array.from(
    (await pipe(text, { pooling: "mean", normalize: true })).data,
  );
}
const chunkKey = (text: string) =>
  crypto.createHash("sha256").update(text).digest("hex");
export function indexStatus() {
  const indexed = new Set(vectorRows(MODEL).map((r) => r.note_id));
  return {
    ...service.status,
    indexed: indexed.size,
    documents: allNotes().length,
  };
}
export function startIndex() {
  if (service.job) return indexStatus();
  service.status = {
    state: "loading",
    done: 0,
    total: 0,
    error: "",
    model: MODEL,
  };
  service.job = (async () => {
    const cached = new Set(
      vectorRows(MODEL).map((r) => `${r.note_id}:${r.chunk_key}`),
    );
    const pending = allNotes()
      .flatMap((note) =>
        chunks(note).map((chunk) => ({
          note,
          chunk,
          key: chunkKey(chunk.text),
        })),
      )
      .filter((x) => !cached.has(`${x.note.id}:${x.key}`));
    service.status.total = pending.length;
    if (pending.length) await extractor();
    service.status.state = "indexing";
    for (const { note, chunk, key } of pending) {
      const vector = await embed(chunk.text);
      putVector(
        {
          note_id: note.id,
          chunk_key: key,
          model: MODEL,
          text: chunk.text,
          level: chunk.level,
          vector: JSON.stringify(vector),
        },
        note.revision,
      );
      service.status.done++;
    }
    service.status.state = "ready";
  })()
    .catch((e) => {
      service.status.state = "error";
      service.status.error = `语义模型暂不可用：${e instanceof Error ? e.message : "加载失败"}。可继续使用关键词搜索，或在设置中重试。`;
    })
    .finally(() => {
      service.job = undefined;
    });
  return indexStatus();
}
export async function search(query: string, mode: string, collection?: string) {
  const notes = allNotes().filter(
      (n) => !collection || n.collection === collection,
    ),
    cards = buildVault(notes).notes;
  const hits = new Map<string, SearchHit>();
  if (mode !== "semantic") {
    const fuse = new Fuse(notes, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.42,
      keys: [
        { name: "title", weight: 5 },
        { name: "aliases", weight: 4 },
        { name: "tags", weight: 3 },
        { name: "summary", weight: 2 },
        { name: "overview", weight: 1 },
        { name: "content", weight: 0.5 },
      ],
    });
    const found = fuse.search(query).slice(0, 30);
    for (let i = 0; i < found.length; i++) {
      const r = found[i],
        n = r.item;
      const lower = query.toLocaleLowerCase();
      const level = [n.title, n.summary, ...n.aliases, ...n.tags].some((s) =>
        s.toLocaleLowerCase().includes(lower),
      )
        ? "L0"
        : n.overview.toLocaleLowerCase().includes(lower)
          ? "L1"
          : "L2";
      hits.set(n.id, {
        note: cards.find((c) => c.id === n.id)!,
        score: 1 / (60 + i),
        matchedLevel: level,
        excerpt: (level === "L2"
          ? n.content
          : level === "L1"
            ? n.overview
            : n.summary
        ).slice(0, 200),
      });
    }
  }
  let warning = "";
  if (mode !== "keyword") {
    const rows = vectorRows(MODEL).filter((r) =>
      cards.some((n) => n.id === r.note_id),
    );
    if (!rows.length)
      warning =
        mode === "semantic"
          ? "语义索引尚未建立，请在设置中建立索引。"
          : "语义索引尚未建立，当前展示关键词结果。可在设置中建立索引。";
    else {
      try {
        const q = await embed(query),
          best = new Map<
            string,
            { score: number; row: (typeof rows)[number] }
          >();
        for (const row of rows) {
          const v = JSON.parse(row.vector) as number[];
          const score = q.reduce((s, x, i) => s + x * (v[i] || 0), 0);
          if (score > (best.get(row.note_id)?.score ?? -1))
            best.set(row.note_id, { score, row });
        }
        const ranked = [...best.entries()]
          .filter(([, v]) => v.score > 0.18)
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, 30);
        ranked.forEach(([id, v], i) => {
          const existing = hits.get(id);
          hits.set(id, {
            note: cards.find((c) => c.id === id)!,
            score: (existing?.score || 0) + 1 / (60 + i),
            vectorScore: v.score,
            matchedLevel: v.row.level,
            excerpt: v.row.text.slice(0, 220),
          });
        });
        if (new Set(rows.map((r) => r.note_id)).size < cards.length)
          warning = "部分文档尚未建立语义索引，请更新索引以覆盖新内容。";
      } catch (e) {
        warning = `语义检索暂不可用。${e instanceof Error ? e.message : ""}`;
      }
    }
  }
  return {
    hits: [...hits.values()].sort((a, b) => b.score - a.score).slice(0, 30),
    warning,
  };
}
