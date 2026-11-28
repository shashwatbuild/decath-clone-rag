# Deploy on Vercel

[Back to the project](../README.md)

**Live demo:** [decath-clone-rag.vercel.app](https://decath-clone-rag.vercel.app). Shared community feedback is intentionally off in this deployment; private fit memories and personal plans remain available.

Desktop, mobile, chat and the API routes are one Next.js application. Deploy **`decath-mobile` as the project root**; do not deploy the repository root as a static site.

| Setting | Value |
|---|---|
| Framework | Next.js |
| Root directory | `decath-mobile` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Next.js default |

## Runtime configuration

Add these as server-side Vercel environment variables. Keep credentials out of Git and out of `NEXT_PUBLIC_*` variables.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Optional Gemini generation; the core catalogue assistant also works without a key. |
| `LLM_PROVIDER=gemini` | Select the Gemini provider. Use `off` for catalogue-only answers. |
| `GEMINI_MODEL=gemini-flash-latest` | A model alias verified accessible to the existing project key during deployment preparation. Provider availability and quota still apply. |
| `UPSTASH_REDIS_REST_URL` | HTTPS endpoint for durable community-fit feedback. |
| `UPSTASH_REDIS_REST_TOKEN` | Server-side read/write token for that database. |
| `COMMUNITY_SHARING=off` | Deploy without a shared-feedback database. The community tab explains availability and links to private fit memories. |

Vercel Marketplace integrations using `KV_REST_API_URL` and `KV_REST_API_TOKEN` are also supported. Connect a Redis database to the same Vercel project and deployment environments. [Vercel storage integrations](https://vercel.com/docs/marketplace-storage) · [Upstash REST API](https://upstash.com/docs/redis/features/restapi)

Community votes use atomic Redis updates, hashed device tokens, a five-contributor minimum and the existing 180-day aggregation window. Local development retains its private file store. Vercel deployments refuse file-based persistence, so unconfigured storage cannot silently accept feedback that later disappears. Validate actual database reads, writes and deletion after provisioning; the automated adapter checks use a mocked REST service.

Do not enable `RAG_EMBEDDINGS=ollama` on Vercel: the current optional embedding adapter deliberately connects only to a local Ollama process. The deployed assistant uses its hybrid lexical retrieval unless a separately hosted semantic-search integration is implemented.

## Deployment and verification

From the app directory, sign in and link the project with the official Vercel CLI:

```bash
cd decath-mobile
npx vercel login
npx vercel link
npx vercel deploy --prod
```

When importing the GitHub repository, set its root directory to `decath-mobile` so future commits build the correct application. `.vercelignore` excludes local secrets, runtime feedback, dependencies and local build output from CLI uploads.

Before publishing, run `npm test` and `npm run build`. On the deployed HTTPS URL, check the store, `/m`, `/chat`, `/lab`, `/plan`, `/adventures`, `/try-sport`, `/fit`, `/try-on` and their API responses. Test camera permissions on the actual device; a camera preview still requires a person in frame.

Chat, carts, personal fit memories and saved plans remain in each visitor's browser. Checkout remains simulated; deploying does not create a real payment, booking or inventory integration.
