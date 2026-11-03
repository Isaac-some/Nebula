import { NextResponse } from "next/server";
import { VaultError } from "./store";
export function fail(error: unknown) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "操作失败，请重试。" },
    { status: error instanceof VaultError ? error.status : 500 },
  );
}
export function assertLocal(request: Request) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !==
      (request.headers.get("host") || new URL(request.url).host)
  )
    throw new VaultError("不接受来自其他网站的修改请求。", 403);
}
