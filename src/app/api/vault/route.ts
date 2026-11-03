import { NextResponse } from "next/server";
import {
  allNotes,
  getNote,
  saveNote,
  deleteNote,
  VaultError,
} from "@/lib/store";
import { buildVault, noteCard } from "@/lib/links";
import { assertLocal, fail } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      id = url.searchParams.get("id");
    if (!id) return NextResponse.json(buildVault(allNotes()));
    const note = getNote(id);
    if (!note) throw new VaultError("文档不存在。", 404);
    const level = url.searchParams.get("level");
    if (level === "L0") return NextResponse.json(noteCard(note));
    if (level === "L1")
      return NextResponse.json({ ...noteCard(note), overview: note.overview });
    return NextResponse.json(note);
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  try {
    assertLocal(request);
    return NextResponse.json(saveNote(await request.json()));
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(request: Request) {
  try {
    assertLocal(request);
    deleteNote(new URL(request.url).searchParams.get("id") || "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
