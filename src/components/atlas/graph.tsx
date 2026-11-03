"use client";
import { useEffect, useRef, useState } from "react";
import { select } from "d3-selection";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from "d3-force";
import {
  zoom,
  zoomIdentity,
  zoomTransform,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3-zoom";
import { drag } from "d3-drag";
import {
  Plus,
  Minus,
  Maximize,
  Focus,
  Orbit,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { relationLabels, type NoteCard, type Edge } from "@/types/knowledge";
import {
  graphDefaults,
  graphPreferences,
  placeGraphLabels,
  type GraphPreferences,
  type LabelCandidate,
} from "@/lib/graph-view";
import GraphSettings from "./graph-settings";
export const domainColors: Record<string, string> = {
  应用层: "#9de7b9",
  方法层: "#a9a0f4",
  模型层: "#83bff1",
  基础层: "#e8bd83",
};
const settingsKey = "atlas-graph-preferences-v1";
type Point = SimulationNodeDatum & {
  id: string;
  title: string;
  label: string;
  type: string;
  color: string;
  r: number;
  degree: number;
  x: number;
  y: number;
  note: NoteCard;
};
type Link = { source: Point; target: Point; descriptions: string[] };
type Tooltip = {
  id: string;
  title: string;
  summary: string;
  kind: string;
  sources: number;
  x: number;
  y: number;
};
export default function Graph({
  notes,
  edges,
  selected,
  onSelect,
  onOpen,
  onClear,
  immersive,
  onImmersive,
  focusRequest,
}: {
  notes: NoteCard[];
  edges: Edge[];
  selected: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onClear: () => void;
  immersive: boolean;
  onImmersive: () => void;
  focusRequest?: { id: string; version: number } | null;
}) {
  const svg = useRef<SVGSVGElement>(null),
    selection = useRef(selected),
    hovered = useRef<string | null>(null),
    dragged = useRef<string | null>(null);
  const callbacks = useRef({ onSelect, onOpen, onClear });
  const refresh = useRef<() => void>(() => {}),
    focusNode = useRef<(id: string) => void>(() => {}),
    fitView = useRef<() => void>(() => {}),
    applyPreferences = useRef<(prefs: GraphPreferences) => void>(() => {});
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null),
    baseScale = useRef(1),
    positions = useRef(new Map<string, { x: number; y: number }>());
  const [scale, setScale] = useState(1),
    [settingsOpen, setSettingsOpen] = useState(false),
    [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [preferences, setPreferences] = useState<GraphPreferences>(() => {
    if (typeof window !== "undefined")
      try {
        return graphPreferences(
          JSON.parse(localStorage.getItem(settingsKey) || "null"),
        );
      } catch {}
    return { ...graphDefaults };
  });
  const prefsRef = useRef(preferences);
  useEffect(() => {
    selection.current = selected;
    callbacks.current = { onSelect, onOpen, onClear };
    refresh.current();
  }, [selected, onSelect, onOpen, onClear]);
  useEffect(() => {
    prefsRef.current = preferences;
    try {
      localStorage.setItem(settingsKey, JSON.stringify(preferences));
    } catch {}
    applyPreferences.current(preferences);
  }, [preferences]);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const root = select(el);
    root.selectAll("*").remove();
    const stage = root.append("g").attr("class", "graph-stage");
    let width = el.clientWidth,
      height = el.clientHeight,
      animation = 0;
    let transform: ZoomTransform = zoomIdentity;
    const cancelAnimation = () => cancelAnimationFrame(animation);
    const adjacency = new Map<string, Set<string>>();
    edges.forEach((e) => {
      if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
      if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
      adjacency.get(e.source)!.add(e.target);
      adjacency.get(e.target)!.add(e.source);
    });
    const points: Point[] = notes.map((n, i) => {
      const cached = positions.current.get(n.id),
        angle = i * 2.3999632297,
        radius = Math.sqrt(i + 1) * 65,
        degree = adjacency.get(n.id)?.size || 0;
      return {
        id: n.id,
        title: n.title,
        label: n.noteType === "research" ? n.aliases[0] || n.title : n.title,
        type:
          n.collection === "待补充" ? "unresolved" : n.noteType || "concept",
        color:
          n.noteType === "organization"
            ? "#b9a6db"
            : n.noteType === "research"
              ? "#98b2d3"
              : domainColors[n.tags[0]] || "#a3b5be",
        r: Math.min(13, 3.8 + Math.sqrt(degree) * 1.3),
        degree,
        x: cached?.x ?? Math.cos(angle) * radius,
        y: cached?.y ?? Math.sin(angle) * radius,
        note: n,
      };
    });
    const byId = new Map(points.map((n) => [n.id, n]));
    const grouped = new Map<string, Link>();
    for (const edge of edges) {
      const source = byId.get(edge.source),
        target = byId.get(edge.target);
      if (!source || !target) continue;
      const key = [edge.source, edge.target].sort().join(":"),
        description = `${source.title} → ${target.title} · ${relationLabels[edge.kind]}`;
      const previous = grouped.get(key);
      if (previous) previous.descriptions.push(description);
      else grouped.set(key, { source, target, descriptions: [description] });
    }
    const links = [...grouped.values()];
    const paths = stage
      .append("g")
      .attr("class", "graph-links")
      .attr("pointer-events", "none")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("class", "graph-link")
      .attr("fill", "none")
      .attr("vector-effect", "non-scaling-stroke");
    const groups = stage
      .append("g")
      .selectAll<SVGGElement, Point>("g")
      .data(points)
      .join("g")
      .attr("class", "graph-node")
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("data-note-id", (n) => n.id)
      .attr("data-note-title", (n) => n.title)
      .attr(
        "aria-label",
        (n) =>
          `${n.title} · ${n.type === "research" ? "研究笔记" : n.type === "organization" ? "研究机构" : "知识点"}`,
      )
      .style("cursor", "pointer");
    groups
      .append("circle")
      .attr("class", "node-hit")
      .attr("fill", "transparent");
    groups
      .append("circle")
      .attr("class", "node-ring")
      .attr("fill", "none")
      .attr("stroke-width", 1)
      .attr("vector-effect", "non-scaling-stroke")
      .attr("pointer-events", "none");
    groups
      .append("circle")
      .attr("class", "node-core")
      .attr("stroke-width", 1)
      .attr("vector-effect", "non-scaling-stroke")
      .attr("stroke-dasharray", (n) =>
        n.type === "unresolved" ? "2 2" : null,
      );
    groups
      .append("text")
      .attr("class", "node-label")
      .attr("pointer-events", "none")
      .text((n) =>
        n.label.length > 27 ? n.label.slice(0, 26) + "…" : n.label,
      );
    const measureContext = document.createElement("canvas").getContext("2d");
    const measure = (text: string, font: number) => {
      if (!measureContext) return text.length * font * 0.65;
      measureContext.font = `500 ${font}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      return measureContext.measureText(text).width;
    };
    let previousFocus: string | null | undefined,
      hopCache = new Map<string, number>();
    const distances = (focus: string | null) => {
      if (previousFocus === focus) return hopCache;
      previousFocus = focus;
      hopCache = new Map();
      if (!focus) return hopCache;
      const queue = [focus];
      hopCache.set(focus, 0);
      for (let i = 0; i < queue.length; i++) {
        const id = queue[i],
          h = hopCache.get(id)!;
        for (const next of adjacency.get(id) || [])
          if (!hopCache.has(next)) {
            hopCache.set(next, h + 1);
            queue.push(next);
          }
      }
      return hopCache;
    };
    const render = () => {
      const prefs = prefsRef.current,
        focus = dragged.current || hovered.current || selection.current,
        hops = distances(focus),
        focusPoint = focus ? byId.get(focus) : undefined;
      const z = transform.k / baseScale.current;
      paths
        .attr(
          "d",
          (e) => `M${e.source.x},${e.source.y}L${e.target.x},${e.target.y}`,
        )
        .attr("stroke", (e) =>
          focus && (e.source.id === focus || e.target.id === focus)
            ? "#b0d9c5"
            : "#697782",
        )
        .attr(
          "stroke-width",
          (e) =>
            prefs.lineWidth *
            (focus && (e.source.id === focus || e.target.id === focus)
              ? 1.75
              : 1),
        )
        .attr("stroke-opacity", (e) =>
          !focus
            ? 0.25
            : e.source.id === focus || e.target.id === focus
              ? 0.9
              : 0.075,
        )
        .attr("data-highlighted", (e) =>
          String(!!focus && (e.source.id === focus || e.target.id === focus)),
        );
      groups
        .attr("transform", (n) => `translate(${n.x},${n.y})`)
        .attr("data-distance", (n) => (focus ? (hops.get(n.id) ?? 99) : 0))
        .attr("data-hovered", (n) => String(n.id === hovered.current))
        .attr("data-dragged", (n) => String(n.id === dragged.current))
        .attr("data-selected", (n) => String(n.id === selection.current))
        .attr("aria-pressed", (n) => String(n.id === selection.current))
        .attr("aria-describedby", (n) =>
          n.id === hovered.current ? "graph-node-tooltip" : null,
        );
      groups
        .select<SVGCircleElement>(".node-hit")
        .attr("r", (n) => Math.max(n.r * prefs.nodeSize + 5, 12 / transform.k));
      groups
        .select<SVGCircleElement>(".node-core")
        .attr("r", (n) => n.r * prefs.nodeSize * (n.id === focus ? 1.18 : 1))
        .attr("fill", (n) => (n.type === "unresolved" ? "#121921" : n.color))
        .attr("stroke", (n) => n.color)
        .attr("opacity", (n) =>
          !focus || (hops.get(n.id) ?? 99) <= 1 ? 1 : 0.38,
        );
      groups
        .select<SVGCircleElement>(".node-ring")
        .attr("r", (n) => n.r * prefs.nodeSize + 5 / transform.k)
        .attr("stroke", (n) => n.color)
        .attr("opacity", (n) =>
          n.id !== focus
            ? 0
            : n.id === dragged.current || n.id === selection.current
              ? 0.95
              : 0.5,
        );
      const candidates: LabelCandidate[] = points.map((n) => {
        const h = focus ? (hops.get(n.id) ?? 99) : 2,
          essential = n.id === focus;
        const physicalDistance = focusPoint
          ? Math.hypot(n.x - focusPoint.x, n.y - focusPoint.y)
          : 0;
        const proximity = 1 - Math.min(0.1, physicalDistance / 6000);
        const zoomGain = Math.max(
          0.72,
          Math.min(1.35, 1 + Math.log2(Math.max(0.1, z)) * 0.16),
        );
        const font =
          (essential
            ? 17
            : h === 1
              ? 12.5 + Math.min(1.8, n.degree * 0.07)
              : h === 2
                ? 11
                : 9.5) *
          zoomGain *
          proximity;
        const fade = essential
          ? 1
          : Math.max(0, Math.min(1, (z - 0.24) / 0.7)) *
            (h === 1 ? 0.92 : h === 2 ? 0.66 : 0.4);
        const [x, y] = transform.apply([n.x, n.y]);
        return {
          id: n.id,
          text: n.label.length > 27 ? n.label.slice(0, 26) + "…" : n.label,
          x,
          y,
          radius: n.r * prefs.nodeSize * transform.k,
          font,
          opacity: fade,
          priority:
            (essential ? 10000 : h === 1 ? 1000 : h === 2 ? 200 : 0) +
            n.degree * 3 -
            physicalDistance * 0.01,
          essential,
        };
      });
      const budget = Math.min(
        points.length,
        Math.round(
          5 + Math.pow(Math.max(0.1, z), 1.25) * 20 * prefs.labelDensity,
        ),
      );
      const placements = new Map(
        placeGraphLabels(candidates, width, height, budget, measure).map(
          (p) => [p.id, p],
        ),
      );
      groups
        .select<SVGTextElement>(".node-label")
        .style(
          "font-size",
          (n) => `${(placements.get(n.id)?.font || 10) / transform.k}px`,
        )
        .attr("x", (n) => {
          const p = placements.get(n.id);
          return p ? (p.x - transform.x) / transform.k - n.x : 0;
        })
        .attr("y", (n) => {
          const p = placements.get(n.id);
          return p ? (p.y - transform.y) / transform.k - n.y : 0;
        })
        .attr("text-anchor", (n) => placements.get(n.id)?.anchor || "middle")
        .attr("opacity", (n) => placements.get(n.id)?.opacity || 0)
        .attr("aria-hidden", (n) => String(!placements.has(n.id)))
        .attr("fill", (n) => (n.id === focus ? "#effff5" : "#bdcbd4"))
        .attr("font-weight", (n) => (n.id === focus ? 650 : 450));
      points.forEach((n) => positions.current.set(n.id, { x: n.x, y: n.y }));
      el.dataset.labels = String(placements.size);
      el.dataset.zoom = z.toFixed(3);
    };
    refresh.current = render;
    const linkForce = forceLink<Point, Link>(links).id((n) => n.id);
    const charge = forceManyBody<Point>();
    const xForce = forceX<Point>(0),
      yForce = forceY<Point>(0);
    const collision = forceCollide<Point>().strength(0.9).iterations(2);
    const simulation = forceSimulation(points)
      .stop()
      .force("link", linkForce)
      .force("charge", charge)
      .force("center", forceCenter(0, 0))
      .force("collision", collision)
      .force("x", xForce)
      .force("y", yForce)
      .velocityDecay(0.45)
      .alphaDecay(0.035);
    const configure = (prefs: GraphPreferences) => {
      linkForce
        .distance(prefs.linkDistance)
        .strength(0.01 + prefs.linkForce * 0.16);
      charge.strength(-80 - prefs.repelForce * 100);
      xForce.strength(prefs.centerForce * 0.035);
      yForce.strength(prefs.centerForce * 0.045);
      collision.radius(
        (n) =>
          Math.max(30, Math.min(70, n.label.length * 2.5)) +
          n.r * prefs.nodeSize,
      );
    };
    configure(prefsRef.current);
    simulation.tick(240);
    applyPreferences.current = (prefs) => {
      configure(prefs);
      simulation.alpha(0.65).restart();
      render();
    };
    const clearHover = () => {
      if (hovered.current) {
        hovered.current = null;
        setTooltip(null);
        render();
      }
    };
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.16, 3.5])
      .extent(() => [
        [0, 0],
        [width, height],
      ])
      .clickDistance(5)
      .filter(
        (event) =>
          (event.type === "wheel" || !event.button) &&
          !(
            event.type !== "wheel" &&
            (event.target as Element).closest(".graph-node")
          ),
      )
      .on("start", (event) => {
        if (event.sourceEvent) {
          cancelAnimation();
          clearHover();
        }
      })
      .on("zoom", (event) => {
        transform = event.transform;
        stage.attr("transform", transform.toString());
        setScale(transform.k / baseScale.current);
        render();
      });
    zoomRef.current = behavior;
    root.call(behavior).on("dblclick.zoom", null);
    const fit = (initial = false) => {
      cancelAnimation();
      const minX = Math.min(0, ...points.map((n) => n.x - 55)),
        maxX = Math.max(0, ...points.map((n) => n.x + 55)),
        minY = Math.min(0, ...points.map((n) => n.y - 35)),
        maxY = Math.max(0, ...points.map((n) => n.y + 35));
      const fitScale = Math.max(
        0.16,
        Math.min(
          1.2,
          (width - 90) / Math.max(1, maxX - minX),
          (height - 165) / Math.max(1, maxY - minY),
        ),
      );
      const k = fitScale;
      if (initial) baseScale.current = k;
      root.call(
        behavior.transform,
        zoomIdentity
          .translate(width / 2, height * 0.43)
          .scale(k)
          .translate(-(minX + maxX) / 2, -(minY + maxY) / 2),
      );
    };
    fitView.current = () => {
      clearHover();
      fit();
    };
    focusNode.current = (id) => {
      const n = byId.get(id);
      if (!n) return;
      cancelAnimation();
      const from = zoomTransform(el),
        k = Math.max(from.k, 0.72),
        target = zoomIdentity
          .translate(width / 2 - n.x * k, height * 0.43 - n.y * k)
          .scale(k),
        start = performance.now();
      const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches
        ? 0
        : 280;
      const frame = (now: number) => {
        const t = duration ? Math.min(1, (now - start) / duration) : 1,
          ease = 1 - Math.pow(1 - t, 3);
        root.call(
          behavior.transform,
          zoomIdentity
            .translate(
              from.x + (target.x - from.x) * ease,
              from.y + (target.y - from.y) * ease,
            )
            .scale(from.k + (target.k - from.k) * ease),
        );
        if (t < 1) animation = requestAnimationFrame(frame);
      };
      animation = requestAnimationFrame(frame);
    };
    const showHover = (n: Point, event?: PointerEvent) => {
      if (dragged.current) return;
      hovered.current = n.id;
      render();
      const rect = el.getBoundingClientRect(),
        [sx, sy] = transform.apply([n.x, n.y]);
      const x = Math.max(
        12,
        Math.min(width - 280, event ? event.clientX - rect.x + 16 : sx + 18),
      );
      const y = Math.max(
        42,
        Math.min(height - 220, event ? event.clientY - rect.y + 20 : sy + 18),
      );
      setTooltip({
        id: n.id,
        title: n.title,
        summary: n.note.summary,
        kind:
          n.type === "research"
            ? "研究文献"
            : n.type === "organization"
              ? "研究机构"
              : "知识概念",
        sources: n.note.sources?.length || 0,
        x,
        y,
      });
    };
    groups
      .on("pointerenter", (event, n) => {
        if (event.pointerType !== "touch") showHover(n, event);
      })
      .on("pointerleave", clearHover)
      .on("focus", (_event, n) => showHover(n))
      .on("blur", clearHover)
      .on("click", (event, n) => {
        if (event.defaultPrevented) return;
        event.stopPropagation();
        callbacks.current.onSelect(n.id);
      })
      .on("dblclick", (event, n) => {
        event.preventDefault();
        event.stopPropagation();
        clearHover();
        callbacks.current.onOpen(n.id);
      })
      .on("keydown", (event, n) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          if (event.metaKey || event.ctrlKey) callbacks.current.onOpen(n.id);
          else {
            callbacks.current.onSelect(n.id);
          }
        }
      });
    root
      .on("click.clear", (event) => {
        if (
          !event.defaultPrevented &&
          !(event.target as Element).closest(".graph-node")
        ) {
          clearHover();
          callbacks.current.onClear();
        }
      })
      .on("keydown.graph", (event) => {
        if (event.key === "Escape") {
          clearHover();
          callbacks.current.onClear();
        }
        if (event.target !== el || event.ctrlKey || event.metaKey) return;
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          root.call(behavior.scaleBy, 1.2);
        } else if (event.key === "-") {
          event.preventDefault();
          root.call(behavior.scaleBy, 1 / 1.2);
        } else if (
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            event.key,
          )
        ) {
          event.preventDefault();
          const step = event.shiftKey ? 100 : 40;
          root.call(
            behavior.translateBy,
            (event.key === "ArrowLeft"
              ? step
              : event.key === "ArrowRight"
                ? -step
                : 0) / transform.k,
            (event.key === "ArrowUp"
              ? step
              : event.key === "ArrowDown"
                ? -step
                : 0) / transform.k,
          );
        }
      });
    const dragStarts = new Map<string, { x: number; y: number }>();
    groups.call(
      drag<SVGGElement, Point>()
        .container(stage.node()!)
        .clickDistance(5)
        .on("start", (event, n) => {
          cancelAnimation();
          event.sourceEvent.stopPropagation();
          clearHover();
          dragStarts.set(n.id, { x: event.x, y: event.y });
          n.fx = n.x;
          n.fy = n.y;
        })
        .on("drag", (event, n) => {
          const start = dragStarts.get(n.id);
          if (
            dragged.current !== n.id &&
            start &&
            Math.hypot(event.x - start.x, event.y - start.y) * transform.k < 5
          )
            return;
          dragged.current = n.id;
          hovered.current = null;
          setTooltip(null);
          groups.style("cursor", "grabbing");
          // During a D3 drag, active includes this gesture (it is at least one).
          // Wake the simulation immediately so collision and spring forces run.
          simulation
            .alpha(Math.max(0.3, simulation.alpha()))
            .alphaTarget(0.16)
            .restart();
          n.fx = event.x;
          n.fy = event.y;
          n.x = event.x;
          n.y = event.y;
          render();
        })
        .on("end", (event, n) => {
          const moved = dragged.current === n.id;
          dragStarts.delete(n.id);
          if (moved) {
            dragged.current = null;
            clearHover();
            if (!event.active) simulation.alphaTarget(0).restart();
          }
          n.fx = null;
          n.fy = null;
          groups.style("cursor", "pointer");
          render();
        }),
    );
    simulation.on("tick", render);
    el.setAttribute("viewBox", `0 0 ${width} ${height}`);
    fit(true);
    let viewportWidth = window.innerWidth,
      viewportHeight = window.innerHeight;
    const observer = new ResizeObserver(() => {
      if (
        Math.abs(width - el.clientWidth) < 1 &&
        Math.abs(height - el.clientHeight) < 1
      )
        return;
      width = el.clientWidth;
      height = el.clientHeight;
      el.setAttribute("viewBox", `0 0 ${width} ${height}`);
      const viewportChanged =
        window.innerWidth !== viewportWidth ||
        window.innerHeight !== viewportHeight;
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      // Opening the preview must keep the clicked node under the pointer.
      if (viewportChanged) fit();
      else render();
    });
    observer.observe(el);
    return () => {
      simulation.stop();
      observer.disconnect();
      cancelAnimation();
      root.on(".zoom", null).on(".clear", null).on(".graph", null);
      groups.on(".drag", null);
      refresh.current = () => {};
      focusNode.current = () => {};
      fitView.current = () => {};
      applyPreferences.current = () => {};
      zoomRef.current = null;
      hovered.current = null;
      dragged.current = null;
    };
  }, [notes, edges]);
  useEffect(() => {
    if (focusRequest) focusNode.current(focusRequest.id);
  }, [focusRequest]);
  const zoomBy = (factor: number) => {
    if (svg.current && zoomRef.current)
      select(svg.current).call(zoomRef.current.scaleBy, factor);
  };
  return (
    <div className="graph-canvas flat-canvas">
      <svg
        ref={svg}
        className="graph-svg"
        aria-label="可拖动缩放的平面知识图谱"
        tabIndex={0}
        style={{ cursor: "grab" }}
      />
      <div className="graph-coordinate">
        <span>NEBULA / CONNECTED KNOWLEDGE</span>
      </div>
      <button
        className={`graph-settings-trigger ${settingsOpen ? "active" : ""}`}
        aria-label="图谱设置"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((v) => !v)}
      >
        <SlidersHorizontal size={14} />
        <span>疏密与显示</span>
      </button>
      {settingsOpen && (
        <GraphSettings
          value={preferences}
          onChange={setPreferences}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {tooltip && (
        <div
          id="graph-node-tooltip"
          className="graph-node-tooltip"
          role="tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <small>
            {tooltip.kind}
            {tooltip.sources > 0 ? ` · ${tooltip.sources} 个原始来源` : ""}
          </small>
          <strong>{tooltip.title}</strong>
          {tooltip.summary && <p>{tooltip.summary}</p>}
          <footer>单击聚焦 · 双击阅读全文 · 拖动调整位置</footer>
        </div>
      )}
      <div className="graph-legend">
        <span>
          <i style={{ background: "#9de7b9" }} />
          概念
        </span>
        <span>
          <i style={{ background: "#98b2d3" }} />
          研究
        </span>
        <span>
          <i style={{ background: "#b9a6db" }} />
          机构
        </span>
      </div>
      <div className="graph-controls">
        <button aria-label="放大图谱" onClick={() => zoomBy(1.2)}>
          <Plus size={17} />
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button aria-label="缩小图谱" onClick={() => zoomBy(1 / 1.2)}>
          <Minus size={17} />
        </button>
        <b />
        <button
          aria-label="查看全图"
          title="缩放到全部节点"
          onClick={() => fitView.current()}
        >
          <Focus size={17} />
        </button>
        <button aria-label="清除聚焦" disabled={!selected} onClick={onClear}>
          <X size={15} />
        </button>
        <button
          aria-label={immersive ? "退出沉浸模式" : "沉浸模式"}
          onClick={onImmersive}
        >
          <Maximize size={16} />
        </button>
      </div>
      {!notes.length && (
        <div className="graph-empty">
          <Orbit size={36} />
          <h3>还没有匹配的知识点</h3>
          <p>调整筛选，或新建文档开始连接。</p>
        </div>
      )}
    </div>
  );
}
