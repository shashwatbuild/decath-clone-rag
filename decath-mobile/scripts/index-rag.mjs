// Explicit opt-in: sends catalogue/guide text only to a local Ollama embedding service.
import { createJiti } from 'jiti';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { '@': root } });
const E = await jiti.import('@/lib/rag/embeddings.ts');
const H = await jiti.import('@/lib/rag/hybrid.ts');
const config = E.embeddingConfig();
if (!config) throw new Error('Run with RAG_EMBEDDINGS=ollama and a local embedding model installed.');
const docs = H.allDocs(), entries = [];
let dimensions;
for (let i = 0; i < docs.length; i += 16) {
  const batch = docs.slice(i, i + 16);
  const vectors = await E.embedTexts(batch.map(E.contextualText), 120_000);
  dimensions ??= vectors[0].length;
  if (vectors.some(v => v.length !== dimensions)) throw new Error('Embedding dimensions changed during indexing');
  entries.push(...batch.map((d,j) => ({ id: d.id, vector: vectors[j] })));
  console.log(`Indexed ${entries.length}/${docs.length} passages`);
}
const output = E.indexPath();
await mkdir(path.dirname(output), { recursive: true });
const temporary = `${output}.${process.pid}.tmp`;
await writeFile(temporary, JSON.stringify({ version: 1, model: config.model, fingerprint: E.corpusFingerprint(), dimensions, entries }), { mode: 0o600 });
await rename(temporary, output);
console.log('Local semantic index ready. Restart the app after changing embedding configuration.');
