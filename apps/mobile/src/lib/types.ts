// Sunucunun döndürdüğü veriler (apps/api ile aynı alanlar).
export type User = {
  id: string; name: string; email: string | null; phone: string | null; role: "user" | "admin"; is_corporate: boolean; credits: number;
  free_unlocks_left: number; unlock_price: number; unread_notifications: number; unread_messages?: number; marketing?: boolean; terms_ok?: boolean;
  mail_prefs?: { offer: boolean; accepted: boolean; message: boolean };
};
export type Category = { id: string; parent_id: string | null; name: string; icon: string; sort: number; active_count: number; subs?: Category[] };
export type Req = {
  id: number; title: string; description: string; category_id: string; category_name: string; top_id: string; top_name: string;
  budget_min: number | null; budget_max: number; city: string; district: string; neighbourhood: string; condition: string;
  attrs: Record<string, unknown>; is_urgent: boolean; is_corporate: boolean; status: string; created_at: string; expires_at: string;
  is_featured: boolean; offer_count: number; media_count: number; buyer_name: string; cover_url: string | null;
  media?: { id: string; kind: "image" | "video"; url: string; thumb_url?: string | null }[]; is_owner?: boolean; is_favorite?: boolean;
  group?: { id: number; title: string }[];
};
export type Contact = {
  price: number; limit: number; used: number; has_phone: boolean; slots_left: number | null; unlocked: boolean; unlock_id: number | null; phone: string | null; hidden: boolean; blocked: boolean;
  viewers?: { unlock_id: number; seller_name: string; created_at: string; reported: boolean }[];
};
export type Page<T> = { total: number; page: number; per: number; items: T[] };
export type Msg = { id: number; mine: boolean; body: string; created_at: string; read: boolean };
