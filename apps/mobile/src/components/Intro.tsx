import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, Text, View } from "react-native";
import { getItem, setItem } from "@/lib/store";
import { C, R } from "@/lib/theme";
import { Icon } from "./Icon";
import { Btn } from "./ui";

const W = Dimensions.get("window").width;
const SLIDES = [
  { icon: "chat", title: "Almak istediğini yaz", text: "Araç, ev, telefon, eşya… Ne arıyorsan tek cümleyle yaz; yapay zekâ talebini saniyeler içinde hazırlasın. Talep vermek ücretsiz." },
  { icon: "bell", title: "Satıcılar sana ulaşsın", text: "Elinde o ürün olan satıcılar seni arar ya da mesaj atar. Satıcıysan alarm kur, sana uygun talep gelince ilk sen haberdar ol." },
  { icon: "shield", title: "Numaran güvende", text: "Numaran yalnızca talebinle ilgilenen sınırlı sayıda satıcıya açılır; kimin gördüğünü sen görürsün, istediğin an gizlersin." },
];
const KEY = "ak_tanitim_goruldu";

/** İlk açılışta bir kez gösterilen kısa tanıtım. */
export function Intro() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const list = useRef<FlatList>(null);
  useEffect(() => { void getItem(KEY).then((v) => { if (!v) setOpen(true); }); }, []);
  const done = () => { setOpen(false); void setItem(KEY, "1"); };
  const next = () => { if (i >= SLIDES.length - 1) return done(); list.current?.scrollToIndex({ index: i + 1 }); setI(i + 1); };
  return (
    <Modal visible={open} animationType="fade" onRequestClose={done}>
      <LinearGradient colors={["#1E3A8A", "#13235B", "#0B1638"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, paddingTop: 50, paddingBottom: 30 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tanıtımı geç" onPress={done} style={{ alignSelf: "flex-end", padding: 16 }}>
          <Text style={{ color: "#C9D0E4", fontWeight: "700" }}>Geç</Text>
        </Pressable>
        <FlatList ref={list} horizontal pagingEnabled data={SLIDES} keyExtractor={(s) => s.title} showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / W))}
          renderItem={({ item }) => (
            <View style={{ width: W, padding: 30, alignItems: "center", justifyContent: "center", gap: 18 }}>
              <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(242,107,29,.18)", alignItems: "center", justifyContent: "center" }}>
                <Icon name={item.icon} size={58} color={C.orange} />
              </View>
              <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 26, fontWeight: "800", textAlign: "center" }}>{item.title}</Text>
              <Text style={{ color: "#C9D0E4", fontSize: 16, lineHeight: 23, textAlign: "center" }}>{item.text}</Text>
            </View>)} />
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          {SLIDES.map((s, k) => <View key={s.title} style={{ width: k === i ? 22 : 8, height: 8, borderRadius: R.pill, backgroundColor: k === i ? C.orange : "rgba(255,255,255,.3)" }} />)}
        </View>
        <View style={{ paddingHorizontal: 24 }}>
          <Btn title={i >= SLIDES.length - 1 ? "Başlayalım" : "Devam"} onPress={next} />
        </View>
      </LinearGradient>
    </Modal>
  );
}
