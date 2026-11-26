"use client";
import { createContext, useContext, useEffect, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { DEFAULT_LAB, type LabInput } from "./types";
import { parseLabInput } from "./input";
const KEY = "dc.gear-lab.v1";
type LabStore = { state: LabInput; setState: Dispatch<SetStateAction<LabInput>>; ready: boolean; storageError: string | null; reset: () => void };
const Context = createContext<LabStore | null>(null);
export function LabProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LabInput>(DEFAULT_LAB);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  useEffect(() => {
    try { const saved = localStorage.getItem(KEY); if (saved) setState(parseLabInput(JSON.parse(saved))); }
    catch { setStorageError("Saved Lab data could not be loaded. The default brief is available."); }
    setReady(true);
    const receive = (event: StorageEvent) => {
      if (event.key !== KEY || !event.newValue) return;
      try { setState(parseLabInput(JSON.parse(event.newValue))); } catch { /* Ignore invalid cross-tab state. */ }
    };
    window.addEventListener("storage", receive);
    return () => window.removeEventListener("storage", receive);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { setStorageError("Device storage is unavailable or full. Export your Lab to keep a copy."); }
  }, [state, ready]);
  return <Context.Provider value={{ state, setState, ready, storageError, reset: () => setState(structuredClone(DEFAULT_LAB)) }}>{children}</Context.Provider>;
}
export function useLab() { const value = useContext(Context); if (!value) throw new Error("LabProvider is missing"); return value; }
