import { FilesetResolver, ImageSegmenter, PoseLandmarker } from "@mediapipe/tasks-vision";
import { bodyRig, type Rig } from "./mesh";
const MODEL_ROOT = "https://storage.googleapis.com/mediapipe-models";
const POSE = `${MODEL_ROOT}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`;
const SEGMENT = `${MODEL_ROOT}/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite`;
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const scope = self as unknown as { postMessage: (message: unknown, transfer?: Transferable[]) => void; onmessage: ((e: MessageEvent) => void) | null };
let pose: PoseLandmarker | null = null, segmenter: ImageSegmenter | null = null;
let mode: "IMAGE" | "VIDEO" = "IMAGE";
let role:"full"|"mask"="full";
async function initialise() {
  if ((pose || role==="mask") && segmenter) return;
  const vision = await FilesetResolver.forVisionTasks(WASM);
  try {
    if(role!=="mask") pose = await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:POSE,delegate:"CPU"},runningMode:"IMAGE",numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5});
    segmenter = await ImageSegmenter.createFromOptions(vision,{baseOptions:{modelAssetPath:SEGMENT,delegate:"CPU"},runningMode:"IMAGE",outputCategoryMask:true,outputConfidenceMasks:role!=="mask"});
    mode="IMAGE";
  } catch (error) { pose?.close(); segmenter?.close(); pose=null;segmenter=null;throw error; }
}
async function setMode(next: "IMAGE" | "VIDEO") {
  if (mode===next) return;
  await pose?.setOptions({runningMode:next});await segmenter!.setOptions({runningMode:next});mode=next;
}
type Input = {type:"init";role?:"mask"} | {type:"asset";id:number;image:ImageBitmap;flat:boolean} | {type:"frame";id:number;image:ImageBitmap;timestamp:number;mode?:"pose"|"mask"};
async function handle(message: Input) {
  if(message.type === "init") {role=message.role??"full";await initialise();scope.postMessage({type:"ready"});return;}
  const image=message.image;
  try {
    await initialise();
    if(message.type === "asset") {
      await setMode("IMAGE");
      const w=image.width,h=image.height;
      const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext("2d",{willReadFrequently:true})!;
      ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,w,h);
      let rig:Rig|null=null;
      if(message.flat) {
        // Reviewed dark flat-lay: remove only the neutral studio background.
        let minX=w,minY=h,maxX=0,maxY=0;
        for(let i=0;i<w*h;i++) {
          const o=i*4,brightness=Math.min(pixels.data[o],pixels.data[o+1],pixels.data[o+2]);
          const alpha=Math.min(1,Math.max(0,(245-brightness)/25));pixels.data[o+3]=Math.round(alpha*255);
          if(alpha>.8) {const x=i%w,y=Math.floor(i/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
        }
        if(maxX<=minX || maxY<=minY) throw new Error("The garment could not be isolated.");
        const bw=maxX-minX,bh=maxY-minY;
        rig={leftShoulder:{x:minX+bw*.22,y:minY+bh*.13},rightShoulder:{x:minX+bw*.78,y:minY+bh*.13},leftHip:{x:minX+bw*.28,y:minY+bh*.92},rightHip:{x:minX+bw*.72,y:minY+bh*.92}};
      } else {
        const points=pose!.detect(image).landmarks[0]??[];
        rig=bodyRig(points,w,h);
        if(!rig || rig.estimated) throw new Error("This catalogue view has no reliable front torso. Choose another item.");
        const top=(rig.leftShoulder.y+rig.rightShoulder.y)/2;
        const bottom=(rig.leftHip.y+rig.rightHip.y)/2;
        const cutoff=bottom-(bottom-top)*.08;
        let kept=0;
        segmenter!.segment(image,result=>{
          const mask=result.confidenceMasks?.[4];
          if(!mask) throw new Error("Clothing segmentation was unavailable.");
          const confidence=mask.getAsFloat32Array();
          for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
            const probability=confidence[Math.min(mask.height-1,Math.floor(y*mask.height/h))*mask.width+Math.min(mask.width-1,Math.floor(x*mask.width/w))];
            const opacity=y>cutoff ? 0 : Math.max(0,Math.min(1,(probability-.35)/.4));
            pixels.data[(y*w+x)*4+3]=Math.round(opacity*255);if(opacity>.5) kept++;
          }
        });
        if(kept/(w*h)<.02 || kept/(w*h)>.55) throw new Error("The isolated garment did not pass the coverage check.");
      }
      ctx.putImageData(pixels,0,0);
      let minX=w,minY=h,maxX=0,maxY=0;
      for(let i=0;i<w*h;i++) if(pixels.data[i*4+3]>32){const x=i%w,y=Math.floor(i/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      if(maxX<=minX || maxY<=minY)throw new Error("The garment layer is empty.");
      const cw=maxX-minX+1,ch=maxY-minY+1;
      const trimmed=new OffscreenCanvas(cw,ch);trimmed.getContext("2d")!.drawImage(canvas,minX,minY,cw,ch,0,0,cw,ch);
      const shift=(point:{x:number;y:number})=>({x:point.x-minX,y:point.y-minY});
      rig={...rig,leftShoulder:shift(rig!.leftShoulder),rightShoulder:shift(rig!.rightShoulder),leftHip:shift(rig!.leftHip),rightHip:shift(rig!.rightHip)};
      const cutout=trimmed.transferToImageBitmap();
      scope.postMessage({type:"asset",id:message.id,image:cutout,rig,width:cw,height:ch},[cutout]);
    } else {
      await setMode("VIDEO");
      const started=performance.now();
      const points=message.mode==="mask"?[]:pose!.detectForVideo(image,message.timestamp).landmarks[0]??[];
      let occlusion:Uint8ClampedArray|undefined,maskWidth=0,maskHeight=0;
      // With no tracked body we skip the second model and show the clean camera.
      if(message.mode==="mask" || (!message.mode && bodyRig(points,image.width,image.height))) {
        segmenter!.segmentForVideo(image,message.timestamp,result=>{
          const mask=result.categoryMask;if(!mask)return;
          maskWidth=mask.width;maskHeight=mask.height;const classes=mask.getAsUint8Array();occlusion=new Uint8ClampedArray(maskWidth*maskHeight*4);
          for(let i=0;i<classes.length;i++) {const foreground=classes[i]===1 || classes[i]===2 || classes[i]===3 || classes[i]===5;occlusion[i*4+3]=foreground ? 255 : 0;}
        });
      }
      scope.postMessage({type:message.mode==="mask"?"mask":"frame",id:message.id,timestamp:message.timestamp,points,occlusion:occlusion?.buffer,maskWidth,maskHeight,inferenceMs:Math.round(performance.now()-started)},occlusion?[occlusion.buffer]:[]);
    }
  } finally {image.close();}
}
let queue=Promise.resolve();
scope.onmessage=e=>{
  const message=e.data as Input;
  queue=queue.then(()=>handle(message)).catch(error=>scope.postMessage({type:"error",phase:message.type,id:"id" in message?message.id:null,message:error instanceof Error?error.message:"Vision processing failed."}));
};
