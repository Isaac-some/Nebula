"use client";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  BookOpen,
  Link2,
  Check,
  PenLine,
  Star,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  relationLabels,
  type Note,
  type NoteCard,
  type Vault,
} from "@/types/knowledge";
import { toHtml } from "@/lib/markdown";
import AtlasSelect from "./select";
export default function Reader({
  id,
  vault,
  onOpen,
  onEdit,
  onUpdate,
  onCreate,
  onBack,
  onDelete,
}: {
  id: string;
  vault: Vault;
  onOpen: (id: string) => void;
  onEdit: (note: Note) => void;
  onUpdate: (note: Note) => void;
  onCreate: (title: string) => void;
  onBack: () => void;
  onDelete: (id: string) => void;
}) {
  const [note, setNote] = useState<Note | null>(null),
    [level, setLevel] = useState("L2"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/vault?id=${id}&level=${level}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        if (active) setNote(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, level, vault]);
  const openTitle = (title: string) => {
    const t = title.split("#")[0];
    const n = vault.notes.find(
      (n) =>
        n.title.toLocaleLowerCase() === t.toLocaleLowerCase() ||
        n.aliases.some((a) => a.toLocaleLowerCase() === t.toLocaleLowerCase()),
    );
    if (n) onOpen(n.id);
    else onCreate(t);
  };
  const update = async (patch: Partial<Note>) => {
    if (!note) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/vault?id=${id}`);
      const full = await response.json();
      if (!response.ok) throw Error(full.error);
      const r = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...full, ...patch }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setNote(d);
      onUpdate(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };
  const edit = async () => {
    const r = await fetch(`/api/vault?id=${id}`);
    const full = await r.json();
    if (r.ok) onEdit(full);
    else setError(full.error);
  };
  const backlinks = vault.edges
    .filter((e) => e.target === id)
    .map((e) => vault.notes.find((n) => n.id === e.source)!)
    .filter((n, i, all) => n && all.findIndex((x) => x.id === n.id) === i);
  return (
    <section className="reader">
      <header className="reader-bar">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={15} /> 返回星图
        </button>
        <span className="reader-breadcrumb">
          {note?.collection} <span>/</span> {note?.title}
        </span>
        <div>
          <button
            className={`icon-button ${note?.favorite ? "starred" : ""}`}
            disabled={!note || busy}
            aria-label={note?.favorite ? "取消收藏" : "收藏文档"}
            onClick={() => update({ favorite: !note?.favorite })}
          >
            <Star size={17} fill={note?.favorite ? "currentColor" : "none"} />
          </button>
          <button className="secondary small" disabled={!note} onClick={edit}>
            <PenLine size={14} />
            编辑
          </button>
        </div>
      </header>
      <div className="reader-scroll">
        <article className="reading-paper">
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          {!note && !error ? (
            <div className="empty-state">
              <Loader2 className="spin" />
              正在打开文档…
            </div>
          ) : (
            note && (
              <>
                <div className="eyebrow">
                  <BookOpen size={13} />
                  {note.collection}
                  <span>·</span>
                  {note.tags.join(" / ")}
                </div>
                <h1>{note.title}</h1>
                <p className="reader-summary">
                  {note.summary || "还没有一句话摘要，编辑后补充你的理解。"}
                </p>
                <div className="reader-meta">
                  <AtlasSelect
                    label="学习状态"
                    disabled={busy}
                    value={note.status}
                    tone="status"
                    options={["未开始", "学习中", "已掌握"].map((s) => ({
                      value: s,
                      label: s,
                    }))}
                    onChange={(value) =>
                      update({ status: value as Note["status"] })
                    }
                  />
                  <span>
                    {new Date(note.updatedAt).toLocaleDateString("zh-CN")} 更新
                  </span>
                  <span>
                    {note.noteType === "research"
                      ? "文献综述"
                      : note.noteType === "organization"
                        ? "研究机构"
                        : "知识笔记"}
                  </span>
                </div>
                <nav className="level-tabs" aria-label="阅读深度">
                  {[
                    ["L0", "一句话"],
                    ["L1", "核心概览"],
                    ["L2", "完整内容"],
                  ].map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => {
                        setNote(null);
                        setError("");
                        setLevel(v);
                      }}
                      className={level === v ? "active" : ""}
                    >
                      <b>{v}</b>
                      {label}
                    </button>
                  ))}
                </nav>
                {note.prerequisites.length > 0 && (
                  <div className="prerequisite-box">
                    <span>建议先了解</span>
                    {note.prerequisites.map((p) => {
                      const n = vault.notes.find(
                        (n) => n.title === p || n.aliases.includes(p),
                      );
                      return (
                        <button key={p} onClick={() => openTitle(p)}>
                          {n?.status === "已掌握" ? (
                            <Check size={12} />
                          ) : (
                            <span className="status-dot" />
                          )}
                          {p}
                          <ArrowUpRight size={11} />
                        </button>
                      );
                    })}
                  </div>
                )}
                <div
                  className="prose reading-content"
                  onClick={(e) => {
                    const a = (e.target as HTMLElement).closest(
                      "a[data-wiki]",
                    ) as HTMLElement | null;
                    if (a) {
                      e.preventDefault();
                      openTitle(a.dataset.wiki!);
                    }
                  }}
                  dangerouslySetInnerHTML={{
                    __html: toHtml(
                      level === "L0"
                        ? note.summary
                        : level === "L1"
                          ? note.overview ||
                            "尚未整理概览。点击「编辑」补充 L1，或切换到完整内容。"
                          : note.content ||
                            "这片知识还等待你的探索。点击「编辑」写下第一段理解。",
                    ),
                  }}
                />
                {(note.sources?.length || 0) > 0 ? (
                  <section
                    className="research-sources"
                    aria-label="原始文献来源"
                  >
                    <h2>
                      原始文献 <span>{note.sources!.length} 个来源</span>
                    </h2>
                    <p>以下是这篇笔记的原始依据，可打开核对全文。</p>
                    {note.sources!.map((source, i) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="source-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <strong>{source.title}</strong>
                          <small>
                            {source.publisher}
                            {source.publishedAt
                              ? ` · ${source.publishedAt}`
                              : ""}
                          </small>
                        </span>
                        <ArrowUpRight size={16} />
                      </a>
                    ))}
                  </section>
                ) : (
                  note.source && (
                    <p className="source-line">
                      来源：
                      {note.source.startsWith("https://") ? (
                        <a href={note.source} target="_blank" rel="noreferrer">
                          原始参考 <ArrowUpRight size={12} />
                        </a>
                      ) : (
                        note.source
                      )}
                    </p>
                  )
                )}
                {!!note.relations?.length && (
                  <section className="research-relations">
                    <h2>沿着研究继续探索</h2>
                    <div>
                      {note.relations.map((r) => (
                        <button
                          key={`${r.kind}:${r.target}`}
                          onClick={() => openTitle(r.target)}
                        >
                          <small>{relationLabels[r.kind]}</small>
                          {r.target}
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <div className="backlinks">
                  <div className="section-label">
                    <Link2 size={15} />
                    反向链接 <span>{backlinks.length}</span>
                  </div>
                  {backlinks.length ? (
                    backlinks
                      .filter(
                        (n, i, all) =>
                          all.findIndex((x) => x.id === n.id) === i,
                      )
                      .map((n) => (
                        <button key={n.id} onClick={() => onOpen(n.id)}>
                          <div>
                            <strong>{n.title}</strong>
                            <p>{n.summary}</p>
                          </div>
                          <ArrowUpRight size={16} />
                        </button>
                      ))
                  ) : (
                    <p className="quiet">
                      还没有其他文档链接到这里。试试在文档中输入 [[{note.title}
                      ]]。
                    </p>
                  )}
                </div>
                <button
                  className="delete-note"
                  onClick={() => {
                    if (
                      window.confirm(
                        "删除这篇文档？原文会保留在本机回收目录；其他文档中的链接将变为待补充。",
                      )
                    )
                      onDelete(id);
                  }}
                >
                  <Trash2 size={13} />
                  删除文档
                </button>
              </>
            )
          )}
        </article>
      </div>
    </section>
  );
}
export function NotePreview({
  note,
  vault,
  onRead,
  onOpen,
  onUpdate,
}: {
  note: NoteCard;
  vault: Vault;
  onRead: () => void;
  onOpen: (id: string) => void;
  onUpdate: (note: Note) => void;
}) {
  const related = [
    ...new Set(
      vault.edges
        .filter((e) => e.source === note.id || e.target === note.id)
        .flatMap((e) => [e.source, e.target]),
    ),
  ]
    .filter((id) => id !== note.id)
    .map((id) => vault.notes.find((n) => n.id === id)!)
    .filter(Boolean);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const status = async (value: Note["status"]) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/vault?id=${note.id}`);
      const full = await r.json();
      if (!r.ok) throw Error(full.error);
      const save = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...full, status: value }),
      });
      const result = await save.json();
      if (!save.ok) throw Error(result.error);
      onUpdate(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <aside className="note-preview">
      <div className="preview-top">
        <span>
          <span className="live-dot" />
          你正在这里
        </span>
        <span>L0 / 摘要</span>
      </div>
      <div className="preview-emblem">
        <OrbitIcon />
      </div>
      <span className="eyebrow">{note.tags.join(" / ") || "知识点"}</span>
      <div className="preview-type">
        {note.noteType === "research"
          ? "◆ 研究文献"
          : note.noteType === "organization"
            ? "■ 研究机构"
            : "● 知识概念"}
        {!!note.sources?.length && (
          <span>{note.sources.length} 个原始来源</span>
        )}
      </div>
      <h2>{note.title}</h2>
      <p className="preview-summary">
        {note.summary || "给这个知识点补充一句话摘要。"}
      </p>
      <button className="primary preview-read" onClick={onRead}>
        <BookOpen size={15} />
        打开文档
        <ArrowUpRight size={15} />
      </button>
      <div className="preview-status">
        <label htmlFor="preview-status">我的学习状态</label>
        <AtlasSelect
          id="preview-status"
          label="我的学习状态"
          value={note.status}
          disabled={busy}
          tone="status"
          align="end"
          options={["未开始", "学习中", "已掌握"].map((s) => ({
            value: s,
            label: s,
          }))}
          onChange={(value) => status(value as Note["status"])}
        />
      </div>
      {error && <p className="error-message">{error}</p>}
      <div className="preview-section">
        <h3>
          建议先了解 <span>{note.prerequisites.length}</span>
        </h3>
        {note.prerequisites.length ? (
          note.prerequisites.map((p) => {
            const n = vault.notes.find(
              (n) => n.title === p || n.aliases.includes(p),
            );
            return (
              <button key={p} onClick={() => n && onOpen(n.id)} disabled={!n}>
                <span
                  className={`learning-mark ${n?.status === "已掌握" ? "done" : ""}`}
                >
                  {n?.status === "已掌握" ? <Check size={11} /> : null}
                </span>
                <div>
                  <strong>{p}</strong>
                  <small>{n?.status || "待补充"}</small>
                </div>
                <ArrowUpRight size={13} />
              </button>
            );
          })
        ) : (
          <p className="quiet">可以直接从这里开始。</p>
        )}
      </div>
      <div className="preview-section related">
        <h3>
          相邻的知识 <span>{related.length}</span>
        </h3>
        {related.slice(0, 5).map((n) => (
          <button key={n.id} onClick={() => onOpen(n.id)}>
            <span className="tiny-star" />
            <div>
              <strong>{n.title}</strong>
              <small>
                {[
                  ...new Set(
                    vault.edges
                      .filter(
                        (e) =>
                          (e.source === note.id && e.target === n.id) ||
                          (e.target === note.id && e.source === n.id),
                      )
                      .map((e) => relationLabels[e.kind]),
                  ),
                ].join(" · ")}
              </small>
            </div>
            <ArrowUpRight size={13} />
          </button>
        ))}
      </div>
      <footer>
        <Link2 size={13} />
        <span>顺着一条连接，发现新的理解。</span>
      </footer>
    </aside>
  );
}
function OrbitIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <ellipse
        cx="20"
        cy="20"
        rx="18"
        ry="8"
        transform="rotate(-35 20 20)"
        stroke="currentColor"
        strokeWidth=".8"
      />
      <ellipse
        cx="20"
        cy="20"
        rx="18"
        ry="8"
        transform="rotate(35 20 20)"
        stroke="currentColor"
        strokeWidth=".8"
      />
      <circle cx="20" cy="20" r="5" fill="currentColor" />
      <circle cx="7" cy="27" r="2.5" fill="currentColor" />
    </svg>
  );
}
