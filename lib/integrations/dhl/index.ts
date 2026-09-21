import { cfg } from '../../config';
import { ONLINE_SUBE_URL, trackingUrl } from '../../constants';
import * as api from './api';
import * as tracking from './tracking';
import type { Customer, Order, TrackResult } from '../../types';

export { ONLINE_SUBE_URL, trackingUrl };

export const canCreate = () => api.isConfigured();
export const canTrack = () => tracking.isConfigured();

export async function createShipment(order: Order, customer: Customer) {
  return api.createShipment(order, customer);
}

/** DHL'de oluşturulmuş siparişi referansıyla iptal eder (Standard Command API cancelorder). */
export async function cancelShipment(referenceId: string) {
  return api.cancelOrder(referenceId);
}

/** DHL Unified Tracking API yapılandırıldıysa sorgular; yoksa null (manuel takip). Standard Command API takip sunmaz. */
export async function track(trackingNo: string): Promise<TrackResult | null> {
  if (tracking.isConfigured()) return tracking.track(trackingNo);
  return null;
}

export function status() {
  return {
    mode: cfg.dhl.mode,
    api_env: cfg.dhl.api.env,
    can_create: canCreate(),
    can_track: canTrack(),
    tracking_source: tracking.isConfigured() ? 'DHL Unified Tracking API' : 'manuel',
    online_sube_url: ONLINE_SUBE_URL,
    sender: cfg.dhl.sender,
  };
}
