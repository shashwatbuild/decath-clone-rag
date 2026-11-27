/** Optional server-only dense retrieval using a local Ollama model and a versioned on-disk index. */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { allDocs, type Doc } from "./hybrid";
import { products } from "@/lib/products";

const productNames = new Map(products.map(p => [p.id, `${p.brand} ${p.name}. ${p.category}. ${p.sport}`]));
export const contextualText = (d: Doc) => `${d.source === 'product' ? productNames.get(d.ref) : d.title}\nTopic: ${d.topic}. Section: ${d.title}.\n${d.text}`;
export const corpusFingerprint = () => createHash('sha256').update(JSON.stringify(allDocs().map(d => [d.id, contextualText(d)]))).digest('hex');
export type VectorIndex = { version: 1; model: string; fingerprint: string; dimensions: number; entries: { id: string; vector: number[] }[] };
export const indexPath = () => path.resolve(process.env.RAG_VECTOR_INDEX || '.local/rag-vectors.json');
export function embeddingConfig() {
  if (process.env.RAG_EMBEDDINGS !== 'ollama') return null;
  const endpoint = new URL(process.env.RAG_EMBEDDING_URL || 'http://127.0.0.1:11434/api/embed');
  // Keep this integration local; neither chat messages nor the corpus go to an arbitrary external host.
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname) || endpoint.protocol !== 'http:' || endpoint.username || endpoint.password) throw new Error('RAG embeddings require a local HTTP Ollama endpoint.');
  return { url: endpoint.href, model: process.env.RAG_EMBEDDING_MODEL || 'embeddinggemma' };
}
export function normalise(vector: unknown): number[] {
  if (!Array.isArray(vector) || !vector.length || vector.length > 8192 || vector.some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new Error('Invalid embedding vector');
  const norm = Math.hypot(...vector);
  if (!norm || !Number.isFinite(norm)) throw new Error('Invalid embedding norm');
  return vector.map(v => v / norm);
}
export async function embedTexts(input: string[], timeoutMs = 2500): Promise<number[][]> {
  const config = embeddingConfig();
  if (!config) throw new Error('Set RAG_EMBEDDINGS=ollama to enable local embeddings');
  const response = await fetch(config.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config.model, input, truncate: false }), signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Embedding service returned ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.embeddings) || data.embeddings.length !== input.length) throw new Error('Wrong embedding count');
  const vectors = data.embeddings.map(normalise);
  if (vectors.some((v: number[]) => v.length !== vectors[0].length)) throw new Error('Inconsistent embedding dimensions');
  return vectors;
}
let cached: { key: string; value: VectorIndex } | undefined;
const queries = new Map<string, { expires: number; vector: number[] }>();
export function validateIndex(data: VectorIndex, model: string): VectorIndex {
  const ids = new Set(allDocs().map(d => d.id));
  if (data.version !== 1 || data.model !== model || data.fingerprint !== corpusFingerprint() || !Array.isArray(data.entries) || data.entries.length !== ids.size) throw new Error('Embedding index is stale; run npm run index:rag');
  if (!Number.isInteger(data.dimensions) || data.dimensions < 1 || data.dimensions > 8192) throw new Error('Invalid index dimensions');
  const seen = new Set<string>();
  const entries = data.entries.map(e => {
    if (!ids.has(e.id) || seen.has(e.id) || e.vector?.length !== data.dimensions) throw new Error('Invalid index entry');
    seen.add(e.id); return { id: e.id, vector: normalise(e.vector) };
  });
  return { ...data, entries };
}
export async function semanticScores(query: string): Promise<{ scores: Map<string, number>; status: string }> {
  try {
    const config = embeddingConfig();
    if (!config) return { scores: new Map(), status: 'disabled' };
    const file = indexPath(), info = await stat(file);
    if (info.size > 100_000_000) throw new Error('Embedding index is too large');
    const key = `${file}:${info.mtimeMs}:${info.size}:${config.model}`;
    if (cached?.key !== key) cached = { key, value: validateIndex(JSON.parse(await readFile(file, 'utf8')), config.model) };
    const qkey = `${key}:${query}`;
    const previous = queries.get(qkey);
    let vector = previous && previous.expires > Date.now() ? previous.vector : undefined;
    if (!vector) {
      [vector] = await embedTexts([query]);
      if (queries.size >= 128) queries.delete(queries.keys().next().value!);
      queries.set(qkey, { expires: Date.now() + 60_000, vector });
    }
    if (vector.length !== cached.value.dimensions) throw new Error('Embedding model dimensions changed');
    const scores = new Map(cached.value.entries.map(e => [e.id, e.vector.reduce((sum, v, i) => sum + v * vector![i], 0)] as const).filter(([,score]) => score > .25).sort((a,b) => b[1] - a[1]).slice(0,60));
    return { scores, status: 'active' };
  } catch {
    // Optional service failures must never prevent lexical retrieval or leak local paths to the UI.
    return { scores: new Map(), status: 'unavailable' };
  }
}
