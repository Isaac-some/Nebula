import { NextResponse } from "next/server";
import { indexStatus, startIndex } from "@/lib/semantic";
import { assertLocal, fail } from "@/lib/api";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(indexStatus());
}
export async function POST(request: Request) {
  try {
    assertLocal(request);
    return NextResponse.json(startIndex());
  } catch (e) {
    return fail(e);
  }
}
