/** DHL'ye giden metin ve telefon biçimleme yardımcıları; Excel aktarımı (excel.ts) ile API adaptörü (api.ts) ortak kullanır. */

export const up = (s: string | null | undefined) => String(s || '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr');

/** Telefonu DHL'nin beklediği 10 haneli biçime çevirir: 0532 123 45 67 → 5321234567 */
export function phoneDigits(p: string | null | undefined): string {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('90')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

/**
 * Kısa içerik metni: "×" yerine "x" (DHL tarafında karakter sorunu çıkmasın), tek boşluk,
 * en çok `max` karakter (kelime sınırında kesilir). Şablon örneği "Kitap" kadar kısa tutulur.
 */
export function contentSummary(items: string | null | undefined, max = 50): string {
  const full = String(items || '').replace(/×/g, 'x').replace(/\s+/g, ' ').trim() || 'Ürün';
  if (full.length <= max) return full;
  return (full.slice(0, max).replace(/\s+\S*$/, '') || full.slice(0, max)).trim();
}
