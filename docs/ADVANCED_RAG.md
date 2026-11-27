# Advanced retrieval and grounded answers

The chatbot now handles explicit multi-part questions, restores context around retrieved guide passages, and checks generated knowledge answers before showing them. A local embedding retriever can join the existing keyword/fuzzy pipeline without a hosted vector database.

| Capability | Behaviour | Status |
|---|---|---|
| Multi-question answers | Separately retrieves up to three explicit questions; combines answers with correctly renumbered sources. Comparisons remain intact. | Active |
| Partial answers | States when a question part lacks catalogue evidence instead of silently skipping it. | Active |
| Parent-guide context | Uses focused chunks to locate a guide, then restores up to 6,000 characters from that guide to preserve qualifications. | Active |
| Topic-aware conversation | Explicit policy questions take precedence over a previously discussed sport. | Active |
| Generated-answer checks | Checks every factual prose block for citations, source overlap, numbers and negation. Rejects uncertain output in favour of the extractive answer. | Active when an LLM supplies knowledge prose |
| Checked display | Shows the extractive cited answer immediately; optional generated prose replaces it only after verification. | Active |
| Dense semantic retrieval | Contextual product/guide embeddings join BM25, fuzzy matches and query expansion through reciprocal rank fusion. Filters still apply. | Optional; requires a local embedding model and index |
| Resilience | Missing, stale, malformed or unavailable vector indexes fall back to existing retrieval; query embedding calls have a 2.5-second deadline. | Active |
| Request validation | Rejects malformed or oversized chat bodies; bounds history and product context. | Active |

## Enable local semantic search

Install Ollama from its official distribution and install a supported embedding model. The integration uses Ollama's [`/api/embed` interface](https://github.com/ollama/ollama/blob/main/docs/capabilities/embeddings.mdx).

```bash
ollama pull embeddinggemma
cd decath-mobile
RAG_EMBEDDINGS=ollama npm run index:rag
```

Indexing runs explicit batches of 16 contextual passages and writes `.local/rag-vectors.json` atomically. It sends catalogue/guide text to your local Ollama service. The index is ignored by Git. Indexing can take several minutes depending on hardware; it never runs automatically during a shopper request.

Enable these settings in `decath-mobile/.env.local`, then restart the app:

```dotenv
RAG_EMBEDDINGS=ollama
RAG_EMBEDDING_MODEL=embeddinggemma
```

The default service is `http://127.0.0.1:11434/api/embed`. `RAG_EMBEDDING_URL` can point to another local HTTP endpoint; non-local hosts are rejected. To use a different model, set `RAG_EMBEDDING_MODEL` for **both** indexing and the application. Rebuild the index after catalogue, guide, contextual formatting or model changes. Model identity, dimensions and a corpus SHA-256 fingerprint prevent incompatible index reuse.

Query vectors use a memory-only cache capped at 128 entries with a 60-second reuse lifetime. No conversation history is embedded; only the rewritten current question is sent to the local model. No model is downloaded automatically and no paid embedding API is invoked. The current workspace does not have Ollama installed, so neural retrieval is not enabled here.

## Processing

1. Validate the request and resolve the current topic.
2. Split explicit multi-part questions, with a maximum of three.
3. If enabled, retrieve dense candidates from the versioned local index.
4. Fuse dense candidates with keyword, fuzzy and expansion candidates; apply source/product filters, rerank and select diverse evidence.
5. Apply evidence thresholds independently to each question. Restore bounded parent-guide context and generate an extractive, cited fallback.
6. Optionally rephrase with the configured LLM. Show the extractive answer immediately. Check citations and conservative lexical support before replacing it with generated prose; keep the extractive answer if uncertain, truncated or refused.

Neural scores affect knowledge retrieval. Structured product eligibility, budgets, sizes, stock filters, kit calculations and cart actions remain deterministic; embeddings cannot override those constraints. This release does not claim neural reranking of every product-search route.

## Verification and limits

```bash
cd decath-mobile
npm run check:rag
npm test
npm run build
```

The original labelled retrieval set remains a regression baseline. `rag-advanced-check.mjs` adds multi-question source checks, partial answers, lexical grounding checks, dense-filter isolation, local endpoint restrictions, index/vector validation, embedding cache/fallback checks and API request/LLM-output checks. Embedding service and LLM responses in this suite are fixtures; tests make no paid calls.

The grounding gate is a conservative lexical check, **not a semantic entailment model or proof of truth**. It may reject correct paraphrases, and high word overlap can still conceal an incorrect interpretation. Bundled sources can themselves be incomplete or wrong. Similarity thresholds are heuristics requiring real-model evaluation; fixture success is not a semantic quality benchmark. Policies describe this demo, and catalogue stock/prices are bundled data rather than live retailer integrations.

Graph reasoning, photo identification, live inventory APIs and accurate clothing simulation require their own datasets and integrations. They are not implied by the RAG upgrade.
