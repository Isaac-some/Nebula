import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Nebula · 让知识连成星系",
  description: "从一个好奇开始，构建属于你的知识宇宙。文档、双链与学习地图。",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
