// Tarayıcıdan API'ye istek. Oturum httpOnly çerezle taşınır; anahtar veya şifre tarayıcıya hiç gelmez.
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? "hata", data.message ?? "Bir sorun oluştu, lütfen tekrar deneyin.");
  return data as T;
}

export type User = { id: string; name: string; email: string | null; phone: string | null; role: "user" | "admin"; is_corporate: boolean; credits: number; free_offers_left: number };

export type Category = { id: string; parent_id: string | null; name: string; icon: string; is_visible: boolean; active_count: number };
export type CategoryTop = Category & { subs: Category[] };

export type RequestItem = {
  id: number; title: string; description: string; category_id: string; category_name: string; top_id: string; top_name: string;
  budget_min: number; budget_max: number; city: string; district: string; condition: string; attrs: Record<string, string | number>;
  is_urgent: boolean; is_corporate: boolean; status: string; created_at: string; expires_at: string; buyer_name: string; offer_count: number;
  cover_url: string | null; media_count: number;
};

export type Media = { id: string; kind: "image" | "video"; content_type: string; url: string };

export type Offer = {
  id: number; price: number; condition: string; delivery: string; warranty: boolean; note: string; status: string; created_at: string;
  seller_name: string; seller_is_corporate: boolean; seller_sales: number; mine: boolean; media: Media[];
};

export type RequestDetail = RequestItem & { media: Media[]; is_owner: boolean; is_favorite: boolean; moderation_note?: string | null; accepted_offer_id: number | null };

export type Draft = {
  category_id: string | null; title: string; budget_min: number | null; budget_max: number | null; city: string | null;
  condition: string; is_urgent: boolean; attrs: Record<string, string | number>; description: string;
};

// Dosya yükleme: sunucudan tek kullanımlık imzalı adres alınır, dosya doğrudan depoya (R2) gönderilir,
// sonra sunucuya "bitti" denir. İlerleme yüzdesi için XMLHttpRequest kullanılır.
export async function uploadFile(file: File, onProgress: (pct: number) => void): Promise<Media> {
  const t = await api<{ id: string; upload: { url: string; method: string; headers: Record<string, string> } }>("/media/uploads", { body: { content_type: file.type, size: file.size } });
  await new Promise<void>((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open(t.upload.method, t.upload.url);
    for (const [k, v] of Object.entries(t.upload.headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new ApiError(x.status, "yukleme", "Dosya yüklenemedi, lütfen tekrar deneyin.")));
    x.onerror = () => reject(new ApiError(0, "yukleme", "Bağlantı koptu, dosya yüklenemedi."));
    x.send(file);
  });
  return api<Media>(`/media/${t.id}/complete`, { body: {} });
}
