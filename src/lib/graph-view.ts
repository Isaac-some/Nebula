export type GraphPreferences = {
  centerForce: number;
  repelForce: number;
  linkForce: number;
  linkDistance: number;
  labelDensity: number;
  nodeSize: number;
  lineWidth: number;
};
export const graphDefaults: GraphPreferences = {
  centerForce: 0.12,
  repelForce: 12,
  linkForce: 0.35,
  linkDistance: 230,
  labelDensity: 0.65,
  nodeSize: 1,
  lineWidth: 0.7,
};
export const graphPreferenceRanges: Record<
  keyof GraphPreferences,
  [number, number]
> = {
  centerForce: [0, 1],
  repelForce: [0, 20],
  linkForce: [0, 1],
  linkDistance: [60, 450],
  labelDensity: [0.15, 1.4],
  nodeSize: [0.6, 1.8],
  lineWidth: [0.2, 2],
};
export function graphPreferences(value: unknown): GraphPreferences {
  const result = { ...graphDefaults };
  if (!value || typeof value !== "object") return result;
  for (const key of Object.keys(result) as (keyof GraphPreferences)[]) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      const [min, max] = graphPreferenceRanges[key];
      result[key] = Math.min(max, Math.max(min, v));
    }
  }
  return result;
}
export type LabelCandidate = {
  id: string;
  text: string;
  x: number;
  y: number;
  radius: number;
  font: number;
  opacity: number;
  priority: number;
  essential: boolean;
};
export type LabelPlacement = {
  id: string;
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  font: number;
  opacity: number;
};
type Rect = { x: number; y: number; width: number; height: number };
function intersects(a: Rect, b: Rect, padding = 4) {
  return (
    a.x < b.x + b.width + padding &&
    a.x + a.width + padding > b.x &&
    a.y < b.y + b.height + padding &&
    a.y + a.height + padding > b.y
  );
}
// Work in screen pixels so zoomed text and labels have the same collision geometry.
export function placeGraphLabels(
  candidates: LabelCandidate[],
  width: number,
  height: number,
  budget: number,
  measure: (text: string, font: number) => number,
): LabelPlacement[] {
  const placed: Rect[] = [],
    result: LabelPlacement[] = [];
  const sorted = [...candidates].sort(
    (a, b) =>
      Number(b.essential) - Number(a.essential) ||
      b.priority - a.priority ||
      a.id.localeCompare(b.id),
  );
  for (const n of sorted) {
    if ((!n.essential && result.length >= budget) || n.opacity < 0.22) continue;
    const w = measure(n.text, n.font),
      h = n.font * 1.2;
    const proposals: {
      x: number;
      y: number;
      anchor: LabelPlacement["anchor"];
      rect: Rect;
    }[] = [
      {
        x: n.x,
        y: n.y + n.radius + 7 + h * 0.8,
        anchor: "middle",
        rect: { x: n.x - w / 2, y: n.y + n.radius + 7, width: w, height: h },
      },
      {
        x: n.x + n.radius + 9,
        y: n.y + h * 0.3,
        anchor: "start",
        rect: { x: n.x + n.radius + 9, y: n.y - h * 0.5, width: w, height: h },
      },
      {
        x: n.x - n.radius - 9,
        y: n.y + h * 0.3,
        anchor: "end",
        rect: {
          x: n.x - n.radius - 9 - w,
          y: n.y - h * 0.5,
          width: w,
          height: h,
        },
      },
      {
        x: n.x,
        y: n.y - n.radius - 9,
        anchor: "middle",
        rect: {
          x: n.x - w / 2,
          y: n.y - n.radius - 9 - h * 0.8,
          width: w,
          height: h,
        },
      },
    ];
    const position = proposals.find(
      (p) =>
        p.rect.x > 12 &&
        p.rect.x + p.rect.width < width - 12 &&
        p.rect.y > 42 &&
        p.rect.y + p.rect.height < height - 142 &&
        !placed.some((r) => intersects(p.rect, r)) &&
        !candidates.some(
          (other) =>
            other.id !== n.id &&
            intersects(
              p.rect,
              {
                x: other.x - other.radius - 2,
                y: other.y - other.radius - 2,
                width: (other.radius + 2) * 2,
                height: (other.radius + 2) * 2,
              },
              1,
            ),
        ),
    );
    if (position) {
      placed.push(position.rect);
      result.push({
        id: n.id,
        x: position.x,
        y: position.y,
        anchor: position.anchor,
        font: n.font,
        opacity: n.opacity,
      });
    }
  }
  return result;
}
