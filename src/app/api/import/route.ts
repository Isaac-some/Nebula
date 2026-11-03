import { NextResponse } from "next/server";
import matter from "gray-matter";
import { allNotes, saveNote, VaultError } from "@/lib/store";
import { assertLocal, fail } from "@/lib/api";
import { normalizeTitle } from "@/lib/links";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertLocal(request);
    const { files } = (await request.json()) as {
      files: { name: string; content: string }[];
    };
    if (!Array.isArray(files) || files.length > 500)
      throw new VaultError("每次最多导入 500 个 Markdown 文件。");
    if (files.reduce((s, f) => s + f.content.length, 0) > 10000000)
      throw new VaultError("每次导入内容请控制在 10 MB 内。");
    const imported: string[] = [],
      skipped: string[] = [],
      errors: string[] = [];
    for (const file of files) {
      try {
        if (!/\.(md|markdown|txt)$/i.test(file.name)) {
          skipped.push(file.name);
          continue;
        }
        const { data, content } = matter(file.content);
        const title = String(
          data.title ||
            content.match(/^# (.+)/m)?.[1] ||
            file.name
              .replace(/\.[^.]+$/, "")
              .split("/")
              .pop(),
        ).trim();
        if (
          allNotes().some(
            (n) => normalizeTitle(n.title) === normalizeTitle(title),
          )
        ) {
          skipped.push(file.name);
          continue;
        }
        const arr = (x: unknown) => (Array.isArray(x) ? x.map(String) : []);
        const note = saveNote({
          title,
          collection: String(data.collection || "我的笔记"),
          content,
          summary: String(
            data.abstract ||
              content
                .replace(/[#*`\[\]]/g, "")
                .split("\n")
                .filter(Boolean)
                .slice(0, 2)
                .join(" ")
                .slice(0, 140),
          ),
          overview: String(data.overview || ""),
          tags: arr(data.tags),
          prerequisites: arr(data.prerequisites),
          aliases: arr(data.aliases),
          source: String(data.source || file.name),
          sources: data.sources,
          noteType: data.noteType,
          organizations: arr(data.organizations),
          relations: data.relations,
          status: ["未开始", "学习中", "已掌握"].includes(data.status)
            ? data.status
            : "未开始",
        });
        imported.push(note.id);
      } catch (e) {
        errors.push(
          `${file.name}：${e instanceof Error ? e.message : "导入失败"}`,
        );
      }
    }
    return NextResponse.json({ imported, skipped, errors });
  } catch (e) {
    return fail(e);
  }
}
