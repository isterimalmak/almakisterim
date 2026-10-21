import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, SafeAreaView, Text, TextInput, View } from "react-native";
import { C, R } from "@/lib/theme";
import { s } from "./ui";

/** Listeden seçim (il, kategori…): dokununca tam ekran, aranabilir liste açılır. */
export function Picker({ label, value, options, onChange, placeholder = "Seçin", disabled }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const shown = useMemo(() => options.filter((o) => o.label.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))), [options, q]);
  const cur = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${cur?.label ?? placeholder}`} disabled={disabled} onPress={() => setOpen(true)}
        style={[s.inp, { flexDirection: "row", justifyContent: "space-between", opacity: disabled ? 0.5 : 1 }]}>
        <Text style={{ fontSize: 16, color: cur ? C.text : "#9AA1AB" }}>{cur?.label ?? placeholder}</Text><Text style={{ color: C.muted }}>▾</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <View style={{ flexDirection: "row", alignItems: "center", padding: 12, gap: 10 }}>
            <TextInput autoFocus placeholder={`${label} ara`} accessibilityLabel={`${label} ara`} value={q} onChangeText={setQ} style={[s.inp, { flex: 1 }]} />
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)}><Text style={{ color: C.navy, fontWeight: "700" }}>Kapat</Text></Pressable>
          </View>
          <FlatList data={shown} keyExtractor={(o) => o.value} keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable accessibilityRole="button" onPress={() => { onChange(item.value); setOpen(false); setQ(""); }}
                style={{ paddingHorizontal: 16, paddingVertical: 14, backgroundColor: item.value === value ? "#FFF3EC" : C.card, borderBottomWidth: 1, borderBottomColor: C.line, borderRadius: item.value === value ? R.sm : 0 }}>
                <Text style={{ fontSize: 16, color: C.text }}>{item.label}</Text>
              </Pressable>
            )} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
