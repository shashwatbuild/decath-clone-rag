import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const jiti=createJiti(import.meta.url,{alias:{'@':fileURLToPath(new URL('..',import.meta.url))}});
const H=await jiti.import('@/lib/rag/hybrid.ts'), A=await jiti.import('@/lib/rag/answer.ts'), Q=await jiti.import('@/lib/rag/questions.ts'), G=await jiti.import('@/lib/rag/grounding.ts'), E=await jiti.import('@/lib/rag/embeddings.ts');
let checks=0;
async function test(name,fn){await fn();checks++;console.log(`PASS ${name}`);}
await test('Explicit questions split; comparisons stay together',()=>{
 assert.equal(Q.splitQuestions('What is the return policy and how long does delivery take?').length,2);
 assert.equal(Q.splitQuestions('Feather and plastic shuttlecocks: what is the difference?').length,1);
 assert.equal(Q.splitQuestions('How do I pay? Can the chatbot pay for me?').length,2);
});
await test('Multi-question answers retrieve both policies with correct per-claim citations',()=>{
 const a=A.knowledgeAnswer('What is the return policy and how long does delivery take?',[]);
 for(const id of ['policy-returns','policy-delivery'])assert(a?.sources.some(s=>s.id===id));
 for(const line of a.text.split('\n').filter(l=>l.startsWith('- '))){const n=Number(line.match(/\[(\d+)\]$/)?.[1]);assert(a.passages.find(p=>p.n===n)?.text.toLowerCase().includes(line.slice(2).replace(/\s*\[\d+\]$/,'').toLowerCase()));}
});
await test('Missing sub-question evidence is disclosed',()=>{
 const a=A.knowledgeAnswer('What is the return policy? What is quantum entanglement?',[]);
 assert(a?.text.includes("couldn't find enough catalogue evidence"));assert.equal(a.trace.confident,false);
});
await test('Grounding rejects changed numbers, fake citations, missing citations, negation and unrelated claims',()=>{
 const p=[{n:1,title:'Returns',text:'You can return most products within 30 days of delivery.'}];
 assert(G.verifyGrounding('**Returns**\nYou can return most products within 30 days of delivery [1].',p).supported);
 for(const s of ['You can return products within 300 days [1].','You can return products within 30 days [9].','Returns are always guaranteed.','You cannot return most products within 30 days of delivery [1].','This product cures chronic back pain permanently [1].'])assert.equal(G.verifyGrounding(s,p).supported,false,s);
});
await test('Dense fusion obeys explicit source and product restrictions',()=>{
 const other=H.allDocs().find(d=>d.source==='product'&&d.ref!=='8515767');
 const result=H.search('racket',{source:'product',productIds:['8515767'],semantic:new Map([[other.id,.99]])});
 assert(result.hits.length);assert(result.hits.every(h=>h.doc.source==='product'&&h.doc.ref==='8515767'));
 assert(H.search('return policy',{semantic:new Map([['policy-returns#0',.9]])}).trace.stages.some(s=>s.includes('Dense semantic')));
});
await test('Embedding chunks preserve product identity and reject invalid vectors or stale indexes',()=>{
 const d=H.allDocs().find(d=>d.source==='product'&&d.kind==='spec');assert(E.contextualText(d).includes(d.text));assert(E.contextualText(d).includes('Section:'));
 for(const v of [[],[0,0],[NaN,1],['1',2]])assert.throws(()=>E.normalise(v));
 assert.throws(()=>E.validateIndex({version:1,model:'wrong',fingerprint:'old',entries:[]},'test'));
});
const keys=['RAG_EMBEDDINGS','RAG_EMBEDDING_MODEL','RAG_EMBEDDING_URL','RAG_VECTOR_INDEX','LLM_PROVIDER'];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const temp=await mkdtemp(path.join(os.tmpdir(),'advanced-rag-'));const originalFetch=globalThis.fetch;
try{
 delete process.env.RAG_EMBEDDINGS;
 await test('Disabled embeddings make no network call',async()=>{globalThis.fetch=()=>{throw Error('Unexpected network request');};assert.equal((await E.semanticScores('disabled')).status,'disabled');});
 Object.assign(process.env,{RAG_EMBEDDINGS:'ollama',RAG_EMBEDDING_MODEL:'fixture',RAG_EMBEDDING_URL:'http://127.0.0.1:11434/api/embed',RAG_VECTOR_INDEX:path.join(temp,'vectors.json')});
 await writeFile(process.env.RAG_VECTOR_INDEX,JSON.stringify({version:1,model:'fixture',fingerprint:E.corpusFingerprint(),dimensions:2,entries:H.allDocs().map(d=>({id:d.id,vector:[1,0]}))}));
 await test('Local embedding adapter, cosine ranking and bounded query cache integrate',async()=>{
  let calls=0;globalThis.fetch=async(_url,o)=>{calls++;assert.deepEqual(JSON.parse(o.body).input,['fixture query']);return Response.json({embeddings:[[1,0]]});};
  assert.equal((await E.semanticScores('fixture query')).status,'active');assert.equal((await E.semanticScores('fixture query')).scores.size,60);assert.equal(calls,1);
 });
 await test('Unavailable embeddings safely fall back',async()=>{globalThis.fetch=async()=>{throw Error('down');};assert.equal((await E.semanticScores('uncached')).status,'unavailable');assert(A.knowledgeAnswer('What is the return policy?',[]));});
 await test('Embeddings cannot transmit to a non-local endpoint',()=>{process.env.RAG_EMBEDDING_URL='https://unrelated.example/api/embed';assert.throws(()=>E.embeddingConfig());});
 delete process.env.RAG_EMBEDDINGS;process.env.LLM_PROVIDER='off';
 const API=await jiti.import('@/app/api/chat/route.ts');const req=v=>new Request('http://localhost/api/chat',{method:'POST',body:JSON.stringify(v)});
 await test('Chat API validates malformed input and limits request size',async()=>{
  for(const v of [null,{}, {message:'  '},{message:4}])assert.equal((await API.POST(req(v))).status,400);
  assert.equal((await API.POST(req({message:'hi',padding:'x'.repeat(33000)}))).status,413);
  assert.equal((await API.POST(new Request('http://localhost/api/chat',{method:'POST',body:'{'}))).status,400);
 });
 await test('API handles malformed optional context and returns both cited answers',async()=>{
  const r=await API.POST(req({message:'What is the return policy and how long does delivery take?',history:[null,{}, {role:'user',text:'Hi'}],contextIds:'wrong',listIds:[null,{},'8515767'],productId:{bad:true}}));assert.equal(r.status,200);
  const events=(await r.text()).trim().split('\n').map(JSON.parse);for(const id of ['policy-returns','policy-delivery'])assert(events[0].sources.some(s=>s.id===id));assert.equal(events.at(-1).type,'done');assert(events.some(e=>e.type==='text'&&e.delta.includes('[1]')));
 });
 await test('History does not drag explicit policy questions into the previous sport',async()=>{
  const R=await jiti.import('@/lib/rag/rewrite.ts');assert.equal(R.rewrite('What is the return policy?',[{role:'user',text:'I play badminton'}]).topic,'store');
 });
 await test('Generated knowledge is checked before display and unsupported output falls back',async()=>{
  process.env.LLM_PROVIDER='gemini';const previousKey=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='fixture-not-a-real-key';
  const fallback=A.knowledgeAnswer('What is the return policy?',[]);
  try{
   for(const generated of ['You can return most products within 999 days [1].','You can return most products within 30 days [99].','Returns are guaranteed forever.']){
    globalThis.fetch=async()=>new Response('data: '+JSON.stringify({candidates:[{content:{parts:[{text:generated}]},finishReason:'STOP'}]})+'\n\n',{headers:{'Content-Type':'text/event-stream'}});
    const response=await API.POST(req({message:'What is the return policy?'}));const events=(await response.text()).trim().split('\n').map(JSON.parse);
    const output=events.filter(e=>e.type==='text').map(e=>e.delta).join('');assert.equal(output,fallback.text);assert(!output.includes('999'));assert(!output.includes('[99]'));assert(events.filter(e=>e.type==='replace').every(e=>e.text===fallback.text));
   }
  }finally{if(previousKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=previousKey;process.env.LLM_PROVIDER='off';}
 });
}finally{globalThis.fetch=originalFetch;for(const[k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await rm(temp,{recursive:true,force:true});}
console.log(`\n${checks} advanced RAG checks passed (embedding fixtures; no paid calls)`);
