"use client";

import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type Ctor = new () => Recognition;

/** Mic button for the chat. Fills the message box with what was said; the shopper still taps send. */
export default function VoiceButton({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.abort();
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    r.lang = "en-IN";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).map((x) => x[0]?.transcript ?? "").join(" ").trim();
      if (text) onText(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  return (
    <button type="button" onClick={toggle} disabled={disabled} aria-label={listening ? "Stop listening" : "Speak your question"} aria-pressed={listening}
      className={`shrink-0 w-10 h-10 rounded-full grid place-items-center ${listening ? "bg-brand text-white animate-pulse" : "text-[#555]"}`}>
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );
}
