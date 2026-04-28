/**
 * Monteur-Dashboard — vereinfachte Liste aller zugewiesenen Projekte.
 * Hoch-Kontrast, große Touch-Targets, Sonnenlicht-tauglich.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { monteurColors as C, monteurType as T, TARGET } from "../../src/monteurTheme";
import { apiGet } from "../../src/api";
import { useAuth } from "../../src/auth";
import { getQueue, syncQueue } from "../../src/offlineQueue";

export default function MonteurDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(0);

  const load = async () => {
    try {
      setProjects(await apiGet("/monteur/projects"));
      setPending((await getQueue()).length);
    } catch { /* offline tolerated */ }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const sync = async () => {
    setLoading(true);
    const r = await syncQueue();
    await load();
    setLoading(false);
    if (r.ok > 0 || r.failed > 0) {
      // Visueller Feedback per State (Alert wäre invasiv)
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.greet}>Monteur-Modus</Text>
          <Text style={s.name}>{user?.name}</Text>
        </View>
        {pending > 0 && (
          <TouchableOpacity onPress={sync} style={s.syncBadge}>
            <Ionicons name="cloud-upload" size={16} color={C.warn} />
            <Text style={s.syncT}>{pending}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Ionicons name="log-out" size={22} color={C.text} />
        </TouchableOpacity>
      </View>

      {pending > 0 && (
        <View style={s.offlineBar}>
          <Ionicons name="cloud-upload" size={14} color={C.warn} />
          <Text style={s.offlineT}>{pending} Eintrag(e) warten auf Sync — antippen oben rechts</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={C.primary} size="large" style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={C.primary} />}
          ListEmptyComponent={() => (
            <View style={{ padding: 60, alignItems: "center" }}>
              <Ionicons name="briefcase-outline" size={64} color={C.todo} />
              <Text style={[T.body, { marginTop: 16, color: C.textDim }]}>Keine Projekte zugewiesen</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`project-${item.id}`}
              style={[s.card, item.has_customer_sig && s.cardDone]}
              onPress={() => router.push(`/monteur/${item.id}`)}
            >
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>{item.title}</Text>
                {item.has_customer_sig && (
                  <View style={s.doneBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={C.bg} />
                    <Text style={s.doneT}>ABGENOMMEN</Text>
                  </View>
                )}
              </View>
              <View style={s.metaRow}>
                <Ionicons name="person" size={14} color={C.textDim} />
                <Text style={s.meta}>{item.customer_name || "—"}</Text>
                <Text style={s.metaSep}>·</Text>
                <Ionicons name="location" size={14} color={C.textDim} />
                <Text style={s.meta}>{item.customer_city || "—"}</Text>
              </View>
              {item.kwp && (
                <View style={s.metaRow}>
                  <Ionicons name="flash" size={14} color={C.primary} />
                  <Text style={[s.meta, { color: C.primary, fontWeight: "800" }]}>{item.kwp} kWp</Text>
                </View>
              )}

              {/* Progress Bar */}
              <View style={s.progressWrap}>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${item.progress_pct}%` }]} />
                </View>
                <Text style={s.progressT}>
                  {item.progress_done}/{item.progress_total} · {item.progress_pct}%
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", padding: 16, paddingBottom: 12 },
  greet: { color: C.warn, fontSize: 12, letterSpacing: 1.5, fontWeight: "800" },
  name: { color: C.text, fontSize: 26, fontWeight: "900", marginTop: 2 },
  syncBadge: { flexDirection: "row", alignItems: "center", gap: 4, padding: 10, borderRadius: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.warn, marginRight: 8 },
  syncT: { color: C.warn, fontWeight: "800", fontSize: 14 },
  logoutBtn: { width: TARGET, height: TARGET, borderRadius: 12, backgroundColor: C.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.borderSoft },
  offlineBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: `${C.warn}22`, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.warn },
  offlineT: { color: C.text, fontSize: 13, flex: 1 },
  card: { borderRadius: 14, backgroundColor: C.card, borderWidth: 2, borderColor: C.borderSoft, padding: 16, marginBottom: 12 },
  cardDone: { borderColor: C.done },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  cardTitle: { color: C.text, fontSize: 19, fontWeight: "800", flex: 1 },
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.done, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  doneT: { color: C.bg, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  meta: { color: C.textDim, fontSize: 14 },
  metaSep: { color: C.textDim, marginHorizontal: 6 },
  progressWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.borderSoft },
  progressTrack: { height: 8, backgroundColor: C.borderSoft, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: C.done },
  progressT: { color: C.text, fontSize: 12, fontWeight: "700", marginTop: 6 },
});
