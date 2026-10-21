import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { C, R } from "@/lib/theme";
import { Btn, s } from "./ui";

/** Alttan açılan seçim penceresi (şikâyet nedeni gibi); isteğe bağlı açıklama kutusu. */
export function Sheet({ visible, title, options, note, onClose, onSubmit }: {
  visible: boolean; title: string; options: { value: string; label: string }[]; note?: string;
  onClose: () => void; onSubmit: (value: string, note: string) => void;
}) {
  const [pick, setPick] = useState("");
  const [text, setText] = useState("");
  const close = () => { setPick(""); setText(""); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable accessibilityLabel="Kapat" onPress={close} style={{ flex: 1, backgroundColor: "rgba(0,0,0,.35)" }} />
      <View accessibilityViewIsModal style={{ backgroundColor: C.card, padding: 16, paddingBottom: 30, gap: 10, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg }}>
        <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: "800", color: C.navy }}>{title}</Text>
        {options.map((o) => (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: pick === o.value }} onPress={() => setPick(o.value)}
            style={{ padding: 12, borderRadius: R.md, borderWidth: 1, borderColor: pick === o.value ? C.orange : C.line, backgroundColor: pick === o.value ? C.soft : C.card }}>
            <Text style={{ color: C.text, fontWeight: pick === o.value ? "700" : "400" }}>{o.label}</Text>
          </Pressable>))}
        {note !== undefined ? <TextInput accessibilityLabel={note} placeholder={note} value={text} onChangeText={setText} multiline maxLength={500} style={[s.inp, { minHeight: 70 }]} /> : null}
        <Btn title="Gönder" disabled={!pick} onPress={() => { onSubmit(pick, text.trim()); close(); }} />
        <Btn title="Vazgeç" kind="gh" onPress={close} />
      </View>
    </Modal>
  );
}
