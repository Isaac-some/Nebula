"use client";
import { vaultRequest } from "@/lib/client-vault";
import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Node, mergeAttributes, nodeInputRule } from "@tiptap/core";
import TurndownService from "turndown";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading2,
  Link2,
  Undo2,
  Redo2,
  X,
  Check,
  ChevronDown,
  FileText,
} from "lucide-react";
import type { Note, NoteCard } from "@/types/knowledge";
import { toHtml } from "@/lib/markdown";
import Modal from "./modal";
const WikiLink = Node.create({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,
  addAttributes() {
    return { title: { default: "" }, label: { default: "" } };
  },
  parseHTML() {
    return [
      {
        tag: "a[data-wiki]",
        getAttrs: (el) => ({
          title: (el as HTMLElement).dataset.wiki,
          label: (el as HTMLElement).textContent,
        }),
      },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-wiki": node.attrs.title,
        href: "#wiki",
        class: "wiki-link",
      }),
      node.attrs.label || node.attrs.title,
    ];
  },
  addInputRules() {
    return [
      nodeInputRule({
        find: /(\[\[[^\]\n]+\]\])$/,
        type: this.type,
        getAttributes: (match) => {
          const [title, label] = match[1].slice(2, -2).split("|");
          return { title: title.trim(), label: label || title };
        },
      }),
    ];
  },
});
const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
td.addRule("wiki", {
  filter: (node) => node.nodeName === "A" && node.hasAttribute("data-wiki"),
  replacement: (content, node) => {
    const title = (node as HTMLElement).getAttribute("data-wiki");
    return `[[${title}${content !== title ? "|" + content : ""}]]`;
  },
});
export default function Editor({
  note,
  notes,
  initialTitle = "",
  onClose,
  onSaved,
}: {
  note: Note | null;
  notes: NoteCard[];
  initialTitle?: string;
  onClose: () => void;
  onSaved: (note: Note) => void;
}) {
  const draftKey = `atlas-draft-${note?.id || "new"}`;
  const [draft] = useState(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      return saved.baseRevision === (note?.revision || 0)
        ? (saved as {
            title: string;
            summary: string;
            overview: string;
            collection: string;
            prerequisites: string[];
            tags: string;
            aliases: string;
            content: string;
          })
        : null;
    } catch {
      return null;
    }
  });
  const [title, setTitle] = useState(
      draft?.title || note?.title || initialTitle,
    ),
    [summary, setSummary] = useState(draft?.summary || note?.summary || ""),
    [overview, setOverview] = useState(draft?.overview || note?.overview || ""),
    [collection, setCollection] = useState(
      draft?.collection || note?.collection || "我的笔记",
    ),
    [prerequisites, setPrerequisites] = useState(
      draft?.prerequisites || note?.prerequisites || [],
    ),
    [tags, setTags] = useState(draft?.tags || note?.tags.join("，") || ""),
    [aliases, setAliases] = useState(
      draft?.aliases || note?.aliases.join("，") || "",
    );
  const [metadata, setMetadata] = useState(!note),
    [linkInput, setLinkInput] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(!!draft),
    [charCount, setCharCount] = useState(
      (draft?.content || note?.content || "").length,
    );
  const contentRef = useRef(draft?.content || note?.content || "");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
        heading: { levels: [2, 3] },
      }),
      WikiLink,
      Placeholder.configure({
        placeholder: "把你的理解写下来。输入 [[知识点]]，让想法产生连接…",
      }),
    ],
    immediatelyRender: false,
    content: toHtml(draft?.content || note?.content || ""),
    onUpdate: ({ editor }) => {
      contentRef.current = td.turndown(editor.getHTML());
      setCharCount(contentRef.current.length);
      setDirty(true);
    },
  });
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          title,
          summary,
          overview,
          collection,
          prerequisites,
          tags,
          aliases,
          content: contentRef.current,
          baseRevision: note?.revision || 0,
        }),
      );
    }, 300);
    return () => clearTimeout(id);
  }, [
    title,
    summary,
    overview,
    collection,
    prerequisites,
    tags,
    aliases,
    dirty,
    editor?.state.doc,
    draftKey,
    note?.revision,
  ]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const close = () => {
    if (
      !dirty ||
      window.confirm(
        "内容还没有保存到知识库。关闭编辑器？草稿会保留在此浏览器。",
      )
    )
      onClose();
  };
  const save = async () => {
    if (!title.trim()) {
      setError("先给这个知识点起一个名字。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await vaultRequest("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...note,
          title,
          summary,
          overview,
          collection,
          prerequisites,
          tags: tags
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
          aliases: aliases
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean),
          content: contentRef.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      localStorage.removeItem(draftKey);
      setDirty(false);
      onSaved(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const change =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      fn(v);
      setDirty(true);
    };
  return (
    <Modal onClose={close} className="editor-modal">
      <header className="editor-header">
        <span>
          <FileText size={16} />
          {note ? "编辑知识点" : "记录一个新想法"}
        </span>
        <div>
          <span className="quiet">
            {draft
              ? "已恢复本地草稿"
              : dirty
                ? "草稿未保存"
                : "支持 Markdown 与双链"}
          </span>
          <button className="primary small" disabled={busy} onClick={save}>
            <Check size={15} />
            {busy ? "保存中…" : "保存知识点"}
          </button>
          <button
            className="icon-button"
            aria-label="关闭编辑器"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="editor-scroll">
        <div className="editor-paper">
          <label className="sr-only" htmlFor="note-title">
            知识点标题
          </label>
          <input
            id="note-title"
            className="title-input"
            autoFocus
            value={title}
            placeholder="给这个知识点起个名字"
            onChange={(e) => change(setTitle)(e.target.value)}
          />
          <label className="field-label" htmlFor="note-summary">
            L0 · 一句话摘要
          </label>
          <textarea
            id="note-summary"
            className="summary-input"
            value={summary}
            placeholder="它是什么？用一句话说清楚。"
            rows={2}
            onChange={(e) => change(setSummary)(e.target.value)}
          />
          <button
            className="metadata-toggle"
            onClick={() => setMetadata(!metadata)}
          >
            <ChevronDown
              size={14}
              style={{ transform: metadata ? "rotate(180deg)" : undefined }}
            />
            {metadata ? "收起文档属性" : "概览、前置知识与文档属性"}
          </button>
          {metadata && (
            <div className="metadata-form">
              <label>
                所属文档集
                <input
                  value={collection}
                  onChange={(e) => change(setCollection)(e.target.value)}
                  list="collections"
                />
              </label>
              <datalist id="collections">
                {[
                  ...new Set([...notes.map((n) => n.collection), "我的笔记"]),
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
              <label>
                标签（逗号分隔）
                <input
                  value={tags}
                  onChange={(e) => change(setTags)(e.target.value)}
                />
              </label>
              <label className="wide">
                别名（逗号分隔，也可用于双链）
                <input
                  value={aliases}
                  onChange={(e) => change(setAliases)(e.target.value)}
                />
              </label>
              <label className="wide">
                前置知识 · 建议先学
                <select
                  value=""
                  onChange={(e) => {
                    if (
                      e.target.value &&
                      !prerequisites.includes(e.target.value)
                    )
                      change(setPrerequisites)([
                        ...prerequisites,
                        e.target.value,
                      ]);
                  }}
                >
                  <option value="">选择已有知识点…</option>
                  {notes
                    .filter((n) => n.id !== note?.id && n.title !== title)
                    .map((n) => (
                      <option key={n.id}>{n.title}</option>
                    ))}
                </select>
              </label>
              <div className="chip-list wide">
                {prerequisites.map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      change(setPrerequisites)(
                        prerequisites.filter((x) => x !== p),
                      )
                    }
                  >
                    {p}
                    <X size={12} />
                  </button>
                ))}
              </div>
              <label className="wide">
                L1 · 核心概览（支持 Markdown）
                <textarea
                  value={overview}
                  rows={5}
                  placeholder="关键内容、使用场景与边界…"
                  onChange={(e) => change(setOverview)(e.target.value)}
                />
              </label>
            </div>
          )}
          <div className="editor-toolbar" role="toolbar" aria-label="文本格式">
            <button
              title="二级标题"
              aria-label="二级标题"
              className={editor?.isActive("heading") ? "active" : ""}
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
            >
              <Heading2 size={17} />
            </button>
            <i />
            <button
              aria-label="加粗"
              className={editor?.isActive("bold") ? "active" : ""}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold size={16} />
            </button>
            <button
              aria-label="斜体"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic size={16} />
            </button>
            <i />
            <button
              aria-label="无序列表"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List size={17} />
            </button>
            <button
              aria-label="有序列表"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered size={17} />
            </button>
            <button
              aria-label="引用"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <Quote size={16} />
            </button>
            <button
              aria-label="代码块"
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            >
              <Code size={17} />
            </button>
            <i />
            <button
              aria-label="插入双链"
              onClick={() => setLinkInput(linkInput === null ? "" : null)}
            >
              <Link2 size={17} />
            </button>
            <div className="toolbar-spacer" />
            <button
              aria-label="撤销"
              onClick={() => editor?.chain().focus().undo().run()}
            >
              <Undo2 size={16} />
            </button>
            <button
              aria-label="重做"
              onClick={() => editor?.chain().focus().redo().run()}
            >
              <Redo2 size={16} />
            </button>
          </div>
          {linkInput !== null && (
            <div className="inline-link">
              <label htmlFor="wiki-target">双链目标</label>
              <input
                id="wiki-target"
                autoFocus
                list="wiki-titles"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="知识点标题"
              />
              <datalist id="wiki-titles">
                {notes.map((n) => (
                  <option key={n.id}>{n.title}</option>
                ))}
              </datalist>
              <button
                className="primary small"
                onClick={() => {
                  if (linkInput.trim()) {
                    editor
                      ?.chain()
                      .focus()
                      .insertContent({
                        type: "wikiLink",
                        attrs: {
                          title: linkInput.trim(),
                          label: linkInput.trim(),
                        },
                      })
                      .run();
                    setLinkInput(null);
                  }
                }}
              >
                插入
              </button>
            </div>
          )}
          <EditorContent editor={editor} className="prose editor-content" />
          <footer className="editor-foot">
            <span>L2 · 完整内容</span>
            <span>{charCount} 字 · ⌘S 保存</span>
          </footer>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
