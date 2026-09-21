import { cfg } from '../../config';
import { httpError, round2 } from '../../utils';
import { isConfigured, request } from './client';
import { resolveCodes } from './cbs';
import { contentSummary, phoneDigits, up } from './format';
import type { Customer, Order } from '../../types';

/**
 * DHL eCommerce Türkiye "Standard Command API" adaptörü (dhl/standard-command-api-10_1.0.json).
 * Kimlik doğrulama client.ts (dhl/identity-api-10_1.0.json), il/ilçe kodları cbs.ts.
 *
 * createOrder yanıtı kargo takip numarası içermez (orderInvoiceId = DHL sipariş kaydı). Sipariş referansı
 * (= barkod) DHL tarafında siparişi tanımlayan anahtardır; updateorder/cancelorder de bununla çalışır.
 * Bu yüzden panelde takip numarası olarak referans saklanır; gerçek takip numarası Standard Query API ile alınabilir (doküman bekleniyor).
 */

export { isConfigured };

export const SERVICE_TYPE = { STANDART: 1, GUN_ICI: 7, AKSAM: 8 } as const;
export const PACKAGING_TYPE = { DOSYA: 1, MI: 2, PAKET: 3, KOLI: 4 } as const;
export const PAYMENT_TYPE = { GONDERICI_ODER: 1, ALICI_ODER: 2, PLATFORM_ODER: 3 } as const;
export const DELIVERY_TYPE = { ADRESE_TESLIM: 1, ALICISI_HABERLI: 2 } as const;

/** DHL sipariş referansı: benzersiz ve büyük harf olmalı (doküman). Önek + sipariş no, yalnızca A-Z 0-9 _ - */
export function referenceId(order: Pick<Order, 'order_no'>): string {
  return `${cfg.dhl.api.referencePrefix}${order.order_no}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export interface RecipientCodes { cityCode: number; districtCode: number; cityName: string; districtName: string }

export function buildPayload(order: Order, customer: Customer, codes: RecipientCodes) {
  const ref = referenceId(order);
  const n = Math.max(1, Number(order.package_count) || 1);
  const desiTotal = order.desi && order.desi > 0 ? order.desi : 1;
  const perPiece = Math.max(1, Math.ceil(desiTotal / n)); // API tam sayı (int32) bekliyor
  const content = contentSummary(order.items);
  const cod = order.payment_status === 'kapida_odeme';
  const description = (order.labels || '').replace(/\s+/g, ' ').trim().slice(0, 200) || content;
  return {
    order: {
      referenceId: ref,
      barcode: ref, // doküman: barkod referans ile aynı olmalı
      billOfLandingId: '',
      isCOD: cod ? 1 : 0,
      codAmount: cod ? round2(Number(order.total) || 0) : 0,
      shipmentServiceType: SERVICE_TYPE.STANDART,
      packagingType: PACKAGING_TYPE.PAKET,
      content,
      smsPreference1: 1, // varış şubesinde alıcıya SMS (Excel: ALICI_SMS=E)
      smsPreference2: 0,
      smsPreference3: 0, // teslimde göndericiye SMS (Excel: GONDERICI_SMS=H)
      paymentType: order.shipping_payer === 'alici' ? PAYMENT_TYPE.ALICI_ODER : PAYMENT_TYPE.GONDERICI_ODER,
      deliveryType: DELIVERY_TYPE.ADRESE_TESLIM,
      description,
      marketPlaceShortCode: '',
      marketPlaceSaleCode: '',
      pudoId: '',
    },
    orderPieceList: Array.from({ length: n }, (_, i) => ({ barcode: `${ref}_PARCA${i + 1}`, desi: perPiece, kg: perPiece, content })),
    recipient: {
      refCustomerId: String(customer.id),
      cityCode: codes.cityCode,
      districtCode: codes.districtCode,
      cityName: codes.cityName,
      districtName: codes.districtName,
      address: up(customer.address),
      fullName: up(customer.name),
      mobilePhoneNumber: phoneDigits(customer.phone),
      homePhoneNumber: '',
      bussinessPhoneNumber: '',
      email: (customer.email || '').trim(),
      taxOffice: '',
      taxNumber: '',
    },
  };
}

export interface CreateResult { trackingNo: string; shipmentRef: string | null; branchCode: string | null; raw: unknown }

/** Yanıt: { orderInvoiceId, orderInvoiceDetailId, shipperBranchCode, referenceId } */
export function parseCreateResponse(data: unknown, expectedRef: string): CreateResult {
  const d = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  const invoiceId = d && d.orderInvoiceId != null && d.orderInvoiceId !== '' ? String(d.orderInvoiceId) : null;
  if (!invoiceId) throw httpError(502, `DHL yanıtında sipariş kaydı (orderInvoiceId) yok: ${JSON.stringify(data).slice(0, 300)}`);
  return {
    trackingNo: d && d.referenceId ? String(d.referenceId) : expectedRef,
    shipmentRef: invoiceId,
    branchCode: d && d.shipperBranchCode != null ? String(d.shipperBranchCode) : null,
    raw: data,
  };
}

export async function createShipment(order: Order, customer: Customer): Promise<CreateResult> {
  if (!isConfigured()) throw httpError(400, 'DHL API modu yapılandırılmadı (DHL_MODE=api ve DHL_API_* değişkenleri gerekli)');
  if (!customer.name?.trim() || !phoneDigits(customer.phone) || !customer.address?.trim()) throw httpError(400, 'DHL gönderisi için alıcı adı, telefonu ve adresi eksiksiz olmalı');
  if (!customer.city?.trim() || !customer.district?.trim()) throw httpError(400, 'DHL gönderisi için alıcının il ve ilçesi girilmeli');
  const codes = await resolveCodes(customer.city, customer.district);
  const payload = buildPayload(order, customer, codes);
  const data = await request('POST', '/standardcmdapi/createOrder', payload);
  return parseCreateResponse(data, payload.order.referenceId);
}

/** PUT /standardcmdapi/cancelorder/{referenceId} — henüz kargoya çıkmamış siparişi DHL'de iptal eder. */
export async function cancelOrder(ref: string): Promise<unknown> {
  if (!ref) throw httpError(400, 'DHL iptali için sipariş referansı gerekli');
  return request('PUT', `/standardcmdapi/cancelorder/${encodeURIComponent(ref)}`);
}
