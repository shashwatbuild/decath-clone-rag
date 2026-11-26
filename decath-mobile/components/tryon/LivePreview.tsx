"use client";
/* eslint-disable @next/next/no-img-element -- catalogue and in-memory transparent layer are canvas inputs */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/ui";
import { products, getProduct, img, toLite } from "@/lib/products";
import { DEFAULT_FITTING_PRODUCT, FITTING_ASSETS, supportsFitting } from "@/lib/tryon/assets";
import { FittingRenderer, type GarmentLayer } from "@/lib/tryon/renderer";
import type { Point } from "@/lib/tryon/geometry";
import type { Rig } from "@/lib/tryon/mesh";
import LabProduct from "@/components/lab/LabProduct";
const eligible=products.filter(p=>supportsFitting(p.id));
type Frame = {points:Point[];occlusion:{data:ArrayBuffer;width:number;height:number}|null;received:number;timestamp:number;inferenceMs:number};
type Reply = {type:string;timestamp?:number;id?:number;phase?:string;message?:string;image?:ImageBitmap;rig?:Rig;width?:number;height?:number;points?:Point[];occlusion?:ArrayBuffer;maskWidth?:number;maskHeight?:number;inferenceMs?:number};
export default function LivePreview(){
  const params=useSearchParams();
  const [productId,setProductId]=useState(DEFAULT_FITTING_PRODUCT);
  const p=getProduct(productId)!;
  const requested=params.get("product");
  const unsupported=!!requested && !!getProduct(requested) && !supportsFitting(requested);
  const [live,setLive]=useState(false),[starting,setStarting]=useState(false),[error,setError]=useState("");
  const [assetReady,setAssetReady]=useState(false),[retry,setRetry]=useState(0);
  const [status,setStatus]=useState("Camera off"),[mirror,setMirror]=useState(true),[compare,setCompare]=useState(false),[scale,setScale]=useState(1.08),[offset,setOffset]=useState(0);
  const [cutout,setCutout]=useState<string|null>(null);
  const video=useRef<HTMLVideoElement>(null),canvas=useRef<HTMLCanvasElement>(null),stream=useRef<MediaStream|null>(null),worker=useRef<Worker|null>(null);
  const maskWorker=useRef<Worker|null>(null),maskReady=useRef(false),maskBusy=useRef(false);
  const foreground=useRef<{data:ArrayBuffer;width:number;height:number;points:Point[];received:number}|null>(null);
  const maskPoints=useRef<Point[]>([]);
  const startup=useRef<Promise<Worker>|null>(null),workerReady=useRef(false),generation=useRef(0),assetGeneration=useRef(0),active=useRef(false),animation=useRef(0),inflight=useRef(false);
  const layer=useRef<GarmentLayer|null>(null),result=useRef<Frame|null>(null),renderer=useRef<FittingRenderer|null>(null);
  const pending=useRef(new Map<number,{resolve:(layer:GarmentLayer)=>void;reject:(error:Error)=>void}>());
  const settings=useRef({mirror,compare,scale,offset,productId});settings.current={mirror,compare,scale,offset,productId};
  const mounted=useRef(true);
  useEffect(()=>{if(requested && supportsFitting(requested))setProductId(requested);},[requested]);
  function getEngine():Promise<Worker>{
    if(startup.current)return startup.current;
    startup.current=new Promise((resolve,reject)=>{
      if(typeof Worker==="undefined" || typeof OffscreenCanvas==="undefined"){reject(new Error("Camera preview is not supported in this browser. Try a recent Chrome, Edge or Safari."));return;}
      const w=new Worker(new URL("../../lib/tryon/vision.worker.ts",import.meta.url));worker.current=w;
      let settled=false;
      const timeout=setTimeout(()=>fail("The preview took too long to get ready. Check your connection and retry."),90000);
      function fail(message:string){
        if(worker.current!==w)return;
        clearTimeout(timeout);workerReady.current=false;
        if(!settled){settled=true;reject(new Error(message));}
        for(const task of pending.current.values())task.reject(new Error(message));pending.current.clear();
        w.terminate();if(worker.current===w){worker.current=null;startup.current=null;}
        if(mounted.current){setError(message);}
      }
      w.onerror=()=>fail("The preview could not start. Please retry.");
      w.onmessage=(event:MessageEvent<Reply>)=>{
        const m=event.data;
        if(m.type==="ready"){
          clearTimeout(timeout);settled=true;workerReady.current=true;
          resolve(w);
        }else if(m.type==="asset"){
          const task=pending.current.get(m.id!);pending.current.delete(m.id!);
          if(task && m.image && m.rig)task.resolve({image:m.image,rig:m.rig,width:m.width!,height:m.height!});else m.image?.close();
        }else if(m.type==="frame"){
          if(m.id!==generation.current)return;
          inflight.current=false;result.current={points:m.points??[],occlusion:m.occlusion?{data:m.occlusion,width:m.maskWidth!,height:m.maskHeight!}:null,received:performance.now(),timestamp:m.timestamp??performance.now(),inferenceMs:m.inferenceMs??0};
        }else if(m.type==="error"){
          if(m.phase==="init"){fail(m.message??"Could not load the models.");return;}
          if(m.phase==="asset"){const task=pending.current.get(m.id!);pending.current.delete(m.id!);task?.reject(new Error(m.message));}
          if(m.phase==="frame" && m.id===generation.current){inflight.current=false;result.current=null;if(mounted.current)setError("Body tracking was interrupted. Stop and restart the camera.");}
        }
      };
      w.postMessage({type:"init"});
    });
    return startup.current;
  }
  function startMaskEngine(){
    if(maskWorker.current)return;
    const w=new Worker(new URL("../../lib/tryon/vision.worker.ts",import.meta.url));maskWorker.current=w;
    const fail=()=>{maskReady.current=false;maskBusy.current=false;foreground.current=null;w.terminate();if(maskWorker.current===w)maskWorker.current=null;if(mounted.current)setError("The preview was interrupted. Stop and restart the camera.");};
    w.onerror=fail;
    w.onmessage=(event:MessageEvent<Reply>)=>{const m=event.data;
      if(m.type==="ready")maskReady.current=true;
      if(m.type==="error")fail();
      if(m.type==="mask"&&m.id===generation.current){maskBusy.current=false;if(m.occlusion)foreground.current={data:m.occlusion,width:m.maskWidth!,height:m.maskHeight!,points:maskPoints.current,received:performance.now()};}
    };
    w.postMessage({type:"init",role:"mask"});
  }
  useEffect(()=>{
    const request=++assetGeneration.current;const abort=new AbortController();let url:string|null=null;
    layer.current?.image.close();layer.current=null;setAssetReady(false);setCutout(null);setError("");
    (async()=>{
      try{
        const w=await getEngine();
        if(abort.signal.aborted)return;
        const response=await fetch(`/api/try-on/asset?product=${productId}`,{signal:abort.signal});
        if(!response.ok)throw new Error("The garment photograph could not load. Please retry.");
        const bitmap=await createImageBitmap(await response.blob(),{resizeWidth:640});
        if(abort.signal.aborted){bitmap.close();return;}
        const prepared=await new Promise<GarmentLayer>((resolve,reject)=>{pending.current.set(request,{resolve,reject});w.postMessage({type:"asset",id:request,image:bitmap,flat:!!FITTING_ASSETS[productId].flat},[bitmap]);});
        if(abort.signal.aborted||request!==assetGeneration.current){prepared.image.close();return;}
        const thumbnail=document.createElement("canvas");thumbnail.width=prepared.width;thumbnail.height=prepared.height;thumbnail.getContext("2d")!.drawImage(prepared.image,0,0);
        const blob=await new Promise<Blob|null>(resolve=>thumbnail.toBlob(resolve,"image/png"));
        if(abort.signal.aborted){prepared.image.close();return;}
        layer.current=prepared;renderer.current?.reset();
        if(blob){url=URL.createObjectURL(blob);setCutout(url);}
        setAssetReady(true);
      }catch{if(!abort.signal.aborted){setError("We couldn’t prepare this top. Please choose another or retry.");}}
    })();
    return()=>{abort.abort();if(url)URL.revokeObjectURL(url);};
  },[productId,retry]);
  function stopCamera(){
    generation.current++;active.current=false;cancelAnimationFrame(animation.current);inflight.current=false;maskBusy.current=false;result.current=null;foreground.current=null;renderer.current?.reset();
    stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;
    if(canvas.current)canvas.current.getContext("2d")?.clearRect(0,0,canvas.current.width,canvas.current.height);
    setLive(false);setStarting(false);setCompare(false);setStatus("Camera off");
  }
  useEffect(()=>{
    mounted.current=true;const hide=()=>{if(document.hidden)stopCamera();};document.addEventListener("visibilitychange",hide);
    // These refs own camera/worker resources rather than rendered DOM nodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return()=>{mounted.current=false;generation.current++;active.current=false;cancelAnimationFrame(animation.current);stream.current?.getTracks().forEach(t=>t.stop());worker.current?.terminate();maskWorker.current?.terminate();maskWorker.current=null;maskReady.current=false;startup.current=null;worker.current=null;workerReady.current=false;for(const task of pending.current.values())task.reject(new Error("Preview closed"));pending.current.clear();layer.current?.image.close();layer.current=null;document.removeEventListener("visibilitychange",hide);};
  },[]);
  async function startCamera(){
    if(live||starting)return;
    const run=++generation.current;setStarting(true);setError("");setStatus("Opening your camera…");
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error("Camera access needs HTTPS or localhost and a supported browser.");
      const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user",width:{ideal:1280},height:{ideal:960}},audio:false});
      if(run!==generation.current){media.getTracks().forEach(t=>t.stop());return;}
      stream.current=media;const v=video.current;if(!v)throw new Error("The camera view is unavailable.");v.srcObject=media;await v.play();
      if(run!==generation.current)return;
      active.current=true;startMaskEngine();setLive(true);setStarting(false);renderer.current=new FittingRenderer();
      let lastFrameTime=-1,lastInference=0,lastMask=0,lastStatus=0,creating=false,creatingMask=false;
      const tick=()=>{
        if(!active.current||generation.current!==run)return;
        const v=video.current,c=canvas.current,now=performance.now();
        if(v&&c&&v.readyState>=2){
          const packet=result.current,d=settings.current;
          const fresh=!!packet&&now-packet.timestamp<450;
          const mask=foreground.current;const usableMask=mask&&now-mask.received<500?mask:null;
          const rig=renderer.current!.draw(c,v,layer.current,packet?.points??[],fresh?usableMask:null,{scale:d.scale,offset:d.offset,compare:d.compare,fresh,timestamp:packet?.timestamp});
          if(now-lastStatus>400){
            setStatus(!workerReady.current?"Loading the fitting engine…":!layer.current?"Preparing your selected garment…":!fresh?"Finding your shoulders…":!rig?"Face forward and show your shoulders and waist":d.compare?"Original camera · garment hidden":rig.estimated?"Following shoulders · show your waist for better alignment":"Following your body");
            lastStatus=now;
          }
          if(workerReady.current&&worker.current&&layer.current&&!inflight.current&&!creating&&now-lastInference>25&&v.currentTime!==lastFrameTime){
            creating=true;lastInference=now;lastFrameTime=v.currentTime;
            createImageBitmap(v,{resizeWidth:384,resizeHeight:Math.round(384*v.videoHeight/v.videoWidth)}).then(bitmap=>{
              creating=false;
              if(!active.current||generation.current!==run||!worker.current){bitmap.close();return;}
              inflight.current=true;worker.current.postMessage({type:"frame",mode:"pose",id:run,image:bitmap,timestamp:now},[bitmap]);
            }).catch(()=>{creating=false;if(mounted.current)setError("This browser could not process camera frames. Try a recent Chrome or Edge.");});
          }
          if(maskReady.current&&maskWorker.current&&fresh&&!maskBusy.current&&!creatingMask&&now-lastMask>180){
            creatingMask=true;lastMask=now;const capturedPoints=packet!.points;
            createImageBitmap(v,{resizeWidth:256,resizeHeight:Math.round(256*v.videoHeight/v.videoWidth)}).then(bitmap=>{
              creatingMask=false;if(!active.current||generation.current!==run||!maskWorker.current){bitmap.close();return;}
              maskBusy.current=true;maskPoints.current=capturedPoints;maskWorker.current.postMessage({type:"frame",mode:"mask",id:run,image:bitmap,timestamp:now},[bitmap]);
            }).catch(()=>{creatingMask=false;});
          }
        }
        animation.current=requestAnimationFrame(tick);
      };tick();
    }catch(e){if(generation.current!==run)return;stopCamera();setError(e instanceof DOMException&&e.name==="NotAllowedError"?"Camera access was denied. Allow camera access in your browser and try again.":e instanceof Error?e.message:"The camera could not open.");}
  }
  return <main className="fitting-page"><TopBar title="Live fitting room"/>
    <div className="fitting-heading"><div><h2>See it on you</h2><p>Choose a top, then open your camera.</p></div><Link href="/lab" className="lab-button">Back to gear lab</Link></div>
    {unsupported&&<p className="lab-notice mx-4 mb-4">Camera preview is not available for {getProduct(requested!)?.shortName}. Choose another top to continue.</p>}
    {error&&<div role="alert" className="lab-notice mx-4 mb-4"><p>{error}</p>{!assetReady&&<button className="lab-button mt-3" onClick={()=>{if(!workerReady.current)startup.current=null;setRetry(n=>n+1);}}>Retry preparation</button>}</div>}
    <div className="fitting-layout">
      <section className="fitting-mirror" aria-label="Live fitting mirror">
        <div className="fitting-toolbar"><div className="flex items-center gap-2"><span className={`fitting-dot ${live?"fitting-dot-live":""}`}/><span>{live?"Camera on":"Camera off"}</span></div><span>Only you can see your camera</span></div>
        <div className="fitting-stage">
          <video ref={video} muted playsInline aria-hidden className="absolute h-px w-px opacity-0 pointer-events-none"/>
          <canvas ref={canvas} className={`fitting-canvas ${!live?"invisible":""}`} style={{transform:mirror?"scaleX(-1)":undefined}} aria-label="Your live camera with a photographic garment layer"/>
          {!live&&<div className="fitting-welcome"><svg viewBox="0 0 48 48" width="48" height="48" fill="none" aria-hidden><rect x="6" y="14" width="36" height="25" rx="7" stroke="currentColor" strokeWidth="1.5"/><path d="m16 14 3-6h10l3 6" stroke="currentColor" strokeWidth="1.5"/><circle cx="24" cy="26" r="7" stroke="currentColor" strokeWidth="1.5"/></svg><h3>Ready when you are</h3><p>Face the camera with your shoulders and waist in view.</p><button className="fitting-start" onClick={startCamera} disabled={starting||!assetReady}>{starting?"Opening camera…":assetReady?"Open live camera":error?"Preparation needed":"Preparing garment…"}</button><span className="fitting-private">No recording. No photo upload.</span></div>}
          {live&&<div className="fitting-live-badge">{compare?"Original":"Live preview"}</div>}
          {live&&<div className="fitting-guidance" role="status">{status}</div>}
        </div>
        {live&&<div className="fitting-controls">{live&&<button className="lab-button" onClick={stopCamera}>Stop camera</button>}<button className="lab-button" hidden={!live} aria-pressed={compare} onClick={()=>setCompare(!compare)}>{compare?"Show try-on":"Show original"}</button><label className="lab-check ml-auto"><input type="checkbox" checked={mirror} onChange={e=>setMirror(e.target.checked)}/>Mirror</label></div>}
        <p className="fitting-footnote">A visual preview. Check the size guide before buying.</p>
      </section>
      <aside className="fitting-sidebar"><section className="lab-panel fitting-product"><label className="lab-label">Choose your top<select className="lab-input" value={p.id} onChange={e=>{setProductId(e.target.value);setScale(1.08);setOffset(0);result.current=null;}}>{eligible.map(p=><option key={p.id} value={p.id}>{p.shortName}</option>)}</select></label><div className="hidden lg:block mt-4"><LabProduct key={p.id} product={{...toLite(p),sizes:p.sizes,inStock:p.inStock,weightKg:p.weightKg}}/><Link className="text-brand text-[13px] underline inline-block mt-3" href={`/p/${p.id}`}>Product details</Link></div><details className="lg:hidden fitting-size-options"><summary>Choose size and add to cart</summary><div className="mt-3"><LabProduct key={p.id} product={{...toLite(p),sizes:p.sizes,inStock:p.inStock,weightKg:p.weightKg}}/></div><Link className="text-brand text-[13px] underline inline-block mt-3" href={`/p/${p.id}`}>Product details</Link></details></section>
        <details className="lab-panel fitting-garment-panel"><summary className="font-semibold text-[14px]">View selected top</summary><div className="fitting-garment">{cutout?<img src={cutout} alt={p.shortName}/>:<img src={img(p.images[FITTING_ASSETS[p.id].image],480)} alt={p.shortName}/>}</div>{!assetReady&&<p className="text-[12px] text-muted mt-3" role="status">{error?"Preview unavailable":"Preparing your top…"}</p>}</details>
        <details className="lab-panel"><summary className="font-semibold text-[14px]">Adjust preview</summary><label className="lab-label mt-4">Width<input type="range" min=".9" max="1.3" step=".01" value={scale} onChange={e=>setScale(Number(e.target.value))}/></label><label className="lab-label mt-4">Vertical position<input type="range" min="-.12" max=".12" step=".005" value={offset} onChange={e=>setOffset(Number(e.target.value))}/></label><button className="lab-button mt-4" onClick={()=>{setScale(1.08);setOffset(0);}}>Reset adjustments</button><p className="text-[12px] text-muted mt-3">These controls adjust the preview, not your clothing size.</p></details>
        <details className="lab-panel"><summary className="font-semibold text-[14px]">How to get the best view</summary><ul className="mt-4 text-[13px] text-muted space-y-3"><li>Use even lighting and keep one person in frame.</li><li>Face forward with your shoulders and waist visible.</li><li>Move gently and stay facing forward for a clearer preview.</li><li>Closing or hiding this page stops the camera.</li></ul></details>
      </aside>
    </div>
  </main>;
}
