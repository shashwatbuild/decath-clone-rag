# Features and shopper benefits

[Back to the project](../README.md) · [Screenshots](SCREENSHOTS.md) · [Architecture](ARCHITECTURE.md)

This inventory describes implemented features. “Benefit” explains the intended shopper value, not a measured conversion or business outcome.

## Gear Lab and camera preview

| Capability | What it does | Shopper benefit |
|---|---|---|
| Future sporting self | Compares budget-aware starting and progression kits, with explicit assumptions. | Understand a possible gear path before buying. |
| Conditions rehearsal | Checks selected conditions against catalogue fields and relevant guides. | Identify what needs checking before an activity. |
| Discriminating experiments | Offers the next criterion that separates eligible products; updates hard requirements. | Narrow choices with a useful question. |
| Ownership and lifecycle logs | Records gear condition, size, use minutes, comfort and repairs with catalogue care links. | Reuse equipment and keep a care history. |
| Opt-in community fit | Stores pseudonymous size votes; displays groups of at least five device tokens; allows deletion. | Consult collective feedback without publishing individual reports. |
| Evidence contracts | Shows field evidence and match/mismatch/unknown status; fingerprints remain in the analysis API. | Check the reasons behind eligibility. |
| Team kit planning | Allocates essentials within individual budgets for up to six people; shares badminton shuttles once. | Avoid duplicate purchases and personal budget overruns. |
| Buy-less advocate | Suggests reuse, inspection, maintenance, deferral and checking borrowing. | Consider alternatives to new purchases. |
| Multi-query RAG | Decomposes queries, filters sources by activity and fuses hybrid results. Technical traces remain in the API. | Read focused source evidence without technical clutter. |
| Shared validated state | Common brief across tools; local persistence, import/export/reset and cross-tab updates. | Keep desktop/mobile interactions consistent. |
| Live outfit preview | Six curated photographic tops, pose-driven textured torso mesh, skin/hair foreground occlusion, a worker and original-camera comparison. | See the real product texture over your tracked body without uploading camera frames. |
| Camera fallback | Camera-off welcome, explicit asset errors, shoulder-based length estimate and tracking-loss suppression. | Avoid a fake floating shirt when no body is tracked; understand estimated alignment. |

[Implementation, supported products, privacy and practical limits →](GEAR_LAB.md)

## RAG chatbot

| Capability | What it does | Shopper benefit / example |
|---|---|---|
| Natural-language discovery | Searches by category, sport and intended use. | “Shoes for marathon running.” |
| Budget understanding | Handles under/above/between, rupees, k and some Hinglish expressions. | “Yoga mat under 1k” or “1000 se kam.” |
| Recipient context | Recognises men/women and phrases such as “for my wife”; provides child-sizing caveats. | More relevant suggestions without repeatedly setting filters. |
| Need matching | Retrieves listed benefits such as cushioning, pockets and thickness. | Connects a use case to product facts. |
| Ranked searches | Supports price, weight, thickness, rating, discount and newness where data permits. | “Lightest trekking backpack.” |
| Named-product lookup | Resolves models, product IDs and product links. | Find a specific item quickly. |
| Typos and synonyms | Normalises common misspellings and related terms. | “Shose” can still find shoes. |
| Product Q&A | Explains listed price, sizes, material, benefits, specs, care, weight and warranty. | Read product facts conversationally. |
| Page-aware chat | Carries the current product into the conversation. | Ask “What is it made of?” from a product page. |
| Follow-up context | Resolves current-topic references and ordinals such as “the second one.” | Continue comparing without repeating names. |
| Comparison tables | Shows products side by side with relevant differences and a verdict. | Assess trade-offs in one place. |
| Similar and complementary products | Offers alternatives and related gear. | Explore another option or complete a kit. |
| Buying guides | Answers supported selection questions about rackets, shuttles, shoes, mats, backpacks and sizing. | Learn what matters before buying. |
| Policy Q&A | Retrieves demo returns, delivery, coupons, payment and other store guidance. | Resolve common shopping questions. |
| Numbered sources | Links knowledge answers to guide, policy or product sources. | Check where an answer came from. |
| Developer retrieval trace | The API includes rewritten queries, retrieval stages and passage scores; shopper screens show source links. | Debug retrieval while keeping shopping screens concise. |
| Cart actions | Adds the selected product and asks for a size when required. | Move from advice to a cart item. |
| Navigation actions | Opens cart, checkout or a prefilled gear planner. | Continue the shopping flow from chat. |
| Suggestion chips | Provides clickable follow-up questions and kit offers. | Less typing and a clearer next step. |
| Proactive kit offer | Recognises starting badminton, running or yoga. | Discover equipment needs early. |
| Voice dictation | Uses browser speech recognition with en-IN when supported. | Speak a question, then review and send it. |
| Unsupported requests | Acknowledges missing details/unstocked categories and declines unrelated topics. | Sets expectations instead of inventing an answer. |
| Optional generation | Gemini or Claude can phrase replies from retrieved evidence. | More conversational wording. |
| Resilient fallback | Catalogue replies remain available without keys or after provider failures. | Core advice remains usable during AI outages. |

## Personalised advisor and kits

