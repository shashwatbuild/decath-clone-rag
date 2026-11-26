"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { TopBar } from "@/components/ui";
import { products, img, inr } from "@/lib/products";
import { garmentKind, garmentColour, manualPlacement, placement, type GarmentKind, type Placement, type Point } from "@/lib/tryon/geometry";
import LabProduct from "@/components/lab/LabProduct";
import { toLite } from "@/lib/products";

const eligible = products.filter(p => garmentKind(p));
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
async function createTracker() {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM);
  return PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL, delegate: "CPU" }, runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: .5, minPosePresenceConfidence: .5, minTrackingConfidence: .5 });
}
function shape(ctx: CanvasRenderingContext2D, kind: GarmentKind) {
  const points = kind === "top" ? [[.3,0],[.42,.06],[.58,.06],[.7,0],[1,.28],[.83,.44],[.73,.32],[.73,1],[.27,1],[.27,.32],[.17,.44],[0,.28]] : [[.12,0],[.88,0],[.98,1],[.57,1],[.5,.36],[.43,1],[.02,1]];
  ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
}
function drawGarment(ctx: CanvasRenderingContext2D, box: Placement, kind: GarmentKind, colour: string, photo: HTMLImageElement | null, texture: boolean, alpha: number, zoom: number, x: number, y: number, crop: number) {
  ctx.save(); ctx.translate(box.x + x, box.y + y); ctx.rotate(box.angle); ctx.translate(-box.width * zoom / 2, -box.height * zoom / 2); ctx.scale(box.width * zoom, box.height * zoom);
  shape(ctx, kind); ctx.clip(); ctx.globalAlpha = alpha;
  ctx.fillStyle = colour; ctx.fillRect(0,0,1,1);
  if (texture && photo?.complete && photo.naturalWidth) {
    const sx = photo.naturalWidth * .18, sy = photo.naturalHeight * crop, sw = photo.naturalWidth * .64, sh = Math.min(photo.naturalHeight - sy, photo.naturalHeight * (kind === "top" ? .52 : .55));
    ctx.drawImage(photo, sx, sy, sw, sh, 0,0,1,1);
  }
  ctx.globalAlpha = .65; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = .006; shape(ctx, kind); ctx.stroke(); ctx.restore();
}
function drawDemo(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#eef0f5"; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = "#d3d8e2"; ctx.beginPath(); ctx.ellipse(w*.5,h*.16,w*.065,h*.065,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = "#c9cfdb"; ctx.lineWidth = w*.1; ctx.lineCap = "round";
  for (const [a,b,c,d] of [[.5,.27,.5,.58],[.37,.29,.25,.55],[.63,.29,.75,.55],[.44,.6,.4,.94],[.56,.6,.6,.94]]) { ctx.beginPath(); ctx.moveTo(w*a,h*b); ctx.lineTo(w*c,h*d); ctx.stroke(); }
}
export default function LivePreview() {
  const params = useSearchParams();
  const [productId, setProductId] = useState(eligible[0].id);
  const p = eligible.find(p => p.id === productId) ?? eligible[0]; const kind = garmentKind(p)!;
  const [live, setLive] = useState(false); const [starting, setStarting] = useState(false); const [tracking, setTracking] = useState("Camera off · demo silhouette"); const [error, setError] = useState("");
  const [checking, setChecking] = useState(false); const [support, setSupport] = useState("");
  const [imageReady, setImageReady] = useState(false);
  const [alignment, setAlignment] = useState<"auto" | "manual">("auto"); const [showJoints, setShowJoints] = useState(true);
  const [texture, setTexture] = useState(false); const [alpha, setAlpha] = useState(.8); const [zoom, setZoom] = useState(1); const [x, setX] = useState(0); const [y, setY] = useState(0); const [crop, setCrop] = useState(.15); const [mirror, setMirror] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null); const video = useRef<HTMLVideoElement>(null); const stream = useRef<MediaStream | null>(null); const detector = useRef<PoseLandmarker | null>(null); const frame = useRef(0); const active = useRef(false); const trackingLabel = useRef(""); const generation = useRef(0);
  const photo = useRef<HTMLImageElement | null>(null);
  const drawing = useRef({ kind, colour: garmentColour(p.name), texture, alpha, zoom, x, y, crop, mirror, alignment, showJoints });
  drawing.current = { kind, colour: garmentColour(p.name), texture, alpha, zoom, x, y, crop, mirror, alignment, showJoints };
  useEffect(() => { const id = params.get("product"); if (id && eligible.some(p => p.id === id)) setProductId(id); }, [params]);
  useEffect(() => {
    const image = new Image(); image.crossOrigin = "anonymous"; image.src = img(p.images[0], 700);
    setImageReady(false);
    image.onload = () => { setImageReady(true); photo.current = image; if (!active.current) drawStill(); }; image.onerror = () => { setImageReady(false); photo.current = null; };
    photo.current = null;
    setCrop(kind === "top" ? .12 : .35);
    return () => { image.onload = null; image.onerror = null; };
  // drawStill reads the latest drawing controls from refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, kind]);
  function drawStill() {
    const c = canvas.current; if (!c || active.current) return; c.width = 600; c.height = 800;
    const ctx = c.getContext("2d"); if (!ctx) return; drawDemo(ctx,600,800); const d = drawing.current;
    drawGarment(ctx, manualPlacement(d.kind,600,800), d.kind,d.colour,photo.current,d.texture,d.alpha,d.zoom,d.x,d.y,d.crop);
  }
  useEffect(() => { drawStill(); });
  function stopCamera() {
    generation.current++; active.current = false; cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
    detector.current?.close(); detector.current = null; if (video.current) video.current.srcObject = null;
    setLive(false); setStarting(false); setTracking("Camera off · demo silhouette");
  }
  useEffect(() => {
    const hide = () => { if (document.hidden) stopCamera(); };
    document.addEventListener("visibilitychange", hide);
    // These refs hold camera resources and cancellation state, not DOM nodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { generation.current++; active.current = false; cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach(t => t.stop()); detector.current?.close(); document.removeEventListener("visibilitychange", hide); };
  }, []);
  async function startCamera() {
    if (starting || live) return;
    setError(""); setStarting(true); const run = ++generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access needs HTTPS or localhost and a supported browser. You can still use the demo silhouette.");
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } }, audio: false });
      if (run !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media; if (!video.current) throw new Error("Camera view is unavailable."); video.current.srcObject = media; await video.current.play();
      if (run !== generation.current) return;
      active.current = true; setLive(true); setStarting(false); setTracking("Camera live · loading on-device tracking");
      let previousTime = -1; let lastInference = 0; let points: Point[] = []; let smooth: Placement | null = null; let lastKind: GarmentKind | null = null; let engineState = "loading"; let inferenceFailed = false;
      const tick = () => {
        if (!active.current || run !== generation.current) return;
        const v = video.current, c = canvas.current;
        if (v && c && v.readyState >= 2) {
          c.width = v.videoWidth; c.height = v.videoHeight; const ctx = c.getContext("2d"); const d = drawing.current;
          if (ctx) {
            const now = performance.now();
            if (detector.current && now - lastInference > 100 && v.currentTime !== previousTime) {
              try { points = detector.current.detectForVideo(v, now).landmarks[0] ?? []; }
              catch { points = []; inferenceFailed = true; }
              lastInference = now; previousTime = v.currentTime;
            }
            ctx.save(); if (d.mirror) { ctx.translate(c.width,0); ctx.scale(-1,1); } ctx.drawImage(v,0,0,c.width,c.height);
            const tracked = d.alignment === "auto" ? placement(points,d.kind,c.width,c.height) : null;
            if (tracked) {
              if (!smooth || lastKind !== d.kind) smooth = tracked;
              else smooth = { x: smooth.x + .35 * (tracked.x - smooth.x), y: smooth.y + .35 * (tracked.y - smooth.y), width: smooth.width + .35 * (tracked.width - smooth.width), height: smooth.height + .35 * (tracked.height - smooth.height), angle: smooth.angle + .35 * (tracked.angle - smooth.angle) };
            } else smooth = null;
            lastKind = d.kind;
            const body = d.kind === "top" ? "shoulders and hips" : d.kind === "shorts" ? "hips and knees" : "hips and ankles";
            const label = d.alignment === "manual" ? "Manual alignment selected · adjust the sliders" : engineState === "loading" ? "Camera live · downloading tracking model…" : engineState === "failed" ? "Tracking unavailable · manual alignment active" : inferenceFailed ? "Tracking interrupted · stop and restart the camera" : tracked?.estimated ? "Shoulders detected · torso length estimated; show hips for better alignment" : tracked ? "Body detected · smoothed approximate overlay" : `Body not fully visible · stand back to show ${body}, face the camera and improve lighting`;
            if (label !== trackingLabel.current) { trackingLabel.current = label; setTracking(label); }
            drawGarment(ctx,smooth ?? manualPlacement(d.kind,c.width,c.height),d.kind,d.colour,photo.current,d.texture,d.alpha,d.zoom,d.x,d.y,d.crop);
            if (d.showJoints && d.alignment === "auto" && engineState === "ready") {
              const indices = d.kind === "top" ? [11,12,23,24] : d.kind === "shorts" ? [23,24,25,26] : [23,24,27,28];
              ctx.fillStyle = "#28e0af";
              for (const i of indices) { const joint = points[i]; if (joint && (joint.visibility ?? 1) >= .45) { ctx.beginPath(); ctx.arc(joint.x*c.width,joint.y*c.height,Math.max(4,c.width*.007),0,Math.PI*2); ctx.fill(); } }
            }
            ctx.restore();
          }
        }
        frame.current = requestAnimationFrame(tick);
      };
      tick();
      try {
        const pose = await createTracker();
        if (run !== generation.current || !active.current) { pose.close(); return; }
        detector.current = pose; engineState = "ready";
      } catch { engineState = "failed"; if (run === generation.current) setError("Pose tracking could not load. The camera still works with manual positioning. Check your connection or retry the camera."); }
    } catch (e) {
      if (run !== generation.current) return; stopCamera();
      setError(e instanceof DOMException && e.name === "NotAllowedError" ? "Camera permission was denied. Allow it in your browser to use the live view, or continue with the demo silhouette." : e instanceof Error ? e.message : "Could not open the camera.");
    }
  }
  return <main className="bg-[#f7f8fa] min-h-[var(--app-h)] pb-10"><TopBar title="Live outfit preview" /><div className="px-4 pt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6 lg:items-start">
    <section className="lab-panel"><div className="flex items-start justify-between gap-4 mb-4"><div><p className="lab-eyebrow">See the colour. Explore the silhouette.</p><h2 className="text-[21px] font-semibold tracking-tight mt-2">A quick look before you choose.</h2></div><span className="lab-badge shrink-0">2D preview</span></div>
      <p className="text-[13px] text-muted mb-4">{live ? "Your camera is on. Frames stay in this browser; no recording or image upload is performed." : "Camera is off. The mannequin below is a demo, not your body."}</p>
      <div className="flex flex-wrap gap-2 mb-4"><button className="lab-button lab-button-primary" disabled={starting || live} onClick={startCamera}>{starting ? "Opening camera…" : "Start camera"}</button><button className="lab-button" disabled={!live && !starting} onClick={stopCamera}>Stop camera</button><label className="lab-check"><input type="checkbox" checked={mirror} onChange={e => setMirror(e.target.checked)} />Mirror live view</label></div>
      <div className="relative overflow-hidden rounded-2xl bg-[#eef0f5]"><video ref={video} muted playsInline className="absolute h-px w-px opacity-0 pointer-events-none" aria-hidden /><canvas ref={canvas} className="block w-full max-h-[65dvh] object-contain" aria-label={live ? "Live camera with approximate clothing overlay" : "Demo mannequin with selected garment silhouette"} /><span className="absolute top-3 left-3 rounded-lg bg-white/95 px-3 py-2 text-[11px] font-semibold text-brand">{live ? "LIVE · on this device" : "DEMO · camera off"}</span></div>
      <p role="status" className="mt-3 text-[12px] text-muted">{tracking}</p>{texture && !imageReady && <p className="text-[12px] text-muted mt-2">Catalogue image is loading or unavailable. Showing the colour silhouette until it is ready.</p>}{error && <p role="alert" className="lab-notice mt-3">{error}</p>}

      <p className="text-[12px] text-muted mt-3">Tops can follow visible shoulders with an estimated length; show hips for better alignment; for shorts, hips and knees; for pants, hips and ankles. Green dots show the joints the overlay uses. Keep one person in frame, face forward and use even lighting.</p>
      <p className="lab-notice mt-4">Visual approximation only. This does not simulate fabric, size, drape or fit. Catalogue crops may contain a model or background; the silhouette mode previews a colour inferred from the product name.</p>
    </section>
    <aside className="space-y-4 mt-5 lg:mt-0"><section className="lab-panel"><h2 className="font-semibold">Choose your clothing</h2><label className="lab-label mt-4">Selected product<select className="lab-input" value={p.id} onChange={e => setProductId(e.target.value)}>{eligible.map(p => <option key={p.id} value={p.id}>{p.shortName}</option>)}</select></label><p className="text-[12px] text-muted mt-2">Tops, shorts, yoga pants and supported badminton clothing. Equipment and shoes are not offered as clothing try-ons.</p><div className="mt-4"><LabProduct key={p.id} product={{ ...toLite(p), sizes: p.sizes, inStock: p.inStock, weightKg: p.weightKg }} /></div><Link href={`/p/${p.id}`} className="block mt-3 text-[13px] text-brand underline">Product details · {inr(p.price)}</Link></section>
      <section className="lab-panel"><h2 className="font-semibold">Fine-tune the preview</h2><label className="lab-label mt-4">Alignment<select className="lab-input" value={alignment} onChange={e => setAlignment(e.target.value as "auto" | "manual")}><option value="auto">Follow my body</option><option value="manual">Manual positioning</option></select></label><label className="lab-check mt-3"><input type="checkbox" checked={showJoints} onChange={e => setShowJoints(e.target.checked)} />Show tracking points</label><button className="lab-button mt-4" disabled={checking || live || starting} onClick={async () => {
          setChecking(true); setSupport("");
          try { const pose = await createTracker(); try { if (canvas.current) pose.detectForVideo(canvas.current, performance.now()); setSupport("Pose engine loaded and inference passed. Camera stayed off."); } finally { pose.close(); } }
          catch { setSupport("Pose tracking could not initialise on this device. Manual alignment remains available."); }
          finally { setChecking(false); }
        }}>{checking ? "Checking tracking engine…" : "Check tracking engine"}</button>{support && <p role="status" className="text-[12px] text-muted mt-2">{support}</p>}<label className="lab-label mt-4">Preview mode<select className="lab-input" value={texture ? "texture" : "silhouette"} onChange={e => setTexture(e.target.value === "texture")}><option value="silhouette">Colour & silhouette</option><option value="texture">Catalogue crop · approximate</option></select></label>
        {([["Scale", zoom, .5, 1.8, .05, setZoom], ["Horizontal offset", x, -200, 200, 5, setX], ["Vertical offset", y, -250, 250, 5, setY], ["Opacity", alpha, .2, 1, .05, setAlpha], ...(texture ? [["Crop starts at", crop, 0, .7, .01, setCrop]] : [])] as [string, number, number, number, number, (n: number) => void][]).map(([label,value,min,max,step,setter]) => <label key={label} className="lab-label mt-4">{label}<input type="range" min={min} max={max} step={step} value={value} onChange={e => setter(Number(e.target.value))} className="w-full accent-[var(--color-brand)]" /></label>)}
        <button className="lab-button mt-4" onClick={() => { setZoom(1); setX(0); setY(0); setAlpha(.8); setCrop(kind === "top" ? .12 : .35); }}>Reset alignment</button>
      </section><Link href="/lab" className="lab-button w-full">Back to my Gear Lab →</Link>
    </aside>
  </div></main>;
}
