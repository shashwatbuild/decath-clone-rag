import type { Product } from "../types";
export type GarmentKind = "top" | "shorts" | "pants";
export type Point = { x: number; y: number; visibility?: number; z?: number };
export type Placement = { x: number; y: number; width: number; height: number; angle: number; estimated?: boolean };
export function garmentKind(p: Pick<Product, "category" | "name">): GarmentKind | null {
  if (["T-Shirts", "Running Tops"].includes(p.category)) return "top";
  if (p.category === "Running Shorts") return "shorts";
  if (p.category === "Yoga Pants") return /capri/i.test(p.name) ? "shorts" : "pants";
  if (p.category === "Badminton Apparel") return /short/i.test(p.name) ? "shorts" : /shirt|top/i.test(p.name) ? "top" : null;
  return null;
}
export function garmentColour(name: string) {
  const colours: [RegExp, string][] = [[/black/i, "#262833"], [/white|cream|beige/i, "#e9e4d9"], [/blue|teal/i, "#426b86"], [/green|lime/i, "#738777"], [/pink|purple/i, "#a2708f"], [/red|orange/i, "#b86558"], [/grey|gray/i, "#777c85"]];
  return colours.find(([r]) => r.test(name))?.[1] ?? "#526080";
}
export function placement(points: Point[], kind: GarmentKind, width: number, height: number): Placement | null {
  const needed = kind === "top" ? [11, 12, 23, 24] : kind === "pants" ? [23, 24, 27, 28] : [23, 24, 25, 26];
  const visible = (i: number) => points[i] && Number.isFinite(points[i].x) && Number.isFinite(points[i].y) && points[i].x >= 0 && points[i].x <= 1 && points[i].y >= 0 && points[i].y <= 1 && (points[i].visibility ?? 1) >= .45;
  if (needed.some(i => !visible(i))) {
    // A laptop camera may see only the upper torso. Anchor a labelled estimate
    // to actual shoulders instead of leaving the shirt fixed in the centre.
    if (kind !== "top" || !visible(11) || !visible(12)) return null;
    const a = { x: points[11].x * width, y: points[11].y * height };
    const b = { x: points[12].x * width, y: points[12].y * height };
    const span = Math.hypot(a.x-b.x,a.y-b.y);
    if (span < 10) return null;
    const left = a.x < b.x ? a : b, right = a.x < b.x ? b : a;
    const tilt = Math.atan2(right.y-left.y,right.x-left.x);
    const torsoHeight = span * 1.4;
    return { x: (a.x+b.x)/2 - Math.sin(tilt)*torsoHeight*.4, y: (a.y+b.y)/2 + Math.cos(tilt)*torsoHeight*.4, width: span*1.6, height: torsoHeight, angle: tilt, estimated: true };
  }
  const [a, b, c, d] = needed.map(i => ({ x: points[i].x * width, y: points[i].y * height }));
  const start = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const end = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 };
  const span = Math.hypot(a.x - b.x, a.y - b.y);
  if (span < 10 || end.y <= start.y + 10) return null;
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, width: span * (kind === "top" ? 1.6 : 1.65), height: (end.y - start.y) * (kind === "top" ? 1.25 : 1.15), angle: Math.atan2(end.y - start.y, end.x - start.x) - Math.PI / 2 };
}
export function manualPlacement(kind: GarmentKind, w: number, h: number): Placement {
  return { x: w * .5, y: h * (kind === "top" ? .39 : .68), width: w * .47, height: h * (kind === "top" ? .34 : kind === "shorts" ? .25 : .48), angle: 0 };
}
