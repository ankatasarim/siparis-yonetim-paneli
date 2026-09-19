import { cfg } from '../../config';
import { ONLINE_SUBE_URL, trackingUrl } from '../../constants';
import * as api from './api';
import * as tracking from './tracking';
import type { Customer, Order, TrackResult } from '../../types';

export { ONLINE_SUBE_URL, trackingUrl };

export const canCreate = () => api.isConfigured();
export const canTrack = () => tracking.isConfigured() || api.isConfigured();

export async function createShipment(order: Order, customer: Customer) {
  return api.createShipment(order, customer);
}

/** Önce Unified Tracking API, yoksa DHL eCommerce API. İkisi de yoksa null (manuel takip). */
export async function track(trackingNo: string): Promise<TrackResult | null> {
  if (tracking.isConfigured()) return tracking.track(trackingNo);
  if (api.isConfigured()) return api.track(trackingNo);
  return null;
}

export function status() {
  return {
    mode: cfg.dhl.mode,
    can_create: canCreate(),
    can_track: canTrack(),
    tracking_source: tracking.isConfigured() ? 'DHL Unified Tracking API' : api.isConfigured() ? 'DHL eCommerce API' : 'manuel',
    online_sube_url: ONLINE_SUBE_URL,
    sender: cfg.dhl.sender,
  };
}
