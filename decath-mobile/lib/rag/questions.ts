/** Bounded decomposition of explicit questions; never invents a question or splits a comparison. */
export function splitQuestions(message: string): string[] {
  const parts = message.trim().split(/\?\s+(?:and\s+|also\s+)?|\s+(?:and|also)\s+(?=(?:how|why|what|when|can|does|do|is|are|should)\b)/i)
    .map(s => s.replace(/^[\s?]+|[\s?]+$/g, "")).filter(Boolean);
  return parts.length > 1 && parts.length <= 3 && parts.every(p => p.length >= 10) ? parts : [message];
}
