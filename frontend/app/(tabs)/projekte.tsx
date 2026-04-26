import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../../src/theme";
import { apiGet, apiPost } from "../../src/api";

const STATUS = ["planung", "genehmigung", "installation", "abnahme", "abgeschlossen"];
const STATUS_LABEL: Record<string, string> = {
  planung: "Planung", genehmigung: "Genehmigung", installation: "Installation",
  abnahme: "Abnahme", abgeschlossen: "Abgeschlossen",
};
const STATUS_COLOR: Record<string, string> = {
  planung: "#3B82F6", genehmigung: "#A855F7", installation: "#F97316",
  abnahme: "#F59E0B", abgeschlossen: "#10B981",
};

export default function Projekte() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setItems(await apiGet("/projects"));
      setCustomers(await apiGet("/customers"));
    } finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Text style={typography.h2}>Projekte</Text>
        <TouchableOpacity testID="add-project-btn" style={s.addBtn} onPress={() => setModal(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={() => (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Ionicons name="briefcase-outline" size={48} color={colors.textDisabled} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Noch keine Projekte angelegt</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.card} onPress={() => router.push(`/project/${item.id}`)} testID={`project-${item.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={s.title}>{item.title}</Text>
                <View style={[s.badge, { borderColor: STATUS_COLOR[item.status], backgroundColor: `${STATUS_COLOR[item.status]}25` }]}>
                  <Text style={[s.badgeT, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
                </View>
              </View>
              <Text style={s.sub}>{item.customer_name || "Ohne Kunde"}</Text>
              <View style={s.timeline}>
                {STATUS.map((st, i) => {
                  const active = STATUS.indexOf(item.status) >= i;
                  return (
                    <View key={st} style={{ flex: 1, alignItems: "center" }}>
                      <View style={[s.dot, { backgroundColor: active ? STATUS_COLOR[item.status] : colors.border }]} />
                      {i < STATUS.length - 1 && <View style={[s.line, { backgroundColor: active ? STATUS_COLOR[item.status] : colors.border }]} />}
                    </View>
                  );
                })}
              </View>
              <View style={s.stats}>
                {item.kwp ? <Text style={s.stat}>{item.kwp} kWp</Text> : null}
                {item.value ? <Text style={[s.stat, { color: colors.secondary }]}>€ {item.value.toLocaleString("de-DE")}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      <NewProjectModal visible={modal} customers={customers} onClose={() => { setModal(false); load(); }} />
    </SafeAreaView>
  );
}

function NewProjectModal({ visible, customers, onClose }: any) {
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [status, setStatus] = useState("planung");
  const [kwp, setKwp] = useState("");
  const [value, setValue] = useState("");

  const save = async () => {
    if (!title || !customerId) return Alert.alert("Fehler", "Titel und Kunde erforderlich");
    try {
      await apiPost("/projects", {
        title, customer_id: customerId, status,
        kwp: kwp ? parseFloat(kwp) : null,
        value: value ? parseFloat(value) : null,
      });
      setTitle(""); setKwp(""); setValue(""); setCustomerId(null); setStatus("planung");
      onClose();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" }} />
        <View style={m.sheet}>
          <View style={m.head}>
            <Text style={typography.h3}>Neues Projekt</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textPrimary} /></TouchableOpacity>
          </View>
          <ScrollView>
            <Text style={m.label}>TITEL</Text>
            <TextInput style={m.input} value={title} onChangeText={setTitle} />

            <Text style={m.label}>KUNDE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {customers.map((c: any) => (
                <TouchableOpacity key={c.id} onPress={() => setCustomerId(c.id)}
                  style={[m.chip, customerId === c.id && m.chipActive]}>
                  <Text style={[m.chipT, customerId === c.id && { color: "#fff" }]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={m.label}>STATUS</Text>
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {STATUS.map(st => (
                <TouchableOpacity key={st} onPress={() => setStatus(st)}
                  style={[m.chip, status === st && { backgroundColor: STATUS_COLOR[st], borderColor: STATUS_COLOR[st] }]}>
                  <Text style={[m.chipT, status === st && { color: "#fff" }]}>{STATUS_LABEL[st]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={m.label}>KWP</Text>
                <TextInput style={m.input} value={kwp} onChangeText={setKwp} keyboardType="decimal-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={m.label}>WERT €</Text>
                <TextInput style={m.input} value={value} onChangeText={setValue} keyboardType="decimal-pad" />
              </View>
            </View>

            <TouchableOpacity onPress={save} style={m.btn}><Text style={m.btnT}>Projekt anlegen</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, paddingBottom: spacing.sm },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  card: { padding: spacing.md, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", flex: 1 },
  sub: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  badgeT: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  timeline: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: { position: "absolute", height: 2, top: 5, right: -30, width: 60 },
  stats: { flexDirection: "row", gap: 14, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  stat: { color: colors.primary, fontWeight: "700" },
});

const m = StyleSheet.create({
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "85%", borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: "700", letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.textPrimary, fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipT: { color: colors.textSecondary, fontWeight: "600", fontSize: 12 },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 24, marginBottom: 24 },
  btnT: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
