import type { Point } from "./geometry";
import { bodyRig, garmentMesh, drawMesh, smoothRig, type Rig } from "./mesh";
export type GarmentLayer = {image:ImageBitmap;rig:Rig;width:number;height:number};
/** Local-only compositing. Skin, hair and accessories from the original camera are
 * restored above the photographic garment; no photographed model is overlaid. */
export class FittingRenderer {
  private previous:Rig|null=null;
  private sample:{rig:Rig;timestamp:number}|null=null;
  private velocity={x:0,y:0};
  private garment=document.createElement("canvas");
  private foreground=document.createElement("canvas");
  private mask=document.createElement("canvas");
  reset(){this.previous=null;this.sample=null;this.velocity={x:0,y:0};}
  draw(canvas:HTMLCanvasElement,video:HTMLVideoElement|HTMLImageElement,layer:GarmentLayer|null,points:Point[],occlusion:{data:ArrayBuffer;width:number;height:number;points?:Point[]}|null, options:{scale:number;offset:number;compare:boolean;fresh:boolean;timestamp?:number}) {
    const w=video instanceof HTMLVideoElement?video.videoWidth:video.naturalWidth,h=video instanceof HTMLVideoElement?video.videoHeight:video.naturalHeight;
    if(!w||!h)return null;
    if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;}
    const ctx=canvas.getContext("2d")!;ctx.drawImage(video,0,0,w,h);
    const rig=options.fresh?bodyRig(points,w,h):null;
    if(!rig || !layer || options.compare){this.previous=null;return rig;}
    const timestamp=options.timestamp??performance.now();
    const centre=(r:Rig)=>({x:(r.leftShoulder.x+r.rightShoulder.x)/2,y:(r.leftShoulder.y+r.rightShoulder.y)/2});
    if(!this.sample || this.sample.timestamp!==timestamp){
      if(this.sample){const dt=timestamp-this.sample.timestamp,a=centre(this.sample.rig),b=centre(rig);this.velocity=dt>0&&dt<500?{x:(b.x-a.x)/dt,y:(b.y-a.y)/dt}:{x:0,y:0};}
      this.sample={rig,timestamp};
    }
    const age=Math.min(70,Math.max(0,performance.now()-timestamp));
    const span=rig.rightShoulder.x-rig.leftShoulder.x;
    const clamp=(value:number)=>Math.max(-span*.15,Math.min(span*.15,value));
    const dx=clamp(this.velocity.x*age),dy=clamp(this.velocity.y*age);
    const move=(p:{x:number;y:number})=>({x:p.x+dx,y:p.y+dy});
    const predicted={...rig,leftShoulder:move(rig.leftShoulder),rightShoulder:move(rig.rightShoulder),leftHip:move(rig.leftHip),rightHip:move(rig.rightHip)};
    this.previous=smoothRig(this.previous,predicted,.72);
    if(this.garment.width!==w || this.garment.height!==h){this.garment.width=w;this.garment.height=h;this.foreground.width=w;this.foreground.height=h;}
    const g=this.garment.getContext("2d")!;g.clearRect(0,0,w,h);
    drawMesh(g,layer.image,garmentMesh(layer.rig,this.previous,layer.width,layer.height,options.scale,options.offset*h));
    ctx.drawImage(this.garment,0,0);
    if(occlusion){
      this.mask.width=occlusion.width;this.mask.height=occlusion.height;
      const maskCtx=this.mask.getContext("2d")!;maskCtx.putImageData(new ImageData(new Uint8ClampedArray(occlusion.data),occlusion.width,occlusion.height),0,0);
      const f=this.foreground.getContext("2d")!;f.clearRect(0,0,w,h);f.globalCompositeOperation="source-over";f.drawImage(video,0,0,w,h);f.globalCompositeOperation="destination-in";
      const old=occlusion.points?bodyRig(occlusion.points,w,h):null;
      if(old){const a=centre(old),b=centre(this.previous);const ratio=(this.previous.rightShoulder.x-this.previous.leftShoulder.x)/Math.max(1,old.rightShoulder.x-old.leftShoulder.x);f.setTransform(ratio,0,0,ratio,b.x-a.x*ratio,b.y-a.y*ratio);}
      f.drawImage(this.mask,0,0,w,h);f.setTransform(1,0,0,1,0,0);f.globalCompositeOperation="source-over";
      ctx.drawImage(this.foreground,0,0);
    }
    return rig;
  }
}
