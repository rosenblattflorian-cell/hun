/**
 * HubFab — globaler "Zurück zum Hub" Floating Action Button.
 * Wird von allen Power-User-Screens überlagert, damit Admin/Vertrieb/Planer
 * jederzeit zum Auswahl-Hub zurückkehren können.
 *
 * Verwendung in jedem Screen (am Ende des SafeAreaView):
 *   <HubFab />
 */
import React from "react";
import { TouchableOpacity, View, Text, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./theme";

type Props = {
  position?: "top-right" | "bottom-right" | "top-left";
  variant?: "pill" | "fab";
};

export function HubFab({ position = "top-left", variant = "pill" }: Props) {
  const router = useRouter();

  if (variant === "fab") {
    return (
      <TouchableOpacity
        testID="hub-fab"
        onPress={() => router.replace("/hub")}
        style={[s.fab, posStyle(position, s)]}
        activeOpacity={0.85}
      >
        <Ionicons name="grid" size={22} color="#000" />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      testID="hub-fab"
      onPress={() => router.replace("/hub")}
      style={[s.pill, posStyle(position, s)]}
      activeOpacity={0.85}
    >
      <Ionicons name="grid" size={14} color={colors.primary} />
      <Text style={s.pillT}>Hub</Text>
    </TouchableOpacity>
  );
}

function posStyle(p: string, s: any) {
  if (p === "bottom-right") return s.bottomRight;
  if (p === "top-left") return s.topLeft;
  return s.topRight;
}

const s = StyleSheet.create({
  pill: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderActive,
    backgroundColor: colors.primaryGlow,
    zIndex: 50,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  pillT: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  fab: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10 },
      android: { elevation: 8 },
    }),
  },
  topRight: { top: Platform.OS === "ios" ? 60 : 16, right: 16 },
  topLeft: { top: Platform.OS === "ios" ? 60 : 16, left: 16 },
  bottomRight: { bottom: 90, right: 16 },
});
