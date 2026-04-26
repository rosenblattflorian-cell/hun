import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../src/theme";
import { apiGet, apiPost, apiPatch, apiDelete } from "../src/api";

const TYPE_LABEL: any = { installation: "Installation", survey: "Aufmaß", service: "Service", internal: "Intern" };
const TYPE_COLOR: any = { installation: colors.primary, survey: colors.secondary, service: colors.info, internal: "#A855F7" };
const STATUS_LABEL: any = { planned: "Geplant", in_progress: "Läuft", done: "Erledigt", cancelled: "Storniert" };
const STATUS_COLOR: any = { planned: colors.textSecondary, in_progress: colors.secondary, done: colors.primary, cancelled: colors.danger };

export default function Calendar() {
  const router = useRouter();
  const [view, setView] = useState<"day" | "week" | "list">("week");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setItems(await apiGet("/appointments"));
      setCustomers(await apiGet("/customers"));
      setProjects(await apiGet("/projects"));
    } finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const weekStart = (() => { const d = new Date(selectedDate); d.setDate(d.getDate() - d.getDay() + 1); return d; })();
  const weekDays = [...Array(7)].map((_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });

  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const dayItems = (d: Date) => items.filter(it => isSameDay(new Date(it.date), d));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={typography.h3}>Kalender</Text>
        <TouchableOpacity testID="add-appt-btn" style={s.addBtn} onPress={() => setModal(true)}>
          <Ionicons name="add" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {(["day", "week", "list"] as const).map(v => (
          <TouchableOpacity key={v} onPress={() => setView(v)} style={[s.tab, view === v && s.tabA]}>
            <Text style={[s.tabT, view === v && { color: "#000" }]}>{v === "day" ? "Tag" : v === "week" ? "Woche" : "Liste"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>
          {view === "week" && weekDays.map((d, i) => {
            const di = dayItems(d);
            const isToday = isSameDay(d, new Date());
            return (
              <View key={i} style={[s.dayBox, isToday && { borderColor: colors.primary }]}>
                <View style={s.dayHead}>
                  <Text style={[s.dayLabel, isToday && { color: colors.primary }]}>{d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })}</Text>
                  <Text style={s.dayCount}>{di.length}</Text>
                </View>
                {di.length === 0 ? <Text style={s.empty}>—</Text> : di.map(it => <ApptCard key={it.id} item={it} onUpdate={load} />)}
              </View>
            );
          })}

          {view === "day" && (
            <>
              <View style={s.daySel}>
                <TouchableOpacity onPress={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d); }}><Ionicons name="chevron-back" size={22} color={colors.primary} /></TouchableOpacity>
                <Text style={s.daySelT}>{selectedDate.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</Text>
                <TouchableOpacity onPress={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d); }}><Ionicons name="chevron-forward" size={22} color={colors.primary} /></TouchableOpacity>
              </View>
              {dayItems(selectedDate).length === 0 ? <Text style={s.empty}>Keine Termine an diesem Tag</Text> : dayItems(selectedDate).map(it => <ApptCard key={it.id} item={it} onUpdate={load} />)}
            </>
          )}

          {view === "list" && (items.length === 0 ? <Text style={s.empty}>Keine Termine</Text> : items.map(it => <ApptCard key={it.id} item={it} onUpdate={load} />))}
        </ScrollView>
      )}

      <NewApptModal visible={modal} customers={customers} projects={projects} onClose={() => { setModal(false); load(); }} />
    </SafeAreaView>
  );
}

