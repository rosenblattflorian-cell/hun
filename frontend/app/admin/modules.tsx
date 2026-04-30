/**
 * Admin: Modul-Stammdaten-Verwaltung
 * ==================================
 * CRUD für PV-Module (Wp, Maße, Gewicht, Technologie).
 * Admin-Only — neue Module ohne Code-Deployment einpflegen.
 */
import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Modal, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../../src/theme";
import { apiGet, apiPost, apiDelete } from "../../src/api";
import { useAuth } from "../../src/auth";

type Module = {
  id: string;
  name: string; brand: string;
  leistung_wp: number;
  laenge_mm: number; breite_mm: number; dicke_mm: number;
  gewicht_kg: number;
  glas_glas: boolean;
  technologie: string;
  zellen_count: number;
  beschreibung?: string;
  datasheet_url?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

const TECH_OPTIONS = ["mono", "poly", "tdk", "n-type", "topcon", "hjt", "perc"];

const empty: Partial<Module> = {
  name: "", brand: "",
  leistung_wp: 450, laenge_mm: 1722, breite_mm: 1134, dicke_mm: 30,
  gewicht_kg: 22, glas_glas: false, technologie: "topcon",
  zellen_count: 144, beschreibung: "", active: true,
};

export default function AdminModules() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [mods, setMods] = useState<Module[]>([]);
  const [activeOnly, setActiveOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const q = activeOnly ? "?active_only=true" : "";
      setMods(await apiGet<Module[]>(`/admin/modules${q}`));
    } catch (e: any) { Alert.alert("Fehler", e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, [activeOnly, isAdmin]));

  const seed = async () => {
    setBusy(true);
    try {
      const r = await apiPost<any>("/admin/modules/seed", {});
      Alert.alert("Stammdaten geseedet", `${r.seeded} neue Module geladen.`);
      await load();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
    finally { setBusy(false); }
  };

  const openNew = () => { setEditing(null); setForm({ ...empty }); setModal(true); };
  const openEdit = (m: Module) => { setEditing(m); setForm({ ...m }); setModal(true); };

  const save = async () => {
    setBusy(true);
    try {
      const payload = {
        name: form.name, brand: form.brand,
        leistung_wp: parseInt(String(form.leistung_wp), 10) || 0,
        laenge_mm: parseInt(String(form.laenge_mm), 10) || 0,
        breite_mm: parseInt(String(form.breite_mm), 10) || 0,
        dicke_mm: parseInt(String(form.dicke_mm), 10) || 30,
        gewicht_kg: parseFloat(String(form.gewicht_kg)) || 0,
        glas_glas: !!form.glas_glas,
        technologie: form.technologie,
        zellen_count: parseInt(String(form.zellen_count), 10) || 144,
        beschreibung: form.beschreibung || null,
        datasheet_url: form.datasheet_url || null,
        active: !!form.active,
      };
      if (editing) {
        // PUT
        const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL || ""}/api/admin/modules/${editing.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${await (await import("@react-native-async-storage/async-storage")).default.getItem("access_token")}`,
          },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error((await r.json()).detail || "Update fehlgeschlagen");
      } else {
        await apiPost("/admin/modules", payload);
      }
      setModal(false); await load();
    } catch (e: any) { Alert.alert("Speichern fehlgeschlagen", e.message); }
    finally { setBusy(false); }
  };

  const remove = (m: Module) => {
    Alert.alert("Löschen?", `Modul "${m.brand} ${m.name}" wirklich entfernen?`, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen", style: "destructive",
        onPress: async () => {
          try { await apiDelete(`/admin/modules/${m.id}`); await load(); }
          catch (e: any) { Alert.alert("Fehler", e.message); }
        },
      },
    ]);
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={s.c}>
        <View style={{ padding: spacing.lg, gap: 12 }}>
          <Text style={typography.h2}>Zugriff verweigert</Text>
          <Text style={s.help}>Diese Seite ist nur für Administratoren.</Text>
          <TouchableOpacity onPress={() => router.replace("/hub")} style={s.hubBtnFull}>
            <Text style={s.hubBtnFullT}>Zurück zum Hub</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity testID="hub-button" onPress={() => router.replace("/hub")} style={s.hubBtn}>
          <Ionicons name="grid" size={16} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Modul-Stammdaten</Text>
          <Text style={s.subtitle}>{mods.length} Module · Wartung ohne Code-Deployment</Text>
        </View>
        <View style={s.adminBadge}>
          <Text style={s.adminBadgeT}>ADMIN</Text>
        </View>
      </View>

      <View style={s.toolbar}>
        <TouchableOpacity onPress={() => setActiveOnly(!activeOnly)} style={s.toggle}>
          <Ionicons name={activeOnly ? "checkbox" : "square-outline"} size={16} color={activeOnly ? colors.primary : colors.textSecondary} />
          <Text style={[s.toggleT, activeOnly && { color: colors.primary }]}>Nur aktive</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={seed} disabled={busy} style={s.seedBtn} testID="seed-modules">
          <Ionicons name="cloud-download-outline" size={14} color={colors.accent} />
          <Text style={s.seedT}>Standard-Module</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openNew} style={s.addBtn} testID="add-module">
          <Ionicons name="add" size={20} color="#000" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 30, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: 8, paddingBottom: 40 }}>
          {mods.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="cube-outline" size={32} color={colors.textSecondary} />
              <Text style={s.emptyT}>Noch keine Module</Text>
              <Text style={s.emptyS}>Klicke auf „Standard-Module" um 5 PV-Module zu seeden, oder lege manuell neue an.</Text>
            </View>
          )}
          {mods.map(m => (
            <View key={m.id} style={[s.row, !m.active && { opacity: 0.5 }]} testID={`module-${m.id}`}>
              <View style={s.rowLeft}>
                <View style={[s.rowIcon, { borderColor: m.glas_glas ? colors.primary : colors.border }]}>
                  <Ionicons name="cube" size={20} color={m.glas_glas ? colors.primary : colors.textSecondary} />
                  {m.glas_glas && (
                    <View style={s.ggBadge}>
                      <Text style={s.ggBadgeT}>GG</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowBrand}>{m.brand}</Text>
                <Text style={s.rowName} numberOfLines={1}>{m.name}</Text>
                <View style={s.rowMeta}>
                  <Text style={[s.rowSpec, { color: colors.primary }]}>{m.leistung_wp} Wp</Text>
                  <Text style={s.rowSep}>·</Text>
                  <Text style={s.rowSpec}>{m.laenge_mm}×{m.breite_mm}mm</Text>
                  <Text style={s.rowSep}>·</Text>
                  <Text style={s.rowSpec}>{m.gewicht_kg}kg</Text>
                  <Text style={s.rowSep}>·</Text>
                  <Text style={[s.rowSpec, { color: colors.accent }]}>{m.technologie.toUpperCase()}</Text>
                </View>
                {m.beschreibung && <Text style={s.rowDesc} numberOfLines={1}>{m.beschreibung}</Text>}
              </View>
              <View style={s.rowActions}>
                <TouchableOpacity onPress={() => openEdit(m)} style={s.actionBtn} testID={`edit-${m.id}`}>
                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(m)} style={s.actionBtn} testID={`delete-${m.id}`}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalC}>
          <View style={s.modalBox}>
            <View style={s.modalHead}>
              <Text style={s.modalT}>{editing ? "Modul bearbeiten" : "Neues Modul"}</Text>
              <TouchableOpacity onPress={() => setModal(false)}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Field label="Hersteller" v={form.brand} set={(v: string) => setForm({ ...form, brand: v })} />
                <Field label="Modell" v={form.name} set={(v: string) => setForm({ ...form, name: v })} />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Field label="Leistung (Wp)" v={String(form.leistung_wp)} set={(v: string) => setForm({ ...form, leistung_wp: v })} numeric />
                <Field label="Zellen" v={String(form.zellen_count)} set={(v: string) => setForm({ ...form, zellen_count: v })} numeric />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Field label="Länge (mm)" v={String(form.laenge_mm)} set={(v: string) => setForm({ ...form, laenge_mm: v })} numeric />
                <Field label="Breite (mm)" v={String(form.breite_mm)} set={(v: string) => setForm({ ...form, breite_mm: v })} numeric />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Field label="Dicke (mm)" v={String(form.dicke_mm)} set={(v: string) => setForm({ ...form, dicke_mm: v })} numeric />
                <Field label="Gewicht (kg)" v={String(form.gewicht_kg)} set={(v: string) => setForm({ ...form, gewicht_kg: v })} numeric />
              </View>

              <Text style={s.fLabel}>Technologie</Text>
              <View style={s.chipRow}>
                {TECH_OPTIONS.map(t => (
                  <TouchableOpacity key={t}
                    onPress={() => setForm({ ...form, technologie: t })}
                    style={[s.chip, form.technologie === t && s.chipActive]}>
                    <Text style={[s.chipT, form.technologie === t && { color: "#000" }]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.toggleRow}>
                <Text style={s.fLabel}>Glas-Glas</Text>
                <Switch value={!!form.glas_glas}
                  onValueChange={v => setForm({ ...form, glas_glas: v })}
                  trackColor={{ false: colors.border, true: colors.primary }} />
              </View>
              <View style={s.toggleRow}>
                <Text style={s.fLabel}>Aktiv</Text>
                <Switch value={!!form.active}
                  onValueChange={v => setForm({ ...form, active: v })}
                  trackColor={{ false: colors.border, true: colors.primary }} />
              </View>

              <Field label="Beschreibung" v={form.beschreibung || ""} set={(v: string) => setForm({ ...form, beschreibung: v })} />
              <Field label="Datasheet URL (optional)" v={form.datasheet_url || ""} set={(v: string) => setForm({ ...form, datasheet_url: v })} />

              <TouchableOpacity onPress={save} disabled={busy} style={s.saveBtn} testID="save-module">
                {busy ? <ActivityIndicator color="#000" />
                  : <Text style={s.saveBtnT}>{editing ? "Aktualisieren" : "Anlegen"}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, v, set, numeric }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.fLabel}>{label}</Text>
      <TextInput value={v} onChangeText={set} style={s.fInput}
        keyboardType={numeric ? "decimal-pad" : "default"}
        placeholderTextColor={colors.textDisabled} />
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.md, paddingBottom: 8 },
  hubBtn: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.primaryGlow },
  title: { ...typography.h2, fontSize: 22, marginBottom: 2 },
  subtitle: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  adminBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.accent },
  adminBadgeT: { color: "#000", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingBottom: 8, gap: 8 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  toggleT: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  seedBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentGlow },
  seedT: { color: colors.accent, fontSize: 11, fontWeight: "800" },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  hubBtnFull: { padding: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center" },
  hubBtnFullT: { color: "#000", fontWeight: "900" },
  help: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  empty: { padding: 30, alignItems: "center", borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 },
  emptyT: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  emptyS: { color: colors.textSecondary, fontSize: 11, textAlign: "center" },

  row: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  rowLeft: { width: 48 },
  rowIcon: { width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5, position: "relative" },
  ggBadge: { position: "absolute", top: -6, right: -6, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.primary },
  ggBadgeT: { color: "#000", fontSize: 8, fontWeight: "900" },
  rowBrand: { color: colors.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  rowName: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, flexWrap: "wrap" },
  rowSpec: { color: colors.textPrimary, fontSize: 11, fontWeight: "700" },
  rowSep: { color: colors.textDisabled, fontSize: 11 },
  rowDesc: { color: colors.textSecondary, fontSize: 10, marginTop: 2, fontStyle: "italic" },
  rowActions: { flexDirection: "row", gap: 4 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },

  modalC: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "92%", borderWidth: 1, borderBottomWidth: 0, borderColor: colors.borderActive },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalT: { color: colors.textPrimary, fontSize: 18, fontWeight: "900" },
  fLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" },
  fInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.textPrimary, fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipT: { color: colors.textSecondary, fontSize: 11, fontWeight: "800" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  saveBtn: { padding: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", marginTop: 12 },
  saveBtnT: { color: "#000", fontSize: 15, fontWeight: "900", letterSpacing: 0.4 },
});
