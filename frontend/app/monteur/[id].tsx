/**
 * Monteur Project View — 3 Tabs:
 * 1. CHECKLISTE (BOM-Items zum Abhaken)
 * 2. FOTOS (Quick-Capture mit GPS + Phase + Auto-Tag)
 * 3. ABNAHME (Signaturen + Protokoll-PDF)
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Image, Alert, Platform, Linking, TextInput, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { monteurColors as C, monteurType as T, TARGET } from "../../src/monteurTheme";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../src/api";
import { enqueue, syncQueue } from "../../src/offlineQueue";
import { SignaturePad, SigStroke } from "../../src/SignaturePad";

const PHASE_LABEL: any = {
  ladung: "Ladung", uk: "Unterkonstruktion", module: "Module",
  elektrik: "Elektrik", netz: "Netz & IBN", doku: "Dokumentation",
};
const PHASE_ORDER = ["ladung", "uk", "module", "elektrik", "netz", "doku"];
const PHASE_ICON: any = {
  ladung: "cube", uk: "construct", module: "sunny",
  elektrik: "flash", netz: "git-network", doku: "camera",
};

export default function MonteurProject() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<"check" | "foto" | "abnahme">("check");
  const [project, setProject] = useState<any>(null);
  const [checklist, setChecklist] = useState<any>(null);
  const [photos, setPhotos] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const all = await apiGet<any[]>("/monteur/projects");
      setProject(all.find(p => p.id === id));
      try { setChecklist(await apiGet(`/monteur/checklists/${id}`)); }
      catch { setChecklist(null); }
      setPhotos(await apiGet(`/monteur/site-photos?project_id=${id}`));
      setSignatures(await apiGet(`/monteur/signatures/${id}`));
    } finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, [id]));

  if (loading || !project) {
    return <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}><ActivityIndicator color={C.primary} size="large" /></View>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="arrow-back" size={26} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={s.title} numberOfLines={1}>{project.title}</Text>
          <Text style={s.sub}>{project.customer_name || "—"} · {project.kwp || "?"} kWp</Text>
        </View>
      </View>

      <View style={s.tabs}>
        <TabBtn active={tab === "check"} onPress={() => setTab("check")} icon="list" label="Checkliste" />
        <TabBtn active={tab === "foto"} onPress={() => setTab("foto")} icon="camera" label={`Fotos (${photos.length})`} />
        <TabBtn active={tab === "abnahme"} onPress={() => setTab("abnahme")} icon="document-text" label="Abnahme" />
      </View>

      {tab === "check" && <ChecklistView projectId={id!} checklist={checklist} reload={load} />}
      {tab === "foto" && <PhotoView projectId={id!} photos={photos} reload={load} />}
      {tab === "abnahme" && <AcceptanceView projectId={id!} project={project} signatures={signatures} checklist={checklist} reload={load} />}
    </SafeAreaView>
  );
}

function TabBtn({ active, onPress, icon, label }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.tab, active && s.tabA]}>
      <Ionicons name={icon} size={18} color={active ? C.bg : C.text} />
      <Text style={[s.tabT, active && { color: C.bg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============== CHECKLIST ==============

function ChecklistView({ projectId, checklist, reload }: any) {
  if (!checklist) {
    return (
      <View style={{ padding: 24, alignItems: "center", flex: 1, justifyContent: "center" }}>
        <Ionicons name="alert-circle" size={48} color={C.warn} />
        <Text style={[T.body, { marginTop: 12, textAlign: "center" }]}>
          Keine Checkliste vorhanden. Sie wird automatisch beim Generieren der Stückliste im Planning-Modul erstellt.
        </Text>
        <Text style={[T.label, { marginTop: 16, color: C.textDim }]}>Beispiel-Checkliste anfordern? → Backend: POST /api/monteur/checklists/generate mit BOM</Text>
      </View>
    );
  }

  const items = checklist.items || [];
  const byPhase: any = {};
  items.forEach((it: any) => { byPhase[it.phase] = byPhase[it.phase] || []; byPhase[it.phase].push(it); });

  const toggle = async (item: any) => {
    const newStatus = item.status === "done" ? "todo" : "done";
    try {
      await apiPatch(`/monteur/checklists/${projectId}/item`, { seq: item.seq, status: newStatus });
    } catch {
      // Offline-Queue
      await enqueue({
        endpoint: `/monteur/checklists/${projectId}/item`, method: "PATCH",
        body: { seq: item.seq, status: newStatus },
        label: `Check: ${item.title}`,
      });
    }
    reload();
  };

  const total = items.length;
  const done = items.filter((i: any) => i.status === "done").length;
  const pct = Math.round(done / Math.max(total, 1) * 100);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <View style={chk.summary}>
        <View style={chk.summaryHead}>
          <Text style={chk.summaryV}>{done}<Text style={{ color: C.textDim, fontSize: 18 }}>/{total}</Text></Text>
          <Text style={chk.summaryL}>{pct}% erledigt</Text>
        </View>
        <View style={chk.bar}>
          <View style={[chk.barFill, { width: `${pct}%` }]} />
        </View>
      </View>

      {PHASE_ORDER.filter(p => byPhase[p]).map(phase => {
        const its = byPhase[phase];
        const phDone = its.filter((i: any) => i.status === "done").length;
        return (
          <View key={phase} style={chk.phase}>
            <View style={chk.phaseHead}>
              <Ionicons name={PHASE_ICON[phase] as any} size={20} color={C.warn} />
              <Text style={chk.phaseT}>{PHASE_LABEL[phase]}</Text>
              <Text style={chk.phaseCount}>{phDone}/{its.length}</Text>
            </View>
            {its.map((it: any) => (
              <TouchableOpacity key={it.seq} onPress={() => toggle(it)} style={[chk.item, it.status === "done" && chk.itemDone]}>
                <View style={[chk.box, it.status === "done" && chk.boxDone]}>
                  {it.status === "done" && <Ionicons name="checkmark" size={22} color={C.bg} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[chk.itemT, it.status === "done" && { textDecorationLine: "line-through", color: C.textDim }]}>
                    {it.title}
                  </Text>
                  {it.qty ? <Text style={chk.itemS}>{it.qty} {it.unit || ""}</Text> : null}
                  {it.checked_at ? (
                    <Text style={chk.itemMeta}>✓ {it.checked_by} · {new Date(it.checked_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ============== PHOTO ==============

function PhotoView({ projectId, photos, reload }: any) {
  const [phase, setPhase] = useState("doku");
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    setBusy(true);
    try {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) { Alert.alert("Berechtigung", "Kamera-Zugriff nötig"); return; }
      const r = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
      if (r.canceled || !r.assets?.[0]?.base64) return;

      // GPS holen (optional, nicht blockierend)
      let gps: any = {};
      try {
        const lp = await Location.requestForegroundPermissionsAsync();
        if (lp.granted) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          gps = { gps_lat: loc.coords.latitude, gps_lng: loc.coords.longitude, gps_accuracy: loc.coords.accuracy };
        }
      } catch { }

      const body = {
        project_id: projectId,
        image_base64: `data:image/jpeg;base64,${r.assets[0].base64}`,
        title: `${PHASE_LABEL[phase]} ${new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}`,
        phase,
        ...gps,
      };
      try {
        await apiPost("/monteur/site-photos", body);
      } catch {
        await enqueue({ endpoint: "/monteur/site-photos", method: "POST", body, label: `Foto ${PHASE_LABEL[phase]}` });
      }
      reload();
    } finally { setBusy(false); }
  };

  const aiCheck = async (pid: string) => {
    try {
      const r = await apiPost<any>(`/monteur/site-photos/${pid}/ai-check`, {});
      Alert.alert("KI-Check (Mock)", `Verdict: ${r.verdict.toUpperCase()}\nConfidence: ${(r.confidence * 100).toFixed(0)}%\nErwartet: ${r.expected}\n\n${r.note}`);
      reload();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Text style={[T.label, { marginBottom: 8 }]}>BAU-PHASE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {PHASE_ORDER.map(p => (
          <TouchableOpacity key={p} onPress={() => setPhase(p)} style={[ph.chip, phase === p && ph.chipA]}>
            <Ionicons name={PHASE_ICON[p] as any} size={16} color={phase === p ? C.bg : C.text} />
            <Text style={[ph.chipT, phase === p && { color: C.bg }]}>{PHASE_LABEL[p]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity onPress={capture} disabled={busy} style={ph.captureBtn}>
        {busy ? <ActivityIndicator color={C.bg} /> : (
          <>
            <Ionicons name="camera" size={28} color={C.bg} />
            <Text style={ph.captureT}>FOTO AUFNEHMEN</Text>
          </>
        )}
      </TouchableOpacity>
      <Text style={ph.hint}>Automatisch getagged: GPS, Zeitstempel, Phase</Text>

      {photos.length === 0 ? (
        <View style={{ padding: 40, alignItems: "center" }}>
          <Ionicons name="images-outline" size={48} color={C.todo} />
          <Text style={[T.body, { color: C.textDim, marginTop: 12 }]}>Noch keine Fotos</Text>
        </View>
      ) : (
        <View style={ph.grid}>
          {photos.map((p: any) => (
            <View key={p.id} style={ph.card}>
              <Image source={{ uri: p.image_base64 }} style={ph.img} />
              <View style={ph.cardBody}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={[ph.phaseTag, { backgroundColor: C.warn }]}>
                    <Text style={ph.phaseTagT}>{PHASE_LABEL[p.phase] || p.phase}</Text>
                  </View>
                  <Text style={ph.cardDate}>{new Date(p.created_at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</Text>
                </View>
                <Text style={ph.cardTitle} numberOfLines={1}>{p.title}</Text>
                {p.gps && (
                  <Text style={ph.gps}>📍 {p.gps.lat?.toFixed(4)}, {p.gps.lng?.toFixed(4)} (±{Math.round(p.gps.accuracy || 0)}m)</Text>
                )}
                {p.ai_check ? (
                  <View style={[ph.aiTag, { borderColor: p.ai_check.verdict === "plausibel" ? C.done : C.warn }]}>
                    <Ionicons name="sparkles" size={11} color={p.ai_check.verdict === "plausibel" ? C.done : C.warn} />
                    <Text style={[ph.aiT, { color: p.ai_check.verdict === "plausibel" ? C.done : C.warn }]}>
                      KI: {p.ai_check.verdict} ({Math.round(p.ai_check.confidence * 100)}%)
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => aiCheck(p.id)} style={ph.aiBtn}>
                    <Ionicons name="sparkles" size={12} color={C.warn} />
                    <Text style={ph.aiBtnT}>KI-Check (MOCK)</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ============== ACCEPTANCE ==============

function AcceptanceView({ projectId, project, signatures, checklist, reload }: any) {
  const [custName, setCustName] = useState(project.customer_name || "");
  const [custStrokes, setCustStrokes] = useState<SigStroke[]>([]);
  const [instStrokes, setInstStrokes] = useState<SigStroke[]>([]);
  const [busy, setBusy] = useState(false);

  const items = checklist?.items || [];
  const done = items.filter((i: any) => i.status === "done").length;
  const total = items.length;
  const allDone = total > 0 && done === total;

  const saveSig = async (role: "customer" | "installer", strokes: SigStroke[], name: string) => {
    if (!name) return Alert.alert("Fehlt", "Bitte Name eingeben");
    if (strokes.every(s => s.length < 2)) return Alert.alert("Fehlt", "Bitte unterschreiben");
    setBusy(true);
    try {
      await apiPost("/monteur/signatures", {
        project_id: projectId, role, name,
        strokes, canvas_width: 320, canvas_height: 180,
      });
      Alert.alert("Gespeichert", `Unterschrift ${role === "customer" ? "Kunde" : "Monteur"} erfasst`);
      reload();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
    finally { setBusy(false); }
  };

  const downloadProtocol = async () => {
    const token = await AsyncStorage.getItem("access_token");
    const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/monteur/protocols/${projectId}/pdf`;
    if (Platform.OS === "web") {
      try {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await r.blob();
        const link = window.URL.createObjectURL(blob);
        window.open(link, "_blank");
      } catch (e: any) { Alert.alert("Fehler", e.message); }
    } else {
      await Linking.openURL(`${url}?_t=${token}`);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {!allDone && total > 0 && (
          <View style={ac.warn}>
            <Ionicons name="alert-circle" size={20} color={C.warn} />
            <Text style={[T.body, { fontSize: 14, flex: 1 }]}>
              {total - done} von {total} Punkten der Checkliste sind noch offen. Abnahme erst nach Fertigstellung empfohlen.
            </Text>
          </View>
        )}

        <Text style={[T.label, { marginTop: 8 }]}>UNTERSCHRIFT KUNDE</Text>
        {signatures.customer ? (
          <View style={ac.signed}>
            <Ionicons name="checkmark-circle" size={32} color={C.done} />
            <View style={{ flex: 1 }}>
              <Text style={ac.signedT}>{signatures.customer.name}</Text>
              <Text style={ac.signedS}>unterschrieben am {new Date(signatures.customer.signed_at).toLocaleString("de-DE")}</Text>
            </View>
          </View>
        ) : (
          <>
            <TextInput style={ac.input} placeholder="Name des Kunden" placeholderTextColor={C.textDim}
              value={custName} onChangeText={setCustName} />
            <View style={{ marginTop: 8 }}>
              <SignaturePad onChange={(s) => setCustStrokes(s)} width={320} height={180} />
            </View>
            <TouchableOpacity onPress={() => saveSig("customer", custStrokes, custName)} disabled={busy} style={ac.signBtn}>
              <Ionicons name="create" size={20} color={C.bg} />
              <Text style={ac.signT}>Kunden-Unterschrift speichern</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={[T.label, { marginTop: 24 }]}>UNTERSCHRIFT MONTEUR</Text>
        {signatures.installer ? (
          <View style={ac.signed}>
            <Ionicons name="checkmark-circle" size={32} color={C.done} />
            <View style={{ flex: 1 }}>
              <Text style={ac.signedT}>{signatures.installer.name}</Text>
              <Text style={ac.signedS}>unterschrieben am {new Date(signatures.installer.signed_at).toLocaleString("de-DE")}</Text>
            </View>
          </View>
        ) : (
          <>
            <SignaturePad onChange={(s) => setInstStrokes(s)} width={320} height={180} />
            <TouchableOpacity onPress={() => saveSig("installer", instStrokes, "Tom Bauer")} disabled={busy} style={ac.signBtn}>
              <Ionicons name="create" size={20} color={C.bg} />
              <Text style={ac.signT}>Monteur-Unterschrift speichern</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={downloadProtocol} style={ac.pdfBtn}>
          <Ionicons name="document-text" size={24} color={C.bg} />
          <Text style={ac.pdfT}>ABNAHMEPROTOKOLL ÖFFNEN</Text>
        </TouchableOpacity>
        <Text style={ac.hint}>
          Enthält: Eckdaten · Checkliste mit Zeitstempeln · Foto-Doku mit GPS · Beide Unterschriften · Solar-Mitte-Briefkopf
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============== STYLES ==============
const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  back: { width: TARGET, height: TARGET, borderRadius: 12, backgroundColor: C.card, alignItems: "center", justifyContent: "center" },
  title: { color: C.text, fontSize: 20, fontWeight: "900" },
  sub: { color: C.textDim, fontSize: 13, marginTop: 2 },
  tabs: { flexDirection: "row", padding: 12, gap: 6 },
  tab: { flex: 1, height: TARGET, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderSoft, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  tabA: { backgroundColor: C.primary, borderColor: C.primary },
  tabT: { color: C.text, fontWeight: "800", fontSize: 13 },
});

const chk = StyleSheet.create({
  summary: { padding: 16, borderRadius: 14, backgroundColor: C.card, borderWidth: 2, borderColor: C.warn, marginBottom: 16 },
  summaryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  summaryV: { color: C.done, fontSize: 36, fontWeight: "900" },
  summaryL: { color: C.textDim, fontSize: 14, fontWeight: "700" },
  bar: { marginTop: 10, height: 10, backgroundColor: C.borderSoft, borderRadius: 5, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: C.done, borderRadius: 5 },
  phase: { marginBottom: 16, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderSoft, overflow: "hidden" },
  phaseHead: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10, backgroundColor: C.borderSoft },
  phaseT: { color: C.warn, fontSize: 14, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", flex: 1 },
  phaseCount: { color: C.textDim, fontSize: 13, fontWeight: "800" },
  item: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderBottomWidth: 1, borderBottomColor: C.borderSoft, minHeight: TARGET },
  itemDone: { backgroundColor: `${C.done}10` },
  box: { width: 30, height: 30, borderRadius: 6, borderWidth: 2, borderColor: C.todo, alignItems: "center", justifyContent: "center" },
  boxDone: { backgroundColor: C.done, borderColor: C.done },
  itemT: { color: C.text, fontSize: 16, fontWeight: "700" },
  itemS: { color: C.textDim, fontSize: 13, marginTop: 2 },
  itemMeta: { color: C.done, fontSize: 11, marginTop: 4, fontWeight: "700" },
});

const ph = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: TARGET - 8, borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderSoft },
  chipA: { backgroundColor: C.warn, borderColor: C.warn },
  chipT: { color: C.text, fontWeight: "800", fontSize: 13 },
  captureBtn: { marginTop: 16, height: 80, borderRadius: 14, backgroundColor: C.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 12 },
  captureT: { color: C.bg, fontWeight: "900", fontSize: 18, letterSpacing: 1 },
  hint: { color: C.textDim, fontSize: 12, marginTop: 6, textAlign: "center" },
  grid: { marginTop: 20, gap: 12 },
  card: { borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.borderSoft, overflow: "hidden" },
  img: { width: "100%", aspectRatio: 4 / 3, backgroundColor: "#000" },
  cardBody: { padding: 12 },
  phaseTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  phaseTagT: { color: C.bg, fontSize: 10, fontWeight: "900" },
  cardDate: { color: C.textDim, fontSize: 11 },
  cardTitle: { color: C.text, fontSize: 14, fontWeight: "700", marginTop: 6 },
  gps: { color: C.textDim, fontSize: 11, marginTop: 4 },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: C.borderSoft, alignSelf: "flex-start" },
  aiBtnT: { color: C.warn, fontSize: 11, fontWeight: "800" },
  aiTag: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, alignSelf: "flex-start" },
  aiT: { fontSize: 11, fontWeight: "800" },
});

const ac = StyleSheet.create({
  warn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginBottom: 16, borderRadius: 10, backgroundColor: `${C.warn}22`, borderWidth: 1, borderColor: C.warn },
  signed: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 12, backgroundColor: `${C.done}18`, borderWidth: 2, borderColor: C.done },
  signedT: { color: C.text, fontSize: 16, fontWeight: "800" },
  signedS: { color: C.textDim, fontSize: 12, marginTop: 2 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.borderSoft, borderRadius: 10, padding: 14, color: C.text, fontSize: 16, marginBottom: 8, minHeight: TARGET },
  signBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, height: TARGET, borderRadius: 12, backgroundColor: C.primary },
  signT: { color: C.bg, fontWeight: "900", fontSize: 14 },
  pdfBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 28, height: 72, borderRadius: 14, backgroundColor: C.warn },
  pdfT: { color: C.bg, fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  hint: { color: C.textDim, fontSize: 12, marginTop: 8, textAlign: "center", lineHeight: 17 },
});
