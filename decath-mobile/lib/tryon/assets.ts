/** Curated front views only. Do not silently substitute another product's garment. */
export const FITTING_ASSETS: Record<string, { image: number; flat?: boolean }> = {
  "8644134": { image: 2, flat: true },
  "8842237": { image: 0 },
  "8660163": { image: 5 },
  "8667940": { image: 0 },
  "8488034": { image: 0 },
  "8978072": { image: 2 },
};
export const DEFAULT_FITTING_PRODUCT = "8644134";
export const supportsFitting = (id: string) => !!FITTING_ASSETS[id];
