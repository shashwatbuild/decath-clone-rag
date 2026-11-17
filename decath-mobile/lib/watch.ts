/**
 * Price watch: follow a product and get an alert price. Stored in this browser only.
 * In this demo the catalogue prices are fixed, so an alert appears when the catalogue price
 * is at or below the alert price (for example after the data is refreshed).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product } from "./types";

const KEY = "dc.watch";
export type Watch = { id: string; priceThen: number; target: number; at: number };

function read(): Watch[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Watch[]; } catch { return []; }
}
function write(list: Watch[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

/** Default alert: 10% below today's price, rounded to the nearest rupee. */
export const defaultTarget = (price: number) => Math.round(price * 0.9);

export function useWatches() {
  const [list, setList] = useState<Watch[]>([]);
  useEffect(() => setList(read()), []);

  const watch = useCallback((p: Product) => {
    setList((l) => {
      const next = [{ id: p.id, priceThen: p.price, target: defaultTarget(p.price), at: Date.now() }, ...l.filter((w) => w.id !== p.id)];
      write(next);
      return next;
    });
  }, []);
  const unwatch = useCallback((id: string) => {
    setList((l) => {
      const next = l.filter((w) => w.id !== id);
      write(next);
      return next;
    });
  }, []);
  const find = (id: string) => list.find((w) => w.id === id);
  return { list, watch, unwatch, find };
}
