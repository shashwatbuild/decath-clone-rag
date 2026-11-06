"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "./types";

type Store = {
  cart: CartItem[];
  wishlist: string[];
  recent: string[];
  pincode: string;
  toast: string | null;
  addToCart: (id: string, size: string | null) => void;
  setQty: (id: string, size: string | null, qty: number) => void;
  removeFromCart: (id: string, size: string | null) => void;
  toggleWish: (id: string) => void;
  markViewed: (id: string) => void;
  setPincode: (p: string) => void;
  showToast: (msg: string) => void;
  cartCount: number;
};

const Ctx = createContext<Store | null>(null);

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [pincode, setPin] = useState("411001");
  const [toast, setToast] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCart(load("dc.cart", []));
    setWishlist(load("dc.wish", []));
    setRecent(load("dc.recent", []));
    setPin(load("dc.pin", "411001"));
    setReady(true);
  }, []);
  useEffect(() => { if (ready) save("dc.cart", cart); }, [cart, ready]);
  useEffect(() => { if (ready) save("dc.wish", wishlist); }, [wishlist, ready]);
  useEffect(() => { if (ready) save("dc.recent", recent); }, [recent, ready]);
  useEffect(() => { if (ready) save("dc.pin", pincode); }, [pincode, ready]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  }, []);

  const value = useMemo<Store>(
    () => ({
      cart,
      wishlist,
      recent,
      pincode,
      toast,
      cartCount: cart.reduce((n, i) => n + i.qty, 0),
      showToast,
      addToCart: (id, size) =>
        setCart((c) => {
          const hit = c.find((i) => i.id === id && i.size === size);
          return hit
            ? c.map((i) => (i === hit ? { ...i, qty: Math.min(10, i.qty + 1) } : i))
            : [...c, { id, size, qty: 1 }];
        }),
      setQty: (id, size, qty) =>
        setCart((c) => c.map((i) => (i.id === id && i.size === size ? { ...i, qty } : i))),
      removeFromCart: (id, size) => setCart((c) => c.filter((i) => !(i.id === id && i.size === size))),
      toggleWish: (id) => setWishlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [id, ...w])),
      markViewed: (id) => setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 10)),
      setPincode: setPin,
    }),
    [cart, wishlist, recent, pincode, toast, showToast],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}
