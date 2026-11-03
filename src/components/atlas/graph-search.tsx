"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import { ArrowUpRight, Search, X } from "lucide-react";
import type { NoteCard } from "@/types/knowledge";
export default function GraphSearch({
  notes,
  onPick,
}: {
  notes: NoteCard[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [show, setShow] = useState(false),
    [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const index = useMemo(
    () =>
      new Fuse(notes, {
        keys: [
          { name: "title", weight: 5 },
          { name: "aliases", weight: 4 },
          { name: "tags", weight: 2 },
          { name: "summary", weight: 1 },
          { name: "organizations", weight: 1 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeScore: true,
      }),
    [notes],
  );
  const hits = useMemo(
    () => (query.trim() ? index.search(query.trim()).slice(0, 7) : []),
    [query, index],
  );
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const pick = (id: string) => {
    onPick(id);
    setShow(false);
  };
  return (
    <div ref={ref} className="graph-search-position inline-graph-search">
      {show && query.trim() && (
        <div
          className="graph-search-results"
          role="listbox"
          id="graph-results"
          aria-label="星图模糊检索结果"
        >
          <div className="graph-results-caption">
            <Search size={12} />{" "}
            {hits.length ? "选择结果，在星图中定位" : "没有匹配的知识"}
            <small>模糊检索</small>
          </div>
          {hits.map(({ item }, i) => (
            <button
              id={`graph-result-${i}`}
              key={item.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onPointerMove={() => setActive(i)}
              onClick={() => pick(item.id)}
            >
              <span className={`result-kind ${item.noteType || "concept"}`}>
                {item.noteType === "research"
                  ? "◆"
                  : item.noteType === "organization"
                    ? "■"
                    : "●"}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.summary}</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          ))}
          {!hits.length && <p>试试“Agent”“注意力”“残差”或机构名称。</p>}
        </div>
      )}
      <div className="galaxy-search">
        <div className="mini-orb" />
        <input
          aria-label="搜索星图"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={show && !!query.trim()}
          aria-controls="graph-results"
          aria-activedescendant={
            show && hits.length ? `graph-result-${active}` : undefined
          }
          value={query}
          onFocus={() => setShow(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setShow(true);
          }}
          placeholder="搜索概念、论文或机构…"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShow(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(hits.length - 1, i + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            }
            if (e.key === "Enter" && hits[active]) {
              e.preventDefault();
              pick(hits[active].item.id);
            }
          }}
        />
        {query && (
          <button
            aria-label="清空星图搜索"
            onClick={() => {
              setQuery("");
              setShow(false);
            }}
          >
            <X size={15} />
          </button>
        )}
        <span className="graph-search-key">↵ 定位</span>
      </div>
      <span className="graph-instruction">
        悬浮看关联 · 单击聚焦 · 双击阅读全文 · 拖动画布平移 · 滚轮缩放
      </span>
    </div>
  );
}
