import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
};
export default nextConfig;
