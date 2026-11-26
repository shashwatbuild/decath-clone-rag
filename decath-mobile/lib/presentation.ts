/** Display formatting only; catalogue identifiers, sizes and input values stay intact. */
export function sentenceCase(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : text;
}
