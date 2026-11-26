# Gear Lab and live outfit preview

[Project](../README.md) · [All features](FEATURES.md) · [Screenshots](SCREENSHOTS.md)

Gear Lab turns futuristic ideas into practical, inspectable shopping tools. It uses the same catalogue, cart and design system as the desktop and mobile store.

## What is implemented?

| Tool | Working behaviour | Practical boundary |
|---|---|---|
| Future sporting self | Compares starting and selected progression/challenge kits, owned gear offsets, costs and uncovered needs. | Scenario planning; weeks do not predict fitness or readiness. Running distance defaults are shown and can be overridden. |
| Conditions rehearsal | Checks selected rain, outdoor and long-session assumptions against product fields and relevant guides. | A preparation checklist; no live weather, physical simulation or safety certification. |
| Next best experiment | Chooses a catalogue criterion that separates current eligible candidates. An answer becomes an explicit hard filter. | Counts products rather than claiming personal confidence or measured information gain. No laboratory trial is performed. |
| Gear memory | Saves condition, size and dated use/comfort/repair notes; totals recorded use and minutes. | User reports and catalogue care facts; no sensors or remaining-life prediction. |
| Community fit | Accepts consented size feedback, deduplicates by device/product/size, publishes thresholded aggregates, supports deleting this device's reports. | At least five distinct device tokens per product/size; tokens are not verified people. No reports are pre-seeded. |
| Evidence contracts | Shows hard checks, preferences, unknowns, source fields and a fingerprint of the brief/product evidence. | A reproducible application decision record, not a legal guarantee or cryptographic attestation. |
| Team kit | Plans essentials for one to six people within individual budgets; buys badminton shuttles once for the group. | Greedy cheapest-eligible allocation, not a globally optimal solver. Shoes, clothing and rackets remain personal. Sizes must be chosen before cart actions. Per-person add controls permit two teammates to buy the same model/size as separate quantities. |
| Buy-less advocate | Recommends reuse, inspection, maintenance, deferral or checking borrowing before purchase. | No verified rental inventory, repair quotes or environmental savings estimate. |
| Live outfit preview | Runs a camera and MediaPipe pose detector locally, follows visible joints with a smoothed 2D garment overlay, offers manual alignment. | Approximate colour/silhouette or catalogue crop; no realistic fabric rendering, size measurement, drape or fit guarantee. |

## Use it

1. Open `/lab` and edit the shared brief: activity, budget, priority, conditions and planning horizon.
2. Explore the eight tabs. A free-text request informs retrieval; explicit answers control hard eligibility.
3. Record owned equipment and its condition. Only gear marked usable offsets purchases.
4. Open the evidence behind a candidate, select an available size and add it to the same store cart.
5. Open `/try-on`, choose supported clothing and press **Start camera**. Press **Stop camera** to release it.

The mobile brief collapses so results stay easy to scan. Export/import moves a validated brief between browsers; it is not automatic account synchronisation. Changing activity clears activity-specific answers.

### Camera guidance

| Clothing | Tracking input |
|---|---|
| T-shirts / running tops / supported badminton tops | Shoulders and hips. If only shoulders are visible, shirt length is estimated and labelled. |
| Running shorts / yoga capris / badminton shorts | Hips and knees must be visible. |
| Yoga pants | Hips and ankles must be visible. |
| Rackets, shoes and other equipment | Clothing preview is not offered. |

Face forward in even lighting with one person visible. Green dots show visible anchor joints. If the overlay stays fixed, read the status: the model may still be loading or the needed joints may be outside the frame. Select **Manual positioning** or adjust scale/offsets. **Check tracking engine** tests model loading and inference without opening the camera.

Camera access requires HTTPS or localhost and browser permission. Runtime/WASM and the pose model download from jsDelivr and Google's model storage. Camera frames are processed in the browser and are not uploaded, recorded or saved. Camera resources stop on Stop, page unmount or when the page becomes hidden. See [MediaPipe's official pose documentation](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker).

Browser model inference passed in testing. The user confirmed that their camera opens and reported a fixed overlay; the implementation now includes a labelled shoulder-only fallback and clearer diagnostics. Reliable alignment across real devices, poses, clothing and lighting still needs validation. Repository screenshots show the demo mannequin with the camera off.

## Retrieval and shared state

| Layer | Implementation |
|---|---|
| Retrieval | Up to five targeted queries, existing hybrid BM25/character-gram retrieval, activity-scoped source filtering and reciprocal-rank fusion. |
| Evidence use | Product-scoped evidence can break equal-preference ranking ties. Explicit budget, stock and hard requirements control eligibility. |
| Transparency | Full source passages, query trace, field-level contracts and clearly stated missing facts. No silent constraint relaxation. |
| Personal data | Browser-local brief and ownership logs, temporarily sent to the app's analysis endpoint. The Lab does not call an external LLM. |
| UI consistency | One provider, schema, analysis endpoint and reusable components across desktop/mobile; stale requests are cancelled and stale-result cart buttons disabled. |
| Cart | Shared store cart with size validation and duplicate prevention. |

## Community storage and privacy

Feedback is opt-in. The browser stores a random device token; the server persists its SHA-256 hash, product ID, listed size, fit vote and timestamp. Reports expire from aggregates after 180 days and are pruned on writes. New submissions replace that device's previous product/size vote. Only aggregate counts for cohorts of at least five device tokens are exposed.

This is **pseudonymous feedback**, not federated learning, differential privacy or verified-purchase data. A user can create more than one device token; a public production service needs authentication/abuse controls. Losing or clearing the token prevents identifying previous submissions for deletion.

By default records live in `decath-mobile/.local/gear-lab/` and are ignored by Git. Set `LAB_DATA_DIR` to a private persistent directory when hosting. Writes use an exclusive lock and atomic file replacement, suitable for a single host with a shared persistent volume. Ephemeral deployments lose reports. Multiple independent instances need a transactional database. After a process crash, an operator may need to remove a stale `community.lock` after confirming no writer is active. Storage failures show an error; they never become fabricated reports.

## Validation

`npm test` runs existing retrieval/advisor regressions and 42 new Gear Lab/API checks. These cover all four activities, budgets and requirements, off-topic source filtering, owned/repair handling, experiments, shared equipment, input validation, pose placement and shoulder fallback, consent, aggregation thresholds, concurrent writes, deletion and API errors. Browser checks cover desktop and mobile views and the camera-off tracking engine check.
