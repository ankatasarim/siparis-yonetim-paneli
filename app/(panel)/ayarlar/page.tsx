import { ready, messaging, instagram, dhl, backup, db } from '@/lib/services';
import { cfg } from '@/lib/config';
import { PageHeader } from '@/components/PageHeader';
import { SettingsClient } from '@/components/settings/SettingsClient';

export default async function SettingsPage() {
  await ready();
  const status = {
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
  };
  const settings = { templates: await messaging.getTemplates(), placeholders: messaging.PLACEHOLDERS, auto: await messaging.getAutoFlags(), auto_labels: messaging.AUTO_LABELS };
  return (
    <>
      <PageHeader title="Ayarlar" />
      <SettingsClient status={status} settings={settings} outbox={await messaging.listPending()} />
    </>
  );
}