| Capability | What it does | Shopper benefit |
|---|---|---|
| Five product profiles | Yoga pants, yoga mats, backpacks, badminton rackets and running shoes. | Questions and criteria match the sport. |
| Visual style choices | Catalogue-backed type cards and “Help me choose.” | Understand unfamiliar product types. |
| Activity brief | Extracts stated activity, level, budget and preferences; allows edits. | Keep the recommendation aligned with the request. |
| Short questioning | Asks discriminating questions with skip/no-preference options. | Reach a useful answer with fewer inputs. |
| Must-haves vs preferences | Filters by hard requirements, then ranks suitable products. | Avoid quietly recommending outside stated constraints. |
| Honest ties and unknowns | Can say “Both are suitable” or “Not specified.” | Avoid false precision. |
| Explanation panels | Why it fits, trade-offs, still to check and product evidence. | Understand the reason behind a pick. |
| Needs-based comparison | Requirements alongside full-spec comparisons. | Separate personal fit from raw specifications. |
| What-if controls | Changes budget, priorities or supported criteria. | See how a decision changes before committing. |
| Undo | Restores earlier brief, ranking and kit states. | Explore changes reversibly. |
| No-match recovery | Offers explicit budget/requirement changes. | Recover from an impossible brief. |
| Sport kits | Yoga, badminton and marathon item groups with essential/optional explanations. | See what is useful for an activity. |
| Ownership tracking | Already own / Need this / Not sure / Skip, also editable through chat. | Avoid unnecessary purchases. |
| Separate kit budget | Totals selected new gear, flags overspending and offers eligible cheaper swaps. | Keep the whole kit affordable. |
| Core-product carryover | Includes the selected main item without duplicating it. | Preserve the original product decision. |
| Safe kit cart selection | Checks sizes and excludes items already in the cart from duplicate additions. | Fewer incomplete or repeated cart entries. |
| Opt-in saved preferences | Stores profile preferences on this device, excluding the budget. | Reuse preferences without an account. |

## Store and supporting tools

| Area | Implemented features | Shopper benefit |
|---|---|---|
| Desktop and mobile | Responsive store, dedicated desktop canvas and phone-frame preview; consistent Inter typography, separated cards, readable coupons and clearer chat/advisor panels. | Use a cleaner, more consistent interface across screens. |
| Catalogue | 87 products across 19 categories, including expanded badminton and running gear. | Browse a focused, inspectable demo catalogue. |
| Home | Sport navigation, coupons, bestseller/discount rails, assistant, kit and planner links. | Find a starting point quickly. |
| Search and listings | Name/brand/category/sport search; gender, price, brand, rating and promotional filters; sorting. | Narrow a large result set. |
| Product details | Swipeable gallery, thumbnails, price/offers, sizes, stock, warranty, benefits, specifications and care. | Review facts before choosing. |
| Plain-language glossary | Tappable technical terms open explanations. | Understand jargon such as cushioning or DWR. |
| Size finder | Apparel height/weight, shoe foot length and cycle-frame height heuristics. | Get a starting size suggestion. |
| Delivery estimate | Editable pincode and rule-based estimated dates/countdown. | Understand the demo delivery flow. |
| Discovery rails | Similar, frequently bought together and recently viewed items. | Return to or explore products. |
| Ratings and reviews | Ratings, breakdowns, aspect scores and star filtering; review text is sample data. | Demonstrate a complete product-review UI. |
| Wishlist | Save items and move cart items to the wishlist. | Keep options for later. |
| Cart | Sizes, quantities, removal, MRP/discount/coupon/shipping/payable breakdown. | Review exactly what is selected. |
| Coupons | NC100 / NC200 / NC300 with eligibility thresholds. | See an applied discount in cart and checkout. |
| Price watch | Saves a target 10% below the current price and displays status in notifications. | Track an item against a local target. |
| Notifications | Offers link to products, categories and prefilled chat questions. | Jump directly to relevant content. |
| Gear planner | Badminton, running, yoga or trekking; 1–12 weeks, budget, owned items and costs per week. | Schedule gear purchases; this is not an exercise programme. |
| Demo checkout | Wallet starting at ₹5,000, ₹1,000 demo top-ups, COD, confirmation, order ID and cart clearing. | Try checkout without real payments or shipping. |
| Local persistence | Cart, wishlist, recently viewed, pincode, price watches, wallet/orders and opt-in preferences. | Retain browser-local shopping state. |

## Boundaries

No live inventory/price sync, real payment gateway, fulfilment integration, real order-support actions, account sync, persistent server-side chat history, background price-alert service or dense-vector retrieval is implemented. Voice depends on browser support and permission. Citations validate source references, not the truth of every AI claim. Delivery and sizing are demo rules. Catalogue facts can become stale.

For the evidence-scoped comparison with Decathlon’s official chat, see the [README](../README.md#how-is-this-different-from-decathlons-chatbot).

## Sports companion and conversation memory

| Capability | What it does | Customer benefit |
|---|---|---|
| Adventure builder | Interactive sport selection, budget, ownership checklist and catalogue-based kit with explicit over-budget feedback. | Prepare for an activity using suitable gear you already own. |
| Saved adventures | Reopen/edit plans, tick preparation tasks, download a checklist and carry owned categories into weekly planning. | Follow through on a personal plan. |
| First-session planner | Friend/instructor format, city-based external discovery, date/time, duration and a borrowing checklist. | Explore a sport before committing to a kit. |
| Trial journal | Save tentative plans, export an ICS reminder and record enjoyment/notes afterwards. | Decide what to try next from experience; no booking is implied. |
| Fit wardrobe | Opt-in item/size feedback, movement comfort, optional areas and notes; edit/remove records with Undo. | Remember real wearing experience without uploading body images. |
| Exact-item size recall | Explicitly select a previously comfortable size on the same product. | Reduce repeated size decisions without pretending different items fit identically. |
| Persistent assistant | Retains chat, cards, draft and guided advisor state across product navigation and reload. End chat clears it. | Continue a shopping conversation without starting again. |

[Implementation, privacy and service boundaries →](SPORTS_COMPANION.md)
