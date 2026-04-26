import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing, STAGE_COLORS, STAGE_LABELS, STAGES } from "../../src/theme";
import { apiGet, apiPatch, apiDelete } from "../../src/api";

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setData(await apiGet(`/customers/${id}`)); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, [id]));

  const updateStage = async (stage: string) => {
    await apiPatch(`/customers/${id}`, { stage });
    load();
  };

  const del = () => Alert.alert("Löschen?", "Kunde wird endgültig gelöscht", [
    { text: "Abbrechen" },
    {
      text: "Löschen", style: "destructive", onPress: async () => {
        await apiDelete(`/customers/${id}`); router.back();
      }
    },
  ]);

  if (loading || !data) return <ActivityIndicator color={colors.primary} style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={s.headT}>Kunde</Text>
        <TouchableOpacity onPress={del}><Ionicons name="trash" size={22} color={colors.danger} /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
        <View style={s.card}>
          <Text style={s.name}>{data.name}</Text>
          <View style={[s.badge, { backgroundColor: `${STAGE_COLORS[data.stage]}30`, borderColor: STAGE_COLORS[data.stage] }]}>
            <Text style={[s.badgeT, { color: STAGE_COLORS[data.stage] }]}>{STAGE_LABELS[data.stage]}</Text>
          </View>
          {data.email ? <InfoRow icon="mail" label={data.email} /> : null}
          {data.phone ? <InfoRow icon="call" label={data.phone} /> : null}
          {data.address ? <InfoRow icon="location" label={`${data.address}${data.city ? ", " + data.city : ""}`} /> : null}
          {data.estimated_kwp ? <InfoRow icon="flash" label={`${data.estimated_kwp} kWp geschätzt`} color={colors.primary} /> : null}
          {data.estimated_value ? <InfoRow icon="cash" label={`€ ${data.estimated_value.toLocaleString("de-DE")}`} color={colors.secondary} /> : null}
        </View>

        <Text style={s.sectionT}>STATUS ÄNDERN</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {STAGES.map(st => (
            <TouchableOpacity key={st} onPress={() => updateStage(st)}
              style={[s.stageBtn, data.stage === st && { backgroundColor: STAGE_COLORS[st], borderColor: STAGE_COLORS[st] }]}>
              <Text style={[s.stageBtnT, data.stage === st && { color: "#fff" }]}>{STAGE_LABELS[st]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {data.notes ? (
          <>
            <Text style={s.sectionT}>NOTIZEN</Text>
            <View style={s.card}><Text style={{ color: colors.textPrimary }}>{data.notes}</Text></View>
          </>
        ) : null}

        <Text style={s.sectionT}>DACHAUFMAßE ({data.audits?.length || 0})</Text>
        {data.audits?.length === 0 && <Text style={s.empty}>Noch keine Aufmaße</Text>}
        {data.audits?.map((a: any) => (
          <View key={a.id} style={s.subCard}>
            <Text style={s.subT}>{a.title}</Text>
            <Text style={s.subS}>{a.modules_total} Module · {a.kwp} kWp · {a.annual_kwh.toLocaleString("de-DE")} kWh/a</Text>
          </View>
        ))}

        <Text style={s.sectionT}>PROJEKTE ({data.projects?.length || 0})</Text>
        {data.projects?.length === 0 && <Text style={s.empty}>Noch keine Projekte</Text>}
        {data.projects?.map((p: any) => (
          <View key={p.id} style={s.subCard}>
            <Text style={s.subT}>{p.title}</Text>
            <Text style={s.subS}>{p.status} · {p.kwp || "-"} kWp</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, color = colors.textSecondary }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 }}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={{ color: color === colors.textSecondary ? colors.textPrimary : color, fontSize: 14, fontWeight: color === colors.textSecondary ? "400" : "700" }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headT: { ...typography.h3, fontSize: 18 },
  card: { padding: spacing.md, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  name: { color: colors.textPrimary, fontSize: 22, fontWeight: "800" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, marginTop: 8 },
  badgeT: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  sectionT: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 20, marginBottom: 8 },
  stageBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  stageBtnT: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  empty: { color: colors.textDisabled, fontSize: 13, fontStyle: "italic" },
  subCard: { padding: 12, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  subT: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
  subS: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
});
