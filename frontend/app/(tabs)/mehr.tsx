import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../../src/theme";
import { apiPost, apiGet } from "../../src/api";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../../src/auth";

export default function Mehr() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<"menu" | "ai">("menu");

  if (view === "ai") return <AIChat onBack={() => setView("menu")} />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <Text style={typography.h2}>Mehr</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <View style={s.profile}>
          <View style={s.avatar}>
            <Ionicons name="person" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.name}</Text>
            <Text style={s.role}>{user?.email}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleT}>{(user?.role || "").toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          testID="export-data-btn"
          style={s.item}
          onPress={async () => {
            try {
              const data = await apiGet<any>("/export/all");
              const json = JSON.stringify(data, null, 2);
              await Clipboard.setStringAsync(json);
              Alert.alert(
                "Daten-Export erfolgreich",
                `${data.counts.customers} Kunden, ${data.counts.roof_audits} Aufmaße, ${data.counts.projects} Projekte, ${data.counts.appointments} Termine wurden in die Zwischenablage kopiert (JSON).`
              );
            } catch (e: any) { Alert.alert("Fehler", e.message); }
          }}
        >
          <View style={[s.iconBox, { backgroundColor: `${colors.info}22`, borderColor: colors.info }]}>
            <Ionicons name="download" size={20} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemT}>Daten exportieren</Text>
            <Text style={s.itemS}>Alle Kunden, Aufmaße, Projekte als JSON</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="open-inventory"
          style={s.item}
          onPress={() => (require("expo-router").router as any).push("/inventory")}
        >
          <View style={[s.iconBox, { backgroundColor: `${colors.secondary}22`, borderColor: colors.secondary }]}>
            <Ionicons name="cube" size={20} color={colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemT}>Inventar</Text>
            <Text style={s.itemS}>Module · Wechselrichter · Speicher · K2 · Kompatibilitäten</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="open-calendar"
          style={s.item}
          onPress={() => (require("expo-router").router as any).push("/calendar")}
        >
          <View style={[s.iconBox, { backgroundColor: `${colors.info}22`, borderColor: colors.info }]}>
            <Ionicons name="calendar" size={20} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemT}>Kalender & Termine</Text>
            <Text style={s.itemS}>Tag · Woche · Liste · Bautagebuch</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={s.item} onPress={() => setView("ai")} testID="open-ai-chat">
          <View style={[s.iconBox, { backgroundColor: `${colors.primary}22`, borderColor: colors.primary }]}>
            <Ionicons name="sparkles" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemT}>KI-Assistent</Text>
            <Text style={s.itemS}>Kundenanfragen & Angebotstexte schreiben</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={s.item}>
          <View style={[s.iconBox, { backgroundColor: `${colors.secondary}22`, borderColor: colors.secondary }]}>
            <Ionicons name="business" size={20} color={colors.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemT}>Unternehmen</Text>
            <Text style={s.itemS}>Solar Mitte GmbH</Text>
          </View>
        </View>

        <View style={s.item}>
          <View style={[s.iconBox, { backgroundColor: `${colors.info}22`, borderColor: colors.info }]}>
            <Ionicons name="information-circle" size={20} color={colors.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemT}>Version</Text>
            <Text style={s.itemS}>1.0.0</Text>
          </View>
        </View>

        <TouchableOpacity
          testID="logout-btn"
          style={[s.item, { borderColor: colors.danger }]}
          onPress={() => Alert.alert("Abmelden", "Wirklich abmelden?", [
            { text: "Abbrechen" },
            { text: "Abmelden", onPress: logout, style: "destructive" },
          ])}
        >
          <View style={[s.iconBox, { backgroundColor: `${colors.danger}22`, borderColor: colors.danger }]}>
            <Ionicons name="log-out" size={20} color={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.itemT, { color: colors.danger }]}>Abmelden</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function AIChat({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "assistant", content: "Hallo! Ich bin Ihr KI-Assistent von Solar Mitte. Wie kann ich Ihnen helfen? Ich kann zum Beispiel Angebotstexte entwerfen, technische Fragen zu PV-Anlagen beantworten oder Kunden-E-Mails formulieren." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [sessionId] = useState(() => `chat-${Date.now()}`);

  useEffect(() => { setTimeout(() => scrollRef.current?.scrollToEnd(), 100); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await apiPost<{ response: string }>("/ai/chat", { session_id: sessionId, message: msg });
      setMessages(m => [...m, { role: "assistant", content: res.response }]);
    } catch (e: any) {
      setMessages(m => [...m, { role: "assistant", content: `Fehler: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={ai.head}>
        <TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={ai.title}>KI-Assistent</Text>
          <Text style={ai.sub}>Claude Sonnet 4.5 · Online</Text>
        </View>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.secondary }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.md, gap: 10 }}>
          {messages.map((m, i) => (
            <View key={i} style={[ai.msg, m.role === "user" ? ai.user : ai.bot]}>
              <Text style={[ai.msgT, m.role === "user" && { color: "#fff" }]}>{m.content}</Text>
            </View>
          ))}
          {loading && (
            <View style={[ai.msg, ai.bot, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={ai.msgT}>Tippt...</Text>
            </View>
          )}
        </ScrollView>
        <View style={ai.inputBar}>
          <TextInput
            testID="ai-input"
            style={ai.input}
            value={input}
            onChangeText={setInput}
            placeholder="Nachricht eingeben..."
            placeholderTextColor={colors.textSecondary}
            multiline
          />
          <TouchableOpacity testID="ai-send" style={ai.sendBtn} onPress={send} disabled={loading}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { padding: spacing.lg, paddingBottom: spacing.sm },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, padding: spacing.md, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
  name: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" },
  role: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  roleBadge: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: `${colors.primary}22`, borderWidth: 1, borderColor: colors.primary },
  roleT: { color: colors.primary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  item: { flexDirection: "row", alignItems: "center", gap: 14, padding: spacing.md, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  itemT: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  itemS: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
});

const ai = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.paper },
  title: { ...typography.h3, fontSize: 18 },
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  msg: { maxWidth: "85%", padding: 12, borderRadius: 14 },
  user: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bot: { alignSelf: "flex-start", backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  msgT: { color: colors.textPrimary, fontSize: 15, lineHeight: 22 },
  inputBar: { flexDirection: "row", padding: spacing.md, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.paper, alignItems: "flex-end" },
  input: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: colors.textPrimary, maxHeight: 120, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});
