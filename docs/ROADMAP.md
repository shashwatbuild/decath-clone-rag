# What is delivered, and what comes next

[Project](../README.md) · [Full feature matrix](FEATURES.md)

The next improvements should make decisions more useful and evidence more dependable. This page distinguishes working features from future integrations.

## Delivered

| Area | Current implementation |
|---|---|
| Shopping assistant | Hybrid retrieval, cited knowledge answers, multi-part questions, bounded parent-guide context and conservative generated-answer checks. |
| Optional semantic retrieval | Local Ollama embedding adapter, contextual index builder, rank fusion and lexical fallback. A real local model/index must be configured; fixture tests are not semantic quality results. |
| Guided decisions | Editable briefs, hard requirements, preference ranking, comparison, Undo and ownership-aware kits. |
| Gear Lab | Eight tools for kit scenarios, conditions, discriminating questions, owned gear, community fit, evidence, team kits and buying less. |
| Sports companion | Saved adventure plans, personal trial/session planning, calendar export, post-session reflections and opt-in exact-item fit memories. |
| Camera preview | Six curated photographic tops, tracked torso mesh and foreground masking; no physical-fit guarantee. |
| Mobile and continuity | Focused setup/weekly-plan views, expandable weekly cards and chat restoration across product navigation and refresh. |

## Next priorities

| Priority | Improvement | Customer value | What is needed / how to validate |
|---|---|---|---|
| 1 | **Authorised catalogue refresh** | Reduce decisions based on stale prices, sizes and stock. | A permitted data source, update timestamps and checks against source records. |
| 2 | **Real trial-session integrations** | Move from a personal plan to verified sessions and availability. | Venue/partner APIs, explicit booking confirmation, cancellation handling and equipment availability. |
| 3 | **Larger RAG evaluation** | Establish whether semantic retrieval improves useful answers. | Real-model tests on a larger held-out set; compare relevance, unsupported claims, refusals, latency and cost with the current baseline. |
| 4 | **Stronger claim verification** | Catch unsupported interpretations that lexical overlap can miss. | An adversarial evaluation set and carefully tested entailment/verification approaches; do not equate a valid citation with a true claim. |
| 5 | **Whole-kit optimisation** | Cover more essential needs within a real budget. | Replace greedy selection with a constrained solver; verify stock, sizes, individual budgets and shared-item rules. |
| 6 | **Optional account-backed memory** | Continue across devices with control over saved information. | Authentication, isolated storage, consent, editing, export and deletion. |
| 7 | **Broader language coverage** | Make shopping conversations easier in Hindi and Hinglish. | Native-speaker evaluation of retrieval, requirements and size/cart actions. |
| 8 | **Real price notifications** | Notify customers when a genuinely refreshed price meets their target. | Scheduled data updates, opt-in delivery, deduplication and unsubscribe controls. |

## Camera and fit research

| Direction | Practical next step | Boundary to preserve |
|---|---|---|
| Better live alignment | Test motion/framing across real devices; improve sleeve articulation and review additional garment assets. | Device performance must be measured, not inferred from a static fixture. |
| Photo-based try-on | Evaluate a separate model service with licensed images and an explicit cost/consent/retention design. | This is not enabled in the current application. |
| Physical sizing and 3D drape | Obtain calibrated measurements, garment geometry and material data. | A webcam silhouette or visual overlay must not be sold as a fit guarantee. |
| More useful fit feedback | Improve item-specific feedback and user corrections before considering broader recommendations. | Keep self-reported experience distinct from verified measurements or cross-product size predictions. |

Related reading: [retrieve-and-rerank workflows](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html), [faithfulness evaluation](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/faithfulness/). Any additional model or evaluation framework should be measured against this project's own data and constraints.
