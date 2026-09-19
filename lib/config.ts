import path from 'path';

const env = process.env;
const bool = (v: string | undefined, d = false) =>
  v == null || v === '' ? d : ['1', 'true', 'yes', 'on', 'evet'].includes(String(v).toLowerCase());
const num = (v: string | undefined, d: number) => {
  if (v == null || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const port = num(env.PORT, 3000);

export const cfg = {
  port,
  env: env.NODE_ENV || 'development',
  isVercel: Boolean(env.VERCEL),
  baseUrl: (env.BASE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : `http://localhost:${port}`)).replace(/\/+$/, ''),
  /**
   * Supabase REST API (supabase-js). Sunucu tarafında kullanılır. Tercihen gizli (secret / service_role) anahtar;
   * yoksa publishable (anon) anahtar — bu durumda supabase/schema.sql içindeki "anon" politikaları erişimi açar.
   */
  supabase: {
    url: (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, ''),
    key: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    keyKind: (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY ? 'secret' : 'publishable') as 'secret' | 'publishable',
  },
  /** Supabase tanımlı değilse yerel JSON deposu (geliştirme) */
  localDataFile: path.resolve(env.LOCAL_DATA_FILE || path.join(process.cwd(), 'data', 'local.json')),
  cronSecret: env.CRON_SECRET || '',
  panelPassword: env.PANEL_PASSWORD || '',
  sessionSecret: env.SESSION_SECRET || 'anka-dev-secret-lutfen-degistirin',
  business: {
    name: env.BUSINESS_NAME || 'Anka Tasarım',
    ownerName: env.OWNER_NAME || '',
    website: env.BUSINESS_WEBSITE || '',
    igHandle: (env.IG_HANDLE || '').replace(/^@/, ''),
    orderStartNo: num(env.ORDER_START_NO, 1001),
  },
  instagram: {
    accessToken: env.IG_ACCESS_TOKEN || '',
    appSecret: env.IG_APP_SECRET || '',
    verifyToken: env.IG_VERIFY_TOKEN || 'anka-webhook-dogrulama',
    apiBase: (env.IG_API_BASE || 'https://graph.instagram.com/v21.0').replace(/\/+$/, ''),
    humanAgentTag: bool(env.IG_USE_HUMAN_AGENT_TAG, true),
  },
  dhl: {
    mode: (env.DHL_MODE || 'manual').toLowerCase() === 'api' ? ('api' as const) : ('manual' as const),
    api: {
      baseUrl: (env.DHL_API_BASE_URL || '').replace(/\/+$/, ''),
      username: env.DHL_API_USERNAME || '',
      password: env.DHL_API_PASSWORD || '',
      customerNo: env.DHL_API_CUSTOMER_NO || '',
      createPath: env.DHL_API_CREATE_PATH || '/shipments',
      trackPath: env.DHL_API_TRACK_PATH || '/shipments/{trackingNo}',
    },
    trackingApiKey: env.DHL_TRACKING_API_KEY || '',
    trackingApiBase: env.DHL_TRACKING_API_BASE || 'https://api-eu.dhl.com/track/shipments',
    sender: {
      name: env.DHL_SENDER_NAME || env.BUSINESS_NAME || 'Anka Tasarım',
      phone: env.DHL_SENDER_PHONE || '',
      address: env.DHL_SENDER_ADDRESS || '',
      city: env.DHL_SENDER_CITY || '',
      district: env.DHL_SENDER_DISTRICT || '',
      postalCode: env.DHL_SENDER_POSTAL_CODE || '',
    },
  },
  automation: {
    enabled: bool(env.AUTOMATION_ENABLED, false),
    trackPollMinutes: Math.max(5, num(env.TRACK_POLL_MINUTES, 30)),
    satisfactionAutoCloseDays: Math.max(1, num(env.SATISFACTION_AUTO_CLOSE_DAYS, 7)),
  },
  allowSimulation: bool(env.ALLOW_SIMULATION, (env.NODE_ENV || 'development') !== 'production'),
};
