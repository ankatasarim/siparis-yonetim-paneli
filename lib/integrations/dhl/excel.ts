import * as XLSX from 'xlsx';
import { round2 } from '@/lib/utils';
import { contentSummary, phoneDigits, up } from './format';
import type { Customer, Order } from '@/lib/types';

export { phoneDigits };

/**
 * DHL eCommerce Online Şube › "Toplu Gönderi Aktarımı" Excel dosyası.
 * Sütunlar, DHL'nin verdiği "Ornek_Toplu_Gonderi_Aktarim_Sablonu.xls" şablonuyla birebir aynıdır (sayfa adı AKTARIM).
 * Kodlar: ODEME_TIPI A=alıcı öder, G=gönderici öder · TESLIM_SEKLI AT=adrese teslim · E/H=evet/hayır.
 */
export const HEADERS = [
  'REFERANS_ID', 'ALICI_BAYI_NO', 'ALICI_ADI', 'ADRES', 'IL', 'ILCE', 'TELEFON', 'TELEFON_CEP', 'EMAIL', 'KIMLIK_VERGI_NO', 'VERGI_DAIRESI',
  'KARGO_ICERIK', 'ADET', 'KILO', 'DESI', 'ODEME_TIPI_A_G', 'TESLIM_SEKLI_AH_AT_TI', 'ACIKLAMA', 'IRSALIYE_NO', 'KIYMET', 'KAPIDA_TAHSILAT',
  'ALICI_SMS_E_H', 'GONDERICI_SMS_E_H', 'PARCA_DAGILIMI', 'PLATFORM_KISA_KODU', 'PLATFORM_SATIS_KODU', 'SIPARIS_BARKOD',
] as const;
const COL_WIDTHS = [12, 12, 24, 44, 14, 14, 12, 12, 24, 14, 14, 30, 6, 6, 6, 9, 10, 30, 12, 9, 9, 9, 9, 40, 10, 12, 12];

export const SHEET_NAME = 'AKTARIM';
export type FileFormat = 'xls' | 'xlsx';
export const FORMATS: Record<FileFormat, { mime: string; bookType: XLSX.BookType }> = {
  xls: { mime: 'application/vnd.ms-excel', bookType: 'biff8' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bookType: 'xlsx' },
};

export interface ExportItem { order: Order; customer: Customer }
export interface ExportProblem { id: number; order_no: number; name: string; missing: string[]; warnings: string[] }

/** Zorunlu alan eksikleri (DHL bu satırı yok sayar) ve uyarılar. */
export function checkItem({ order, customer }: ExportItem): ExportProblem | null {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!customer.name?.trim()) missing.push('alıcı adı');
  if (!customer.address?.trim()) missing.push('adres');
  if (!customer.city?.trim()) missing.push('il');
  if (!customer.district?.trim()) missing.push('ilçe');
  const phone = phoneDigits(customer.phone);
  if (!phone) missing.push('telefon');
  else if (phone.length !== 10) warnings.push(`telefon 10 haneli değil (${phone})`);
  if (order.desi == null || order.desi <= 0) warnings.push('desi girilmemiş, 1 yazılacak');
  if (!missing.length && !warnings.length) return null;
  return { id: order.id, order_no: order.order_no, name: customer.name || (customer.ig_username ? '@' + customer.ig_username : 'İsimsiz'), missing, warnings };
}

/** Boş değerler hücre olarak yazılmaz (şablondaki gibi), telefon ve tutarlar sayı hücresi olur. */
export function toRow({ order, customer }: ExportItem): (string | number | null)[] {
  const desi = order.desi && order.desi > 0 ? round2(order.desi) : 1;
  const n = Math.max(1, Number(order.package_count) || 1);
  const content = contentSummary(order.items);
  // Parçalı gönderi: "parça kg : parça desi : parça kgdesi : parça içerik : parça no ;;" — DHL örneğindeki biçim.
  // ":" ve ";" parça dağılımında ayraç olduğu için içerikten temizlenir.
  const perPiece = Math.max(0.1, round2(desi / n));
  const pieceContent = content.replace(/[:;]/g, ' ').replace(/\s+/g, ' ').slice(0, 30).trim() || 'Ürün';
  const parca = n > 1 ? Array.from({ length: n }, (_, i) => `${perPiece}:${perPiece}:${perPiece}:${pieceContent}:${i + 1};;`).join('') : '';
  const phone = phoneDigits(customer.phone);
  const text = (s: string) => (s ? s : null);
  return [
    String(order.order_no),                                   // REFERANS_ID
    null,                                                     // ALICI_BAYI_NO
    up(customer.name),                                        // ALICI_ADI
    up(customer.address),                                     // ADRES
    up(customer.city),                                        // IL
    up(customer.district),                                    // ILCE
    null,                                                     // TELEFON (sabit hat)
    /^\d{1,15}$/.test(phone) ? Number(phone) : text(phone),   // TELEFON_CEP (şablonda sayı hücresi)
    text((customer.email || '').trim()),                      // EMAIL
    null, null,                                               // KIMLIK_VERGI_NO, VERGI_DAIRESI
    content,                                                  // KARGO_ICERIK
    n,                                                        // ADET
    desi,                                                     // KILO (ağırlık bilinmiyor; desi ile aynı varsayılır)
    desi,                                                     // DESI
    order.shipping_payer === 'alici' ? 'A' : 'G',             // ODEME_TIPI_A_G
    'AT',                                                     // TESLIM_SEKLI: adrese teslim
    text((order.labels || '').replace(/\s+/g, ' ').slice(0, 200)), // ACIKLAMA
    null,                                                     // IRSALIYE_NO
    round2(Number(order.total) || 0),                         // KIYMET
    order.payment_status === 'kapida_odeme' ? 'E' : 'H',      // KAPIDA_TAHSILAT
    'E',                                                      // ALICI_SMS_E_H
    'H',                                                      // GONDERICI_SMS_E_H
    text(parca),                                              // PARCA_DAGILIMI
    null, null, null,                                         // PLATFORM_KISA_KODU, PLATFORM_SATIS_KODU, SIPARIS_BARKOD
  ];
}

export function buildWorkbook(items: ExportItem[], format: FileFormat = 'xls'): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([[...HEADERS], ...items.map(toRow)]);
  ws['!cols'] = COL_WIDTHS.map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME);
  wb.Props = { Title: 'DHL Toplu Gönderi', Author: 'Anka Tasarım Sipariş Takip' };
  return XLSX.write(wb, { bookType: FORMATS[format].bookType, type: 'buffer' }) as Buffer;
}
