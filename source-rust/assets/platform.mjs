// Browser/WebView API adapters only. UI, state, effects, search, naming and masks live in Rust.
export async function imagePixels(src,width=0,height=0){
 const image=new Image();image.src=src;await image.decode();
 const scale=Math.min(1,2048/Math.max(image.width,image.height));
 const canvas=document.createElement('canvas');canvas.width=width||Math.round(image.width*scale);canvas.height=height||Math.round(image.height*scale);
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);
 return {width:canvas.width,height:canvas.height,pixels:ctx.getImageData(0,0,canvas.width,canvas.height).data};
}
export function pixelsData(pixels,width,height){const c=document.createElement('canvas');c.width=width;c.height=height;c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),width,height),0,0);return c.toDataURL('image/png')}
export async function pngBytes(src,size){const image=new Image();image.src=src;await image.decode();const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').drawImage(image,0,0,size,size);const blob=await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(Error('PNG rendering failed'))));return new Uint8Array(await blob.arrayBuffer())}
export async function writeClipboard(bytes,type){const blob=new Blob([bytes],{type});await navigator.clipboard.write([new ClipboardItem({[type]:blob})]);return true}
export function downloadBytes(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}
export async function readFile(file){if(file.size>25*1024*1024)throw Error('Choose files smaller than 25 MB');const bytes=new Uint8Array(await file.arrayBuffer());return {name:file.name,type:file.type,bytes}}
export async function readWorkspace(){return new Promise((ok,no)=>{const q=indexedDB.open('icon-studio',1);q.onupgradeneeded=()=>q.result.createObjectStore('workspace');q.onerror=()=>no(q.error);q.onsuccess=()=>{const db=q.result,r=db.transaction('workspace').objectStore('workspace').get('current');r.onsuccess=()=>{ok(r.result||null);db.close()};r.onerror=()=>{no(r.error);db.close()}}})}
export async function storeWorkspace(json){return new Promise((ok,no)=>{const q=indexedDB.open('icon-studio',1);q.onupgradeneeded=()=>q.result.createObjectStore('workspace');q.onerror=()=>no(q.error);q.onsuccess=()=>{const db=q.result,t=db.transaction('workspace','readwrite');t.objectStore('workspace').put(JSON.parse(json),'current');t.oncomplete=()=>{ok(true);db.close()};t.onerror=()=>{no(t.error);db.close()}}})}
let runtime,session;
export async function inferMask(input){runtime ||= await import(new URL('ai-runtime/ort.wasm.min.mjs',location.href).href);runtime.env.wasm.numThreads=1;runtime.env.wasm.wasmPaths=new URL('./ai-runtime/',location.href).href;session ||=await runtime.InferenceSession.create(new URL('./models/u2netp.onnx',location.href).href,{executionProviders:['wasm']});const tensor=new runtime.Tensor('float32',input,[1,3,320,320]);try{const output=await session.run({[session.inputNames[0]]:tensor});const result=Float32Array.from(output[session.outputNames[0]].data);for(const t of Object.values(output))t.dispose();return result}finally{tensor.dispose()}}
