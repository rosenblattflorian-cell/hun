import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect } from "react-native-svg";
import { colors, typography, spacing, STAGE_COLORS, STAGE_LABELS } from "../../src/theme";
import { apiGet } from "../../src/api";
import { useAuth } from "../../src/auth";
import { HubFab } from "../../src/HubFab";

type Stats = {
  total_customers: number; leads: number; angebote: number; in_installation: number; abgeschlossen: number;
  pipeline_value: number; total_kwp: number;
  recent_customers: any[]; upcoming_appointments: any[];
  trend: { month: string; value: number }[];
};

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setStats(await apiGet<Stats>("/dashboard/stats")); }
    catch (e) { console.log(e); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const fmtEur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const maxTrend = Math.max(...(stats?.trend.map(t => t.value) || [1]), 1);

  return (
    <SafeAreaView style={styles.c} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Guten Tag,</Text>
            <Text style={styles.name}>{user?.name}</Text>
          </View>
          <TouchableOpacity
            testID="hub-button"
            onPress={() => router.replace("/hub")}
            style={styles.hubBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="grid" size={18} color={colors.primary} />
            <Text style={styles.hubBtnT}>Hub</Text>
          </TouchableOpacity>
        </View>

        {loading && !stats ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : stats ? (
          <>
            {/* Hero KPI */}
            <View style={styles.heroKpi} testID="kpi-pipeline">
              <Text style={styles.kpiLabel}>Pipeline-Wert</Text>
              <Text style={styles.heroValue}>{fmtEur(stats.pipeline_value)}</Text>
              <View style={styles.heroRow}>
                <View style={styles.heroChip}>
                  <Ionicons name="flash" size={12} color={colors.primary} />
                  <Text style={styles.chipText}>{stats.total_kwp} kWp installiert</Text>
                </View>
              </View>
              {/* Trend bars */}
              <View style={styles.trendBox}>
                <Svg width="100%" height={56}>
                  {stats.trend.map((t, i) => {
                    const bw = 100 / stats.trend.length;
                    const bh = (t.value / maxTrend) * 40;
                    return (
                      <Rect key={i}
                        x={`${i * bw + 2}%`} y={48 - bh}
                        width={`${bw - 4}%`} height={Math.max(bh, 2)}
                        fill={colors.primary} opacity={0.8} rx="2" />
                    );
                  })}
                </Svg>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                  {stats.trend.map((t, i) => (
                    <Text key={i} style={styles.trendLabel}>{t.month}</Text>
                  ))}
                </View>
              </View>
            </View>

            {/* Grid KPIs */}
            <View style={styles.grid}>
              {[
                { k: "total_customers", l: "Kunden gesamt", v: stats.total_customers, icon: "people", color: colors.info },
                { k: "leads", l: "Neue Leads", v: stats.leads, icon: "leaf", color: colors.secondary },
                { k: "angebote", l: "Offene Angebote", v: stats.angebote, icon: "document-text", color: colors.primary },
                { k: "in_installation", l: "In Installation", v: stats.in_installation, icon: "construct", color: colors.orange },
              ].map(x => (
                <View key={x.k} style={styles.kpiCard} testID={`kpi-${x.k}`}>
                  <View style={[styles.iconBox, { backgroundColor: `${x.color}22`, borderColor: x.color }]}>
                    <Ionicons name={x.icon as any} size={18} color={x.color} />
                  </View>
                  <Text style={styles.kpiVal}>{x.v}</Text>
                  <Text style={styles.kpiL}>{x.l}</Text>
                </View>
              ))}
            </View>

            {/* Pipeline stages */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pipeline-Übersicht</Text>
              <View style={styles.pipelineBar}>
                {["lead", "kontakt", "angebot", "vertrag", "installation", "abgeschlossen"].map(s => {
                  const val = (stats as any)[s === "in_installation" ? "in_installation" : s] ?? 0;
                  const num = s === "lead" ? stats.leads : s === "angebot" ? stats.angebote :
                    s === "installation" ? stats.in_installation : s === "abgeschlossen" ? stats.abgeschlossen :
                      0;
                  return (
                    <View key={s} style={styles.stageBox}>
                      <View style={[styles.stageDot, { backgroundColor: STAGE_COLORS[s] }]} />
                      <Text style={styles.stageNum}>{num}</Text>
                      <Text style={styles.stageLabel}>{STAGE_LABELS[s]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Recent customers */}
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>Neueste Kunden</Text>
                <TouchableOpacity onPress={() => router.push("/(tabs)/kunden")}>
                  <Text style={styles.link}>Alle →</Text>
                </TouchableOpacity>
              </View>
              {stats.recent_customers.map((c: any) => (
                <TouchableOpacity
                  key={c.id} style={styles.listItem}
                  onPress={() => router.push(`/customer/${c.id}`)}
                >
                  <View style={[styles.dot, { backgroundColor: STAGE_COLORS[c.stage] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>{c.name}</Text>
                    <Text style={styles.listSub}>{c.city || "—"} · {STAGE_LABELS[c.stage]}</Text>
                  </View>
                  <Text style={styles.listVal}>{c.estimated_kwp ? `${c.estimated_kwp} kWp` : ""}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, paddingBottom: spacing.md },
  greeting: { color: colors.textSecondary, fontSize: 13 },
  name: { ...typography.h2, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  hubBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.primaryGlow },
  hubBtnT: { color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 0.6 },
  heroKpi: { marginHorizontal: spacing.lg, padding: spacing.lg, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  kpiLabel: { color: colors.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "600" },
  heroValue: { fontSize: 36, fontWeight: "800", color: colors.primary, marginTop: 6, letterSpacing: -1 },
  heroRow: { flexDirection: "row", marginTop: 10, gap: 8 },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
  trendBox: { marginTop: spacing.md },
  trendLabel: { color: colors.textSecondary, fontSize: 10, flex: 1, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", padding: spacing.md, gap: spacing.sm },
  kpiCard: { width: "48%", padding: spacing.md, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, marginBottom: spacing.sm },
  kpiVal: { fontSize: 28, fontWeight: "800", color: colors.textPrimary },
  kpiL: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  section: { margin: spacing.md, padding: spacing.md, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3, marginBottom: spacing.sm },
  link: { color: colors.primary, fontWeight: "600" },
  pipelineBar: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  stageBox: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: 10, backgroundColor: colors.bg },
  stageDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  stageNum: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  stageLabel: { color: colors.textSecondary, fontSize: 9, marginTop: 2, textTransform: "uppercase" },
  listItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  listTitle: { color: colors.textPrimary, fontWeight: "600", fontSize: 15 },
  listSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  listVal: { color: colors.primary, fontWeight: "700", fontSize: 13 },
});
