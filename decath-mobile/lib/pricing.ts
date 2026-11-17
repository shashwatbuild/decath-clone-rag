/**
 * Cart and checkout totals, shared so the cart and the payment page always agree.
 */
import type { Product } from "./types";

export const COUPONS: Record<string, { off: number; above: number }> = {
  NC100: { off: 100, above: 1499 },
  NC200: { off: 200, above: 2499 },
  NC300: { off: 300, above: 3499 },
};

export type PriceLine = { p: Product; qty: number };

export function cartTotals(lines: PriceLine[], couponCode: string | null) {
  const mrp = lines.reduce((s, l) => s + l.p.mrp * l.qty, 0);
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const coupon = couponCode && COUPONS[couponCode] && total >= COUPONS[couponCode].above ? COUPONS[couponCode].off : 0;
  const shipping = total === 0 || total >= 999 ? 0 : 99;
  const pay = total - coupon + shipping;
  return { mrp, total, coupon, shipping, pay, saved: mrp - total + coupon };
}
