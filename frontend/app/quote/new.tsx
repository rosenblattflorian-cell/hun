import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, typography, spacing } from "../../src/theme";
import { apiGet, apiPost } from "../../src/api";

export default function QuoteWizard() {
  const params = useLocalSearchParams<{ layout?: string; bom?: string }>();
  const router = useRouter();
  const [step, setStep] = useState<"customer" | "options" | "result">("customer");
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [extras, setExtras] = useState("");
  const [discount, setDiscount] = useState("");
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<any>(null);

  const layout = params.layout ? JSON.parse(params.layout as string) : null;
  const bom = params.bom ? JSON.parse(params.bom as string) : null;

  useEffect(() => { apiGet<any[]>("/customers").then(setCustomers).catch(() => { }); }, []);

  const generate = async () => {
    if (!customerId) return Alert.alert("Fehlt", "Bitte einen Kunden auswählen");
    if (!layout || !bom) return Alert.alert("Fehlt", "Planungsdaten fehlen — zurück zum Planning");
    setLoading(true); setStep("result");
    try {
      const r = await apiPost<any>("/quotes/generate", {
        customer_id: customerId, layout, bom, extras, discount_request: discount
      });
      setQuote(r);
    } catch (e: any) { Alert.alert("KI-Fehler", e.message); setStep("options"); }
    finally { setLoading(false); }
  };

  const downloadPdf = async () => {
    if (!quote) return;
    const token = await AsyncStorage.getItem("access_token");
    const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/quotes/${quote.id}/pdf`;
    if (Platform.OS === "web") {
      // Web: fetch + Blob + open
      try {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const blob = await r.blob();
        const link = window.URL.createObjectURL(blob);
        window.open(link, "_blank");
      } catch (e: any) { Alert.alert("Fehler", e.message); }
    } else {
      // Native: open URL with token in query
      const u = `${url}?_t=${token}`;
      const ok = await Linking.canOpenURL(u);
      if (ok) await Linking.openURL(u);
      else Alert.alert("Fehler", "PDF kann nicht geöffnet werden");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={typography.h3}>Angebot erstellen</Text>
          <Text style={s.sub}>{layout ? `${layout.modules_count} Module · ${layout.kwp} kWp` : "—"}</Text>
        </View>
      </View>

      {/* Stepper */}
      <View style={s.stepper}>
        {["Kunde", "Optionen", "Ergebnis"].map((lbl, i) => {
          const active = (step === "customer" && i === 0) || (step === "options" && i === 1) || (step === "result" && i === 2);
          const done = (step === "options" && i < 1) || (step === "result" && i < 2);
          return (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              <View style={[s.stepDot, active && s.stepActive, done && s.stepDone]}>
                {done ? <Ionicons name="checkmark" size={14} color="#000" /> :
                  <Text style={[s.stepNum, active && { color: "#000" }]}>{i + 1}</Text>}
              </View>
              <Text style={[s.stepLabel, active && { color: colors.primary, fontWeight: "800" }]}>{lbl}</Text>
            </View>
          );
        })}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
          {step === "customer" && (
            <>
              <Text style={s.label}>KUNDE AUSWÄHLEN</Text>
              {customers.length === 0 ? <Text style={s.empty}>Lade Kunden...</Text> : customers.map(c => (
                <TouchableOpacity key={c.id} onPress={() => setCustomerId(c.id)}
                  style={[s.custBtn, customerId === c.id && s.custBtnA]}>
                  <View style={[s.avatar, customerId === c.id && { backgroundColor: "#000" }]}>
                    <Ionicons name="person" size={16} color={customerId === c.id ? colors.primary : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.custT, customerId === c.id && { color: "#000" }]}>{c.name}</Text>
                    <Text style={[s.custS, customerId === c.id && { color: "rgba(0,0,0,0.7)" }]}>{c.city || "—"} · {c.stage}</Text>
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setStep("options")} disabled={!customerId}
                style={[s.nextBtn, !customerId && { opacity: 0.4 }]}>
                <Text style={s.nextT}>Weiter</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </TouchableOpacity>
            </>
          )}

          {step === "options" && (
            <>
              <Text style={s.label}>ZUSATZ-WÜNSCHE (KI VERARBEITET FREITEXT)</Text>
              <TextInput style={[s.input, { height: 80 }]} multiline placeholder="z.B. Wallbox 11 kW als Sonderposition aufnehmen, Zählerschrank-Umbau einkalkulieren"
                placeholderTextColor={colors.textDisabled} value={extras} onChangeText={setExtras} />

              <Text style={s.label}>RABATT-WUNSCH</Text>
              <TextInput style={s.input} placeholder="z.B. 5% Rabatt auf Handwerkerleistung, 500€ Kennenlern-Bonus"
                placeholderTextColor={colors.textDisabled} value={discount} onChangeText={setDiscount} />

              <View style={s.aiHint}>
                <Ionicons name="sparkles" size={16} color={colors.primary} />
                <Text style={s.aiHintT}>Claude Sonnet 4.5 strukturiert die BOM in 4 Solar-Mitte-Sektionen, schreibt einen personalisierten Anschreibe-Text und wendet Rabatte korrekt an.</Text>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 24 }}>
                <TouchableOpacity onPress={() => setStep("customer")} style={[s.nextBtn, { backgroundColor: colors.elevated, flex: 1 }]}>
                  <Text style={[s.nextT, { color: colors.primary }]}>Zurück</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={generate} style={[s.nextBtn, { flex: 2 }]}>
                  <Ionicons name="sparkles" size={18} color="#000" />
                  <Text style={s.nextT}>Mit KI generieren</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {step === "result" && (
            <>
              {loading || !quote ? (
                <View style={{ padding: 50, alignItems: "center" }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ color: colors.textPrimary, marginTop: 14, fontSize: 16, fontWeight: "700" }}>KI strukturiert das Angebot...</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 12 }}>Claude analysiert BOM, Validierung & Personalisierung</Text>
                </View>
              ) : (
                <>
                  <View style={s.resultHead}>
                    <View>
                      <Text style={s.qNum}>{quote.quote_number}</Text>
                      <Text style={s.qDate}>{new Date(quote.created_at).toLocaleDateString("de-DE", { dateStyle: "long" })}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={s.qTotal}>€ {quote.structured.total_gross?.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text>
                      <Text style={s.qTotalL}>brutto</Text>
                    </View>
                  </View>

                  <Text style={s.label}>ANSCHREIBEN-ENTWURF</Text>
                  <View style={s.introCard}>
                    <Text style={s.introT}>{quote.structured.intro_text}</Text>
                  </View>

                  <Text style={s.label}>STRUKTURIERTE POSITIONEN</Text>
                  {quote.structured.sections?.filter((sec: any) => sec.items?.length > 0).map((sec: any) => (
                    <View key={sec.code} style={s.secCard}>
                      <View style={s.secHead}>
                        <Text style={s.secCode}>POS. {sec.code}</Text>
                        <Text style={s.secTitle}>{sec.title}</Text>
                        <Text style={s.secCount}>{sec.items.length}</Text>
                      </View>
                      {sec.items.map((it: any, i: number) => (
                        <View key={i} style={s.itemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.itemName}>{it.name}</Text>
                            {it.description ? <Text style={s.itemDesc}>{it.description}</Text> : null}
                          </View>
                          <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                            <Text style={s.itemQty}>{it.qty} {it.unit}</Text>
                            <Text style={s.itemPrice}>€ {(it.total_net || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}

                  <View style={s.totalCard}>
                    <View style={s.totalRow}>
                      <Text style={s.totalL}>Netto</Text>
                      <Text style={s.totalV}>€ {quote.structured.total_net?.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text>
                    </View>
                    {quote.structured.discount_amount > 0 && (
                      <View style={s.totalRow}>
                        <Text style={[s.totalL, { color: colors.primary }]}>Rabatt — {quote.structured.discount_label}</Text>
                        <Text style={[s.totalV, { color: colors.primary }]}>− € {quote.structured.discount_amount?.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text>
                      </View>
                    )}
                    <View style={s.totalRow}>
                      <Text style={s.totalL}>+ 19% USt.</Text>
                      <Text style={s.totalV}>€ {quote.structured.total_vat?.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <View style={[s.totalRow, { borderTopWidth: 2, borderTopColor: colors.primary, paddingTop: 10, marginTop: 6 }]}>
                      <Text style={[s.totalL, { fontSize: 13, fontWeight: "800" }]}>BRUTTO</Text>
                      <Text style={[s.totalV, { color: colors.primary, fontSize: 22 }]}>€ {quote.structured.total_gross?.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
                    <TouchableOpacity onPress={downloadPdf} style={[s.actBtn, { flex: 2 }]}>
                      <Ionicons name="document" size={18} color="#000" />
                      <Text style={s.actT}>PDF öffnen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert("E-Mail", `Funktion ohne SMTP-Config noch deaktiviert. PDF-Download ist verfügbar.`)} style={[s.actBtn, { flex: 1, backgroundColor: colors.elevated }]}>
                      <Ionicons name="mail" size={18} color={colors.primary} />
                      <Text style={[s.actT, { color: colors.primary }]}>E-Mail</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[s.empty, { textAlign: "center", marginTop: 8 }]}>
                    Liefer-/Gültigkeitsangaben & Solar-Mitte-Branding sind im PDF eingebettet.
                  </Text>
                </>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  stepper: { flexDirection: "row", padding: spacing.md, paddingTop: 16, paddingBottom: 16 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  stepActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepNum: { color: colors.textSecondary, fontWeight: "800", fontSize: 12 },
  stepLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 4, fontWeight: "600" },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  empty: { color: colors.textDisabled, fontStyle: "italic", fontSize: 12 },
  custBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  custBtnA: { backgroundColor: colors.primary, borderColor: colors.primary },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  custT: { color: colors.textPrimary, fontWeight: "700", fontSize: 15 },
  custS: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 16, borderRadius: 12, backgroundColor: colors.primary, marginTop: 24 },
  nextT: { color: "#000", fontWeight: "800", fontSize: 15 },
  input: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.textPrimary, fontSize: 14 },
  aiHint: { flexDirection: "row", gap: 10, padding: 12, marginTop: 16, borderRadius: 10, backgroundColor: `${colors.primary}10`, borderWidth: 1, borderColor: colors.primary },
  aiHintT: { color: colors.textPrimary, fontSize: 12, lineHeight: 17, flex: 1 },
  resultHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", padding: 16, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.primary, marginBottom: 8 },
  qNum: { color: colors.primary, fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  qDate: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  qTotal: { color: colors.primary, fontSize: 24, fontWeight: "800" },
  qTotalL: { color: colors.textSecondary, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  introCard: { padding: 14, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  introT: { color: colors.textPrimary, fontSize: 13, lineHeight: 19 },
  secCard: { borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: 8, overflow: "hidden" },
  secHead: { flexDirection: "row", alignItems: "center", padding: 12, gap: 10, backgroundColor: colors.elevated, borderBottomWidth: 1, borderBottomColor: colors.border },
  secCode: { color: colors.primary, fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  secTitle: { color: colors.textPrimary, fontWeight: "700", fontSize: 14, flex: 1 },
  secCount: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  itemRow: { flexDirection: "row", padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemName: { color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  itemDesc: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  itemQty: { color: colors.textSecondary, fontSize: 12, fontWeight: "600" },
  itemPrice: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", marginTop: 2 },
  totalCard: { padding: 14, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  totalL: { color: colors.textSecondary, fontSize: 12 },
  totalV: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
  actBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 14, borderRadius: 10, backgroundColor: colors.primary },
  actT: { color: "#000", fontWeight: "800", fontSize: 14 },
});
