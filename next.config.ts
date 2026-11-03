import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: process.cwd(),
  ...(process.env.NEXT_PUBLIC_NEBULA_BROWSER === "true"
    ? { output: "export" as const, basePath: process.env.PAGES_BASE_PATH || "", trailingSlash: true }
    : {}),
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};
export default nextConfig;
