export type OrderStatus = 'yeni' | 'hazirlaniyor' | 'kargoya_verildi' | 'teslim_edildi' | 'kapandi' | 'iptal';
export type PaymentStatus = 'bekleniyor' | 'alindi' | 'kapida_odeme';
export type ShippingPayer = 'gonderici' | 'alici';
export type Satisfaction = 'bekleniyor' | 'memnun' | 'memnun_degil' | 'cevaplandi' | 'cevapsiz';
export type MessageStatus = 'ok' | 'pending' | 'failed' | 'manual_sent';

export interface OrderLine {
  name: string;
  qty: number;
  price: number | null;
  /** Katalogdan seçildiyse ürün kimliği (bilgi amaçlı; ad ve fiyat satıra kopyalanır). */
  product_id?: number | null;
}

export interface Product {
  id: number;
  name: string;
  price: number | null;
  description: string;
  /** Görsel adresi (URL); şimdilik boş olabilir */
  image: string;
  /** Ürün desisi (kargo hesabı için); şimdilik 0 */
  desi: number;
  /** 1 = aktif (sipariş formunda önerilir), 0 = pasif */
  active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  ig_user_id: string | null;
  ig_username: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  district: string;
  postal_code: string;
  notes: string;
  profile_pic: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerRow extends Customer {
  order_count: number;
  last_order_at: string | null;
  unread: number;
  total_spent: number;
}

export interface Order {
  id: number;
  order_no: number;
  customer_id: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  shipping_payer: ShippingPayer;
  lines: OrderLine[];
  items: string;
  notes: string;
  labels: string;
  desi: number | null;
  package_count: number;
  shipping_fee: number;
  subtotal: number;
  total: number;
  source: string;
  dhl_tracking_no: string | null;
  dhl_shipment_ref: string | null;
  dhl_status: string | null;
  dhl_status_text: string | null;
  dhl_last_check: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  closed_at: string | null;
  satisfaction: Satisfaction | null;
  satisfaction_note: string | null;
  satisfaction_asked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderRow extends Order {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_ig: string | null;
  customer_ig_id: string | null;
  customer_city: string;
  customer_district: string;
}

export interface OrderEvent {
  id: number;
  order_id: number;
  type: string;
  description: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface Message {
  id: number;
  customer_id: number;
  order_id: number | null;
  direction: 'in' | 'out';
  channel: string;
  ig_mid: string | null;
  text: string;
  attachments: { type: string; url: string | null }[];
  status: MessageStatus;
  error: string | null;
  kind: string | null;
  is_read: number;
  created_at: string;
  order_no?: number | null;
}

export interface OrderFull extends Order {
  customer: Customer;
  events: OrderEvent[];
  messages: Message[];
  next_statuses: OrderStatus[];
  tracking_url: string | null;
  templates_preview?: Record<string, string>;
}

export interface Conversation {
  id: number;
  name: string;
  ig_username: string | null;
  ig_user_id: string | null;
  profile_pic: string | null;
  phone: string;
  last_text: string;
  last_at: string;
  last_direction: 'in' | 'out';
  last_status: string;
  unread: number;
  active_orders: number;
}

export interface Thread {
  customer: Customer;
  messages: Message[];
  window_open: boolean;
  last_incoming_at: string | null;
  active_orders: OrderRow[];
}

export interface TrackResult {
  status: string;
  text: string;
  timestamp?: string | null;
  events: { timestamp?: string; description: string; location?: string }[];
  raw?: unknown;
}

export interface Dashboard {
  counts: Record<OrderStatus, number>;
  attention: { pending_messages: number; unhappy: number; unread: number; no_tracking: number; unpaid: number };
  recent_events: (OrderEvent & { order_no: number })[];
  today_count: number;
  month_count: number;
  month_revenue: number;
  new_orders: OrderRow[];
  awaiting_shipment: OrderRow[];
  in_transit: OrderRow[];
}
