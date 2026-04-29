import React, { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../../src/theme";
import { apiGet, apiPost, apiDelete } from "../../src/api";
import RoofPlan from "../../src/RoofPlan";

const ORIENT = ["Süd", "SO", "SW", "Ost", "West", "NO", "NW", "Nord"];

export default function AufmassTab() {
  const router = useRouter();
  const [tab, setTab] = useState<"neu" | "liste">("neu");
  const [audits, setAudits] = useState<any[]>([]);
  const loadAudits = async () => setAudits(await apiGet("/roof-audits"));
  useFocusEffect(useCallback(() => { if (tab === "liste") loadAudits(); }, [tab]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity
          testID="hub-button"
          onPress={() => router.replace("/hub")}
          style={s.hubBtn}
          activeOpacity={0.85}
        >
          <Ionicons name="grid" size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text style={typography.h2}>Dachaufmaß</Text>
      </View>
      <View style={s.tabs}>
        <TouchableOpacity
          testID="tab-neu"
          style={[s.tab, tab === "neu" && s.tabActive]}
          onPress={() => setTab("neu")}
        >
          <Text style={[s.tabT, tab === "neu" && s.tabTActive]}>Neues Aufmaß</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tab-liste"
          style={[s.tab, tab === "liste" && s.tabActive]}
          onPress={() => setTab("liste")}
        >
          <Text style={[s.tabT, tab === "liste" && s.tabTActive]}>Archiv</Text>
        </TouchableOpacity>
      </View>
      {tab === "neu" ? <NewAudit onSaved={loadAudits} /> : <AuditList audits={audits} reload={loadAudits} />}
    </SafeAreaView>
  );
}

function NewAudit({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState("Dachaufmaß");
  const [laenge, setLaenge] = useState("25.5");
  const [breite, setBreite] = useState("10");
  const [walm, setWalm] = useState("4");
  const [first, setFirst] = useState("17.5");
  const [sparren, setSparren] = useState("0.64");
  const [neigung, setNeigung] = useState("35");
  const [ausrichtung, setAusrichtung] = useState("Süd");
  const [watt, setWatt] = useState("420");
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const compute = () => {
    const L = parseFloat(laenge || "0");
    const B = parseFloat(breite || "0");
    const F = parseFloat(first || "0");
    const W = parseFloat(walm || "0");
    const mL = 1.722, mW = 1.134;
    const gap = 0.02, edge = 0.3;
    const usableX = Math.max(F - 2 * edge, 0);
    const usableY = Math.max(B / 2 - 2 * edge, 0);
    const cols = Math.floor((usableX + gap) / (mL + gap));
    const rows = Math.floor((usableY + gap) / (mW + gap));
    const modules = cols * rows * 2;
    const kwp = +(modules * parseInt(watt || "420") / 1000).toFixed(2);
    const orientF: Record<string, number> = { "Süd": 1, SO: 0.95, SW: 0.95, Ost: 0.85, West: 0.85, NO: 0.7, NW: 0.7, Nord: 0.6 };
    const kwh = Math.round(kwp * 950 * (orientF[ausrichtung] || 0.9));
    const co2 = +(kwh * 0.4 / 1000).toFixed(2);
    const eur = Math.round(kwh * 0.35);
    return { cols, rows, modules, kwp, kwh, co2, eur, area: +(L * B).toFixed(2) };
  };

  const preview = compute();

  const save = async () => {
    setSaving(true);
    try {
      await apiPost("/roof-audits", {
        title, laenge: parseFloat(laenge), breite: parseFloat(breite),
        walm: parseFloat(walm), first: parseFloat(first),
        sparrenabstand: parseFloat(sparren), neigung: parseFloat(neigung),
        ausrichtung, module_watt: parseInt(watt),
      });
      Alert.alert("Gespeichert", "Aufmaß wurde erfolgreich gespeichert");
      onSaved();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
    finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        {/* Visualization */}
        <View style={s.planCard}>
          <Text style={s.planTitle}>Technische Ansicht</Text>
          <RoofPlan
            laenge={parseFloat(laenge) || 1}
            breite={parseFloat(breite) || 1}
            walm={parseFloat(walm) || 0}
            first={parseFloat(first) || 1}
            sparren={parseFloat(sparren) || 0.64}
            modules={{ cols: preview.cols, rows: preview.rows }}
            width={340} height={200}
          />
          <View style={s.legend}>
            <LegendItem color={colors.roofOutline} label="Dachumriss" />
            <LegendItem color={colors.rafterLines} label="Sparren" />
            <LegendItem color={colors.pvModuleStroke} label="PV-Module" />
          </View>
        </View>

        {/* Live result */}
        <View style={s.result}>
          <View style={s.resultItem}>
            <Text style={s.rLabel}>Module</Text>
            <Text style={s.rVal}>{preview.modules}</Text>
          </View>
          <View style={s.sep} />
          <View style={s.resultItem}>
            <Text style={s.rLabel}>kWp</Text>
            <Text style={[s.rVal, { color: colors.primary }]}>{preview.kwp}</Text>
          </View>
          <View style={s.sep} />
          <View style={s.resultItem}>
            <Text style={s.rLabel}>kWh/Jahr</Text>
            <Text style={[s.rVal, { color: colors.secondary }]}>{preview.kwh.toLocaleString("de-DE")}</Text>
          </View>
        </View>
        <View style={[s.result, { marginTop: 8 }]}>
          <View style={s.resultItem}>
            <Text style={s.rLabel}>CO₂ t/Jahr</Text>
            <Text style={s.rVal}>{preview.co2}</Text>
          </View>
          <View style={s.sep} />
          <View style={s.resultItem}>
            <Text style={s.rLabel}>€ / Jahr</Text>
            <Text style={[s.rVal, { color: colors.primary }]}>{preview.eur.toLocaleString("de-DE")}</Text>
          </View>
          <View style={s.sep} />
          <View style={s.resultItem}>
            <Text style={s.rLabel}>Fläche m²</Text>
            <Text style={s.rVal}>{preview.area}</Text>
          </View>
        </View>

        {/* Inputs */}
        <Text style={s.sectionT}>MAßE</Text>
        <View style={s.row}>
          <NumField label="Länge" v={laenge} set={setLaenge} unit="m" testID="in-laenge" />
          <NumField label="Breite" v={breite} set={setBreite} unit="m" testID="in-breite" />
        </View>
        <View style={s.row}>
          <NumField label="First" v={first} set={setFirst} unit="m" testID="in-first" />
          <NumField label="Walm" v={walm} set={setWalm} unit="m" testID="in-walm" />
        </View>
        <View style={s.row}>
          <NumField label="Sparrenabstand" v={sparren} set={setSparren} unit="m" testID="in-sparren" />
          <NumField label="Neigung" v={neigung} set={setNeigung} unit="°" testID="in-neigung" />
        </View>

        <Text style={s.sectionT}>AUSRICHTUNG</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {ORIENT.map(o => (
            <TouchableOpacity key={o} onPress={() => setAusrichtung(o)}
              style={[s.chip, ausrichtung === o && s.chipActive]}>
              <Text style={[s.chipT, ausrichtung === o && { color: "#fff" }]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={s.sectionT}>MODUL</Text>
        <NumField label="Modul-Leistung" v={watt} set={setWatt} unit="W" testID="in-watt" />

        <Text style={s.sectionT}>BEZEICHNUNG</Text>
        <TextInput
          testID="in-title"
          value={title} onChangeText={setTitle}
          style={s.input} placeholderTextColor={colors.textDisabled}
        />

        <TouchableOpacity testID="save-audit-btn" onPress={save} style={s.saveBtn} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="save" size={18} color="#fff" />
              <Text style={s.saveT}>Aufmaß speichern</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AuditList({ audits, reload }: { audits: any[]; reload: () => void }) {
  return (
    <FlatList
      data={audits}
      keyExtractor={i => i.id}
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
      ListEmptyComponent={() => (
        <View style={{ padding: 40, alignItems: "center" }}>
          <Ionicons name="archive-outline" size={48} color={colors.textDisabled} />
          <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Noch keine gespeicherten Aufmaße</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={s.auditCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={s.auditTitle}>{item.title}</Text>
            <TouchableOpacity onPress={async () => { await apiDelete(`/roof-audits/${item.id}`); reload(); }}>
              <Ionicons name="trash" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
          <RoofPlan laenge={item.laenge} breite={item.breite} walm={item.walm}
            first={item.first} sparren={item.sparrenabstand}
            modules={{ cols: item.layout_cols, rows: item.layout_rows }}
            width={300} height={150} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <Pill label={`${item.modules_total} Module`} />
            <Pill label={`${item.kwp} kWp`} color={colors.primary} />
            <Pill label={`${item.annual_kwh.toLocaleString("de-DE")} kWh/a`} color={colors.secondary} />
            <Pill label={item.ausrichtung} />
          </View>
        </View>
      )}
    />
  );
}

function Pill({ label, color = colors.textSecondary }: { label: string; color?: string }) {
  return (
    <View style={[s.pill, { borderColor: color }]}>
      <Text style={[s.pillT, { color }]}>{label}</Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function NumField({ label, v, set, unit, testID }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.fLabel}>{label}</Text>
      <View style={s.fBox}>
        <TextInput testID={testID} value={v} onChangeText={set} keyboardType="decimal-pad" style={s.fInput} />
        <Text style={s.fUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { padding: spacing.lg, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: 12 },
  hubBtn: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.primaryGlow },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.md, gap: 8, marginBottom: spacing.sm },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabT: { color: colors.textSecondary, fontWeight: "600" },
  tabTActive: { color: "#fff" },
  planCard: { backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: "center" },
  planTitle: { color: colors.textSecondary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700", alignSelf: "flex-start", marginBottom: 8 },
  legend: { flexDirection: "row", gap: 14, marginTop: 10 },
  result: { flexDirection: "row", backgroundColor: colors.paper, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, marginTop: spacing.md },
  resultItem: { flex: 1, alignItems: "center" },
  sep: { width: 1, backgroundColor: colors.border },
  rLabel: { color: colors.textSecondary, fontSize: 10, textTransform: "uppercase", fontWeight: "600", letterSpacing: 0.5 },
  rVal: { color: colors.textPrimary, fontSize: 22, fontWeight: "800", marginTop: 4 },
  sectionT: { color: colors.textSecondary, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginTop: 20, marginBottom: 8 },
  row: { flexDirection: "row", gap: 10, marginBottom: 10 },
  fLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 4 },
  fBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingRight: 12 },
  fInput: { flex: 1, color: colors.textPrimary, padding: 12, fontSize: 16 },
  fUnit: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipT: { color: colors.textSecondary, fontWeight: "600" },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.textPrimary, fontSize: 15 },
  saveBtn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 },
  saveT: { color: "#fff", fontWeight: "700", fontSize: 16 },
  auditCard: { backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, alignItems: "center" },
  auditTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: "700", alignSelf: "flex-start", marginBottom: 6, flex: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillT: { fontSize: 11, fontWeight: "700" },
});
