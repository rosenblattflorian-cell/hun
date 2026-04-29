import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing, STAGE_LABELS, STAGE_COLORS, STAGES } from "../../src/theme";
import { apiGet, apiPost } from "../../src/api";

export default function KundenList() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const load = async () => {
    try {
      const qp = new URLSearchParams();
      if (stage) qp.append("stage", stage);
      if (search) qp.append("search", search);
      setItems(await apiGet(`/customers?${qp.toString()}`));
    } finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, [stage, search]));

  return (
    <SafeAreaView style={styles.c} edges={["top"]}>
      <View style={styles.head}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            testID="hub-button"
            onPress={() => router.replace("/hub")}
            style={styles.hubBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="grid" size={16} color={colors.primary} />
          </TouchableOpacity>
          <Text style={typography.h2}>Kunden</Text>
        </View>
        <TouchableOpacity testID="add-customer-btn" style={styles.addBtn} onPress={() => setModal(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="customer-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Suche nach Name, Stadt..."
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <TouchableOpacity
          onPress={() => setStage(null)}
          style={[styles.filter, !stage && styles.filterActive]}
        >
          <Text style={[styles.filterT, !stage && { color: "#fff" }]}>Alle</Text>
        </TouchableOpacity>
        {STAGES.map(s => (
          <TouchableOpacity
            key={s} onPress={() => setStage(s)}
            style={[styles.filter, stage === s && { backgroundColor: STAGE_COLORS[s], borderColor: STAGE_COLORS[s] }]}
          >
            <Text style={[styles.filterT, stage === s && { color: "#fff" }]}>{STAGE_LABELS[s]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={() => (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Ionicons name="people-outline" size={48} color={colors.textDisabled} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine Kunden gefunden</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/customer/${item.id}`)}
              testID={`customer-item-${item.id}`}
            >
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <View style={[styles.badge, { backgroundColor: `${STAGE_COLORS[item.stage]}30`, borderColor: STAGE_COLORS[item.stage] }]}>
                  <Text style={[styles.badgeT, { color: STAGE_COLORS[item.stage] }]}>{STAGE_LABELS[item.stage]}</Text>
                </View>
              </View>
              {item.city ? <Text style={styles.cardLine}><Ionicons name="location" size={12} color={colors.textSecondary} /> {item.city}</Text> : null}
              {item.phone ? <Text style={styles.cardLine}><Ionicons name="call" size={12} color={colors.textSecondary} /> {item.phone}</Text> : null}
              {item.estimated_kwp ? (
                <View style={styles.cardFooter}>
                  <Text style={styles.metric}>{item.estimated_kwp} kWp</Text>
                  {item.estimated_value ? <Text style={styles.metricEur}>€ {item.estimated_value.toLocaleString("de-DE")}</Text> : null}
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}

      <NewCustomerModal visible={modal} onClose={() => { setModal(false); load(); }} />
    </SafeAreaView>
  );
}

function NewCustomerModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [kwp, setKwp] = useState("");
  const [stage, setStage] = useState("lead");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim()) return Alert.alert("Fehler", "Name ist erforderlich");
    setLoading(true);
    try {
      await apiPost("/customers", {
        name, email: email || null, phone: phone || null, city: city || null,
        address: address || null, stage, estimated_kwp: kwp ? parseFloat(kwp) : null,
      });
      setName(""); setEmail(""); setPhone(""); setCity(""); setAddress(""); setKwp(""); setStage("lead");
      onClose();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
        <View style={mStyles.backdrop} />
        <View style={mStyles.sheet}>
          <View style={mStyles.handle} />
          <View style={mStyles.head}>
            <Text style={typography.h3}>Neuer Kunde</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.textPrimary} /></TouchableOpacity>
          </View>
          <ScrollView>
            <Field label="Name *" value={name} onChange={setName} testID="new-name" />
            <Field label="E-Mail" value={email} onChange={setEmail} keyboardType="email-address" />
            <Field label="Telefon" value={phone} onChange={setPhone} keyboardType="phone-pad" />
            <Field label="Stadt" value={city} onChange={setCity} />
            <Field label="Adresse" value={address} onChange={setAddress} />
            <Field label="Geschätzte kWp" value={kwp} onChange={setKwp} keyboardType="decimal-pad" />
            <Text style={mStyles.label}>STATUS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
              {STAGES.map(s => (
                <TouchableOpacity key={s} onPress={() => setStage(s)}
                  style={[mStyles.stageBtn, stage === s && { backgroundColor: STAGE_COLORS[s], borderColor: STAGE_COLORS[s] }]}>
                  <Text style={[mStyles.stageT, stage === s && { color: "#fff" }]}>{STAGE_LABELS[s]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity testID="save-customer" onPress={save} style={mStyles.saveBtn} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.saveT}>Kunde anlegen</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, value, onChange, keyboardType, testID }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={mStyles.label}>{label.toUpperCase()}</Text>
      <TextInput
        testID={testID}
        value={value} onChangeText={onChange} keyboardType={keyboardType}
        style={mStyles.input} placeholderTextColor={colors.textDisabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg, paddingBottom: spacing.sm },
  addBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  hubBtn: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.primaryGlow },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.md, paddingHorizontal: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  searchInput: { flex: 1, color: colors.textPrimary, paddingVertical: 12, fontSize: 14 },
  filters: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 8 },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterT: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  card: { padding: spacing.md, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { ...typography.body, fontWeight: "700", fontSize: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  badgeT: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  cardLine: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  cardFooter: { flexDirection: "row", gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  metric: { color: colors.primary, fontWeight: "700" },
  metricEur: { color: colors.secondary, fontWeight: "700" },
});

const mStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "85%", borderWidth: 1, borderColor: colors.border },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.textPrimary, fontSize: 15 },
  stageBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  stageT: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 10, padding: 16, alignItems: "center", marginTop: spacing.md, marginBottom: spacing.lg },
  saveT: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
