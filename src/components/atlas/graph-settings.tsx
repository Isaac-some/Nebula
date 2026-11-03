"use client";
import { RotateCcw, X } from "lucide-react";
import {
  graphDefaults,
  graphPreferenceRanges,
  type GraphPreferences,
} from "@/lib/graph-view";
const controls: {
  key: keyof GraphPreferences;
  label: string;
  hint: string;
  step: number;
  unit?: string;
}[] = [
  { key: "centerForce", label: "向心力", hint: "越大，图谱越聚拢", step: 0.01 },
  { key: "repelForce", label: "排斥力", hint: "越大，节点越分散", step: 0.5 },
  {
    key: "linkForce",
    label: "连接拉力",
    hint: "越大，关联节点靠得越近",
    step: 0.01,
  },
  {
    key: "linkDistance",
    label: "连线长度",
    hint: "越长，关联节点间距越大",
    step: 5,
  },
  {
    key: "labelDensity",
    label: "文字密度",
    hint: "放大时会逐步显示更多名称",
    step: 0.05,
  },
  {
    key: "nodeSize",
    label: "节点大小",
    hint: "连接越多的节点会更大",
    step: 0.05,
  },
  {
    key: "lineWidth",
    label: "连线粗细",
    hint: "悬浮节点时突出相关连线",
    step: 0.1,
  },
];
export default function GraphSettings({
  value,
  onChange,
  onClose,
}: {
  value: GraphPreferences;
  onChange: (next: GraphPreferences) => void;
  onClose: () => void;
}) {
  return (
    <section className="graph-settings" aria-label="图谱显示与力度设置">
      <header>
        <strong>疏密与显示</strong>
        <button aria-label="关闭图谱设置" onClick={onClose}>
          <X size={15} />
        </button>
      </header>
      <p>按自己的阅读习惯调整，自动保存在这台设备。</p>
      {controls.map((c, i) => (
        <div
          key={c.key}
          className={`graph-setting-row ${i === 4 ? "section-break" : ""}`}
        >
          <label htmlFor={`graph-${c.key}`}>
            {c.label}
            <output>{Number(value[c.key].toFixed(2))}</output>
          </label>
          <input
            id={`graph-${c.key}`}
            type="range"
            min={graphPreferenceRanges[c.key][0]}
            max={graphPreferenceRanges[c.key][1]}
            step={c.step}
            value={value[c.key]}
            onChange={(e) =>
              onChange({ ...value, [c.key]: Number(e.target.value) })
            }
          />
          <small>{c.hint}</small>
        </div>
      ))}
      <button
        className="graph-settings-reset"
        onClick={() => onChange({ ...graphDefaults })}
      >
        <RotateCcw size={13} />
        恢复默认
      </button>
    </section>
  );
}
