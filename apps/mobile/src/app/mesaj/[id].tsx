import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { Empty, Err, Loading, s } from "@/components/ui";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { C, R } from "@/lib/theme";
import type { Msg } from "@/lib/types";

type Thread = { seller_id: string; seller_name: string; blocked: boolean; messages: Msg[] };
type Data = { can_write?: boolean; messages?: Msg[]; threads?: Thread[] };

/** Bir talep üzerindeki konuşma. Alıcı birden fazla satıcıyla konuşabilir; satıcı yalnızca alıcıyla. */
export default function Mesaj() {
  const { id, satici } = useLocalSearchParams<{ id: string; satici?: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [seller, setSeller] = useState<string | undefined>(satici);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef<FlatList<Msg>>(null);
  const load = useCallback(async () => { try { setD(await api<Data>(`/requests/${id}/messages`)); } catch (e) { setErr((e as Error).message); } }, [id]);
  useEffect(() => { void load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (d?.threads?.length && !seller) setSeller(d.threads[0]!.seller_id); }, [d, seller]);

  if (!d) return err ? <View style={{ padding: 16 }}><Err text={err} /></View> : <Loading />;
  const buyer = !!d.threads;
  const thread = buyer ? d.threads!.find((t) => t.seller_id === seller) : undefined;
  const msgs = buyer ? thread?.messages ?? [] : d.messages ?? [];
  const canWrite = buyer ? !!thread && !thread.blocked : !!d.can_write;
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr("");
    try { await api(`/requests/${id}/messages`, { body: { body: text.trim(), ...(buyer ? { seller_id: seller } : {}) } }); setText(""); await load(); setTimeout(() => list.current?.scrollToEnd(), 100); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: buyer ? "Satıcılarla mesajlar" : "Alıcıyla mesajlar" }} />
      {buyer && d.threads!.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 10, backgroundColor: C.card }}>
          {d.threads!.map((t) => (
            <Pressable key={t.seller_id} accessibilityRole="button" accessibilityState={{ selected: t.seller_id === seller }} onPress={() => setSeller(t.seller_id)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, backgroundColor: t.seller_id === seller ? C.navy : C.bg }}>
              <Text style={{ color: t.seller_id === seller ? "#fff" : C.navy, fontWeight: "700" }}>{t.seller_name}</Text>
            </Pressable>))}
        </View>
      ) : null}
      <FlatList ref={list} data={msgs} keyExtractor={(m) => String(m.id)} contentContainerStyle={{ padding: 12, gap: 8 }} onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Empty text={canWrite ? "Henüz mesaj yok. İlk mesajı siz yazın." : buyer ? "Satıcılar size yazınca konuşmalar burada görünür." : "Mesaj yazmak için önce numarayı görün (talep sayfasında)."} />}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.mine ? "flex-end" : "flex-start", maxWidth: "82%", backgroundColor: item.mine ? C.navy : C.card, borderRadius: R.lg, padding: 10, borderWidth: item.mine ? 0 : 1, borderColor: C.line }}>
            <Text style={{ color: item.mine ? "#fff" : C.text, fontSize: 15 }}>{item.body}</Text>
            <Text style={{ color: item.mine ? "#C9D0E4" : C.muted, fontSize: 11, marginTop: 4, textAlign: "right" }}>{ago(item.created_at)}{item.mine && item.read ? " · okundu" : ""}</Text>
          </View>)} />
      {err ? <View style={{ paddingHorizontal: 12 }}><Err text={err} /></View> : null}
      {canWrite ? (
        <View style={{ flexDirection: "row", gap: 8, padding: 10, paddingBottom: 20, backgroundColor: C.card, borderTopWidth: 1, borderTopColor: C.line }}>
          <TextInput accessibilityLabel="Mesajınız" placeholder="Mesajınızı yazın" value={text} onChangeText={setText} multiline maxLength={2000} style={[s.inp, { flex: 1, maxHeight: 120 }]} />
          <Pressable accessibilityRole="button" accessibilityLabel="Gönder" disabled={busy || !text.trim()} onPress={send}
            style={{ backgroundColor: C.orange, borderRadius: R.md, paddingHorizontal: 16, justifyContent: "center", opacity: busy || !text.trim() ? 0.5 : 1 }}>
            <Text style={{ color: "#fff", fontWeight: "800" }}>Gönder</Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
