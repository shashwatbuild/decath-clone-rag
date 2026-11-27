/**
 * Knowledge base for the assistant: store policies and buying guides.
 *
 * Product pages answer "what does this product have?". This answers "how do I choose?", "what does that
 * mean?" and "how does the store work?". Each document is split into paragraphs that are retrieved and
 * cited separately. Guides are general buying advice written for this store; the policies mirror what the
 * app actually does. Product pages also contribute guide-like text of their own (see hybrid.ts).
 */

export type KnowledgeDoc = {
  id: string;
  kind: "policy" | "guide";
  title: string;
  /** sport or topic this document belongs to, used to prefer on-topic guides */
  topic: string;
  /** catalogue categories whose products are relevant to this document (shown as related products) */
  categories?: string[];
  /** follow-up chips offered with an answer from this document */
  suggest?: string[];
  /** paragraphs separated by a blank line */
  text: string;
};

export const KNOWLEDGE: KnowledgeDoc[] = [
  {
    id: "policy-adventures",
    kind: "policy", title: "Planning your next adventure", topic: "store",
    suggest: ["Open the adventure planner", "Try a sport before buying"],
    text: "Plan my next adventure lets you choose badminton, running, yoga or an easy day walk, set a gear budget and mark categories you already own. Reused categories are excluded from new purchases. The checklist and kit use the bundled catalogue; they are not live stock or a complete outdoor safety plan.\n\nSave an adventure on this device, reopen it, download a checklist or spread purchases over weeks in the training plan. A saved adventure does not book a venue, instructor or activity.",
  },
  {
    id: "policy-sport-trials",
    kind: "policy", title: "Trying a sport before buying gear", topic: "store",
    suggest: ["Try a sport", "Plan my next adventure"],
    text: "Try a sport helps you plan a first session with a friend or an instructor. Choose a sport, enter your city, explore external Google Maps results and decide what to borrow or bring. Confirm venue availability, fees, equipment, instruction and booking terms directly with the venue.\n\nSave a personal trial plan, download a tentative calendar reminder and record your enjoyment and notes after the real session. Saving or downloading does not make a booking or reserve equipment.",
  },
  {
    id: "policy-fit-memory",
    kind: "policy", title: "Fit memories and the camera fitting room", topic: "store",
    suggest: ["Open my fit memories", "Open camera preview"],
    text: "My fit memories records a catalogue item and listed size you have actually worn, whether it felt snug, right or loose, freedom of movement and optional fit notes. Save feedback only after choosing to keep it on this device. You can edit or remove individual memories.\n\nA comfortable remembered size can be selected explicitly for the exact same catalogue item on its product page. Fit memories do not automatically transfer sizes between products. The live camera fitting room is a visual preview and cannot confirm physical size or fit. No body measurements or camera images are saved in fit memories.",
  },
  {
    id: "policy-chat-memory",
    kind: "policy", title: "Keeping and ending your assistant conversation", topic: "store",
    text: "The assistant keeps its messages, draft input, product cards and guided shopping session while you open a product or another page and return. The conversation is saved in this browser when device storage is available and can be restored after refreshing.\n\nClosing the chat keeps the conversation. End chat clears the saved conversation and returns to the storefront. Conversation history is not an account or cross-device sync, and browser data clearing removes the saved conversation.",
  },
  // ---------------------------------------------------------------- store policies
  {
    id: "policy-returns",
    suggest: ["How fast is delivery?", "Any coupons?"],
    kind: "policy",
    title: "Return, exchange and warranty policy",
    topic: "store",
    text:
      "You can return or exchange most products within 30 days of delivery. Keep the item unused where possible and in its original packaging.\n\n" +
      "Most products also carry a 2-year warranty against manufacturing defects. Each product page shows its own warranty, and a few products are marked non-returnable on their page.",
  },
  {
    id: "policy-delivery",
    suggest: ["What's the return policy?", "Any coupons?"],
    kind: "policy",
    title: "Delivery, shipping and store pickup policy",
    topic: "store",
    text:
      "Delivery time depends on your pincode. Big-city pincodes usually take 2 to 3 days, most other places 4 to 6 days, and remote regions 6 to 8 days. Each product page shows the estimated date for the pincode you have set.\n\n" +
      "Shipping is free on orders of ₹999 or more and ₹99 below that. You can also choose to pick an order up from a store within 2 hours, free of charge.",
  },
  {
    id: "policy-coupons",
    suggest: ["View my cart", "What's on sale?"],
    kind: "policy",
    title: "Coupons and offers",
    topic: "store",
    text:
      "Three coupons work on the cart page: NC100 takes ₹100 off orders above ₹1,499, NC200 takes ₹200 off orders above ₹2,499, and NC300 takes ₹300 off orders above ₹3,499.\n\n" +
      "Some products also show their own offers on the product page, for example a cheaper price when you buy two.",
  },
  {
    id: "policy-payment",
    suggest: ["Go to checkout", "Any coupons?"],
    kind: "policy",
    title: "Payment, wallet and checkout",
    topic: "store",
    text:
      "This is a demo store. Checkout offers a demo wallet, which holds simulated money and moves no real money, and cash on delivery. You can add demo money to the wallet from the checkout page.\n\n" +
      "The assistant never pays for you. It can open checkout, and you review the order and confirm the payment yourself.",
  },
  {
    id: "policy-size-finder",
    kind: "policy",
    title: "Finding your size",
    topic: "store",
    text:
      "On a product page with several sizes, tap Find my size. For clothing enter your height and weight, for bikes your height, and for shoes your foot length. It suggests a size and can select it for you.\n\n" +
      "The suggestion is an estimate. If you are between two sizes, pick the larger for a relaxed fit, and treat the size chart on the product page as the final word.",
  },
  {
    id: "policy-price-watch",
    kind: "policy",
    title: "Price watch and alerts",
    topic: "store",
    text:
      "Tap Watch this price on a product page to follow it. You get an alert price 10 percent below today's price, and followed products appear under Price watch in Notifications with their current price and alert status. You can stop watching at any time.",
  },
  {
    id: "policy-kits",
    suggest: ["Help me build a badminton kit", "Help me build a marathon kit"],
    kind: "policy",
    title: "Kits and the training plan",
    topic: "store",
    text:
      "Tell the assistant you have started badminton, running or yoga and it can build a kit. It asks what you already own and only suggests what you still need, with a separate kit budget and cheaper swaps if you go over.\n\n" +
      "The Training plan page spreads the gear for badminton, a marathon, yoga or trekking across the weeks before you start, within the budget you choose.",
  },

  // ---------------------------------------------------------------- buying guides
  {
    id: "guide-badminton-racket",
    suggest: ["Help me choose a badminton racket", "Help me build a badminton kit"],
    kind: "guide",
    title: "How to choose a badminton racket",
    topic: "badminton",
    categories: ["Badminton Rackets"],
    text:
      "Start with weight and balance. Rackets are rated by a weight class where a higher U number means a lighter racket: 5U is about 75 to 79 g, while 1U is above 95 g. Lighter rackets are easier to swing and kinder on the wrist. Heavier ones can add power but tire your arm faster.\n\n" +
      "Balance describes where the weight sits. A head-heavy racket gives more power on clears and smashes. An even balance gives more control and quicker handling. Beginners usually do well with a light racket that is easy to handle.\n\n" +
      "Shaft flex matters too. A flexible shaft helps newer players generate power with less effort. A stiff shaft gives precision to stronger players but needs good technique.\n\n" +
      "Check the grip size (G4 is medium and G5 is small) and whether the racket is sold strung. For occasional play a sturdy, affordable racket is enough, and you can move up as you play more often.",
  },
  {
    id: "guide-shuttlecocks",
    kind: "guide",
    title: "Feather or plastic shuttlecocks?",
    topic: "badminton",
    categories: ["Shuttlecocks"],
    text:
      "Feather shuttlecocks have a duck-feather skirt. They fly truer and feel like the shuttles used in competition, but they break quickly and cost more. Plastic (nylon) shuttlecocks are far more durable and cheaper per game, so they suit practice, beginners, school play and outdoor use.\n\n" +
      "Packs come in 3, 6 or 12. Speed ratings such as 76, 77 or 78, or labels such as slow, describe how fast the shuttle flies. Slower shuttles are generally chosen for warm weather. Outdoor shuttlecocks use a skirt designed for stable flight in mild wind.",
  },
  {
    id: "guide-badminton-shoes",
    kind: "guide",
    title: "Why badminton shoes and not running shoes?",
    topic: "badminton",
    categories: ["Badminton Shoes"],
    text:
      "Badminton is played with quick stops, lunges and side-to-side steps on indoor courts. Badminton shoes have a non-marking sole with grip for wooden or synthetic floors, cushioning for jumps, and lateral support to protect your ankles.\n\n" +
      "Running shoes are built for straight forward motion and can slip or roll on court. Look for a non-marking outsole and a snug fit with room for your toes, and choose the level that matches how often you play.",
  },
  {
    id: "guide-running-shoes",
    suggest: ["Help me choose running shoes for a marathon", "Help me build a marathon kit"],
    kind: "guide",
    title: "Choosing running shoes for a marathon or long runs",
    topic: "running",
    categories: ["Running Shoes"],
    text:
      "For long distances prioritise cushioning and comfort. High or maximum cushioning absorbs impact over many kilometres. Drop is the height difference between heel and toe, usually 6 to 10 mm. A higher drop is gentler on the calves and Achilles tendon, and a lower drop feels closer to the ground.\n\n" +
      "Stride type matters. Neutral runners suit most shoes, while pronators, whose feet roll inward, may prefer a stability shoe such as one made to support the arch.\n\n" +
      "For fit, leave about a thumb's width in front of your longest toe, and try shoes later in the day when your feet are slightly larger. Break shoes in over a few runs before a race and never debut new shoes on race day. Many runners replace road shoes after roughly 500 to 800 km.",
  },
  {
    id: "guide-marathon-kit",
    suggest: ["Help me build a marathon kit"],
    kind: "guide",
    title: "What you need for a marathon",
    topic: "running",
    categories: ["Running Shoes", "Running Socks", "Running Shorts", "Running Tops", "Hydration & Nutrition", "Running Caps", "Running Watches"],
    text:
      "The essentials are well-fitted running shoes, running socks that do not hold sweat (cotton socks cause blisters over long distances) and shorts that avoid chafing.\n\n" +
      "Useful extras are a breathable top, a cap or visor for the sun, a hydration belt or flask for runs over about an hour, and a GPS watch to pace yourself.\n\n" +
      "Test every item on long training runs and use nothing new on race day. Build your weekly distance gradually, and ease off in the last two weeks before the race.",
  },
  {
    id: "guide-yoga-mat",
    suggest: ["Help me choose a yoga mat"],
    kind: "guide",
    title: "Choosing a yoga mat thickness",
    topic: "yoga",
    categories: ["Yoga Mats"],
    text:
      "A 4 mm mat is thin and firm, which helps with balance and suits beginners who want to feel the floor. A 6 mm mat is a popular all-rounder with some cushioning. An 8 mm mat gives extra cushioning for knees and joints and suits gentle or restorative practice.\n\n" +
      "A 1.3 mm travel mat folds very small but offers little cushioning. Check that the surface grips well so the mat stays put on the floor.",
  },
  {
    id: "guide-backpack-litres",
    suggest: ["Help me choose a trekking backpack"],
    kind: "guide",
    title: "How many litres for a trek?",
    topic: "hiking",
    categories: ["Backpacks"],
    text:
      "As a rule of thumb, a day hike needs about 10 to 30 litres, a 2 to 3 day trip around 40 to 50 litres, and a trip of 4 days or more, or one with camping gear, 60 litres or more.\n\n" +
      "Also check the hip belt and back ventilation, whether a rain cover is included, and the weight: lighter bags are easier to carry but usually cost more. Pack heavy items close to your back.",
  },
  {
    id: "guide-shoe-size",
    kind: "guide",
    title: "Measuring your foot and reading shoe sizes",
    topic: "sizing",
    categories: ["Running Shoes", "Badminton Shoes"],
    text:
      "Stand on a sheet of paper, mark your longest toe and your heel, and measure the distance in centimetres. Sports shoes usually need about 1 to 1.5 cm of room in front of the toes.\n\n" +
      "Product pages list UK and EU sizes together, for example UK 8 - EU 42. If your foot is between sizes, take the larger one, and try shoes late in the day.",
  },
  {
    id: "guide-cycle-size",
    kind: "guide",
    title: "Choosing a cycle frame size",
    topic: "cycling",
    categories: ["Cycles"],
    text:
      "Frame size depends mainly on your height. Roughly, S suits riders under 165 cm, M suits 165 to 175 cm, L suits 175 to 185 cm and XL suits taller riders. This is an approximation, so check the size chart and try to sit on the bike if you can.",
  },
  {
    id: "guide-football-size",
    kind: "guide",
    title: "Which football size?",
    topic: "football",
    categories: ["Footballs"],
    text:
      "A size 5 ball is the standard adult ball, used from about age 12. Younger children usually play with a size 4 ball, and the smallest players with size 3. Our footballs are size 5.",
  },
];
