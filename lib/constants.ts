import type { OrderSource, OrderStatus, PaymentStatus, Satisfaction, ShippingPayer } from './types';

export const STATUSES: Record<OrderStatus, { label: string; next: OrderStatus[]; pill: string; dot: string }> = {
  yeni:            { label: 'Yeni Sipariş',    next: ['hazirlaniyor', 'iptal'],    pill: 'border-blue-300 text-blue-700 bg-blue-50',        dot: 'bg-blue-500' },
  hazirlaniyor:    { label: 'Hazırlanıyor',    next: ['kargoya_verildi', 'iptal'], pill: 'border-amber-300 text-amber-700 bg-amber-50',     dot: 'bg-amber-500' },
  kargoya_verildi: { label: 'Kargoya Verildi', next: ['teslim_edildi', 'iptal'],   pill: 'border-violet-300 text-violet-700 bg-violet-50',  dot: 'bg-violet-500' },
  teslim_edildi:   { label: 'Teslim Edildi',   next: ['kapandi'],                  pill: 'border-neutral-300 text-neutral-700 bg-white',    dot: 'bg-emerald-500' },
  kapandi:         { label: 'Kapandı',         next: [],                           pill: 'border-neutral-200 text-neutral-500 bg-neutral-50', dot: 'bg-neutral-400' },
  iptal:           { label: 'İptal',           next: [],                           pill: 'border-red-300 text-red-700 bg-red-50',           dot: 'bg-red-500' },
};

export const ACTIVE_STATUSES: OrderStatus[] = ['yeni', 'hazirlaniyor', 'kargoya_verildi', 'teslim_edildi'];
export const ALL_STATUSES = Object.keys(STATUSES) as OrderStatus[];

export const PAYMENT_STATUSES: Record<PaymentStatus, { label: string; pill: string }> = {
  bekleniyor:   { label: 'Ödeme Bekleniyor', pill: 'border-amber-300 text-amber-700 bg-amber-50' },
  alindi:       { label: 'Ödeme Alındı',     pill: 'border-emerald-400 text-emerald-600 bg-emerald-50' },
  kapida_odeme: { label: 'Kapıda Ödeme',     pill: 'border-orange-300 text-orange-700 bg-orange-50' },
};

export const SHIPPING_PAYERS: Record<ShippingPayer, string> = {
  gonderici: 'Gönderici öder (biz)',
  alici: 'Alıcı öder (karşı ödemeli)',
};

export const SATISFACTION_LABELS: Record<Satisfaction, string> = {
  bekleniyor: 'Cevap bekleniyor',
  memnun: 'Memnun',
  memnun_degil: 'Memnun değil',
  cevaplandi: 'Cevapladı · değerlendirilmeli',
  cevapsiz: 'Cevap gelmedi',
};

export const PAYMENT_METHODS = ['Havale / EFT', 'Kapıda ödeme', 'Kredi kartı', 'Diğer'];

/** Sipariş kanalları (sipariş formunda seçilir, listede ve detayda gösterilir). */
export const ORDER_SOURCES: Record<OrderSource, { label: string }> = {
  instagram: { label: 'Instagram' },
  whatsapp: { label: 'WhatsApp' },
  shopier: { label: 'Shopier' },
};
export const DEFAULT_SOURCE: OrderSource = 'instagram';

/** Boya ürünleri için standart 9 renk; ürün formunda tek tıkla seçenek olarak doldurulur. */
export const STANDARD_COLORS = ['Kırmızı', 'Sarı', 'Mavi', 'Yeşil', 'Turuncu', 'Mor', 'Pembe', 'Siyah', 'Beyaz'];

export const DHL_STATUS_TEXT: Record<string, string> = {
  created: 'Gönderi oluşturuldu',
  in_transit: 'Yolda',
  out_for_delivery: 'Dağıtımda',
  delivered: 'Teslim edildi',
  exception: 'Sorun / İstisna',
  returned: 'İade',
  unknown: 'Bilinmiyor',
};

export const MESSAGE_KIND_LABELS: Record<string, string> = {
  kargo_bildirimi: 'Kargo bildirimi',
  memnuniyet: 'Memnuniyet sorusu',
  siparis_alindi: 'Sipariş alındı',
  manual: 'Mesaj',
  instagram: 'Instagram',
};

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  ok: 'Gönderildi',
  pending: 'Elle gönderilmeli',
  failed: 'Gönderilemedi',
  manual_sent: 'Elle gönderildi',
};

export const ONLINE_SUBE_URL = 'https://onlinesube.dhlecommerce.com.tr/';
export const trackingUrl = (no: string) => `https://kargotakip.dhlecommerce.com.tr/?takipNo=${encodeURIComponent(no)}`;
