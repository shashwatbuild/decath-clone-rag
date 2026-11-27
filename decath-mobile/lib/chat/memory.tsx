"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
  type MutableRefObject,
} from "react";
import type { ChatMessage } from "@/lib/types";
import type { Session } from "@/lib/advisor/session";
import { parseChatSnapshot, type PendingStart } from "./snapshot";
const KEY = "dc.assistant-conversation.v1";
type Memory = {
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  session: Session | null;
  setSession: Dispatch<SetStateAction<Session | null>>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  source: "claude" | "gemini" | "offline" | "rag" | null;
  setSource: Dispatch<SetStateAction<Memory["source"]>>;
  ready: boolean;
  error: string | null;
  handledLinks: MutableRefObject<Set<string>>;
  pendingStart: MutableRefObject<PendingStart>;
  request: MutableRefObject<AbortController | null>;
  clear: () => void;
};
const Context = createContext<Memory | null>(null);
export function ChatMemoryProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]),
    [input, setInput] = useState(""),
    [session, setSession] = useState<Session | null>(null),
    [busy, setBusy] = useState(false),
    [source, setSource] = useState<Memory["source"]>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null);
  const handledLinks = useRef(new Set<string>()),
    pendingStart = useRef<PendingStart>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        if (saved.length > 4000000) throw Error();
        const snapshot = parseChatSnapshot(JSON.parse(saved));
        setMessages(snapshot.messages);
        setInput(snapshot.input);
        setSession(snapshot.session);
        handledLinks.current = new Set(snapshot.handledLinks);
        pendingStart.current = snapshot.pendingStart;
      }
    } catch {
      setError(
        "The saved conversation could not be restored. New messages stay available while you browse.",
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          messages,
          input,
          session,
          handledLinks: [...handledLinks.current],
          pendingStart: pendingStart.current,
        }),
      );
    } catch {
      setError(
        "Browser storage is full or unavailable. This conversation remains available until you close or refresh the app.",
      );
    }
  }, [messages, input, session, ready]);
  function clear() {
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setMessages([]);
    setInput("");
    setSession(null);
    setSource(null);
    pendingStart.current = null;
    handledLinks.current.clear();
    try {
      localStorage.removeItem(KEY);
      setError(null);
    } catch {
      setError(
        "The saved conversation could not be cleared from browser storage.",
      );
    }
  }
  return (
    <Context.Provider
      value={{
        messages,
        setMessages,
        input,
        setInput,
        session,
        setSession,
        busy,
        setBusy,
        source,
        setSource,
        ready,
        error,
        handledLinks,
        pendingStart,
        request,
        clear,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useChatMemory() {
  const value = useContext(Context);
  if (!value) throw Error("ChatMemoryProvider is missing");
  return value;
}
