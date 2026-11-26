# Ideas for a smarter assistant

[Back to the project](../README.md)

The eight Gear Lab tools and photographic live AR fitting room are now implemented; see [their practical scope](GEAR_LAB.md). The table below describes further improvements, not capabilities already delivered. The order prioritises trustworthy answers and useful shopping decisions before adding more automation.

| Priority | Improvement | Shopper benefit | How to validate it |
|---|---|---|---|
| 1 | **Fresher catalogue** — authorised data refresh, validation and a “last updated” timestamp. | Fewer recommendations based on stale prices or stock. | Compare stored prices/availability with the source and track stale records. |
| 2 | **Stronger answer checks** — connect each factual claim to its supporting passage; add adversarial and ambiguous questions. | Better-supported answers and clearer admissions of uncertainty. | Measure claim support, appropriate refusal, retrieval recall and action correctness on a larger held-out set. |
| 3 | **Semantic retrieval experiment** — combine embeddings with existing keyword retrieval and test a learned reranker. | Potentially understand paraphrases and unfamiliar descriptions better. | Compare against the current hybrid baseline; retain only if quality improves within latency/cost limits. |
| 4 | **Learned clarification** — compare the existing catalogue-splitting question heuristic with measured user outcomes. | Less questioning and more relevant picks. | Measure questions-to-decision and whether the final choice meets the brief. |
| 5 | **Global kit optimisation** — replace the current greedy allocation with a solver across essential coverage, sizes and individual budgets. | A more useful complete kit for the same spend. | Check hard budgets, size/stock constraints, duplicate prevention and essential coverage. |
| 6 | **Account-based memory** — extend existing local gear logs and import/export to optional authenticated cross-device sync. | Resume shopping across visits or devices. | Verify consent, corrections, forgetting and isolation between users. |
| 7 | **Hindi/Hinglish coverage** — expand language understanding and test bilingual shopping conversations. | Make the assistant easier to use in the shopper’s preferred language. | Native-speaker review of retrieval, requirements and size/cart actions. |
| 8 | **Real price alerts** — scheduled refreshes and opt-in notifications. | Learn when a watched item actually reaches its target. | Test deduplication, stale data, delivery and unsubscribe behaviour. |

**Technical references:** [Sentence Transformers’ retrieve-and-rerank workflow](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html) describes a candidate-retrieval stage followed by a cross-encoder. [Ragas faithfulness](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/faithfulness/) evaluates consistency with retrieved context. Neither tool guarantees an improvement on this catalogue; measure against this project’s own baseline.

## Further camera and intelligence work

| Idea | Practicality | Next implementation step |
|---|---|---|
| Better live garment alignment | Feasible, with real-device testing. | The worker, textured torso mesh and foreground mask are implemented. Next test live framing/latency across devices and add independently articulated sleeves and more reviewed assets. |
| Photorealistic photo try-on | Feasible through a separate model service; needs cost, consent and retention design. | Evaluate a provider on licensed garment/person images before offering uploads. |
| True 3D drape and physical sizing | Substantial research/data work. | Obtain garment meshes, material properties and calibrated measurements; never infer a fit guarantee from a webcam silhouette. |
| Semantic reranking | Feasible experiment. | Compare embeddings/cross-encoders against the existing hybrid/RRF baseline on a larger held-out set. |
| Trustworthy community data | Feasible production work. | Add identity/abuse controls, database storage and verified-purchase signals before using votes for recommendations. |
