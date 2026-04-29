import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography, spacing } from "../src/theme";
import { useAuth } from "../src/auth";
import { Ionicons } from "@expo/vector-icons";
import { SolarMitteLogo } from "../src/SolarMitteLogo";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@solar-mitte.de");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle = async () => {
    setError(""); setLoading(true);
    try { await login(email.trim().toLowerCase(), password); }
    catch (e: any) { setError(e.message || "Fehler"); }
    finally { setLoading(false); }
  };

  const fill = (e: string, p: string) => { setEmail(e); setPassword(p); };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Hero mit Logo */}
          <View style={styles.hero}>
            {/* Glow-Effekte */}
            <View style={[styles.glow, styles.glowGreen]} />
            <View style={[styles.glow, styles.glowYellow]} />

            <View style={styles.logoWrap}>
              <SolarMitteLogo size={150} />
            </View>

            <Text style={styles.brand}>SOLAR MITTE</Text>
            <Text style={styles.tag}>CRM & Field-Service-Plattform</Text>

            <View style={styles.brandLine}>
              <View style={[styles.brandDot, { backgroundColor: colors.primary }]} />
              <View style={[styles.brandDot, { backgroundColor: colors.accent }]} />
              <View style={[styles.brandDot, { backgroundColor: colors.primary }]} />
            </View>
          </View>

          {/* Login-Form */}
          <View style={styles.form}>
            <Text style={[typography.h2, { marginBottom: 4 }]}>Anmelden</Text>
            <Text style={[typography.body2, { marginBottom: spacing.lg }]}>
              Willkommen zurück bei Ihrem Solar OS.
            </Text>

            <Text style={styles.label}>E-MAIL</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail" size={16} color={colors.textSecondary} />
              <TextInput
                testID="login-email-input"
                style={styles.input}
                value={email} onChangeText={setEmail}
                placeholder="name@solar-mitte.de"
                placeholderTextColor={colors.textDisabled}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <Text style={styles.label}>PASSWORT</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />
              <TextInput
                testID="login-password-input"
                style={styles.input}
                value={password} onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textDisabled}
                secureTextEntry
              />
            </View>

            {error ? (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errT}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              testID="login-submit-button"
              onPress={handle}
              style={[styles.btn, loading && { opacity: 0.6 }]}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : (
                <>
                  <Text style={styles.btnText}>Anmelden</Text>
                  <Ionicons name="arrow-forward" size={18} color="#000" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>SCHNELLZUGÄNGE</Text>
              <DemoRow label="Admin" email="admin@solar-mitte.de" pw="admin123" onPress={() => fill("admin@solar-mitte.de", "admin123")} />
              <DemoRow label="Vertrieb" email="vertrieb@solar-mitte.de" pw="vertrieb123" onPress={() => fill("vertrieb@solar-mitte.de", "vertrieb123")} />
              <DemoRow label="Monteur" email="monteur@solar-mitte.de" pw="monteur123" onPress={() => fill("monteur@solar-mitte.de", "monteur123")} />
              <DemoRow label="Kunde" email="schmidt@example.de" pw="kunde123" onPress={() => fill("schmidt@example.de", "kunde123")} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DemoRow({ label, email, pw, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.demoRow}>
      <View style={styles.demoLabel}>
        <Text style={styles.demoLabelT}>{label}</Text>
      </View>
      <Text style={styles.demoEmail}>{email}</Text>
      <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  hero: { paddingTop: 28, paddingBottom: 28, alignItems: "center", position: "relative", overflow: "hidden" },
  glow: { position: "absolute", width: 300, height: 300, borderRadius: 150, opacity: 0.1 },
  glowGreen: { backgroundColor: colors.primary, top: -100, left: -50 },
  glowYellow: { backgroundColor: colors.accent, top: -50, right: -80 },
  logoWrap: { padding: 8 },
  brand: { color: colors.textPrimary, fontSize: 30, fontWeight: "900", letterSpacing: 4, marginTop: 12 },
  tag: { color: colors.textSecondary, fontSize: 12, marginTop: 4, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  brandLine: { flexDirection: "row", gap: 6, marginTop: 14 },
  brandDot: { width: 7, height: 7, borderRadius: 4 },

  form: { padding: spacing.lg, paddingTop: 8 },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6, marginTop: spacing.md },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14 },
  input: { flex: 1, color: colors.textPrimary, paddingVertical: 14, fontSize: 16 },

  btn: {
    marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  btnText: { color: "#000", fontWeight: "900", fontSize: 16, letterSpacing: 0.5 },

  errBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md, padding: 10, borderRadius: 8, backgroundColor: `${colors.danger}15`, borderWidth: 1, borderColor: colors.danger },
  errT: { color: colors.danger, fontSize: 13, flex: 1 },

  demoBox: { marginTop: spacing.xl, padding: 14, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  demoTitle: { color: colors.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.8, marginBottom: 10 },
  demoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border },
  demoLabel: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, minWidth: 70, alignItems: "center" },
  demoLabelT: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  demoEmail: { color: colors.textSecondary, fontSize: 12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", flex: 1 },
});
