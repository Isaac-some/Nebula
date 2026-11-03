import { NextResponse } from "next/server";
import JSZip from "jszip";
import { allNotes, markdownFile } from "@/lib/store";
import { fail } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const zip = new JSZip(),
      notes = allNotes();
    zip.file(
      "Nebula知识库/.obsidian/app.json",
      JSON.stringify({
        showInlineTitle: true,
        readableLineLength: true,
        newLinkFormat: "shortest",
      }),
    );
    zip.file(
      "Nebula知识库/purpose.md",
      "# 学习目标\n\n从一个知识点进入，连接已有理解与未知领域。\n",
    );
    zip.file(
      "Nebula知识库/wiki/index.md",
      "# 知识索引\n\n" +
        [...new Set(notes.map((n) => n.collection))]
          .map(
            (c) =>
              `## ${c}\n\n` +
              notes
                .filter((n) => n.collection === c)
                .map((n) => `- [[${n.title}]] — ${n.summary}`)
                .join("\n"),
          )
          .join("\n\n"),
    );
    zip.file(
      "Nebula知识库/wiki/.abstract.md",
      `个人知识库，共 ${notes.length} 篇文档。`,
    );
    zip.file(
      "Nebula知识库/wiki/.overview.md",
      "# 概览\n\n" +
        notes.map((n) => `- [[${n.title}]]：${n.summary}`).join("\n"),
    );
    const used = new Set<string>();
    for (const n of notes) {
      let name = n.title.replace(/[/\\:*?"<>|]/g, "_");
      if (used.has(name)) name += `-${n.id.slice(0, 8)}`;
      used.add(name);
      zip.file(
        `Nebula知识库/wiki/${n.collection.replace(/[/\\]/g, "_")}/${name}.md`,
        markdownFile(n),
      );
    }
    return new NextResponse(
      new Uint8Array(await zip.generateAsync({ type: "nodebuffer" })),
      {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": "attachment; filename=nebula-vault.zip",
        },
      },
    );
  } catch (e) {
    return fail(e);
  }
}