function ApptCard({ item, onUpdate }: any) {
  const next: any = { planned: "in_progress", in_progress: "done", done: "planned" };
  const cycle = async () => {
    await apiPatch(`/appointments/${item.id}`, { status: next[item.status] || "planned" });
    onUpdate();
  };
  return (
    <View style={s.card}>
      <View style={[s.typeBar, { backgroundColor: TYPE_COLOR[item.type] || colors.primary }]} />
      <View style={{ flex: 1, padding: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={s.cTitle}>{item.title}</Text>
          <TouchableOpacity onPress={cycle} style={[s.statusBadge, { borderColor: STATUS_COLOR[item.status], backgroundColor: `${STATUS_COLOR[item.status]}25` }]}>
            <Text style={[s.statusT, { color: STATUS_COLOR[item.status] }]}>{STATUS_LABEL[item.status]}</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.cMeta}>{new Date(item.date).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} · {TYPE_LABEL[item.type]}</Text>
        {item.location ? <Text style={s.cMeta}>📍 {item.location}</Text> : null}
        {item.customer_name ? <Text style={s.cMeta}>👤 {item.customer_name}</Text> : null}
        {item.notes ? <Text style={s.cNotes}>{item.notes}</Text> : null}
        <TouchableOpacity onPress={async () => { await apiDelete(`/appointments/${item.id}`); onUpdate(); }} style={{ alignSelf: "flex-end", marginTop: 6 }}>
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function NewApptModal({ visible, customers, projects, onClose }: any) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
  const [type, setType] = useState("installation");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const save = async () => {
    if (!title) return Alert.alert("Fehler", "Titel erforderlich");
    try {
      await apiPost("/appointments", { title, date: new Date(date).toISOString(), type, customer_id: customerId, project_id: projectId, location, notes, status: "planned" });
      setTitle(""); setLocation(""); setNotes(""); setCustomerId(null); setProjectId(null);
      onClose();
    } catch (e: any) { Alert.alert("Fehler", e.message); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, justifyContent: "flex-end" }}>
        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" }} />
        <View style={m.sheet}>
          <View style={m.head}><Text style={typography.h3}>Neuer Termin</Text><TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={colors.textPrimary} /></TouchableOpacity></View>
          <ScrollView>
            <Text style={m.l}>TITEL</Text><TextInput style={m.i} value={title} onChangeText={setTitle} placeholderTextColor={colors.textDisabled} />
            <Text style={m.l}>DATUM/UHRZEIT (YYYY-MM-DDTHH:MM)</Text><TextInput style={m.i} value={date} onChangeText={setDate} />
            <Text style={m.l}>TYP</Text>
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {Object.keys(TYPE_LABEL).map(t => (
                <TouchableOpacity key={t} onPress={() => setType(t)} style={[m.chip, type === t && { backgroundColor: TYPE_COLOR[t], borderColor: TYPE_COLOR[t] }]}>
                  <Text style={[m.chipT, type === t && { color: "#000" }]}>{TYPE_LABEL[t]}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={m.l}>KUNDE</Text>
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity onPress={() => setCustomerId(null)} style={[m.chip, !customerId && m.chipA]}><Text style={[m.chipT, !customerId && { color: "#000" }]}>—</Text></TouchableOpacity>
              {customers.map((c: any) => <TouchableOpacity key={c.id} onPress={() => setCustomerId(c.id)} style={[m.chip, customerId === c.id && m.chipA]}><Text style={[m.chipT, customerId === c.id && { color: "#000" }]}>{c.name}</Text></TouchableOpacity>)}
            </ScrollView>
            <Text style={m.l}>PROJEKT</Text>
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity onPress={() => setProjectId(null)} style={[m.chip, !projectId && m.chipA]}><Text style={[m.chipT, !projectId && { color: "#000" }]}>—</Text></TouchableOpacity>
              {projects.map((p: any) => <TouchableOpacity key={p.id} onPress={() => setProjectId(p.id)} style={[m.chip, projectId === p.id && m.chipA]}><Text style={[m.chipT, projectId === p.id && { color: "#000" }]}>{p.title}</Text></TouchableOpacity>)}
            </ScrollView>
            <Text style={m.l}>ORT</Text><TextInput style={m.i} value={location} onChangeText={setLocation} />
            <Text style={m.l}>NOTIZEN</Text><TextInput style={[m.i, { height: 80 }]} value={notes} onChangeText={setNotes} multiline />
            <TouchableOpacity onPress={save} style={m.btn}><Text style={m.btnT}>Termin anlegen</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  addBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", padding: spacing.md, gap: 8 },
  tab: { flex: 1, padding: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  tabA: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabT: { color: colors.textSecondary, fontWeight: "700" },
  dayBox: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, marginBottom: 10, backgroundColor: colors.paper },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  dayLabel: { color: colors.textPrimary, fontWeight: "700", fontSize: 13, textTransform: "uppercase" },
  dayCount: { color: colors.textSecondary, fontSize: 12 },
  daySel: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  daySelT: { color: colors.textPrimary, fontWeight: "700", fontSize: 16 },
  empty: { color: colors.textDisabled, fontStyle: "italic", textAlign: "center", paddingVertical: 8, fontSize: 13 },
  card: { flexDirection: "row", borderRadius: 10, backgroundColor: colors.elevated, marginBottom: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  typeBar: { width: 4 },
  cTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 15, flex: 1 },
  cMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  cNotes: { color: colors.textPrimary, fontSize: 13, marginTop: 4, fontStyle: "italic" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  statusT: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
});
const m = StyleSheet.create({
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: "90%", borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  l: { fontSize: 11, color: colors.textSecondary, fontWeight: "700", letterSpacing: 1, marginTop: 12, marginBottom: 6 },
  i: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.textPrimary, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.paper },
  chipA: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipT: { color: colors.textSecondary, fontWeight: "700", fontSize: 12 },
  btn: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginTop: 24, marginBottom: 24 },
  btnT: { color: "#000", fontWeight: "700", fontSize: 16 },
});
