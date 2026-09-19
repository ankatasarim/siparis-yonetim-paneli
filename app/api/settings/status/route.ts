import { api } from '@/lib/api';
import { cfg } from '@/lib/config';
import { instagram, dhl, backup, db } from '@/lib/services';

export const GET = api(async () => ({
  instagram: await instagram.status(),
  dhl: dhl.status(),
  automation: cfg.automation,
  base_url: cfg.baseUrl,
  simulation: cfg.allowSimulation,
  panel_password_set: Boolean(cfg.panelPassword),
  node_version: process.version,
  db_kind: db.kind(),
  key_kind: cfg.supabase.keyKind,
  is_vercel: cfg.isVercel,
  backup: await backup.status(),
  cron: { configured: Boolean(cfg.cronSecret), url: `${cfg.baseUrl}/api/cron`, secret: cfg.cronSecret, last_at: await db.getSetting('cron_last_at') },
}));
