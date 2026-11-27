# Sports companion

Three connected flows help a customer try an activity, prepare for it and remember what fitted. They work on desktop, mobile and the iPhone preview.

| Feature | What you can do | What is saved |
|---|---|---|
| Plan my next adventure | Choose an activity, set a gear budget, reuse owned categories, generate a checklist, select product sizes, add items to cart and download the plan. | Up to 12 editable adventure plans on this device. |
| Try a sport | Choose a friend/instructor format, explore venues through Google Maps, plan a date and duration, download a tentative calendar reminder and record a post-session reflection. | Up to 12 personal trial plans and reflections on this device. |
| My fit memories | Find an item you wore, record a listed size, overall fit, movement comfort, optional problem areas and a note. Reuse a comfortable size for that exact item on its product page. | Up to 50 fit records, saved only after opting in. No camera images or body measurements. |
| Keep my conversation | Open a product, return to chat and continue with messages, product cards, draft input and the guided shopping session intact. Refresh restores the saved conversation when browser storage is available. | One browser-local assistant conversation, until End chat or browser data clearing. |

## Where to find them

- **Storefront:** “Try it. Plan it. Make it yours.”
- **Desktop navigation:** Explore.
- **Companion navigation:** Plan an adventure / Try a sport / My fit memories.
- **Product page:** Your fit memory, alongside size selection.
- **Camera fitting room:** My fit memories and a link to record this item's fit.
- **Chat:** Ask to open the adventure planner, try a sport or open fit memories.
- **iPhone preview:** `/m?screen=adventures`, `/m?screen=try-sport` or `/m?screen=fit`.

## What stays connected

The adventure planner uses the existing catalogue and gear-planning engine. Owned categories are excluded from purchases, and usable Gear Lab inventory can be matched by category. Weekly planner links carry sport, budget and owned categories. Sized items require a valid size before adding to cart. Totals explicitly show when the suggested kit exceeds the budget.

A fit memory can populate a size only after the customer chooses “Use my remembered size”, and only for the same catalogue item. The latest saved feedback for an item/size replaces its previous entry. Similar products do not inherit a size prediction. Camera preview adjustments do not change physical size or fit records.

Saved experiences can be reopened and edited. Removing a saved item offers Undo until the next saved change or reload. Browser-local data is not account-backed and does not sync between devices. Storage errors are shown rather than claiming a successful save.

The assistant conversation lives above route changes, so product navigation does not unmount its state. Storage snapshots validate message shapes and rebuild product cards from catalogue IDs. Network history is bounded independently of the displayed conversation. Closing the chat preserves it; **End chat** aborts an in-progress response, clears the conversation and returns home. This does not erase separate fit memories or saved plans. Conversations that disappeared before this feature existed cannot be recovered automatically.

## Practical boundaries

**Trials are personal plans, not bookings.** Venue discovery opens a Google Maps search for the selected sport and city using the [official Maps URL format](https://developers.google.com/maps/documentation/urls/get-started). No live venue listings, rental inventory, fees, available slots or instructor reservations are invented. Customers confirm those directly with the venue. Calendar exports are marked tentative and explicitly state that no booking has been made. The session outline is flexible planning guidance, not a personalised workout prescription.

**Fit memories are self-reported.** They do not establish physical measurements, guarantee a size or turn the camera overlay into a drape simulation.

**Adventure kits use bundled catalogue data.** They are not live stock or a complete outdoor/safety checklist. The day-walking flow explicitly asks customers to confirm route-specific requirements separately.

## Implementation and checks

- `lib/experiences/model.ts`: validated records, ownership-aware kit calculation, exact-item fit recall, venue links and escaped/folded calendar exports.
- `lib/experiences/store.tsx`: bounded browser-local persistence, cross-tab experience updates, explicit writes and reversible removal.
- `components/experiences/`: shared accessible navigation, stepper, checklists, size/fit controls and responsive layouts.
- `lib/chat/`: persistent conversation provider and validated reload snapshots.
- `scripts/experiences-check.mjs`: 15 checks covering round trips, invalid sizes, exact-item recall, budget/ownership behavior, calendar rollover/injection, safe discovery links and conversation/advisor restoration.

```bash
cd decath-mobile
npm run check:experiences
npm test
npm run lint
npm run build
```

Browser checks cover saving/reopening an ownership-aware plan, trial/calendar download, fit-record creation, remembered-size selection, removal/Undo, mobile overflow and a chat → product → back → refresh journey. Any fit record created for verification is labelled as a test and removed afterwards; screenshots do not publish a personal camera capture.
