import { router } from "expo-router";
import { Text, View } from "react-native";
import { RowList } from "@/components/RowList";
import { Btn } from "@/components/ui";
import { C } from "@/lib/theme";

// Satıcı için: kurduğu alarmlara uyan açık talepler.
export default function Uygun() {
  return <RowList path="/me/matches" empty={
    <View style={{ gap: 10, padding: 10 }}>
      <Text style={{ color: C.muted, textAlign: "center" }}>Size uygun talepleri görmek için talep alarmı kurun: hangi kategoride ve ilde satış yaptığınızı seçin.</Text>
      <Btn title="Talep alarmı kur" onPress={() => router.push("/hesap/alarmlar")} />
    </View>} />;
}
