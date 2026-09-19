import { cfg } from '../../config';
import { DHL_STATUS_TEXT } from '../../constants';
import type { TrackResult } from '../../types';

/** DHL Unified Shipment Tracking API (developer.dhl.com – "Shipment Tracking - Unified"). */

const STATUS_MAP: Record<string, string> = { 'pre-transit': 'created', transit: 'in_transit', delivered: 'delivered', failure: 'exception', unknown: 'unknown' };

export function isConfigured(): boolean {
  return Boolean(cfg.dhl.trackingApiKey);
}

export function normalize(shipment: any): TrackResult {
  if (!shipment) return { status: 'unknown', text: 'Takip numarası bulunamadı', events: [] };
  const st = shipment.status || {};
  const code = String(st.statusCode || '').toLowerCase();
  let status = STATUS_MAP[code] || 'unknown';
  const desc = String(st.description || st.status || '');
  if (status === 'in_transit' && /out for delivery|dağıtım|dagitim|delivery vehicle/i.test(desc)) status = 'out_for_delivery';
  if (/return/i.test(desc) && status !== 'delivered') status = 'returned';
  const addr = st.location && st.location.address;
  const location = addr ? [addr.addressLocality, addr.countryCode].filter(Boolean).join(', ') : '';
  return {
    status,
    text: desc ? `${DHL_STATUS_TEXT[status]} · ${desc}${location ? ' (' + location + ')' : ''}` : DHL_STATUS_TEXT[status],
    timestamp: st.timestamp || null,
    events: (shipment.events || []).slice(0, 15).map((e: any) => ({
      timestamp: e.timestamp,
      description: e.description || e.status || '',
      location: e.location && e.location.address ? e.location.address.addressLocality : '',
    })),
  };
}

export async function track(trackingNo: string): Promise<TrackResult | null> {
  if (!isConfigured()) return null;
  const url = `${cfg.dhl.trackingApiBase}?${new URLSearchParams({ trackingNumber: trackingNo })}`;
  const res = await fetch(url, { headers: { 'DHL-API-Key': cfg.dhl.trackingApiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (res.status === 404) return { status: 'unknown', text: 'DHL takip: gönderi henüz sistemde görünmüyor', events: [] };
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    const err = new Error(`DHL takip sorgusu başarısız (${res.status}): ${detail}`) as Error & { status: number };
    err.status = 502;
    throw err;
  }
  const data: any = await res.json();
  return normalize(Array.isArray(data.shipments) ? data.shipments[0] : null);
}
