// Para buscar sin distinguir mayúsculas ni acentos: «Decoración» = «decoracion»
export const plain = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// ¿Están todas las palabras de `query` en `text`?
export const matchesWords = (text, query) => {
  const haystack = plain(text);
  return plain(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
};
