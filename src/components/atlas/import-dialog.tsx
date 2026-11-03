"use client";
import { useState } from "react";
import { Copy, Download, Upload, X } from "lucide-react";
import Modal from "./modal";

export default function ImportDialog({ onClose, onChoose }: {
  onClose: () => void;
  onChoose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const resource = (file: string) => new URL(`skills/nebula-markdown/${file}`, window.location.href);
  const read = async (file: string) => {
    const response = await fetch(resource(file));
    if (!response.ok) throw Error("格式文件暂时无法读取，请稍后重试。");
    return response.text();
  };
  const deliver = async (file: string, copy = false) => {
    setBusy(true);
    try {
      const text = await read(file);
      if (copy) {
        await navigator.clipboard.writeText(text);
        setMessage("Skill 已复制，可直接发给模型，再附上需要整理的资料。");
      } else {
        const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = file;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        setMessage(file === "SKILL.md" ? "已下载 SKILL.md，可交给模型或放入 nebula-markdown 技能文件夹。" : "已下载示例，可参照修改或直接导入体验。");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，可尝试下载 Skill。");
    } finally { setBusy(false); }
  };
  return (
    <Modal onClose={onClose} className="settings-modal import-modal">
      <header>
        <div><span className="eyebrow">MARKDOWN TO KNOWLEDGE</span><h2>导入 Markdown</h2></div>
        <button className="icon-button" aria-label="关闭导入" onClick={onClose}><X size={19} /></button>
      </header>
      <div className="settings-body">
        <section>
          <h3>先让模型按 Nebula 格式整理</h3>
          <p>把这份 Skill 和原始资料一起交给模型，请它生成 Markdown 文件。Skill 包含摘要、概览、分类、前置知识、双链和来源的填写规则。</p>
          <div className="settings-actions">
            <button className="secondary" disabled={busy} onClick={() => void deliver("SKILL.md", true)}><Copy size={15} />复制 Skill</button>
            <button className="secondary" disabled={busy} onClick={() => void deliver("SKILL.md")}><Download size={15} />下载 Skill</button>
            <button className="secondary" disabled={busy} onClick={() => void deliver("example.md")}><Download size={15} />下载格式示例</button>
          </div>
          <small className="quiet">这里只提供写作规范，不会调用模型，也不会上传你的资料。已有 Markdown 可以直接导入。</small>
        </section>
        <section>
          <h3>选择生成好的文件</h3>
          <p>支持 .md / .markdown / .txt，每次最多 500 篇、合计 10 MB。同名文档会跳过，保留已有内容。</p>
          <button className="primary" onClick={onChoose}><Upload size={15} />选择 Markdown 文件</button>
        </section>
        {message && <p role="status">{message}</p>}
      </div>
    </Modal>
  );
}
