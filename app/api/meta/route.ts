import { api } from '@/lib/api';
import { cfg } from '@/lib/config';
import { dhl, instagram } from '@/lib/services';
import { STATUSES, ACTIVE_STATUSES, PAYMENT_STATUSES, SHIPPING_PAYERS, SATISFACTION_LABELS, ONLINE_SUBE_URL } from '@/lib/constants';

export const GET = api(async () => ({
  statuses: STATUSES, active_statuses: ACTIVE_STATUSES, payment_statuses: PAYMENT_STATUSES, shipping_payers: SHIPPING_PAYERS, satisfaction: SATISFACTION_LABELS,
  business: cfg.business,
  dhl: { mode: cfg.dhl.mode, can_create: dhl.canCreate(), can_track: dhl.canTrack(), online_sube_url: ONLINE_SUBE_URL },
  instagram: { configured: await instagram.isConfigured() },
  simulation: cfg.allowSimulation,
}));
