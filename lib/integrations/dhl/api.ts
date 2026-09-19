import { cfg } from '../../config';
import { DHL_STATUS_TEXT } from '../../constants';
import { httpError } from '../../utils';
import type { Customer, Order, TrackResult } from '../../types';

/**
 * DHL eCommerce Türkiye "kargo sipariş web servisi" adaptörü.
 *
 * DHL eCommerce Türkiye bu servisin dokümanını herkese açık yayınlamıyor; kullanıcı adı, şifre,
 * müşteri numarası ve uç nokta bilgileri çalıştığınız DHL şubesinden alınır. Bu dosya şubeden gelen
 * dokümana göre uyarlanacak ŞABLON bir REST/JSON adaptörüdür:
 *  - buildPayload(): panelden gelen siparişi DHL'nin beklediği alan adlarına çevirir
 *  - parseCreateResponse(): yanıt içinden takip numarasını bulur
 *  - track(): gönderi durumunu sorgular ve panelin anladığı sade duruma çevirir
 */

const PAYMENT_CODES: Record<string, string> = { gonderici: 'GONDERICI', alici: 'ALICI' };

export function isConfigured(): boolean {
  return cfg.dhl.mode === 'api' && Boolean(cfg.dhl.api.baseUrl);
}

function headers(): Record<string, string> {
  const a = cfg.dhl.api;
  const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (a.username) h.Authorization = 'Basic ' + Buffer.from(`${a.username}:${a.password}`).toString('base64');
  return h;
}

export function buildPayload(order: Order, customer: Customer, sender = cfg.dhl.sender) {
  const a = cfg.dhl.api;
  return {
    musteriNo: a.customerNo,
    kullaniciAdi: a.username,
    sifre: a.password,
    referansNo: String(order.order_no),
    gonderici: { adSoyad: sender.name, telefon: sender.phone, adres: sender.address, il: sender.city, ilce: sender.district, postaKodu: sender.postalCode },
    alici: { adSoyad: customer.name, telefon: customer.phone, adres: customer.address, il: customer.city, ilce: customer.district, postaKodu: customer.postal_code },
    desi: order.desi || 1,
    parcaSayisi: order.package_count || 1,
    odemeTipi: PAYMENT_CODES[order.shipping_payer] || 'GONDERICI',
    tahsilatTutari: order.payment_status === 'kapida_odeme' ? order.total || 0 : 0,
    aciklama: [order.items, order.labels].filter(Boolean).join(' | ').slice(0, 200),
  };
}

const TRACKING_KEYS = ['takipNo', 'TakipNo', 'takipNumarasi', 'trackingNumber', 'trackingNo', 'barkod', 'Barkod', 'barcode', 'gonderiNo', 'GonderiNo', 'shipmentNumber'];
const REF_KEYS = ['gonderiId', 'shipmentId', 'id', 'referans', 'reference'];

function findKey(obj: any, keys: string[], depth = 0): string | null {
  if (!obj || typeof obj !== 'object' || depth > 4) return null;
  for (const k of keys) if (obj[k] != null && obj[k] !== '') return String(obj[k]);
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') {
      const found = findKey(v, keys, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function parseCreateResponse(data: unknown): { trackingNo: string; shipmentRef: string | null; raw: unknown } {
  const trackingNo = findKey(data, TRACKING_KEYS);
  if (!trackingNo) throw httpError(502, `DHL yanıtında takip numarası bulunamadı: ${JSON.stringify(data).slice(0, 300)}`);
  return { trackingNo, shipmentRef: findKey(data, REF_KEYS), raw: data };
}

export async function createShipment(order: Order, customer: Customer) {
  if (!isConfigured()) throw httpError(400, 'DHL API modu yapılandırılmadı (DHL_MODE=api ve DHL_API_BASE_URL gerekli)');
  if (!customer.name || !customer.phone || !customer.address) throw httpError(400, 'DHL gönderisi için müşteri adı, telefonu ve adresi eksiksiz olmalı');
  const res = await fetch(cfg.dhl.api.baseUrl + cfg.dhl.api.createPath, {
    method: 'POST', headers: headers(), body: JSON.stringify(buildPayload(order, customer)), signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw httpError(502, `DHL gönderi oluşturulamadı (${res.status}): ${text.slice(0, 300)}`);
  return parseCreateResponse(data);
}

const STATUS_WORDS: [RegExp, string][] = [
  [/teslim edildi|delivered/i, 'delivered'],
  [/dağıtım|dagitim|out for delivery/i, 'out_for_delivery'],
  [/iade|return/i, 'returned'],
  [/yolda|transfer|transit|çıkış|cikis|varış|varis/i, 'in_transit'],
  [/olusturuldu|oluşturuldu|kabul|created|bekliyor/i, 'created'],
  [/hasar|kayıp|kayip|sorun|hata|exception/i, 'exception'],
];

export async function track(trackingNo: string): Promise<TrackResult | null> {
  if (!isConfigured()) return null;
  const path = cfg.dhl.api.trackPath.replace('{trackingNo}', encodeURIComponent(trackingNo));
  const res = await fetch(cfg.dhl.api.baseUrl + path, { headers: headers(), signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  if (!res.ok) throw httpError(502, `DHL durum sorgusu başarısız (${res.status}): ${text.slice(0, 200)}`);
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  const desc = findKey(data, ['durum', 'Durum', 'durumAciklama', 'status', 'statusText', 'aciklama']) || '';
  let status = 'unknown';
  for (const [re, s] of STATUS_WORDS) if (re.test(desc)) { status = s; break; }
  return { status, text: desc ? `${DHL_STATUS_TEXT[status]} · ${desc}` : DHL_STATUS_TEXT[status], events: [], raw: data };
}
