export const browserDemo = process.env.NEXT_PUBLIC_NEBULA_BROWSER === "true";

export async function vaultRequest(url: string, init?: RequestInit): Promise<Response> {
  if (!browserDemo) return fetch(url, init);
  const { browserRequest } = await import("./browser-vault");
  return browserRequest(url, init);
}
