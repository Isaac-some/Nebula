"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import AtlasSelect from "./select";
import {
  Orbit,
  Network,
  Library,
  Route,
  Star,
  Settings2,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  ArrowUpRight,
  ArrowRight,
  Upload,
  Download,
  PanelLeftClose,
  PanelLeft,
  Check,
  BookOpen,
  Link2,
  Loader2,
  X,
  RefreshCw,
  HardDrive,
  FolderOpen,
  CheckCircle2,
  Compass,
} from "lucide-react";
import {
  relationLabels,
  type Note,
  type NoteCard,
  type Vault,
} from "@/types/knowledge";
import Graph, { domainColors } from "./graph";
import GraphSearch from "./graph-search";
import Reader, { NotePreview } from "./reader";
import Editor from "./editor";
import SearchModal from "./search";
import Modal from "./modal";
type View = "graph" | "library" | "learning" | "favorites";
type IndexStatus = {
  state: string;
  done: number;
  total: number;
  indexed: number;
  documents: number;
  error: string;
  model: string;
};
export default function Atlas() {
  const [vault, setVault] = useState<Vault>({
      notes: [],
      edges: [],
      unresolved: [],
    }),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [view, setView] = useState<View>("graph"),
    [selected, setSelected] = useState<string | null>(null),
    [reading, setReading] = useState<string | null>(null),
    [search, setSearch] = useState(false),
    [editor, setEditor] = useState<{
      note: Note | null;
      title?: string;
    } | null>(null),
    [settings, setSettings] = useState(false),
    [immersive, setImmersive] = useState(false),
    [mobileNav, setMobileNav] = useState(false),
    [filter, setFilter] = useState("全部领域"),
    [nodeType, setNodeType] = useState("all"),
    [relation, setRelation] = useState("all"),
    [focusRequest, setFocusRequest] = useState<{
      id: string;
      version: number;
    } | null>(null),
    [collection, setCollection] = useState("全部文档"),
    [local, setLocal] = useState(false),
    [toast, setToast] = useState(""),
    [index, setIndex] = useState<IndexStatus | null>(null),
    [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  };
  const reload = useCallback(async () => {
    const r = await fetch("/api/vault");
    const data = await r.json();
    if (!r.ok) throw Error(data.error);
    setVault(data);
    setSelected((prev) =>
      prev && data.notes.some((n: NoteCard) => n.id === prev) ? prev : null,
    );
    return data as Vault;
  }, []);
  useEffect(() => {
    fetch("/api/vault")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        setVault(data);
        const url = new URL(window.location.href);
        setReading(url.searchParams.get("note"));
        if (
          ["graph", "library", "learning", "favorites"].includes(
            url.searchParams.get("view") || "",
          )
        )
          setView(url.searchParams.get("view") as View);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const pop = () => {
      const p = new URL(window.location.href).searchParams;
      setReading(p.get("note"));
      setView((p.get("view") || "graph") as View);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const go = (next: View) => {
    setView(next);
    setReading(null);
    setMobileNav(false);
    const u = new URL(window.location.href);
    u.searchParams.delete("note");
    u.searchParams.set("view", next);
    window.history.pushState({}, "", u);
  };
  const open = (id: string) => {
    setSelected(id);
    setReading(id);
    setSearch(false);
    const u = new URL(window.location.href);
    u.searchParams.set("note", id);
    window.history.pushState({}, "", u);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "n" &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target as HTMLElement).isContentEditable
        )
      ) {
        e.preventDefault();
        setEditor({ note: null });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!settings) return;
    let active = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/index");
        if (active) setIndex(await r.json());
      } catch {
        if (active) setError("无法读取索引状态。");
      }
    };
    void poll();
    const timer = setInterval(poll, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [settings]);
  const save = async (note: Note) => {
    setEditor(null);
    await reload();
    setSelected(note.id);
    if (reading) setReading(note.id);
    notify("知识点已保存，图谱已更新");
  };
  const changed = () => {
    void reload().catch((e) => notify(e.message));
  };
  const remove = async (id: string) => {
    const r = await fetch(`/api/vault?id=${id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) {
      notify(d.error);
      return;
    }
    await reload();
    go("graph");
    notify("文档已删除，原文保留在 data/trash 回收目录");
  };
  const importFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setImporting(true);
    try {
      const content = await Promise.all(
        [...files].map(async (f) => ({
          name: f.name,
          content: await f.text(),
        })),
      );
      const r = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: content }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await reload();
      notify(
        `已导入 ${d.imported.length} 篇，跳过 ${d.skipped.length} 篇${d.errors.length ? "；失败：" + d.errors.join("；") : ""}`,
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const exportVault = () => {
    const a = document.createElement("a");
    a.href = "/api/export";
    a.download = "nebula-vault.zip";
    a.click();
    notify("正在导出 Obsidian 兼容的 Markdown 知识库");
  };
  const baseVisible = useMemo(
    () =>
      vault.notes.filter(
        (n) =>
          (collection === "全部文档" || n.collection === collection) &&
          (filter === "全部领域" || n.tags.includes(filter)) &&
          (view !== "graph" ||
            nodeType === "all" ||
            (n.noteType || "concept") === nodeType),
      ),
    [vault.notes, filter, collection, nodeType, view],
  );
  const visible = useMemo(() => {
    if (!local || !selected) return baseVisible;
    const neighbors = new Set(
      vault.edges
        .filter((e) => e.source === selected || e.target === selected)
        .flatMap((e) => [e.source, e.target]),
    );
    neighbors.add(selected);
    return baseVisible.filter((n) => neighbors.has(n.id));
  }, [baseVisible, vault.edges, local, selected]);
  const graphNotes = useMemo(() => {
    const ids = new Set(visible.map((n) => n.id));
    const missing = [
      ...new Set(
        vault.unresolved
          .filter(
            (u) =>
              ids.has(u.source) && (relation === "all" || relation === "link"),
          )
          .map((u) => u.title),
      ),
    ];
    return [
      ...visible,
      ...missing.map((title) => ({
        id: "unresolved:" + encodeURIComponent(title),
        title,
        collection: "待补充",
        summary: "这个知识点还没有文档，点击后补充。",
        tags: ["待补充"],
        prerequisites: [],
        aliases: [],
        status: "未开始" as const,
        favorite: false,
        source: "",
        updatedAt: "",
        revision: 0,
      })),
    ];
  }, [visible, vault.unresolved, relation]);
  const visibleEdges = useMemo(() => {
    const ids = new Set(visible.map((n) => n.id));
    return [
      ...vault.edges.filter(
        (e) =>
          ids.has(e.source) &&
          ids.has(e.target) &&
          (relation === "all" || e.kind === relation),
      ),
      ...vault.unresolved
        .filter(
          (u) =>
            ids.has(u.source) && (relation === "all" || relation === "link"),
        )
        .map((u) => ({
          source: u.source,
          target: "unresolved:" + encodeURIComponent(u.title),
          kind: "link" as const,
        })),
    ];
  }, [vault.edges, vault.unresolved, visible, relation]);
  const graphSelected = visible.some((n) => n.id === selected)
    ? selected
    : null;
  const current = vault.notes.find(
      (n) => n.id === (view === "graph" ? graphSelected : selected),
    ),
    mastered = vault.notes.filter((n) => n.status === "已掌握").length,
    learning = vault.notes.filter((n) => n.status === "学习中").length;
  const ready = (n: NoteCard) =>
    n.prerequisites.every((p) =>
      vault.notes.some(
        (x) =>
          (x.title === p || x.aliases.includes(p)) && x.status === "已掌握",
      ),
    );
  return (
    <div
      className={`atlas-app ${immersive ? "immersive" : ""} ${mobileNav ? "nav-open" : ""}`}
    >
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".md,.markdown,.txt"
        className="hidden"
        onChange={(e) => importFiles(e.target.files)}
      />
      <aside className="sidebar">
        <button className="brand" onClick={() => go("graph")}>
          <span className="brand-icon">
            <Orbit size={26} />
          </span>
          <span>Nebula</span>
        </button>
        <button
          className="workspace-picker"
          onClick={() => {
            setCollection("全部文档");
            go("library");
          }}
        >
          <span className="workspace-avatar">知</span>
          <span>
            我的知识宇宙<small>个人本地空间</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <button className="sidebar-search" onClick={() => setSearch(true)}>
          <Search size={15} />
          <span>搜索知识</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="nav-label">探索</div>
        <nav>
          {(
            [
              { id: "graph", label: "知识图谱", icon: Network },
              { id: "library", label: "文档库", icon: Library },
              { id: "learning", label: "学习路径", icon: Route },
              { id: "favorites", label: "我的收藏", icon: Star },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={view === item.id && !reading ? "active" : ""}
              onClick={() => go(item.id)}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              {item.id === "library" ? (
                <small>{vault.notes.length}</small>
              ) : item.id === "graph" ? (
                <span className="nav-spark" />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="nav-label collection-label">
          文档集
          <button
            aria-label="新建文档"
            onClick={() => setEditor({ note: null })}
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="collection-list">
          {[...new Set(vault.notes.map((n) => n.collection))].map((c, i) => (
            <button
              key={c}
              className={collection === c ? "selected" : ""}
              onClick={() => {
                setCollection(c);
                go("library");
              }}
            >
              <span
                className="collection-dot"
                style={{ background: Object.values(domainColors)[i % 4] }}
              />
              <span>{c}</span>
              <small>
                {vault.notes.filter((n) => n.collection === c).length}
              </small>
            </button>
          ))}
          <button
            className="import-link"
            onClick={() => fileInput.current?.click()}
            disabled={importing}
          >
            <Upload size={14} />
            {importing ? "导入中…" : "导入 Markdown"}
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="growth-card">
            <span>
              <Compass size={15} />
              每一点理解，都有回响
            </span>
            <div>
              <strong>{mastered}</strong>
              <small> / {vault.notes.length} 个知识点已掌握</small>
            </div>
            <div className="growth-track">
              <i
                style={{
                  width: `${vault.notes.length ? (mastered / vault.notes.length) * 100 : 0}%`,
                }}
              />
            </div>
            <button onClick={() => go("learning")}>
              继续我的探索
              <ArrowRight size={13} />
            </button>
          </div>
          <button className="settings-link" onClick={() => setSettings(true)}>
            <Settings2 size={16} />
            设置与数据
            <span className="local-badge">
              <i />
              本地
            </span>
          </button>
          <div className="sidebar-profile">
            <div>我</div>
            <span>
              我的学习空间<small>把知识，变成自己的。</small>
            </span>
          </div>
        </div>
      </aside>
      <main id="main" className="main-space">
        <header className="topbar">
          <div>
            <button
              className="icon-button sidebar-toggle"
              aria-label="切换侧栏"
              onClick={() => {
                if (window.innerWidth < 800) setMobileNav(!mobileNav);
                else setImmersive(!immersive);
              }}
            >
              {immersive ? (
                <PanelLeft size={17} />
              ) : (
                <PanelLeftClose size={17} />
              )}
            </button>
            <span className="topbar-divider" />
            <span>我的知识宇宙</span>
            <ChevronRight size={12} />
            <strong>
              {reading
                ? "阅读文档"
                : view === "graph"
                  ? "知识图谱"
                  : view === "learning"
                    ? "学习路径"
                    : view === "favorites"
                      ? "我的收藏"
                      : "文档库"}
            </strong>
          </div>
          <div>
            <span className="saved-indicator">
              <i />
              所有更改保存在本机
            </span>
            <button
              className="primary small"
              onClick={() => setEditor({ note: null })}
            >
              <Plus size={15} />
              新建知识点
            </button>
          </div>
        </header>
        {loading ? (
          <div className="loading-screen">
            <Orbit size={40} className="spin" />
            <h2>正在展开你的知识宇宙</h2>
          </div>
        ) : error ? (
          <div className="empty-state">
            <h2>知识库未能打开</h2>
            <p>{error}</p>
            <button
              className="primary"
              onClick={() => {
                setError("");
                setLoading(true);
                reload()
                  .catch((e) => setError(e.message))
                  .finally(() => setLoading(false));
              }}
            >
              重试
            </button>
          </div>
        ) : reading ? (
          <Reader
            key={reading}
            id={reading}
            vault={vault}
            onOpen={open}
            onEdit={(note) => setEditor({ note })}
            onUpdate={changed}
            onCreate={(title) => setEditor({ note: null, title })}
            onBack={() => go("graph")}
            onDelete={remove}
          />
        ) : (
          <>
            {view !== "graph" && (
              <div className="page-intro">
                <div>
                  <span className="eyebrow">
                    {view === "learning"
                      ? "ONE STEP CLOSER"
                      : "YOUR GROWING LIBRARY"}
                  </span>
                  <h1>
                    {view === "learning"
                      ? "从知道，到真正理解。"
                      : view === "favorites"
                        ? "那些值得反复回看的。"
                        : "把零散的理解，慢慢积成体系。"}
                  </h1>
                  <p>
                    {view === "learning"
                      ? "看清已经走过的路，也找到下一步值得探索的方向。"
                      : "记录、连接、回看。每一篇笔记，都是你的一个新坐标。"}
                  </p>
                </div>
              </div>
            )}

            {view === "graph" ? (
              <div className="graph-layout expanded-graph-layout">
                <section className="graph-panel">
                  <div className="graph-panel-top">
                    <div>
                      <Orbit size={16} />
                      <strong>知识星图</strong>
                      <span className="graph-inline-stats">
                        {visible.length} 节点 · {visibleEdges.length} 关系
                      </span>
                      <span className="subtle-label">
                        /{" "}
                        {collection === "全部文档"
                          ? "我的全部知识"
                          : collection}
                      </span>
                    </div>
                    <div>
                      <AtlasSelect
                        label="图谱领域筛选"
                        value={filter}
                        onChange={setFilter}
                        align="end"
                        options={["全部领域", ...Object.keys(domainColors)].map(
                          (c) => ({ value: c, label: c }),
                        )}
                      />
                      <button
                        className={`local-toggle ${local ? "active" : ""}`}
                        onClick={() => setLocal(!local)}
                      >
                        <FocusIcon />
                        仅看关联
                      </button>
                    </div>
                  </div>
                  <div className="graph-dimensions">
                    <label>
                      知识类型
                      <AtlasSelect
                        label="知识类型筛选"
                        value={nodeType}
                        onChange={setNodeType}
                        options={[
                          { value: "all", label: "全部类型" },
                          { value: "concept", label: "概念" },
                          { value: "research", label: "研究文献" },
                          { value: "organization", label: "研究机构" },
                        ]}
                      />
                    </label>
                    <label>
                      关系
                      <AtlasSelect
                        label="知识关系筛选"
                        value={relation}
                        onChange={setRelation}
                        options={[
                          { value: "all", label: "全部关系" },
                          ...Object.entries(relationLabels).map(
                            ([value, label]) => ({ value, label }),
                          ),
                        ]}
                      />
                    </label>
                    <span>从原理、研究与应用，交叉理解知识</span>
                  </div>
                  <Graph
                    onOpen={(id) =>
                      id.startsWith("unresolved:")
                        ? setEditor({
                            note: null,
                            title: decodeURIComponent(id.slice(11)),
                          })
                        : open(id)
                    }
                    onClear={() => setSelected(null)}
                    focusRequest={focusRequest}
                    notes={graphNotes}
                    edges={visibleEdges}
                    selected={graphSelected}
                    onSelect={(id) =>
                      id.startsWith("unresolved:")
                        ? setEditor({
                            note: null,
                            title: decodeURIComponent(id.slice(11)),
                          })
                        : window.innerWidth <= 650
                          ? open(id)
                          : setSelected(id)
                    }
                    immersive={immersive}
                    onImmersive={() => setImmersive(!immersive)}
                  />
                  <GraphSearch
                    notes={vault.notes}
                    onPick={(id) => {
                      setCollection("全部文档");
                      setFilter("全部领域");
                      setNodeType("all");
                      setRelation("all");
                      setLocal(false);
                      setSelected(id);
                      setFocusRequest({ id, version: Date.now() });
                    }}
                  />
                </section>
                {current && (
                  <NotePreview
                    note={current}
                    vault={vault}
                    onRead={() => open(current.id)}
                    onOpen={setSelected}
                    onUpdate={changed}
                  />
                )}
              </div>
            ) : view === "learning" ? (
              <div className="learning-view">
                <div className="learning-overview">
                  <div>
                    <span className="eyebrow">我的探索进度</span>
                    <h2>
                      {mastered}
                      <small> / {vault.notes.length} 个知识点</small>
                    </h2>
                    <p>
                      已掌握 {mastered} · 学习中 {learning} · 未开始{" "}
                      {vault.notes.length - mastered - learning}
                    </p>
                  </div>
                  <div
                    className="progress-ring"
                    style={
                      {
                        "--progress": `${vault.notes.length ? (mastered / vault.notes.length) * 100 : 0}%`,
                      } as React.CSSProperties
                    }
                  >
                    <span>
                      {Math.round(
                        vault.notes.length
                          ? (mastered / vault.notes.length) * 100
                          : 0,
                      )}
                      <small>%</small>
                    </span>
                  </div>
                </div>
                <div className="section-heading">
                  <h2>继续上次的好奇</h2>
                  <span>学习中 · {learning}</span>
                </div>
                <div className="learning-cards">
                  {vault.notes
                    .filter((n) => n.status === "学习中")
                    .map((n) => (
                      <LearningCard
                        key={n.id}
                        note={n}
                        onOpen={() => open(n.id)}
                        ready={ready(n)}
                      />
                    ))}
                </div>
                <div className="section-heading">
                  <h2>下一步，可以从这里开始</h2>
                  <span>前置知识已掌握，或可以直接入门</span>
                </div>
                <div className="learning-cards">
                  {vault.notes
                    .filter((n) => n.status === "未开始" && ready(n))
                    .map((n) => (
                      <LearningCard
                        key={n.id}
                        note={n}
                        onOpen={() => open(n.id)}
                        ready
                      />
                    ))}
                </div>
                <div className="section-heading">
                  <h2>还有这些，等待探索</h2>
                </div>
                <div className="learning-cards">
                  {vault.notes
                    .filter((n) => n.status === "未开始" && !ready(n))
                    .map((n) => (
                      <LearningCard
                        key={n.id}
                        note={n}
                        onOpen={() => open(n.id)}
                        ready={false}
                      />
                    ))}
                </div>
              </div>
            ) : (
              <div className="library-view">
                <div className="library-toolbar">
                  <div className="tab-pills">
                    <button
                      className={collection === "全部文档" ? "active" : ""}
                      onClick={() => setCollection("全部文档")}
                    >
                      全部文档
                    </button>
                    {[...new Set(vault.notes.map((n) => n.collection))].map(
                      (c) => (
                        <button
                          key={c}
                          className={collection === c ? "active" : ""}
                          onClick={() => setCollection(c)}
                        >
                          {c}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    className="secondary small"
                    disabled={importing}
                    onClick={() => fileInput.current?.click()}
                  >
                    <Upload size={14} />
                    导入
                  </button>
                </div>
                <div className="library-grid">
                  {vault.notes
                    .filter(
                      (n) =>
                        (collection === "全部文档" ||
                          n.collection === collection) &&
                        (view !== "favorites" || n.favorite),
                    )
                    .map((n) => (
                      <button
                        key={n.id}
                        className="note-card"
                        onClick={() => open(n.id)}
                      >
                        <div className="card-top">
                          <span
                            className="card-domain"
                            style={{
                              color: domainColors[n.tags[0]] || "#a7ddc1",
                            }}
                          >
                            <BookOpen size={15} />
                            {n.tags[0] || n.collection}
                          </span>
                          <span
                            className={`status-pill ${n.status === "已掌握" ? "done" : n.status === "学习中" ? "in-progress" : ""}`}
                          >
                            {n.status === "已掌握" && <Check size={10} />}{" "}
                            {n.status}
                          </span>
                        </div>
                        <h2>{n.title}</h2>
                        <p>{n.summary || "等待你补充的一段新理解。"}</p>
                        <footer>
                          <span>
                            <Link2 size={12} />
                            {new Set(
                              vault.edges
                                .filter(
                                  (e) => e.source === n.id || e.target === n.id,
                                )
                                .flatMap((e) => [e.source, e.target]),
                            ).size -
                              (vault.edges.some(
                                (e) => e.source === n.id || e.target === n.id,
                              )
                                ? 1
                                : 0)}{" "}
                            个连接
                          </span>
                          <ArrowUpRight size={16} />
                        </footer>
                      </button>
                    ))}
                </div>
                {!vault.notes.some(
                  (n) =>
                    (collection === "全部文档" ||
                      n.collection === collection) &&
                    (view !== "favorites" || n.favorite),
                ) && (
                  <div className="empty-state">
                    <Star size={28} />
                    <h2>
                      {view === "favorites"
                        ? "把值得回看的知识收藏在这里"
                        : "这里还没有文档"}
                    </h2>
                    <p>
                      {view === "favorites"
                        ? "打开文档，点击右上角的星标即可收藏。"
                        : "新建一个知识点，或导入 Markdown 文档。"}
                    </p>
                  </div>
                )}
              </div>
            )}
            <footer className="workspace-footer">
              <span>
                <i className="live-dot" />
                知识持续生长中
              </span>
              <span>
                {view === "graph"
                  ? "从一个概念，探索更大的知识宇宙"
                  : "你写下的每个知识点，都在自己的电脑上。"}
                <span className="footer-separator">/</span>
                <span>Nebula</span>
              </span>
            </footer>
          </>
        )}
      </main>
      {search && <SearchModal onClose={() => setSearch(false)} onOpen={open} />}
      {editor && (
        <Editor
          note={editor.note}
          initialTitle={editor.title}
          notes={vault.notes}
          onClose={() => setEditor(null)}
          onSaved={save}
        />
      )}
      {settings && (
        <Modal onClose={() => setSettings(false)} className="settings-modal">
          <header className="modal-heading">
            <div>
              <span className="eyebrow">YOUR OWN SPACE</span>
              <h2>设置与数据</h2>
            </div>
            <button
              className="icon-button"
              aria-label="关闭设置"
              onClick={() => setSettings(false)}
            >
              <X size={19} />
            </button>
          </header>
          <div className="settings-body">
            <section>
              <h3>
                <HardDrive size={17} />
                你的知识，保存在你这里
              </h3>
              <p>
                文档和索引保存在本机 <code>data/</code>，Markdown 副本位于{" "}
                <code>data/vault/wiki/</code>。导出后可直接作为 Obsidian
                知识库打开。
              </p>
              <div className="settings-actions">
                <button className="secondary" onClick={exportVault}>
                  <Download size={15} />
                  导出全部文档
                </button>
                <button
                  className="secondary"
                  disabled={importing}
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload size={15} />
                  导入 Markdown
                </button>
              </div>
            </section>
            <section>
              <h3>
                <Search size={17} />
                检索方式
              </h3>
              <p>
                关键词搜索立即可用。语义检索在本机运行中英文嵌入模型，建立索引后，能找到“说法不同、意思接近”的内容。修改文档后可补建索引。
              </p>
              <div className="index-status">
                <span className={index?.state === "ready" ? "success" : ""}>
                  {index?.state === "indexing" || index?.state === "loading" ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}{" "}
                  {index?.state === "loading"
                    ? "正在加载语义模型"
                    : index?.state === "indexing"
                      ? `正在建立索引 ${index.done} / ${index.total}`
                      : `已建立索引 ${index?.indexed || 0} / ${index?.documents || vault.notes.length} 篇`}
                </span>
                <button
                  className="primary small"
                  disabled={
                    index?.state === "loading" || index?.state === "indexing"
                  }
                  onClick={async () => {
                    try {
                      const r = await fetch("/api/index", { method: "POST" });
                      const d = await r.json();
                      if (!r.ok) throw Error(d.error);
                      setIndex(d);
                    } catch (e) {
                      notify(e instanceof Error ? e.message : "建立索引失败");
                    }
                  }}
                >
                  <RefreshCw size={13} />
                  建立 / 更新索引
                </button>
              </div>
              {index?.error && <p className="error-message">{index.error}</p>}
              <small className="quiet">
                模型首次准备需要下载；检索内容在本机计算，无需 API Key。
              </small>
            </section>
            <section>
              <h3>
                <FolderOpen size={17} />
                第一版的使用边界
              </h3>
              <p>
                个人本地使用；摘要、概览、链接和学习顺序由你维护。支持 Markdown
                / TXT
                导入，同名文档跳过。图谱只表达已录入的知识，前置关系是学习建议。
              </p>
            </section>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={16} />
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="收起侧栏"
          onClick={() => setMobileNav(false)}
        />
      )}
    </div>
  );
}
function LearningCard({
  note,
  onOpen,
  ready,
}: {
  note: NoteCard;
  onOpen: () => void;
  ready: boolean;
}) {
  return (
    <button className="learning-card" onClick={onOpen}>
      <div className="learning-card-icon">
        <BookOpen size={19} />
      </div>
      <div>
        <h3>{note.title}</h3>
        <p>{note.summary}</p>
        <span>
          {ready
            ? "可以开始探索"
            : `建议先了解：${note.prerequisites.join("、")}`}
        </span>
      </div>
      <ArrowUpRight size={17} />
    </button>
  );
}
function FocusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" />
      <path d="M5 2H2v3m9-3h3v3M2 11v3h3m6 0h3v-3" stroke="currentColor" />
    </svg>
  );
}
