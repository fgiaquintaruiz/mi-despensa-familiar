const STOP_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los',
  'y', 'e', 'o', 'u', 'a', 'en', 'con',
  'por', 'para', 'sin', 'sobre', 'al',
  'un', 'una', 'unos', 'unas',
]);

export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (index > 0 && STOP_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
