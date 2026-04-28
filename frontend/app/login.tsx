import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, typography, spacing } from "../src/theme";
import { useAuth } from "../src/auth";
import { Ionicons } from "@expo/vector-icons";

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

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.heroBox}>
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1726866492047-7f9516558c6e?crop=entropy&cs=srgb&fm=jpg&w=1200&q=75" }}
              style={styles.heroImg}
            />
            <View style={styles.heroOverlay} />
            <View style={styles.heroContent}>
              <View style={styles.logoBox}>
                <Ionicons name="sunny" size={28} color={colors.primary} />
              </View>
              <Text style={styles.brand}>SOLAR MITTE</Text>
              <Text style={styles.tag}>CRM & Dachaufmaß-System</Text>
            </View>
          </View>

          <View style={styles.form}>
            <Text style={[typography.h2, { marginBottom: spacing.xs }]}>Anmelden</Text>
            <Text style={[typography.body2, { marginBottom: spacing.lg }]}>
              Bitte melden Sie sich mit Ihren Zugangsdaten an.
            </Text>

            <Text style={styles.label}>E-MAIL</Text>
            <TextInput
              testID="login-email-input"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@solar-mitte.de"
              placeholderTextColor={colors.textDisabled}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.label}>PASSWORT</Text>
            <TextInput
              testID="login-password-input"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textDisabled}
              secureTextEntry
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              testID="login-submit-button"
              onPress={handle}
              style={[styles.btn, loading && { opacity: 0.6 }]}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.btnText}>Anmelden</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.demoBox}>
              <Text style={styles.demoTitle}>Demo-Zugänge</Text>
              <Text style={styles.demoLine}>admin@solar-mitte.de / admin123</Text>
              <Text style={styles.demoLine}>vertrieb@solar-mitte.de / vertrieb123</Text>
              <Text style={styles.demoLine}>monteur@solar-mitte.de / monteur123</Text>
              <Text style={styles.demoLine}>schmidt@example.de / kunde123</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  heroBox: { height: 240, position: "relative", overflow: "hidden" },
  heroImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.8)" },
  heroContent: { flex: 1, justifyContent: "flex-end", padding: spacing.lg },
  logoBox: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: "rgba(245,158,11,0.15)",
    borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center",
    marginBottom: spacing.sm,
  },
  brand: { fontSize: 28, fontWeight: "800", color: colors.textPrimary, letterSpacing: 2 },
  tag: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  form: { padding: spacing.lg },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: "600", letterSpacing: 1, marginBottom: 6, marginTop: spacing.md },
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 14, color: colors.textPrimary, fontSize: 16,
  },
  btn: {
    marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: 10,
    paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14 },
  demoBox: { marginTop: spacing.xl, padding: spacing.md, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  demoTitle: { color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  demoLine: { color: colors.textSecondary, fontSize: 13, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
});
