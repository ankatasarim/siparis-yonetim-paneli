import * as XLSX from 'xlsx';
import { round2 } from '@/lib/utils';
import type { Customer, Order } from '@/lib/types';

export const POREGO_HEADERS = [
  'Müşteri Adı', 'Müşteri Soyadı', 'Müşteri Telefonu', 'Müşteri E-posta', 'Ürün Adı', 'Adet',
  'Birim Fiyat', 'Toplam Tutar', 'Para Birimi', 'Ödeme Tipi', 'Kapıda Ödeme Tutarı', 'Ağırlık (kg)',
  'Desi', 'Adres', 'Şehir', 'İlçe', 'Mahalle', 'Posta Kodu', 'Sipariş Notu',
] as const;

const SHEET_NAME = 'Sipariş İçe Aktarma';

const HEPSIJET_DESI_RATES = [
  { maxDesi: 4, fee: 119.79 },
  { maxDesi: 10, fee: 171.38 },
  { maxDesi: 20, fee: 238.92 },
  { maxDesi: 30, fee: 349.47 },
] as const;

const COD_COMMISSIONS = [
  { maxAmount: 500, fee: 20.76 },
  { maxAmount: 1000, fee: 34.39 },
  { maxAmount: 2000, fee: 51.58 },
  { maxAmount: 3000, fee: 97.03 },
  { maxAmount: 4000, fee: 116.68 },
  { maxAmount: 5000, fee: 147.38 },
  { maxAmount: 7000, fee: 245.64 },
] as const;

export function getHepsijetDesiFee(desi: number | null): number {
  const validDesi = typeof desi === 'number' && Number.isFinite(desi) ? Math.max(0, desi) : 0;
  return HEPSIJET_DESI_RATES.find(({ maxDesi }) => validDesi <= maxDesi)?.fee ?? 405;
}

export function calculateHepsijetCodCommission(amount: number): number {
  const validAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const bracket = COD_COMMISSIONS.find(({ maxAmount }) => validAmount <= maxAmount);
  return bracket ? bracket.fee : round2(343.90 + (validAmount - 7000) * 0.04);
}

type ExportItem = { order: Order; customer: Customer };

function splitName(name: string): [string, string] {
  const parts = name.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (parts.length < 2) return [parts[0] || '', ''];
  return [parts.slice(0, -1).join(' '), parts.at(-1) || ''];
}

function getNeighborhood(address: string): string {
  const segment = address.split(/[\n,;]/).map((part) => part.trim()).find((part) => /\bmah(?:allesi)?\.?\b/i.test(part));
  return segment || '';
}

function toRow({ order, customer }: ExportItem): (string | number | null)[] {
  const [firstName, lastName] = splitName(customer.name);
  const note = [order.notes, order.labels].filter((value) => value?.trim()).join(' · ');
  const recipientPays = order.shipping_payer === 'alici';
  const isCashOnDelivery = order.payment_status === 'kapida_odeme';
  const shippingFee = getHepsijetDesiFee(order.desi);
  const codCommission = calculateHepsijetCodCommission(shippingFee);
  const codAmount = recipientPays
    ? round2((isCashOnDelivery ? Number(order.total) || 0 : 0) + shippingFee + codCommission)
    : 0;

  return [
    firstName,
    lastName,
    customer.phone || '',
    customer.email || '',
    'Boş kutu',
    1,
    0,
    1,
    'TRY',
    codAmount > 0 ? 'Kapıda Ödeme' : 'Peşin',
    codAmount,
    order.desi != null && order.desi > 0 ? round2(order.desi) : null, // Ayrı ağırlık alanı bulunmadığı için mevcut DHL aktarımındaki gibi desi kullanılır.
    order.desi != null && order.desi > 0 ? round2(order.desi) : null,
    customer.address || '',
    customer.city || '',
    customer.district || '',
    getNeighborhood(customer.address || ''),
    customer.postal_code || '',
    note,
  ];
}

export function buildPoregoWorkbook(items: ExportItem): Buffer;
export function buildPoregoWorkbook(items: ExportItem[]): Buffer;
export function buildPoregoWorkbook(items: ExportItem | ExportItem[]): Buffer {
  const records = Array.isArray(items) ? items : [items];
  const sheet = XLSX.utils.aoa_to_sheet([[...POREGO_HEADERS], ...records.map(toRow)]);
  sheet['!cols'] = [18, 20, 18, 28, 36, 10, 14, 14, 12, 20, 20, 14, 10, 44, 18, 18, 22, 14, 36].map((wch) => ({ wch }));
  sheet['!autofilter'] = { ref: `A1:S${Math.max(1, records.length + 1)}` };
  sheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  workbook.Props = { Title: 'Porego Sipariş İçe Aktarma', Author: 'Anka Tasarım Sipariş Takip' };
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}