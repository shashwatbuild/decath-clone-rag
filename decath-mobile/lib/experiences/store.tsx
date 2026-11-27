"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  EMPTY_EXPERIENCES,
  parseExperiences,
  type ExperienceState,
} from "./model";
const KEY = "dc.experiences.v1";
type ExperienceStore = {
  data: ExperienceState;
  ready: boolean;
  error: string | null;
  commit: (
    update: (current: ExperienceState) => ExperienceState,
    undoable?: boolean,
  ) => boolean;
  undo: () => boolean;
  canUndo: boolean;
};
const Context = createContext<ExperienceStore | null>(null);
export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [previous, setPrevious] = useState<ExperienceState | null>(null);
  const [data, setData] = useState<ExperienceState>(EMPTY_EXPERIENCES),
    [ready, setReady] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        if (saved.length > 150000) throw Error();
        setData(parseExperiences(JSON.parse(saved)));
      }
    } catch {
      setError(
        "Your saved experiences could not be loaded. New changes can still be saved.",
      );
    }
    setReady(true);
    const sync = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      setPrevious(null);
      try {
        setData(
          e.newValue
            ? parseExperiences(JSON.parse(e.newValue))
            : EMPTY_EXPERIENCES,
        );
      } catch {
        setError("A saved change could not be loaded.");
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const commit = useCallback(
    (
      update: (current: ExperienceState) => ExperienceState,
      undoable = false,
    ) => {
      if (!ready) return false;
      try {
        const saved = localStorage.getItem(KEY);
        let current = data;
        if (saved) {
          try {
            current = parseExperiences(JSON.parse(saved));
          } catch {
            /* An explicit save can replace a corrupt local snapshot. */
          }
        }
        const next = parseExperiences(update(current));
        localStorage.setItem(KEY, JSON.stringify(next));
        setPrevious(undoable ? current : null);
        setData(next);
        setError(null);
        return true;
      } catch {
        setError(
          "This change could not be saved. Check that browser storage is available.",
        );
        return false;
      }
    },
    [data, ready],
  );
  function undo() {
    if (!previous) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(previous));
      setData(previous);
      setPrevious(null);
      setError(null);
      return true;
    } catch {
      setError("This change could not be restored.");
      return false;
    }
  }
  return (
    <Context.Provider
      value={{ data, ready, error, commit, undo, canUndo: !!previous }}
    >
      {children}
    </Context.Provider>
  );
}
export function useExperiences() {
  const value = useContext(Context);
  if (!value) throw Error("ExperienceProvider is missing");
  return value;
}
