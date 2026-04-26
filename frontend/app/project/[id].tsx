import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors, typography, spacing } from "../../src/theme";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../src/api";

const TABS = ["uebersicht", "termine", "aufgaben", "fotos", "tagebuch"] as const;
const TAB_LABEL: any = { uebersicht: "Übersicht", termine: "Termine", aufgaben: "Aufgaben", fotos: "Fotos", tagebuch: "Bautagebuch" };

const STATUS_COLOR: any = { todo: colors.textSecondary, in_progress: colors.secondary, done: colors.primary };
const PRIO_COLOR: any = { low: colors.info, medium: colors.secondary, high: colors.danger };

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [tab, setTab] = useState<string>("uebersicht");
  const [tasks, setTasks] = useState<any[]>([]);
  const [appts, setAppts] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTask, setShowTask] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const load = async () => {
    try {
      const projects = await apiGet<any[]>("/projects");
      setProject(projects.find(p => p.id === id));
      setTasks(await apiGet(`/tasks?project_id=${id}`));
      const allAppts = await apiGet<any[]>("/appointments");
      setAppts(allAppts.filter((a: any) => a.project_id === id));
      setPhotos(await apiGet(`/photos?project_id=${id}`));
      setLogs(await apiGet(`/site-logs?project_id=${id}`));
    } finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, [id]));

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Berechtigung", "Galerie-Zugriff nötig");
    const r = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    try {
      await apiPost("/photos", { project_id: id, image_base64: `data:image/jpeg;base64,${r.assets[0].base64}`, title: `Foto ${new Date().toLocaleDateString("de-DE")}` });
      load();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Berechtigung", "Kamera-Zugriff nötig");
    const r = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    try {
      await apiPost("/photos", { project_id: id, image_base64: `data:image/jpeg;base64,${r.assets[0].base64}`, title: `Vor-Ort-Foto ${new Date().toLocaleString("de-DE")}` });
      load();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
  };

  if (loading || !project) return <ActivityIndicator color={colors.primary} style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.title} numberOfLines={1}>{project.title}</Text>
          <Text style={s.sub}>{project.customer_name || "—"}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabA]}>
            <Text style={[s.tabT, tab === t && { color: "#000" }]}>{TAB_LABEL[t]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        {tab === "uebersicht" && (
          <View>
            <View style={s.card}>
              <Text style={s.label}>STATUS</Text><Text style={s.val}>{project.status}</Text>
              <Text style={s.label}>KWP</Text><Text style={s.val}>{project.kwp || "—"}</Text>
              <Text style={s.label}>WERT</Text><Text style={s.val}>{project.value ? `€ ${project.value.toLocaleString("de-DE")}` : "—"}</Text>
              {project.notes ? (<><Text style={s.label}>NOTIZEN</Text><Text style={s.val}>{project.notes}</Text></>) : null}
            </View>
            <View style={s.statsRow}>
              <Stat label="Termine" v={appts.length} />
              <Stat label="Aufgaben" v={tasks.length} />
              <Stat label="Fotos" v={photos.length} />
              <Stat label="Logs" v={logs.length} />
            </View>
          </View>
        )}

        {tab === "termine" && (appts.length === 0 ? <Empty txt="Keine Termine" /> : appts.map((a: any) => (
          <View key={a.id} style={s.card}>
            <Text style={s.cTitle}>{a.title}</Text>
            <Text style={s.cMeta}>{new Date(a.date).toLocaleString("de-DE")} · {a.type} · {a.status}</Text>
            {a.location ? <Text style={s.cMeta}>📍 {a.location}</Text> : null}
          </View>
        )))}

        {tab === "aufgaben" && (
          <>
            <TouchableOpacity onPress={() => setShowTask(true)} style={s.fab}><Ionicons name="add" size={18} color="#000" /><Text style={s.fabT}>Neue Aufgabe</Text></TouchableOpacity>
            {tasks.length === 0 ? <Empty txt="Keine Aufgaben" /> : tasks.map((t: any) => (
              <TouchableOpacity key={t.id} style={s.card} onPress={async () => {
                const next: any = { todo: "in_progress", in_progress: "done", done: "todo" };
                await apiPatch(`/tasks/${t.id}`, { status: next[t.status] });
                load();
              }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name={t.status === "done" ? "checkmark-circle" : t.status === "in_progress" ? "ellipse" : "ellipse-outline"} size={22} color={STATUS_COLOR[t.status]} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[s.cTitle, t.status === "done" && { textDecorationLine: "line-through", color: colors.textSecondary }]}>{t.title}</Text>
                    {t.description ? <Text style={s.cMeta}>{t.description}</Text> : null}
                  </View>
                  <View style={[s.prioBadge, { borderColor: PRIO_COLOR[t.priority] }]}>
                    <Text style={[s.prioT, { color: PRIO_COLOR[t.priority] }]}>{t.priority}</Text>
                  </View>
                  <TouchableOpacity onPress={async () => { await apiDelete(`/tasks/${t.id}`); load(); }}><Ionicons name="trash" size={16} color={colors.danger} /></TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === "fotos" && (
          <>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity onPress={takePhoto} style={s.fab}><Ionicons name="camera" size={18} color="#000" /><Text style={s.fabT}>Foto aufnehmen</Text></TouchableOpacity>
              <TouchableOpacity onPress={pickImage} style={[s.fab, { backgroundColor: colors.elevated }]}><Ionicons name="images" size={18} color={colors.primary} /><Text style={[s.fabT, { color: colors.primary }]}>Galerie</Text></TouchableOpacity>
            </View>
            {photos.length === 0 ? <Empty txt="Noch keine Fotos" /> : (
              <View style={s.photoGrid}>
                {photos.map((p: any) => (
                  <TouchableOpacity key={p.id} style={s.photoBox} onLongPress={() => Alert.alert("Löschen?", p.title, [{ text: "Abbrechen" }, { text: "Löschen", style: "destructive", onPress: async () => { await apiDelete(`/photos/${p.id}`); load(); } }])}>
                    <Image source={{ uri: p.image_base64 }} style={s.photoImg} />
                    {p.title ? <Text style={s.photoT} numberOfLines={1}>{p.title}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {tab === "tagebuch" && (
          <>
            <TouchableOpacity onPress={() => setShowLog(true)} style={s.fab}><Ionicons name="add" size={18} color="#000" /><Text style={s.fabT}>Neuer Eintrag</Text></TouchableOpacity>
            {logs.length === 0 ? <Empty txt="Bautagebuch ist leer" /> : logs.map((l: any) => (
              <View key={l.id} style={s.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={s.cTitle}>{new Date(l.log_date).toLocaleDateString("de-DE")}</Text>
                  <TouchableOpacity onPress={async () => { await apiDelete(`/site-logs/${l.id}`); load(); }}><Ionicons name="trash" size={16} color={colors.danger} /></TouchableOpacity>
                </View>
                <Text style={s.cMeta}>{l.created_by_name} {l.weather ? `· ☁ ${l.weather}` : ""} {l.workers_count ? `· 👷 ${l.workers_count}` : ""}</Text>
                <Section label="✓ Ausgeführt" txt={l.work_done} />
                {l.issues ? <Section label="⚠ Probleme" txt={l.issues} /> : null}
                {l.next_steps ? <Section label="→ Nächste Schritte" txt={l.next_steps} /> : null}
                {l.safety_notes ? <Section label="⛑ Sicherheit" txt={l.safety_notes} /> : null}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <NewTaskModal visible={showTask} projectId={id!} onClose={() => { setShowTask(false); load(); }} />
      <NewLogModal visible={showLog} projectId={id!} onClose={() => { setShowLog(false); load(); }} />
    </SafeAreaView>
  );
}

function Stat({ label, v }: any) { return <View style={s.stat}><Text style={s.statV}>{v}</Text><Text style={s.statL}>{label}</Text></View>; }
function Empty({ txt }: any) { return <View style={{ padding: 40, alignItems: "center" }}><Text style={{ color: colors.textDisabled, fontStyle: "italic" }}>{txt}</Text></View>; }
function Section({ label, txt }: any) { return <View style={{ marginTop: 8 }}><Text style={s.label}>{label}</Text><Text style={s.val}>{txt}</Text></View>; }

function NewTaskModal({ visible, projectId, onClose }: any) {
  const [title, setTitle] = useState(""); const [desc, setDesc] = useState(""); const [prio, setPrio] = useState("medium");
  const save = async () => {
    if (!title) return Alert.alert("Fehler", "Titel erforderlich");
    await apiPost("/tasks", { project_id: projectId, title, description: desc, priority: prio, status: "todo" });
    setTitle(""); setDesc(""); onClose();
  };
  return <Modal visible={visible} animationType="slide" transparent><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}><View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" }} /><View style={mm.sheet}><View style={mm.head}><Text style={typography.h3}>Neue Aufgabe</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textPrimary} /></TouchableOpacity></View><Text style={mm.l}>TITEL</Text><TextInput style={mm.i} value={title} onChangeText={setTitle} /><Text style={mm.l}>BESCHREIBUNG</Text><TextInput style={[mm.i, { height: 80 }]} value={desc} onChangeText={setDesc} multiline /><Text style={mm.l}>PRIORITÄT</Text><View style={{ flexDirection: "row", gap: 8 }}>{["low","medium","high"].map(p => <TouchableOpacity key={p} onPress={() => setPrio(p)} style={[mm.chip, prio === p && { backgroundColor: PRIO_COLOR[p], borderColor: PRIO_COLOR[p] }]}><Text style={[mm.chipT, prio === p && { color: "#000" }]}>{p}</Text></TouchableOpacity>)}</View><TouchableOpacity onPress={save} style={mm.btn}><Text style={mm.btnT}>Anlegen</Text></TouchableOpacity></View></KeyboardAvoidingView></Modal>;
}

function NewLogModal({ visible, projectId, onClose }: any) {
  const [work, setWork] = useState(""); const [issues, setIssues] = useState(""); const [next, setNext] = useState(""); const [safety, setSafety] = useState(""); const [weather, setWeather] = useState(""); const [workers, setWorkers] = useState("");
  const save = async () => {
    if (!work) return Alert.alert("Fehler", "Ausgeführte Arbeit erforderlich");
    await apiPost("/site-logs", { project_id: projectId, log_date: new Date().toISOString(), work_done: work, issues, next_steps: next, safety_notes: safety, weather, workers_count: workers ? parseInt(workers) : null });
    setWork(""); setIssues(""); setNext(""); setSafety(""); setWeather(""); setWorkers(""); onClose();
  };
  return <Modal visible={visible} animationType="slide" transparent><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}><View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" }} /><View style={mm.sheet}><View style={mm.head}><Text style={typography.h3}>Bautagebuch-Eintrag</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textPrimary} /></TouchableOpacity></View><ScrollView><View style={{ flexDirection: "row", gap: 10 }}><View style={{ flex: 1 }}><Text style={mm.l}>WETTER</Text><TextInput style={mm.i} value={weather} onChangeText={setWeather} placeholder="z.B. sonnig 22°C" placeholderTextColor={colors.textDisabled} /></View><View style={{ flex: 1 }}><Text style={mm.l}>ARBEITER</Text><TextInput style={mm.i} value={workers} onChangeText={setWorkers} keyboardType="number-pad" /></View></View><Text style={mm.l}>✓ AUSGEFÜHRTE ARBEITEN *</Text><TextInput style={[mm.i, { height: 80 }]} value={work} onChangeText={setWork} multiline /><Text style={mm.l}>⚠ PROBLEME / ABWEICHUNGEN</Text><TextInput style={[mm.i, { height: 60 }]} value={issues} onChangeText={setIssues} multiline /><Text style={mm.l}>→ NÄCHSTE SCHRITTE</Text><TextInput style={[mm.i, { height: 60 }]} value={next} onChangeText={setNext} multiline /><Text style={mm.l}>⛑ SICHERHEITSHINWEISE</Text><TextInput style={[mm.i, { height: 60 }]} value={safety} onChangeText={setSafety} multiline /><TouchableOpacity onPress={save} style={mm.btn}><Text style={mm.btnT}>Eintrag speichern</Text></TouchableOpacity></ScrollView></View></KeyboardAvoidingView></Modal>;
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  tabs: { padding: spacing.md, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  tabA: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabT: { color: colors.textSecondary, fontWeight: "700", fontSize: 12 },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  cTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 15, flex: 1 },
  cMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 8 },
  val: { color: colors.textPrimary, fontSize: 14, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  stat: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  statV: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  statL: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 },
  fab: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 10, backgroundColor: colors.primary, marginBottom: 12, flex: 1 },
  fabT: { color: "#000", fontWeight: "700" },
  prioBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  prioT: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoBox: { width: "48%", aspectRatio: 1, borderRadius: 10, overflow: "hidden", backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  photoImg: { width: "100%", height: "100%" },
  photoT: { position: "absolute", bottom: 0, left: 0, right: 0, color: "#fff", fontSize: 10, padding: 4, backgroundColor: "rgba(0,0,0,0.7)" },
});
const mm = StyleSheet.create({
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "90%", borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  l: { fontSize: 11, color: colors.textSecondary, fontWeight: "700", letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  i: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.textPrimary, fontSize: 15 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  chipT: { color: colors.textSecondary, fontWeight: "700", fontSize: 12, textTransform: "uppercase" },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 24, marginBottom: 24 },
  btnT: { color: "#000", fontWeight: "700", fontSize: 16 },
});
