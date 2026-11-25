/**
 * Up to two letters for an avatar: the first letters of the first two words ("Harbor Point Capital, LLC" → "HP"),
 * or the first two letters of a single word. Letters and digits only, so punctuation never shows.
 */
export function initialsOf(name: string) {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const [first = '', second] = words;
  const letters = second ? [[...first][0], [...second][0]] : [...first].slice(0, 2);
  return letters.join('').toUpperCase();
}
