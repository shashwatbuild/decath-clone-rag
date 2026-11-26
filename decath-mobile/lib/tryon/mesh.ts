import type { Point } from "./geometry";
export type Vec = { x: number; y: number };
export type Rig = { leftShoulder: Vec; rightShoulder: Vec; leftHip: Vec; rightHip: Vec; estimated?: boolean };
export type Vertex = { source: Vec; target: Vec };
export const visible = (p?: Point) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 && (p.visibility ?? 1) >= .5;
const lerp = (a: Vec, b: Vec, t: number): Vec => ({ x: a.x+(b.x-a.x)*t, y: a.y+(b.y-a.y)*t });
const length = (a: Vec, b: Vec) => Math.hypot(a.x-b.x,a.y-b.y);
export function bodyRig(points: Point[], width: number, height: number): Rig | null {
  if (!visible(points[11]) || !visible(points[12])) return null;
  // A single front photograph must not be stretched into a side/back view.
  if (Number.isFinite(points[11].z) && Number.isFinite(points[12].z) && Math.abs(points[11].z!-points[12].z!) > Math.abs(points[11].x-points[12].x)*1.4) return null;
  const pixel = (i: number) => ({ x: points[i].x*width, y: points[i].y*height });
  const shoulders = [pixel(11),pixel(12)].sort((a,b)=>a.x-b.x);
  const span = length(...shoulders as [Vec,Vec]);
  if (span < width*.06 || span > width*.9) return null;
  const full = visible(points[23]) && visible(points[24]);
  const hips = full ? [pixel(23),pixel(24)].sort((a,b)=>a.x-b.x) : shoulders.map((s,i) => ({ x: s.x+(i ? -1 : 1)*span*.1, y: s.y+span*1.45 }));
  if ((hips[0].y+hips[1].y-shoulders[0].y-shoulders[1].y)/2 < span*.45) return null;
  const tilt = Math.abs(shoulders[1].y-shoulders[0].y)/span;
  if (tilt > .6) return null;
  return { leftShoulder: shoulders[0], rightShoulder: shoulders[1], leftHip: hips[0], rightHip: hips[1], estimated: !full };
}
export function smoothRig(previous: Rig | null, next: Rig, amount = .4): Rig {
  if (!previous) return next;
  return { leftShoulder: lerp(previous.leftShoulder,next.leftShoulder,amount), rightShoulder: lerp(previous.rightShoulder,next.rightShoulder,amount), leftHip: lerp(previous.leftHip,next.leftHip,amount), rightHip: lerp(previous.rightHip,next.rightHip,amount), estimated: next.estimated };
}
/** Piecewise-affine textured mesh. Source shoulder/hip coordinates retain real collar,
 * print and hem pixels while the torso changes width and angle independently. */
export function garmentMesh(source: Rig, target: Rig, w: number, h: number, scale = 1, offset = 0, columns = 4, rows = 12): Vertex[][] {
  const sourceTop = lerp(source.leftShoulder,source.rightShoulder,.5), sourceBottom = lerp(source.leftHip,source.rightHip,.5);
  const targetTop = lerp(target.leftShoulder,target.rightShoulder,.5);
  const sourceH = sourceBottom.y-sourceTop.y;
  if (sourceH <= 0) return [];
  const vertices: Vertex[][] = [];
  for (let row=0;row<=rows;row++) {
    const line: Vertex[] = [];
    for (let col=0;col<=columns;col++) {
      const p = { x: col*w/columns, y: row*h/rows };
      const v = (p.y-sourceTop.y)/sourceH;
      const sourceLeft = lerp(source.leftShoulder,source.leftHip,v), sourceRight = lerp(source.rightShoulder,source.rightHip,v);
      const sourceWidth = sourceRight.x-sourceLeft.x;
      const u = (p.x-(sourceLeft.x+sourceRight.x)/2)/Math.max(1,sourceWidth);
      const left = lerp(target.leftShoulder,target.leftHip,v), right = lerp(target.rightShoulder,target.rightHip,v);
      const centre = lerp(left,right,.5);
      // Extra ease belongs to the garment photo; adjustment scales around the torso centre.
      line.push({ source:p, target:{x:targetTop.x+(centre.x-targetTop.x)*scale+(right.x-left.x)*u*scale, y:targetTop.y+(centre.y-targetTop.y)*scale+(right.y-left.y)*u*scale+offset} });
    }
    vertices.push(line);
  }
  return vertices;
}
export function drawTriangle(ctx: CanvasRenderingContext2D, image: CanvasImageSource, a: Vertex, b: Vertex, c: Vertex) {
  const [s0,s1,s2] = [a.source,b.source,c.source], [d0,d1,d2] = [a.target,b.target,c.target];
  const det = (s1.x-s0.x)*(s2.y-s0.y)-(s2.x-s0.x)*(s1.y-s0.y);
  if (Math.abs(det) < 1e-6) return;
  const ax = ((d1.x-d0.x)*(s2.y-s0.y)-(d2.x-d0.x)*(s1.y-s0.y))/det;
  const bx = ((d2.x-d0.x)*(s1.x-s0.x)-(d1.x-d0.x)*(s2.x-s0.x))/det;
  const ay = ((d1.y-d0.y)*(s2.y-s0.y)-(d2.y-d0.y)*(s1.y-s0.y))/det;
  const by = ((d2.y-d0.y)*(s1.x-s0.x)-(d1.y-d0.y)*(s2.x-s0.x))/det;
  ctx.save(); ctx.beginPath(); ctx.moveTo(d0.x,d0.y);ctx.lineTo(d1.x,d1.y);ctx.lineTo(d2.x,d2.y);ctx.closePath();ctx.clip();
  ctx.transform(ax,ay,bx,by,d0.x-ax*s0.x-bx*s0.y,d0.y-ay*s0.x-by*s0.y);ctx.drawImage(image,0,0);ctx.restore();
}
export function drawMesh(ctx: CanvasRenderingContext2D, image: CanvasImageSource, vertices: Vertex[][]) {
  for(let r=0;r<vertices.length-1;r++) for(let c=0;c<vertices[r].length-1;c++) {
    drawTriangle(ctx,image,vertices[r][c],vertices[r][c+1],vertices[r+1][c]);
    drawTriangle(ctx,image,vertices[r][c+1],vertices[r+1][c+1],vertices[r+1][c]);
  }
}
