# Ideas for a smarter assistant

[Back to the project](../README.md)

These are proposed improvements, not implemented features. The order prioritises trustworthy answers and useful shopping decisions before adding more automation.

| Priority | Improvement | Shopper benefit | How to validate it |
|---|---|---|---|
| 1 | **Fresher catalogue** — authorised data refresh, validation and a “last updated” timestamp. | Fewer recommendations based on stale prices or stock. | Compare stored prices/availability with the source and track stale records. |
| 2 | **Stronger answer checks** — connect each factual claim to its supporting passage; add adversarial and ambiguous questions. | Better-supported answers and clearer admissions of uncertainty. | Measure claim support, appropriate refusal, retrieval recall and action correctness on a larger held-out set. |
| 3 | **Semantic retrieval experiment** — combine embeddings with existing keyword retrieval and test a learned reranker. | Potentially understand paraphrases and unfamiliar descriptions better. | Compare against the current hybrid baseline; retain only if quality improves within latency/cost limits. |
| 4 | **Smarter clarification** — ask the single question most likely to separate suitable products. | Less questioning and more relevant picks. | Measure questions-to-decision and whether the final choice meets the brief. |
| 5 | **Better kit optimisation** — jointly choose gear under a total budget, considering essential items and already-owned equipment. | A more useful complete kit for the same spend. | Check hard budgets, size/stock constraints, duplicate prevention and essential coverage. |
| 6 | **Persistent, editable memory** — optional saved conversations and preferences with delete/export controls. | Resume shopping across visits or devices. | Verify consent, corrections, forgetting and isolation between users. |
| 7 | **Hindi/Hinglish coverage** — expand language understanding and test bilingual shopping conversations. | Make the assistant easier to use in the shopper’s preferred language. | Native-speaker review of retrieval, requirements and size/cart actions. |
| 8 | **Real price alerts** — scheduled refreshes and opt-in notifications. | Learn when a watched item actually reaches its target. | Test deduplication, stale data, delivery and unsubscribe behaviour. |

**Technical references:** [Sentence Transformers’ retrieve-and-rerank workflow](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html) describes a candidate-retrieval stage followed by a cross-encoder. [Ragas faithfulness](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/faithfulness/) evaluates consistency with retrieved context. Neither tool guarantees an improvement on this catalogue; measure against this project’s own baseline.
