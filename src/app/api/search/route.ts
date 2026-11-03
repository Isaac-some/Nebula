import { NextResponse } from "next/server";
import { search } from "@/lib/semantic";
import { fail } from "@/lib/api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    const q = p.get("q")?.trim().slice(0, 300);
    if (!q) return NextResponse.json({ hits: [], warning: "" });
    return NextResponse.json(
      await search(
        q,
        p.get("mode") || "hybrid",
        p.get("collection") || undefined,
      ),
    );
  } catch (e) {
    return fail(e);
  }
}
