"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import type { ChatMessage, ProductLite } from "@/lib/types";
import { getProduct, img, inr } from "@/lib/products";
import { useStore } from "@/lib/store";
import RichText from "@/components/RichText";
import { DecathlonMark, IconClose, IconHome, IconSend } from "@/components/Icons";
import AdvisorPanel from "@/components/advisor/AdvisorPanel";
import { RE } from "@/lib/rag/assistant";
import { applyPatch, type BriefPatch } from "@/lib/advisor/engine";
import { PROFILES } from "@/lib/advisor/profiles";
import {
  acknowledge, answer, begin, commit, commitKit, detectStart, finish, helpSummary, openKit, parseKit, parseUpdate, questionMessage, undo,
  type SavedPrefs, type Session, type Start,
} from "@/lib/advisor/session";
import type { KitItem, KitLine } from "@/lib/advisor/kit";
import TypeCards from "@/components/advisor/TypeCards";

const SAVED_KEY = "dc.briefs";
function loadSaved(): SavedPrefs {
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}") as SavedPrefs; } catch { return {}; }
}

const fmtTime = (t: number) =>
  new Date(t).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).replace(",", "");

function ChatInner() {
  const router = useRouter();
  const params = useSearchParams();
  const focusId = params.get("product");
  /** /chat?q=... asks that question straight away (deep links from banners, notifications, the README) */
  const initialQ = params.get("q");
  const askedInitial = useRef(false);
  const focus = focusId ? getProduct(focusId) : undefined;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const pending = useRef<ChatMessage | null>(null);
  const [source, setSource] = useState<"claude" | "gemini" | "offline" | "rag" | null>(null);
  const { addToCart, showToast, cart } = useStore();
  /** The guided shopping session: one source of truth for brief, comparison and Undo */
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const pendingStart = useRef<{ msg: string; options: { id: string; label: string }[] } | null>(null);
  const [saved, setSaved] = useState<SavedPrefs>({});
  useEffect(() => { setSaved(loadSaved()); }, []);

  useEffect(() => {
    setMessages([{
      role: "assistant",
      time: Date.now(),
      text: focus
        ? `Hi! 👋 I see you're looking at the ${focus.shortName}. Ask me anything about it (material, sizes, weight, warranty) or ask me to compare it.`
        : "Hi! 👋 Welcome to Decathlon Sports India 🏃\nHow can I assist you today? 😊",
      suggestions: focus
        ? ["What is it made of?", "What sizes are available?", "Is it good for beginners?", "Compare with a similar product"]
        : ["Help me explore a product 🤔📦", "I'm starting yoga and want pants under ₹1,000", "Running shoes for a marathon", "Lightest trekking backpack", "What's on sale?"],
    }]);
  }, [focusId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  useEffect(() => {
    if (initialQ && !askedInitial.current && messages.length === 1) {
      askedInitial.current = true;
      send(initialQ);
    }
  }, [messages, initialQ]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Guided shopping flow, handled on the device with the shared advisor engine (no network, so rapid
   * changes can't race). Returns true when the message was handled here.
   */
  function advisorTurn(msg: string): boolean {
    const s = sessionRef.current;
    const lower = msg.toLowerCase();
    const idx = messages.length + 1; // index of the reply we're about to add
    const reply = (m: Partial<ChatMessage>) => setMessages((ms) => [...ms, { role: "assistant", time: Date.now(), text: "", ...m }]);
    if (RE.addCart.test(lower) || /^(view|open|go to|show) (my )?cart$/i.test(msg)) return false;

    // switching activity keeps the previous brief one Undo away
    const carryUndo = (next: Session): Session =>
      s?.ready
        ? {
            ...next,
            undo: [...s.undo, { brief: s.brief, selected: s.selected, kit: s.kit }].slice(-20),
            change: next.brief.profile !== s.brief.profile
              ? { lines: [`Activity: ${PROFILES[s.brief.profile].noun} → ${PROFILES[next.brief.profile].noun}`], effect: `Started a new brief for ${PROFILES[next.brief.profile].noun}. Undo returns to your ${PROFILES[s.brief.profile].noun} brief.`, n: (s.change?.n ?? 0) + 1 }
              : null,
          }
        : next;
    const advance = (next: Session, intro?: string) => {
      if (next.queue.length) {
        setSession(next);
        reply(questionMessage(next, intro));
      } else {
        const done = finish(next, idx);
        setSession(done);
        const help = done.helping ? helpSummary(done.brief) + "\n\n" : "";
        reply({ text: `${intro ? intro.replace(/ One quick question:$/, "") + "\n\n" : ""}${help}Here's my pick for you 👇` });
      }
    };
    const startFlow = (st: Extract<Start, { kind: "start" }>) => {
      const s0 = carryUndo(begin(st.brief, st.selected, st.count, idx));
      advance(s0, `${acknowledge(st.brief)}${s0.queue.length ? " One quick question:" : ""}`);
    };

    // "Yoga pants or a mat?" answered
    const ps = pendingStart.current;
    if (ps) {
      pendingStart.current = null;
      const choice = ps.options.find((o) => o.label.toLowerCase() === lower || lower.includes(o.label.toLowerCase().split(" ").pop()!));
      if (choice) {
        const st = detectStart(`${ps.msg} ${choice.label}`, saved);
        if (st?.kind === "start") { startFlow(st); return true; }
      }
    }

    // Answering the question on screen (chips, "Not sure", "Skip", or typed text)
    if (s && !s.ready && s.queue.length) {
      const a = answer(s, msg);
      if (a) { advance(a); return true; }
      const patch = parseUpdate(msg, s.brief);
      if (patch && !patch.profile) {
        const brief = applyPatch(s.brief, patch, "stated");
        advance({ ...s, brief, queue: s.queue.filter((q) => !(q in brief.values)) });
        return true;
      }
    }

    // Activity kit, from chat
    if (s?.ready && /\b(build|start|make|open)\b.*\bkit\b|^my kit$/.test(lower)) {
      setSession({ ...openKit(s), anchor: idx });
      reply({ text: "Let's build your kit 👇 Mark what you already have." });
      return true;
    }
    const kitChange = s?.ready ? parseKit(msg, s) : null;
    if (s && kitChange) {
      const next = commitKit(s, kitChange.items, kitChange.budget);
      setSession({ ...next, anchor: idx });
      reply({ text: next === s ? "Your kit already says that 👇" : "Updated your kit 👇" });
      return true;
    }

    if (s?.ready && /^undo\b/.test(lower)) {
      if (!s.undo.length) { reply({ text: "There's nothing to undo yet." }); return true; }
      setSession({ ...undo(s), anchor: idx });
      reply({ text: "Undone ↩" });
      return true;
    }

    const st = detectStart(msg, saved);
    const sameActivity = st?.kind === "start" && s?.ready && st.brief.profile === s.brief.profile && !st.selected;
    if (st && !sameActivity) {
      if (st.kind === "ask-profile") {
        pendingStart.current = { msg, options: st.options };
        reply({ text: "Happy to help you get started! 🧘 What are you shopping for?", suggestions: st.options.map((o) => o.label) });
        return true;
      }
      startFlow(st);
      return true;
    }

    // A change to the active brief, typed in the chat ("make it under 800", "any length is fine")
    if (s?.ready) {
      const patch = parseUpdate(msg, s.brief);
      if (patch) {
        const next = commit(s, patch, "stated");
        setSession({ ...next, anchor: idx });
        reply({ text: next === s ? "Your brief already says that 👇" : "Updated 👇" });
        return true;
      }
    }
    return false;
  }

  const commitEdit = (patch: BriefPatch, selected?: string[]) => setSession((s) => (s ? commit(s, patch, "edited", selected) : s));
  const kitEdit = (items: Record<string, Partial<KitItem>>, budget?: number | null) => setSession((s) => (s ? commitKit(s, items, budget) : s));
  const addKitToCart = (lines: KitLine[]) => {
    for (const l of lines) addToCart(l.product!.id, l.needsSize ? l.item.size : (l.product!.sizes[0] ?? null));
    const core = lines.find((l) => l.product?.category === "Yoga Pants" && l.item.size);
    if (core) setSession((s) => (s ? { ...s, brief: { ...s.brief, size: core.item.size! } } : s));
    showToast(`Added ${lines.length} item${lines.length > 1 ? "s" : ""} to cart`);
  };
  const undoEdit = () => setSession((s) => (s ? undo(s) : s));
  const savePrefs = (on: boolean) => {
    const s = sessionRef.current;
    if (!s) return;
    const next = { ...saved };
    if (on) next[s.brief.profile] = { values: s.brief.values, must: s.brief.must, priority: s.brief.priority };
    else delete next[s.brief.profile];
    setSaved(next);
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch {}
    showToast(on ? "Saved on this device" : "Saved preferences removed");
  };

  async function send(text: string, opts: { productId?: string } = {}) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput("");
    const assistantMsgs = [...messages].reverse().filter((m) => m.role === "assistant");
    const lastProducts = assistantMsgs.find((m) => m.products?.length)?.products ?? [];
    const lastList = assistantMsgs.find((m) => (m.products?.length ?? 0) > 1)?.products ?? [];
    const lastFocus = assistantMsgs.find((m) => m.products?.length === 1)?.products?.[0];
    setMessages((m) => [...m, { role: "user", text: msg, time: Date.now() }]);

    // keep the brief and kit in step with what the shopper picks in chat
    const sizeTap = msg.match(/^add size (.+) to cart$/i);
    if (sizeTap && sessionRef.current?.ready) setSession((s) => (s ? { ...s, brief: { ...s.brief, size: sizeTap[1] } } : s));
    if (opts.productId && /^add .+ to cart$/i.test(msg)) {
      const pid = opts.productId;
      setSession((s) => (s ? { ...s, chosen: pid } : s));
    }

    if (!opts.productId && advisorTurn(msg)) return;

    if (/^(view|open|go to|show) (my )?cart$/i.test(msg)) {
      router.push("/cart");
      return;
    }

    if (/explore a product/i.test(msg)) {
      setMessages((m) => [...m, { role: "assistant", time: Date.now(), text: "What product would you like to explore? For example, running shoes, a trekking backpack, a football, or a bicycle.", suggestions: ["Running shoes", "Trekking backpack", "Football", "Bicycle"] }]);
      return;
    }

    setBusy(true);
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    // Update the reply being streamed (always the last message once it exists)
    const patch = (f: (m: ChatMessage) => ChatMessage) =>
      setMessages((ms) => [...ms.slice(0, -1), f(ms[ms.length - 1])]);
    let started = false;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history,
          // a button on a specific product (e.g. "Add to cart" in the recommendation) scopes the request to it
          contextIds: opts.productId ? [opts.productId] : lastProducts.map((p) => p.id),
          listIds: opts.productId ? [opts.productId] : lastList.map((p) => p.id),
          lastFocusId: opts.productId ?? lastFocus?.id,
          productId: opts.productId || lastProducts.length ? undefined : focusId ?? undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "meta") {
            setSource(ev.source);
            pending.current = { role: "assistant", time: Date.now(), text: "", products: ev.products, compare: ev.compare, suggestions: ev.suggestions, action: ev.action };
            if (ev.action?.type === "add_to_cart") {
              addToCart(ev.action.productId, ev.action.size);
              showToast("Added to cart");
            }
          } else if (ev.type === "source") {
            setSource(ev.source);
          } else if (ev.type === "text" || ev.type === "replace") {
            if (!started) {
              started = true;
              setBusy(false);
              const first = { ...(pending.current ?? { role: "assistant" as const, time: Date.now(), text: "" }), text: ev.type === "text" ? ev.delta : ev.text };
              setMessages((ms) => [...ms, first]);
            } else {
              patch((m) => ({ ...m, text: ev.type === "text" ? m.text + ev.delta : ev.text }));
            }
          }
        }
      }
    } catch {
      const err = { role: "assistant" as const, time: Date.now(), text: "Sorry, something went wrong. Please try again." };
      setMessages((ms) => (started ? [...ms.slice(0, -1), err] : [...ms, err]));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-col h-[var(--app-h)]">
      <header className="bg-brand text-white flex items-center gap-4 px-5 pt-6 pb-5 shrink-0">
        <span className="relative shrink-0">
          <DecathlonMark className="w-11 h-9 text-white" />
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#4caf50] ring-2 ring-white" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-[19px]">Decathlon Chat Assistant</p>
          <p className="text-[15px] opacity-95">Your teammate for every query!</p>
        </div>
        <button onClick={() => router.back()} className="ml-auto" aria-label="Close chat"><IconClose className="w-7 h-7" /></button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i}>
            <Bubble m={m} onSuggest={(t) => send(t)} isLast={i === messages.length - 1}
              showTime={i === messages.length - 1 || messages[i + 1].role !== m.role} />
            {/* answered type cards collapse: the shopper's reply already shows the choice */}
            {m.cards && session && i === messages.length - 1 && (
              <div className="pl-10">
                <TypeCards brief={session.brief} id={m.cards} active={i === messages.length - 1 && !busy} onAnswer={(t) => send(t)} />
              </div>
            )}
            {session?.ready && session.anchor === i && (
              <AdvisorPanel
                session={session}
                onCommit={commitEdit}
                onUndo={undoEdit}
                onAsk={(t, productId) => send(t, { productId })}
                saved={Boolean(saved[session.brief.profile])}
                onSave={savePrefs}
                cart={cart}
                onOpenKit={() => setSession((s) => (s ? openKit(s) : s))}
                onKit={kitEdit}
                onAddKit={addKitToCart}
                onView={(view) => setSession((s) => (s ? { ...s, view } : s))}
              />
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-end gap-2">
            <Avatar />
            <div className="bg-[#E4E6EA] rounded-3xl px-5 py-4 flex gap-1">
              {[0, 1, 2].map((d) => <span key={d} className="w-2 h-2 rounded-full bg-[#888] animate-bounce" style={{ animationDelay: `${d * 120}ms` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="shrink-0 border-t border-line px-4 pt-4 pb-3 bg-white">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Home" className="text-[#555]"><IconHome className="w-8 h-8" /></Link>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message"
            className="flex-1 min-w-0 border border-[#ccc] rounded-full px-5 py-3.5 text-[16px] outline-none focus:border-brand" />
          <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="text-brand disabled:text-[#aaa]"><IconSend className="w-8 h-8" /></button>
        </div>
        <p className="text-center text-[13px] text-[#888] mt-3">{source === "claude" ? "Powered by Claude + product RAG" : source === "gemini" ? "Powered by Gemini + product RAG" : source === "offline" ? "Catalogue answers · AI is busy right now" : "Powered by product RAG"}</p>
      </form>
    </main>
  );
}

function Avatar() {
  return (
    <span className="w-8 h-8 rounded-full bg-brand grid place-items-center shrink-0 mb-5">
      <DecathlonMark className="w-[20px] h-[16px] text-white" />
    </span>
  );
}

function Bubble({ m, onSuggest, isLast, showTime }: { m: ChatMessage; onSuggest: (s: string) => void; isLast: boolean; showTime: boolean }) {
  if (m.role === "user")
    return (
      <div className="flex flex-col items-end">
        <div className="bg-brand text-white rounded-[20px] rounded-br-md px-4 py-3 max-w-[80%] text-[15px] leading-[1.45] whitespace-pre-wrap break-words">{m.text}</div>
        {showTime && <span className="text-[12px] text-[#8a8a8e] mt-1 mr-1">{fmtTime(m.time)}</span>}
      </div>
    );
  return (
    <div className="flex items-end gap-2">
      {showTime ? <Avatar /> : <span className="w-8 shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="bg-[#F2F3F7] rounded-[20px] rounded-bl-md px-4 py-3 max-w-[94%] w-fit">
          <RichText text={m.text} />
        </div>
        {m.compare && <CompareTable c={m.compare} />}
        {m.products && m.products.length > 0 && !m.compare && <ProductStrip ps={m.products} onAsk={isLast ? onSuggest : undefined} />}
        {isLast && m.suggestions && m.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            {m.suggestions.map((s) => (
              <button key={s} onClick={() => onSuggest(s)} className="bg-white border border-brand/60 text-brand rounded-full px-3.5 min-h-[36px] text-[14px] text-left">{s}</button>
            ))}
          </div>
        )}
        {showTime && <span className="block text-[12px] text-[#8a8a8e] mt-1 ml-1">{fmtTime(m.time)}</span>}
      </div>
    </div>
  );
}

function ProductStrip({ ps, onAsk }: { ps: ProductLite[]; onAsk?: (s: string) => void }) {
  return (
    <div className="flex gap-2.5 overflow-x-auto no-scrollbar mt-2.5 pr-2">
      {ps.map((p, i) => (
        <div key={p.id} className="w-[150px] shrink-0 border border-line rounded-xl overflow-hidden bg-white flex flex-col">
          <Link href={`/p/${p.id}`} className="block relative aspect-square bg-[#F5F4F5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(p.image, 300)} alt="" className="w-full h-full object-cover mix-blend-multiply" />
            {ps.length > 1 && (
              <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-white/95 text-[12px] font-semibold grid place-items-center shadow-sm">{i + 1}</span>
            )}
          </Link>
          <Link href={`/p/${p.id}`} className="px-2.5 pt-2 flex-1">
            <p className="text-[13px] line-clamp-2 leading-snug"><b>{p.brand}</b> {p.shortName}</p>
            <p className="font-bold mt-1">{inr(p.price)} {p.mrp > p.price && <s className="text-[12px] font-normal text-muted">{inr(p.mrp)}</s>}</p>
            {p.reviewCount > 0 && <p className="text-[12px] text-muted">★ {p.rating} · {p.reviewCount.toLocaleString("en-IN")}</p>}
          </Link>
          {onAsk && (
            <button onClick={() => onAsk(`Add ${p.shortName} to cart`)} className="m-2 mt-2 rounded-full bg-brand text-white text-[12px] font-semibold py-1.5">
              Add to cart
            </button>
          )}
          {!onAsk && <span className="pb-2.5" />}
        </div>
      ))}
    </div>
  );
}

function CompareTable({ c }: { c: NonNullable<ChatMessage["compare"]> }) {
  return (
    <div className="mt-2.5 border border-line rounded-xl overflow-hidden bg-white max-w-[100%]">
      <div className="grid" style={{ gridTemplateColumns: `84px repeat(${c.products.length}, minmax(0,1fr))` }}>
        <div />
        {c.products.map((p) => (
          <Link key={p.id} href={`/p/${p.id}`} className="p-2 border-l border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(p.image, 200)} alt="" className="w-full aspect-square object-cover bg-[#F5F4F5] rounded" />
            <p className="text-[12px] line-clamp-2 mt-1 leading-tight font-medium">{p.shortName}</p>
          </Link>
        ))}
        {c.rows.map((r) => (
          <div key={r.label} className="contents">
            <div className="text-[12px] font-semibold p-2 border-t border-line bg-[#FAFAFA]">{r.label}</div>
            {r.values.map((v, i) => <div key={i} className="text-[12px] p-2 border-t border-l border-line break-words hyphens-auto">{v}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return <Suspense><ChatInner /></Suspense>;
}
