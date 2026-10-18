/** Lit un nombre saisi par l'utilisateur (virgule ou point décimal). Retourne null si invalide ou incomplet. */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '' || t === '-' || t === '+' || t === '.' || !/^[-+]?\d*\.?\d*$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
