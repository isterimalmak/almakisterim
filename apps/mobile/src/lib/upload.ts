import * as ImagePicker from "expo-image-picker";
import { abs, api } from "./api";

export type Uploaded = { id: string; url: string; uri: string };

/** Fotoğraf seçer ya da çeker ve sitedeki gibi yükler: yükleme bileti al → dosyayı gönder → tamamlandı bildir. */
export async function pickAndUpload(source: "camera" | "library", max: number): Promise<Uploaded[]> {
  const perm = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error(source === "camera" ? "Kamera izni verilmedi. Telefonun ayarlarından izin verebilirsiniz." : "Fotoğraf izni verilmedi. Telefonun ayarlarından izin verebilirsiniz.");
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: source === "library", selectionLimit: max };
  const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return [];
  const out: Uploaded[] = [];
  for (const a of res.assets.slice(0, max)) {
    const blob = await (await fetch(a.uri)).blob();
    const type = a.mimeType ?? blob.type ?? "image/jpeg";
    const t = await api<{ id: string; upload: { url: string; method: "PUT"; headers: Record<string, string> } }>("/media/uploads", { body: { content_type: type, size: blob.size } });
    const put = await fetch(abs(t.upload.url), { method: "PUT", headers: { "Content-Type": type, ...t.upload.headers }, body: blob });
    if (!put.ok) throw new Error("Fotoğraf yüklenemedi, lütfen tekrar deneyin.");
    const m = await api<{ id: string; url: string }>(`/media/${t.id}/complete`, { method: "POST", body: {} });
    out.push({ id: m.id, url: m.url, uri: a.uri });
  }
  return out;
}
