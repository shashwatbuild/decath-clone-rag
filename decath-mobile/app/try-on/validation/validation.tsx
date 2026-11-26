"use client";
/* eslint-disable @next/next/no-img-element -- developer-only public catalogue test fixtures */
import { useRef, useState } from "react";
import type { Rig } from "@/lib/tryon/mesh";
import type { Point } from "@/lib/tryon/geometry";
import { FittingRenderer, type GarmentLayer } from "@/lib/tryon/renderer";
import { FITTING_ASSETS } from "@/lib/tryon/assets";
export default function VisualValidation(){
 const [status,setStatus]=useState("Ready to test public catalogue fixtures. No camera is used."),[results,setResults]=useState<string[]>([]),[busy,setBusy]=useState(false);
 const output=useRef<HTMLCanvasElement>(null);
 const [original,setOriginal]=useState("");
 async function run(){
  setBusy(true);setResults([]);setStatus("Loading worker and official vision models…");
  const worker=new Worker(new URL("../../../lib/tryon/vision.worker.ts",import.meta.url));
  let timeout:ReturnType<typeof setTimeout>;
  let next=1;const tasks=new Map<number,{resolve:(value:Record<string,unknown>)=>void;reject:(error:Error)=>void}>();
  try{
   await new Promise<void>((resolve,reject)=>{timeout=setTimeout(()=>reject(new Error("Worker timed out")),90000);worker.onerror=()=>reject(new Error("Worker failed"));worker.onmessage=e=>{
    const m=e.data;if(m.type==="ready"){clearTimeout(timeout);resolve();}else if(m.type==="error"){const t=tasks.get(m.id);tasks.delete(m.id);if(t)t.reject(new Error(m.message));else reject(new Error(m.message));}else{const t=tasks.get(m.id);tasks.delete(m.id);t?.resolve(m);}
   };worker.postMessage({type:"init"});});
   const request=(message:Record<string,unknown>,image:ImageBitmap)=>new Promise<Record<string,unknown>>((resolve,reject)=>{const id=next++;tasks.set(id,{resolve,reject});worker.postMessage({...message,id,image},[image]);});
   const bitmap=async(id:string)=>{const r=await fetch(`/api/try-on/asset?product=${id}`);if(!r.ok)throw new Error(`Asset ${id}: ${r.status}`);return createImageBitmap(await r.blob(),{resizeWidth:640});};
   let first:GarmentLayer|null=null;
   for(const [id,asset] of Object.entries(FITTING_ASSETS)){
    setStatus(`Testing garment isolation: ${id}`);
    try{const reply=await request({type:"asset",flat:!!asset.flat},await bitmap(id));const layer={image:reply.image as ImageBitmap,rig:reply.rig as Rig,width:reply.width as number,height:reply.height as number};setResults(r=>[...r,`PASS ${id}: real garment isolated (${layer.width}×${layer.height})`]);if(id==="8644134")first=layer;else layer.image.close();}
    catch(e){setResults(r=>[...r,`FAIL ${id}: ${e instanceof Error?e.message:"unknown error"}`]);}
   }
   if(!first)throw new Error("Flat-lay garment failed");
   setStatus("Testing actual pose inference, skin masking and mesh rendering on a public model photograph…");
   const fixture="/api/try-on/asset?product=8667940";setOriginal(fixture);
   const image=new Image();image.src=fixture;await image.decode();
   const frame=await request({type:"frame",timestamp:performance.now()},await bitmap("8667940"));
   const renderer=new FittingRenderer();const rig=renderer.draw(output.current!,image,first,frame.points as Point[],frame.occlusion?{data:frame.occlusion as ArrayBuffer,width:frame.maskWidth as number,height:frame.maskHeight as number}:null,{scale:1.08,offset:0,compare:false,fresh:true});
   if(!rig||rig.estimated)throw new Error("Fixture torso did not track");if(!frame.occlusion)throw new Error("No foreground mask returned");
   const timings:number[]=[];
   for(let i=0;i<5;i++){const poseFrame=await request({type:"frame",mode:"pose",timestamp:performance.now()},await bitmap("8667940"));timings.push(poseFrame.inferenceMs as number);}
   const average=Math.round(timings.reduce((a,b)=>a+b,0)/timings.length);
   setResults(r=>[...r,`PASS independent pose path: ${average} ms average over five frames; foreground segmentation does not block it`]);
   const maskWorker=new Worker(new URL("../../../lib/tryon/vision.worker.ts",import.meta.url));
   try{await new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("Mask worker timed out")),30000);
    maskWorker.onerror=()=>{clearTimeout(timer);reject(new Error("Mask worker failed"));};
    maskWorker.onmessage=async e=>{const m=e.data;if(m.type==="error"){clearTimeout(timer);reject(new Error(m.message));}if(m.type==="ready"){const image=await bitmap("8667940");maskWorker.postMessage({type:"frame",mode:"mask",id:1,image,timestamp:performance.now()},[image]);}if(m.type==="mask"){clearTimeout(timer);if(!m.occlusion)reject(new Error("No mask from independent worker"));else{setResults(r=>[...r,`PASS separate masking worker: foreground mask returned independently (${m.inferenceMs} ms)`]);resolve();}}};
    maskWorker.postMessage({type:"init",role:"mask"});
   });}finally{maskWorker.terminate();}
   first.image.close();setResults(r=>[...r,`PASS public photo: full torso, foreground mask and photographic mesh rendered (${frame.inferenceMs} ms inference)`]);setStatus("Validation complete. These are catalogue test photographs, not a live customer result.");
  }catch(e){setStatus(`FAIL: ${e instanceof Error?e.message:"Validation failed"}`);}
  finally{clearTimeout(timeout!);worker.terminate();setBusy(false);}
 }
 return <main className="p-6"><h1 className="font-semibold text-xl">Developer visual validation</h1><p className="my-4" role="status">{status}</p><button className="lab-button" disabled={busy} onClick={run}>Run catalogue fixture checks</button><ul className="my-4 space-y-2">{results.map(r=><li key={r}>{r}</li>)}</ul><div className="grid grid-cols-2 gap-5"><div><h2>Original public catalogue photo</h2>{original&&<img src={original} alt="Original catalogue model fixture"/>}</div><div><h2>Rendered garment + foreground occlusion</h2><canvas ref={output} className="w-full" aria-label="Photographic garment rendering on a public catalogue fixture"/></div></div></main>;
}
