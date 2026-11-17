/**
 * DEMO WALLET. Simulated money stored in this browser only. No payment gateway, no real money moves.
 * A real wallet needs a payment provider and, in India, RBI authorisation for prepaid instruments.
 */
import type { CartItem } from "./types";

const WALLET_KEY = "dc.wallet";
const ORDERS_KEY = "dc.orders";
export const DEMO_START_BALANCE = 5000;
export const DEMO_TOP_UP = 1000;

export type Order = { id: string; at: number; amount: number; method: "wallet" | "cod"; lines: CartItem[] };

export function getBalance(): number {
  try {
    const v = localStorage.getItem(WALLET_KEY);
    if (v === null) { localStorage.setItem(WALLET_KEY, String(DEMO_START_BALANCE)); return DEMO_START_BALANCE; }
    const n = Number(v);
    return Number.isFinite(n) ? n : DEMO_START_BALANCE;
  } catch {
    return DEMO_START_BALANCE;
  }
}

function setBalance(n: number) {
  try { localStorage.setItem(WALLET_KEY, String(n)); } catch {}
}

export function topUpDemo(): number {
  const next = getBalance() + DEMO_TOP_UP;
  setBalance(next);
  return next;
}

/** Deducts from the demo balance and records the order. Returns null if the balance can't cover it. */
export function payWithWallet(amount: number, lines: CartItem[]): Order | null {
  const balance = getBalance();
  if (amount <= 0 || amount > balance) return null;
  setBalance(balance - amount);
  const order: Order = { id: "DC" + Date.now().toString(36).toUpperCase(), at: Date.now(), amount, method: "wallet", lines };
  try {
    const prev: Order[] = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...prev].slice(0, 20)));
  } catch {}
  return order;
}

export function placeCodOrder(amount: number, lines: CartItem[]): Order {
  const order: Order = { id: "DC" + Date.now().toString(36).toUpperCase(), at: Date.now(), amount, method: "cod", lines };
  try {
    const prev: Order[] = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...prev].slice(0, 20)));
  } catch {}
  return order;
}
