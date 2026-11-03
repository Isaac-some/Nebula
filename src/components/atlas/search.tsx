"use client";
import { useEffect, useState, useRef } from "react";
import {
  Search,
  X,
  ArrowUpRight,
  CornerDownLeft,
  Loader2,
  FileText,
  Command,
} from "lucide-react";
import type { SearchHit } from "@/types/knowledge";
import Modal from "./modal";
export default function SearchModal({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState(""),
    [mode, setMode] = useState("keyword"),
    [hits, setHits] = useState<SearchHit[]>([]),
    [loading, setLoading] = useState(false),
    [warning, setWarning] = useState(""),
    [active, setActive] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const current = ++request.current;
    if (!q.trim()) return;
    const abort = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&mode=${mode}`,
          { signal: abort.signal },
        );
        const data = await res.json();
        if (!res.ok) throw Error(data.error);
        if (current === request.current) {
          setHits(data.hits);
          setWarning(data.warning);
          setActive(0);
        }
      } catch (e) {
        if (!abort.signal.aborted)
          setWarning(e instanceof Error ? e.message : "检索失败。");
      } finally {
        if (current === request.current) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(id);
      abort.abort();
    };
  }, [q, mode]);
  const updateQuery = (value: string) => {
    setQ(value);
    setLoading(!!value.trim());
    setWarning("");
    if (!value.trim()) setHits([]);
  };
  return (
    <Modal onClose={onClose} className="search-modal">
      <div className="search-modal-input">
        <div className="mini-orb" />
        <input
          aria-label="搜索知识库"
          autoFocus
          placeholder="你想了解什么？"
          value={q}
          onChange={(e) => updateQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive(Math.min(active + 1, hits.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive(Math.max(0, active - 1));
            }
            if (e.key === "Enter" && hits[active]) onOpen(hits[active].note.id);
          }}
        />
        {loading ? (
          <Loader2 size={19} className="spin" />
        ) : (
          <Search size={19} />
        )}
        <button className="icon-button" onClick={onClose} aria-label="关闭搜索">
          <X size={18} />
        </button>
      </div>
      <div className="search-modes">
        {[
          ["hybrid", "混合检索"],
          ["keyword", "关键词"],
          ["semantic", "语义检索"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={mode === value ? "active" : ""}
            onClick={() => {
              setMode(value);
              if (q.trim()) setLoading(true);
            }}
          >
            {label}
          </button>
        ))}
        <span>从摘要到全文，逐层发现</span>
      </div>
      {warning && (
        <div className="search-warning" role="status">
          {warning}
        </div>
      )}
      <div className="search-results">
        {!q && (
          <div className="search-intro">
            <div className="search-orb" />
            <h2>循着好奇，找到连接。</h2>
            <p>搜一个词，或描述你想解决的问题。</p>
            <div className="suggestions">
              {["AI Agent", "让模型调用工具", "如何找到意思相近的资料"].map(
                (s) => (
                  <button key={s} onClick={() => updateQuery(s)}>
                    {s}
                    <ArrowUpRight size={13} />
                  </button>
                ),
              )}
            </div>
          </div>
        )}
        {q && !loading && !hits.length && (
          <div className="empty-state">
            <Search size={27} />
            <h3>暂时没有找到相关知识</h3>
            <p>换一个词，或把这个问题记录为新的知识点。</p>
          </div>
        )}
        {hits.map((h, i) => (
          <button
            key={h.note.id}
            className={`search-hit ${active === i ? "selected" : ""}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => onOpen(h.note.id)}
          >
            <FileText size={18} />
            <div>
              <strong>
                {h.note.title}
                <small>{h.matchedLevel}</small>
              </strong>
              <p>{h.excerpt.replace(/[#*`\[\]]/g, "").slice(0, 130)}</p>
              <span>
                {h.note.collection} ·{" "}
                {h.vectorScore !== undefined
                  ? `语义相似度 ${h.vectorScore.toFixed(2)}`
                  : "关键词匹配"}
              </span>
            </div>
            <CornerDownLeft size={15} />
          </button>
        ))}
      </div>
      <footer className="search-footer">
        <span>
          ↑ ↓ 选择 <CornerDownLeft size={12} /> 打开
        </span>
        <span>
          <Command size={12} /> K · 随时搜索 <kbd>esc</kbd> 关闭
        </span>
      </footer>
    </Modal>
  );
}
