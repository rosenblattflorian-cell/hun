/**
 * Kunden-Portal — Rolle "customer".
 * Transparenz: Timeline · Dokumenten-Tresor · Layout-Vorschau · Empfehlung.
 * Ton: elegant, beruhigend, Solar-Mitte-Branding in entspannter Form.
 */
import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Image, Platform, Linking, Share, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, typography, spacing } from "../../src/theme";
import { apiGet } from "../../src/api";
import { useAuth } from "../../src/auth";

export default function KundePortal() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try { setError(null); setData(await apiGet("/portal/my")); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const openPdf = async (path: string) => {
    const token = await AsyncStorage.getItem("access_token");
    const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}${path}`;
    if (Platform.OS === "web") {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await r.blob();
      window.open(window.URL.createObjectURL(blob), "_blank");
    } else {
      await Linking.openURL(`${url}${path.includes("?") ? "&" : "?"}_t=${token}`);
    }
  };

  const shareReferral = async (code: string) => {
    const msg = `Ich bin begeistert von meiner Solar-Mitte PV-Anlage! Mit meinem Code *${code}* bekommst Du bei Solar Mitte einen besonderen Vorteil. https://solar-mitte.de/empfehlung?c=${code}`;
    try {
      if (Platform.OS === "web") {
        if (navigator.share) await navigator.share({ text: msg });
        else { await navigator.clipboard?.writeText(msg); Alert.alert("In Zwischenablage kopiert", code); }
      } else {
        await Share.share({ message: msg });
      }
    } catch { }
  };

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}><ActivityIndicator size="large" color={colors.primary} /></View>;

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: 40, alignItems: "center" }}>
          <Ionicons name="alert-circle" size={48} color={colors.danger} />
          <Text style={[typography.body, { marginTop: 12, textAlign: "center" }]}>{error}</Text>
          <TouchableOpacity onPress={logout} style={s.logoutBtn}><Text style={s.logoutT}>Abmelden</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const project = data?.projects?.[0];
  const referral = data?.referral;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={s.hero}>
          <View style={s.heroGlow} />
          <Text style={s.welcome}>Willkommen zurück</Text>
          <Text style={s.heroName}>{data?.customer?.name || user?.name}</Text>
          {project?.kwp && (
            <View style={s.kwpBadge}>
              <Ionicons name="sunny" size={16} color={colors.primary} />
              <Text style={s.kwpT}>Ihre {project.kwp} kWp PV-Anlage</Text>
            </View>
          )}
          <TouchableOpacity onPress={logout} style={s.logoutFab}>
            <Ionicons name="log-out" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {!project ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <Ionicons name="hourglass" size={48} color={colors.textDisabled} />
            <Text style={[typography.body, { marginTop: 12 }]}>Wir bereiten Ihr Projekt vor.</Text>
            <Text style={[typography.body2, { marginTop: 4 }]}>Bei Fragen erreichen Sie uns unter +49 30 1234567.</Text>
          </View>
        ) : (
          <>
            {/* Preview Image */}
            {project.preview_image ? (
              <View style={s.previewWrap}>
                <Image source={{ uri: project.preview_image }} style={s.preview} resizeMode="cover" />
                <View style={s.previewOverlay}>
                  <Text style={s.previewT}>Ihre Anlage · Ansicht</Text>
                </View>
              </View>
            ) : null}

            {/* Timeline */}
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Ionicons name="git-network" size={18} color={colors.primary} />
                <Text style={s.sectionT}>Projekt-Fortschritt</Text>
              </View>
              <View style={s.timeline}>
                {project.timeline?.map((step: any, i: number) => {
                  const isLast = i === project.timeline.length - 1;
                  return (
                    <View key={step.key} style={s.tlRow}>
                      <View style={s.tlLeft}>
                        <View style={[s.tlDot, step.done && s.tlDotDone]}>
                          {step.done ? <Ionicons name="checkmark" size={16} color="#000" /> :
                            <Ionicons name={step.icon as any} size={14} color={colors.textSecondary} />}
                        </View>
                        {!isLast && <View style={[s.tlLine, step.done && { backgroundColor: colors.primary }]} />}
                      </View>
                      <View style={s.tlContent}>
                        <Text style={[s.tlLabel, step.done && { color: colors.primary, fontWeight: "800" }]}>{step.label}</Text>
                        {step.progress && <Text style={s.tlMeta}>{step.progress} erledigt</Text>}
                        {step.date && <Text style={s.tlDate}>
                          {new Date(step.date).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" })}
                        </Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Documents */}
            <View style={s.section}>
              <View style={s.sectionHead}>
                <Ionicons name="folder" size={18} color={colors.primary} />
                <Text style={s.sectionT}>Dokumenten-Tresor</Text>
              </View>
              {project.documents?.length === 0 ? (
                <Text style={{ color: colors.textDisabled, padding: 8 }}>Dokumente werden in Kürze bereitgestellt</Text>
              ) : project.documents.map((doc: any, i: number) => (
                <TouchableOpacity key={i} style={s.docRow}
                  onPress={() => doc.external ? Linking.openURL(doc.url) : openPdf(doc.download)}>
                  <View style={[s.docIcon, { backgroundColor: `${colors.primary}20` }]}>
                    <Ionicons name={doc.kind === "quote" ? "document-text" :
                                    doc.kind === "protocol" ? "ribbon" : "information-circle"}
                      size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.docL}>{doc.label}</Text>
                    {doc.date && <Text style={s.docD}>{new Date(doc.date).toLocaleDateString("de-DE")}</Text>}
                    {doc.external && <Text style={[s.docD, { color: colors.info }]}>Extern · Hersteller-Seite</Text>}
                  </View>
                  <Ionicons name={doc.external ? "open-outline" : "download"} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ))}
            </View>

            {/* Referral Banner */}
            {referral && (
              <View style={s.refCard}>
                <View style={s.refGlow} />
                <Ionicons name="gift" size={28} color={colors.primary} />
                <Text style={s.refT}>Freunde empfehlen · Vorteile sichern</Text>
                <Text style={s.refD}>
                  Ihr persönlicher Empfehlungs-Code. Pro vermittelten Vertragsabschluss erhalten Sie und Ihr Freund
                  eine Wartungs-Gutschrift.
                </Text>
                <View style={s.codeBox}>
                  <Text style={s.codeT}>{referral.code}</Text>
                </View>
                <View style={s.refStats}>
                  <View style={s.refStat}>
                    <Text style={s.refSv}>{referral.leads_count}</Text>
                    <Text style={s.refSl}>Empfohlen</Text>
                  </View>
                  <View style={s.refStat}>
                    <Text style={[s.refSv, { color: colors.primary }]}>{referral.converted_count}</Text>
                    <Text style={s.refSl}>Abgeschlossen</Text>
                  </View>
                  <View style={s.refStat}>
                    <Text style={[s.refSv, { color: colors.primary }]}>€ {referral.bonus_eur}</Text>
                    <Text style={s.refSl}>Gutschrift</Text>
                  </View>
                </View>
                <TouchableOpacity style={s.refBtn} onPress={() => shareReferral(referral.code)}>
                  <Ionicons name="share-social" size={18} color="#000" />
                  <Text style={s.refBtnT}>Empfehlungs-Link teilen</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Support Card */}
            <View style={[s.section, { flexDirection: "row", alignItems: "center", gap: 14 }]}>
              <View style={[s.docIcon, { backgroundColor: `${colors.info}22`, borderWidth: 1, borderColor: colors.info }]}>
                <Ionicons name="headset" size={20} color={colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.supportT}>Service & Support</Text>
                <Text style={s.supportD}>+49 30 1234567 · service@solar-mitte.de</Text>
              </View>
              <TouchableOpacity onPress={() => Linking.openURL("tel:+493012345678")}>
                <Ionicons name="call" size={22} color={colors.info} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  hero: { padding: 24, paddingBottom: 20 },
  heroGlow: { position: "absolute", top: -40, right: -60, width: 200, height: 200, borderRadius: 999, backgroundColor: `${colors.primary}22` },
  welcome: { color: colors.textSecondary, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  heroName: { color: colors.textPrimary, fontSize: 28, fontWeight: "900", marginTop: 4, letterSpacing: -0.5 },
  kwpBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: `${colors.primary}20`, borderWidth: 1, borderColor: colors.primary },
  kwpT: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  logoutFab: { position: "absolute", right: 20, top: 24, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  previewWrap: { marginHorizontal: spacing.md, borderRadius: 16, overflow: "hidden", backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, aspectRatio: 16 / 10 },
  preview: { width: "100%", height: "100%" },
  previewOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 10, backgroundColor: "rgba(0,0,0,0.6)" },
  previewT: { color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  section: { margin: spacing.md, padding: 16, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sectionT: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  timeline: { marginLeft: 4 },
  tlRow: { flexDirection: "row", gap: 12 },
  tlLeft: { alignItems: "center", width: 32 },
  tlDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.elevated, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.border },
  tlDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  tlLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2, minHeight: 20 },
  tlContent: { flex: 1, paddingBottom: 16 },
  tlLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: "600", marginTop: 6 },
  tlMeta: { color: colors.primary, fontSize: 12, marginTop: 2, fontWeight: "700" },
  tlDate: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  docRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  docIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  docL: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
  docD: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  refCard: { margin: spacing.md, padding: 20, borderRadius: 16, backgroundColor: colors.paper, borderWidth: 2, borderColor: colors.primary, overflow: "hidden" },
  refGlow: { position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: `${colors.primary}25` },
  refT: { color: colors.textPrimary, fontSize: 18, fontWeight: "900", marginTop: 10 },
  refD: { color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 19 },
  codeBox: { marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.primary, borderStyle: "dashed", alignItems: "center" },
  codeT: { color: colors.primary, fontSize: 24, fontWeight: "900", letterSpacing: 3, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  refStats: { flexDirection: "row", marginTop: 16, gap: 10 },
  refStat: { flex: 1, alignItems: "center", padding: 10, borderRadius: 10, backgroundColor: colors.bg },
  refSv: { color: colors.textPrimary, fontSize: 18, fontWeight: "900" },
  refSl: { color: colors.textSecondary, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
  refBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, padding: 14, borderRadius: 12, backgroundColor: colors.primary },
  refBtnT: { color: "#000", fontWeight: "900", fontSize: 15 },
  supportT: { color: colors.textPrimary, fontSize: 15, fontWeight: "700" },
  supportD: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  logoutBtn: { marginTop: 20, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
  logoutT: { color: colors.textPrimary, fontWeight: "700" },
});
