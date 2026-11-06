# Decath clone + RAG shopping assistant

A mobile-first sports store modelled on the decathlon.in app, with 32 real products (4 per category) and a chat assistant that answers from the product data.

## Run

```bash
cd decath-mobile
npm install
npm run dev
```

Open http://localhost:3000. On a laptop or desktop the app runs inside an iPhone-style phone frame, with a live status bar and home indicator, and scrolls inside the screen. On a real phone, or any window under 640px wide, the frame disappears and the app is full-screen. The frame lives in `components/PhoneFrame.tsx`, with styles under "Phone frame" in `app/globals.css`.

## Screens

| Route | What it does |
|---|---|
| `/` | Home: search, category circles, coupon strip, product rails |
| `/c/[slug]` | Listing: quick chips (price, rating 4★+, clearance, new), Gender / Sort / Filter bottom sheets |
| `/search?q=` | Search across name, brand, category and sport |
| `/p/[id]` | Product page: gallery, offers, warranty, size picker, delivery, Benefits / Tech info / Specs / Material accordions, bought-together, similar, recently viewed, ratings and reviews |
| `/cart`, `/wishlist` | Saved in localStorage; coupons NC100 / NC200 / NC300 |
| `/chat` | Assistant. Opened from a product page, it knows which product you are on |

## Data

`decath-mobile/data/products.json` holds 32 products, 4 in each of 8 categories, taken from decathlon.in on 2026-11-06. Prices, specs, benefits, sizes, images and rating counts are real. Review text and the star breakdown are generated sample data.

To refresh the data or add products, edit the IDs in `scripts/build_catalog.py` and download each product page as `<pdp_dir>/<id>.html`, using `https://www.decathlon.in/qr/<id>/-1`. Then run:

```bash
python3 -I scripts/build_catalog.py <pdp_dir> decath-mobile/data/products.json
```

## RAG assistant

- `lib/rag/index.ts` is the retrieval step. It splits each product into chunks (overview, each benefit, each spec, tech Q&A, material, sizes, warranty) and ranks them with BM25. Synonyms are handled, for example sneakers → shoes and bike → cycle.
- `lib/rag/assistant.ts` handles intents: list a category (with price, gender and "best"/"cheapest" handling), compare 2–3 products as a table (from links, IDs or "compare 2 yoga mats for beginners"), answer questions about one product, and follow-ups about the products in the last reply.
- `lib/rag/llm.ts` is the generation step. It builds a `<catalog_context>` block (full fact sheets for the chosen products plus the best BM25 snippets), picks the provider, and streams the reply.
  - **Claude** (`ANTHROPIC_API_KEY`): `claude-opus-5-5` at `effort: "low"`. The system prompt is prompt-cached, and `fallbacks: "default"` retries a refused request on Anthropic's recommended model.
  - **Gemini** (`GEMINI_API_KEY`, in `lib/rag/gemini.ts`, the provider in use via `LLM_PROVIDER=gemini`): REST `streamGenerateContent` with `gemini-3.8-flash`, falling back to `gemini-flash-latest` (`GEMINI_MODELS` overrides the list). It uses low thinking, a 12-second budget for the first words (`GEMINI_TIMEOUT_MS`) with one quick retry on "high demand" errors, then a 2-minute cooldown where replies come from offline mode instantly. Hidden "thinking" text is skipped, and safety blocks fall back to the offline answer.
- **Reply format:** replies use a small Markdown subset, rendered by `components/RichText.tsx`: a bold title, numbered product rows (numbers match the cards) with a muted details line, "- " bullets with bold labels, and "> " callouts for the pick, tips and offers. The offline replies and the LLM prompt both follow it.
- `app/api/chat/route.ts` takes `POST { message, history?, contextIds?, productId? }` and streams newline-delimited JSON. A `meta` event carries the cards and compare table, `text` events carry the streamed reply, a `replace` event swaps in a different reply, and a `source` event switches the footer to offline when the model call fails.

### What the assistant understands

- **Categories, sports and needs:** "shoes for marathon with good cushioning", "bikes for mountain", "thick yoga mat for knees", "t shirt for running in summer"
- **Budgets:** "under 2k", "below ₹1,500", "1000 se kam", "above 5000", "between 1000 and 3000"
- **Who it's for:** "for my wife", "for men", "gift for a 10 year old" (adds a sizing tip)
- **Superlatives:** cheapest, most premium, lightest (uses product weight), thickest, best rated, newest, "what's on sale"
- **Products by model name, link or ID:** "kipride max vs kipcore premium", "BR 100 and BR Lite 900", "kitna price hai kiprun ks900"
- **Follow-ups:** "the second one", "does the first one have pockets?", "is it waterproof?", "which one is lighter?", "show similar products", "what else goes with it?"
- **Actions:** "add it to cart" asks for a size when needed, then adds to the real cart. Product cards in chat are numbered and have an Add to cart button.
- **Store questions:** returns, delivery, store pickup, coupons, payments
- **Honesty:** says when we don't stock something (tennis, cricket…) and offers the closest alternative. Politely declines off-topic questions.
- **Typos:** "shose", "bagpack"

Regression test: with the dev server running, `python3 scripts/chat-eval/run.py scripts/chat-eval/cases.json` sends 36 conversations through `/api/chat` and prints every reply.

### Turning on an AI model

```bash
cp decath-mobile/.env.example decath-mobile/.env.local   # then paste ONE key
```

Put either `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` in `.env.local`, then restart `npm run dev`. If both are set, Claude is used unless `LLM_PROVIDER=gemini`. The chat footer shows which model answered: "Powered by Claude / Gemini + product RAG".

Without a key, or if a request fails (out of credits, rate limit, network), the assistant uses the rule-based answer, which is built from the same retrieved facts. The failure is logged in the dev server output. `LLM_PROVIDER=off` forces offline mode. `CLAUDE_MODEL` and `GEMINI_MODEL` override the models.

> This is a personal learning clone. If you make it public, replace the brand name and the hot-linked product images.
