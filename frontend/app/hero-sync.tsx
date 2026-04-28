/**
 * HERO Sync — Admin-only Screen.
 * Pull Projekt via HERO-ID · Push Angebote/Protokolle · Sync-Log.
 *
 * Hinweis: HERO läuft derzeit als MOCK (kein API-Key konfiguriert).
 * Banner weist klar darauf hin.
 */
import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../src/theme";
import { apiGet, apiPost } from "../src/api";

export default function HeroSync() {
  const router = useRouter();
  const [health, setHealth] = useState<any>(null);
  const [heroId, setHeroId] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<any[]>([]);
  const [lastPull, setLastPull] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);

  const load = async () => {
    try {
      setHealth(await apiGet("/hero/health"));
      setLog(await apiGet("/hero/sync-log"));
      setQuotes(await apiGet("/quotes"));
    } catch { }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const pull = async () => {
    if (!heroId.trim()) return Alert.alert("Fehlt", "HERO-Projekt-ID eingeben");
    setBusy(true);
    try {
      const r = await apiPost<any>("/hero/pull-project", { hero_project_id: heroId.trim() });
      setLastPull(r);
      Alert.alert("Erfolg", `Projekt ${heroId} importiert. Customer: ${r.customer_id.slice(0, 8)}... · Project: ${r.project_id.slice(0, 8)}...${r.mock ? "\n\n⚠ MOCK-Modus" : ""}`);
      setHeroId("");
      load();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
    finally { setBusy(false); }
  };

  const pushQuote = async (q: any) => {
    // Suche in letzten Pulls nach HERO-ID via Customer
    const heroPid = prompt?.("HERO-Projekt-ID für Angebot eintragen") || await promptAsync("HERO-Projekt-ID für dieses Angebot");
    if (!heroPid) return;
    setBusy(true);
    try {
      const r = await apiPost<any>("/hero/push-quote", { quote_id: q.id, hero_project_id: heroPid });
      Alert.alert("Gesendet", `Angebot ${q.quote_number} an HERO ${heroPid}${r._mock ? "\n⚠ MOCK-Modus" : ""}`);
      load();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
    finally { setBusy(false); }
  };

  // Einfacher Alert-basierter Prompt-Polyfill
  const promptAsync = (label: string): Promise<string | null> => new Promise(resolve => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      resolve(window.prompt(label));
    } else {
      // Fallback: zur Eingabe in die HERO-ID-Box leiten
      Alert.alert(label, "Bitte HERO-ID oben im Feld eintragen und erneut Push drücken");
      resolve(null);
    }
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={typography.h3}>HERO Sync</Text>
          <Text style={s.sub}>Bidirektionale Brücke · Solar Mitte ↔ HERO</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          {/* Connection Status */}
          <View style={[s.statusBox, { borderColor: health?.connected ? colors.primary : colors.secondary }]}>
            <Ionicons
              name={health?.connected ? "cloud-done" : "cloud-offline"}
              size={24}
              color={health?.connected ? colors.primary : colors.secondary}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.statusT}>
                {health?.connected ? "HERO VERBUNDEN" : `HERO ${health?.mode || "?"}-MODUS`}
              </Text>
              <Text style={s.statusS}>
                {health?.connected
                  ? "Alle Sync-Aktionen werden live durchgeführt"
                  : "Aufrufe werden gemockt. Konfigurieren Sie HERO_API_URL + HERO_API_KEY in backend/.env"}
              </Text>
            </View>
          </View>

          {/* PULL */}
          <Text style={s.label}>PROJEKT AUS HERO ZIEHEN</Text>
          <View style={s.pullRow}>
            <TextInput
              style={s.input}
              value={heroId}
              onChangeText={setHeroId}
              placeholder="z.B. HRO-2026-0815"
              placeholderTextColor={colors.textDisabled}
              autoCapitalize="characters"
            />
            <TouchableOpacity onPress={pull} disabled={busy || !heroId} style={[s.pullBtn, (busy || !heroId) && { opacity: 0.4 }]}>
              {busy ? <ActivityIndicator color="#000" /> : (
                <>
                  <Ionicons name="download" size={18} color="#000" />
                  <Text style={s.pullT}>Pull</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          <Text style={s.hint}>Holt Kunden + Projekt aus HERO und synchronisiert in Solar Mitte</Text>

          {lastPull?.hero_data && (
            <View style={s.resultBox}>
              <Text style={s.resultHead}>Letzter Pull</Text>
              <Text style={s.resultK}>Kunde: <Text style={s.resultV}>{lastPull.hero_data.customer?.name}</Text></Text>
              <Text style={s.resultK}>Adresse: <Text style={s.resultV}>{lastPull.hero_data.customer?.street}, {lastPull.hero_data.customer?.zip_code} {lastPull.hero_data.customer?.city}</Text></Text>
              <Text style={s.resultK}>Projekt: <Text style={s.resultV}>{lastPull.hero_data.project_name}</Text></Text>
              <Text style={s.resultK}>kWp: <Text style={s.resultV}>{lastPull.hero_data.project?.estimated_kwp}</Text></Text>
              {lastPull.mock && <Text style={s.mockTag}>⚠ MOCK</Text>}
            </View>
          )}

          {/* PUSH Quotes */}
          <Text style={s.label}>ANGEBOTE AN HERO PUSHEN</Text>
          {quotes.length === 0 ? <Text style={s.empty}>Noch keine Angebote vorhanden</Text> : (
            quotes.slice(0, 5).map((q: any) => (
              <View key={q.id} style={s.quoteRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.quoteNr}>{q.quote_number}</Text>
                  <Text style={s.quoteMeta}>{q.customer_snapshot?.name} · € {q.total_net?.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text>
                </View>
                <TouchableOpacity onPress={() => pushQuote(q)} style={s.pushBtn}>
                  <Ionicons name="cloud-upload" size={16} color={colors.primary} />
                  <Text style={s.pushT}>Push</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Sync Log */}
          <Text style={s.label}>SYNC-HISTORIE</Text>
          {log.length === 0 ? <Text style={s.empty}>Noch keine Sync-Aktionen</Text> : log.slice(0, 12).map((x: any) => (
            <View key={x.id} style={s.logRow}>
              <Ionicons
                name={x.direction === "pull" ? "arrow-down-circle" :
                  x.direction.startsWith("push") ? "arrow-up-circle" : "sync"}
                size={18}
                color={x.direction === "pull" ? colors.info : colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.logT}>{x.direction.toUpperCase()} · {x.hero_project_id}</Text>
                <Text style={s.logS}>
                  {new Date(x.created_at).toLocaleString("de-DE")}
                  {x.mock && " · MOCK"}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  statusBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 2 },
  statusT: { color: colors.textPrimary, fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  statusS: { color: colors.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 15 },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 22, marginBottom: 8 },
  pullRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, color: colors.textPrimary, fontSize: 16, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  pullBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.primary, justifyContent: "center" },
  pullT: { color: "#000", fontWeight: "800", fontSize: 14 },
  hint: { color: colors.textDisabled, fontSize: 11, marginTop: 6 },
  resultBox: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  resultHead: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  resultK: { color: colors.textSecondary, fontSize: 12, marginBottom: 3 },
  resultV: { color: colors.textPrimary, fontWeight: "700" },
  mockTag: { marginTop: 6, color: colors.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  empty: { color: colors.textDisabled, fontStyle: "italic", fontSize: 12 },
  quoteRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  quoteNr: { color: colors.textPrimary, fontSize: 14, fontWeight: "800" },
  quoteMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  pushBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.primary },
  pushT: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  logRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8, marginBottom: 4, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  logT: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  logS: { color: colors.textSecondary, fontSize: 10, marginTop: 1 },
});
