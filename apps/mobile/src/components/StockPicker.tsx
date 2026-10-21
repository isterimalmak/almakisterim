import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, SafeAreaView, Text, View } from "react-native";
import { abs, api } from "@/lib/api";
import { C, R } from "@/lib/theme";
import type { Uploaded } from "@/lib/upload";
import { Err, Loading } from "./ui";

type Item = { id: number; title: string; media: { id: string; url: string } };
type Photo = { id: number; thumb: string; alt: string; photographer: string };

/** Sitedeki "Hazır görsellerden seç": önce yönetimin galerisi (talebin marka/modeline uyanlar başta), azsa ücretsiz fotoğraflar. */
export function StockPicker({ visible, category, cars, onClose, onPick }: { visible: boolean; category: string; cars: string; onClose: () => void; onPick: (u: Uploaded) => void }) {
  type Data = { items: Item[]; photos: Photo[]; photo_source: { name: string } | null };
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible || !category) return;
    setD(null); setErr("");
    api<Data>(`/stock-images?category=${encodeURIComponent(category)}${cars ? `&araclar=${encodeURIComponent(cars)}` : ""}`).then(setD).catch((e) => setErr((e as Error).message));
  }, [visible, category, cars]);
  const use = async (path: string, uri: string) => {
    setBusy(true); setErr("");
    try { const m = await api<{ id: string; url: string; kind: "image" | "video" }>(path, { method: "POST", body: {} }); onPick({ id: m.id, url: m.url, uri, kind: m.kind }); onClose(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const tiles = [...(d?.items ?? []).map((i) => ({ key: `g${i.id}`, uri: abs(i.media.url), label: i.title, path: `/stock-images/${i.id}/use` })),
    ...(d?.photos ?? []).map((p) => ({ key: `p${p.id}`, uri: p.thumb, label: p.alt || `Fotoğraf: ${p.photographer}`, path: `/stock-images/photos/${p.id}/use` }))];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 }}>
          <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: C.navy }}>Hazır görseller</Text>
          <Pressable accessibilityRole="button" onPress={onClose}><Text style={{ color: C.navy, fontWeight: "700" }}>Kapat</Text></Pressable>
        </View>
        {err ? <View style={{ paddingHorizontal: 14 }}><Err text={err} /></View> : null}
        {!d ? (err ? null : <Loading />) : !tiles.length ? <Text style={{ padding: 20, color: C.muted, textAlign: "center" }}>Bu kategori için hazır görsel yok. Kendi fotoğrafınızı ekleyebilirsiniz.</Text> : (
          <FlatList data={tiles} numColumns={3} keyExtractor={(t) => t.key} contentContainerStyle={{ padding: 8, gap: 8 }} columnWrapperStyle={{ gap: 8 }}
            ListFooterComponent={d.photo_source ? <Text style={{ color: C.muted, fontSize: 11, textAlign: "center", padding: 10 }}>Ücretsiz fotoğraflar: {d.photo_source.name}</Text> : null}
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" accessibilityLabel={`${item.label} görselini seç`} disabled={busy} onPress={() => void use(item.path, item.uri)} style={{ flex: 1 / 3, aspectRatio: 1, borderRadius: R.sm, overflow: "hidden", backgroundColor: C.card }}>
                <Image source={{ uri: item.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              </Pressable>)} />)}
      </SafeAreaView>
    </Modal>
  );
}
