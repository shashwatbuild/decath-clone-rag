/**
 * Delivery estimate by pincode. A simple demo rule, not real courier data:
 * big-city pincodes are quickest, remote regions slowest.
 */
const METRO = ["11", "38", "40", "41", "50", "56", "60", "70"];
const REMOTE = ["18", "19", "74", "78", "79", "68"];

export function deliveryDays(pincode: string): { min: number; max: number } {
  const p = pincode.slice(0, 2);
  if (METRO.includes(p)) return { min: 2, max: 3 };
  if (REMOTE.includes(p)) return { min: 6, max: 8 };
  return { min: 4, max: 6 };
}
