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
| Evidence contracts | Shows hard checks, preferences, unknowns and source fields. A fingerprint remains available in the API for debugging. | A reproducible application decision record, not a legal guarantee or cryptographic attestation. |
| Team kit | Plans essentials for one to six people within individual budgets; buys badminton shuttles once for the group. | Greedy cheapest-eligible allocation, not a globally optimal solver. Shoes, clothing and rackets remain personal. Sizes must be chosen before cart actions. Per-person add controls permit two teammates to buy the same model/size as separate quantities. |
| Buy-less advocate | Recommends reuse, inspection, maintenance, deferral or checking borrowing before purchase. | No verified rental inventory, repair quotes or environmental savings estimate. |
| Live outfit preview | Isolates real catalogue garments, warps their photographic texture through a torso mesh and restores foreground skin/hair. Pose tracking and foreground segmentation run independently in separate workers. | Front-view photographic AR for six curated tops. No generative fabric rendering, true 3D drape, size measurement or fit guarantee. |

## Use it

1. Open `/lab` and edit the shared brief: activity, budget, priority, conditions and planning horizon.
2. Explore the eight tabs. A free-text request informs retrieval; explicit answers control hard eligibility.
3. Record owned equipment and its condition. Only gear marked usable offsets purchases.
4. Open the evidence behind a candidate, select an available size and add it to the same store cart.
5. Open `/try-on`, choose a supported top, wait for its real garment layer to be ready and press **Open live camera**. Press **Stop camera** to release it.

Mobile uses an expandable plan, a section selector and stacked product checks. Export/import/reset sit under “Saved plan”. Export/import moves a validated brief between browsers; it is not automatic account synchronisation. Changing activity clears activity-specific answers.

### Camera guidance

| Supported top | Asset used |
|---|---|
| Badminton T-Shirt 530 | Front flat-lay, with studio background removed. |
| Gym Compression T-Shirt | Front model view; clothing isolated using multiclass segmentation. |
| Recycled Polyester Gym T-Shirt | Front model view; real print retained. |
| Sportee Cotton T-Shirt | Front model view; white fabric retained. |
| Kiprun 100 Running T-Shirt | Front model view; clothing isolated from the photographed person. |
| Run 900 Running T-Shirt | Front model view; real fabric and graphics retained. |

Other tops, shorts, pants and equipment are not offered as if they had a verified fitting asset. A direct link to an unsupported item explains the limit; it never passes off another product's texture as that item.

Face forward in even lighting, with one person visible. Show shoulders and waist. If only shoulders are visible, torso length is estimated and the status says so. A missing or stale pose hides the garment instead of leaving it floating in the centre; strong side views are rejected. **Show original** compares the unmodified camera. Adjustments change visual ease and hem position, not physical size.

The new page has no drawn mannequin, geometric shirt, arbitrary crop mode or opacity slider. Six curated photographs are isolated and cropped to their alpha bounds. The renderer uses a piecewise affine mesh to follow independently moving shoulder/hip anchors; a multiclass mask restores skin, hair and accessories above it. This is photographic AR, not a generative clothing replacement: existing clothes can remain visible where their silhouette is larger, sleeves do not articulate independently, and large rotations cannot reveal an unseen side/back.

Camera access requires HTTPS or localhost and browser permission. Runtime/WASM and pose/segmentation models download from jsDelivr and Google's model storage. Camera frames are processed in a Web Worker and are not uploaded, recorded or saved. The server's asset endpoint accepts only curated product IDs and fetches their fixed catalogue images; it accepts no camera image or arbitrary URL. Camera tracks stop and the canvas is cleared on Stop; page hiding and unmount also release camera resources. See [MediaPipe segmentation documentation](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter).

All six asset extractions and the complete pose/foreground/mesh pipeline passed a browser check on public catalogue photographs. A development-only `/try-on/validation` page reproduces those checks; it returns 404 in production. The separated pose path averaged 13 ms over five repeated fixture frames, while the combined pose/segmentation fixture pass took 212 ms. These are small local measurements, not webcam frame-rate or device-wide guarantees. A lighter mesh, bounded motion prediction and torso-aligned older masks reduce perceived delay. Live webcam alignment, latency, segmentation edges and lighting/body diversity still require real-device acceptance testing. Screenshots deliberately do not imply that this verification has happened.

The `/m` device preview now keeps a fixed 414 × 868 device rather than compressing its height to fit a short desktop window. Short windows scroll. Repository mobile captures use a full portrait frame, and desktop images have their own full-width gallery rows.

## Retrieval and shared state

| Layer | Implementation |
|---|---|
| Retrieval | Up to five targeted queries, existing hybrid BM25/character-gram retrieval, activity-scoped source filtering and reciprocal-rank fusion. |
| Evidence use | Product-scoped evidence can break equal-preference ranking ties. Explicit budget, stock and hard requirements control eligibility. |
| Transparency | Source links, optional full passages, product checks and clearly stated missing facts. Query traces and fingerprints remain in the API. No silent constraint relaxation. |
| Personal data | Browser-local brief and ownership logs, temporarily sent to the app's analysis endpoint. The Lab does not call an external LLM. |
| UI consistency | One provider, schema, analysis endpoint and reusable components across desktop/mobile; stale requests are cancelled and stale-result cart buttons disabled. |
| Cart | Shared store cart with size validation and duplicate prevention. |

## Community storage and privacy

Feedback is opt-in. The browser stores a random device token; the server persists its SHA-256 hash, product ID, listed size, fit vote and timestamp. Reports expire from aggregates after 180 days and are pruned on writes. New submissions replace that device's previous product/size vote. Only aggregate counts for cohorts of at least five device tokens are exposed.

This is **pseudonymous feedback**, not federated learning, differential privacy or verified-purchase data. A user can create more than one device token; a public production service needs authentication/abuse controls. Losing or clearing the token prevents identifying previous submissions for deletion.

By default records live in `decath-mobile/.local/gear-lab/` and are ignored by Git. Set `LAB_DATA_DIR` to a private persistent directory when hosting. Writes use an exclusive lock and atomic file replacement, suitable for a single host with a shared persistent volume. Ephemeral deployments lose reports. Multiple independent instances need a transactional database. After a process crash, an operator may need to remove a stale `community.lock` after confirming no writer is active. Storage failures show an error; they never become fabricated reports.

## Validation

`npm test` runs existing retrieval/advisor regressions and 50 Gear Lab/API and fitting checks. These cover all four activities, budgets and requirements, off-topic source filtering, owned/repair handling, experiments, shared equipment, input validation, pose placement and shoulder fallback, consent, aggregation thresholds, concurrent writes, deletion and API errors. Browser checks cover desktop and mobile views and the camera-free photographic fitting pipeline.

## Shopper-facing UI

Labels use sentence case. Mobile headers prioritise the page title, search and cart. In the fitting room, garment selection comes before the mirror on mobile, with size/cart controls available on demand. Desktop retains its two-column layout. Timings, numbered workflow labels, model-loading diagnostics, revision codes and retrieval scores are removed from shopper screens; useful source links and camera/privacy guidance remain.
