/** Formats Turkish phone numbers consistently as 05xx xxx xx xx. */
export function formatTurkishPhone(value: string | null | undefined): string {
  let digits = String(value || '').replace(/\D/g, '');

  if (digits.startsWith('0090') && digits.length >= 13) digits = digits.slice(4);
  else if (digits.startsWith('90') && digits.length >= 12) digits = digits.slice(2);

  if (!digits) return '';
  if (!digits.startsWith('0') && digits.length >= 10) digits = `0${digits}`;
  digits = digits.slice(0, 11);

  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)]
    .filter(Boolean)
    .join(' ');
}
