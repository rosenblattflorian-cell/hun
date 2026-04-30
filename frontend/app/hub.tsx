/**
 * Solar Mitte Hub — Premium 3-Spalten Grid · NO-SCROLL Layout
 * Alle Funktionen auf einen Blick · Touch-optimiert · Branded
 */
import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../src/theme";
import { SolarMitteLogo } from "../src/SolarMitteLogo";
import { SolarHaloHeader } from "../src/SolarHaloHeader";
import { useAuth } from "../src/auth";
import { apiGet } from "../src/api";

type Tile = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  color: string;
  badge?: string;
  adminOnly?: boolean;
};

const TILES: Tile[] = [
  { key: "dashboard", label: "Dashboard",   icon: "grid",                href: "/(tabs)/dashboard", color: colors.primary },
  { key: "kunden",    label: "Kunden",      icon: "people",              href: "/(tabs)/kunden",    color: colors.primary },
  { key: "projekte",  label: "Projekte",    icon: "briefcase",           href: "/(tabs)/projekte",  color: colors.primary },
  { key: "aufmass",   label: "Aufmaß",      icon: "scan",                href: "/(tabs)/aufmass",   color: colors.accent },
  { key: "photo",     label: "KI-Foto",     icon: "camera",              href: "/photo-audit",      color: colors.accent, badge: "KI" },
  { key: "blueprint", label: "Blueprint",   icon: "document-text",       href: "/blueprint",        color: colors.primary, badge: "PRO" },
  { key: "planning",  label: "PV-Layout",   icon: "apps",                href: "/planning",         color: colors.primary, badge: "BOM" },
  { key: "inventory", label: "Inventar",    icon: "cube",                href: "/inventory",        color: colors.accent },
  { key: "calendar",  label: "Kalender",    icon: "calendar",            href: "/calendar",         color: colors.primary },
  { key: "monteur",   label: "Monteur",     icon: "hammer",              href: "/monteur",          color: colors.accent },
  { key: "ai",        label: "KI-Assist.",  icon: "sparkles",            href: "/(tabs)/mehr",      color: colors.primary, badge: "AI" },
  { key: "admin",     label: "Module",      icon: "settings",            href: "/admin/modules",    color: colors.accent, badge: "DB", adminOnly: true },
  { key: "hero",      label: "HERO",        icon: "git-merge",           href: "/hero-sync",        color: colors.accent, adminOnly: true },
];

const { width: SW, height: SH } = Dimensions.get("window");
const COLS = 3;
const HORIZONTAL_PAD = spacing.md * 2;     // 32
const TILE_GAP = 10;
const TILE_SIZE = (SW - HORIZONTAL_PAD - TILE_GAP * (COLS - 1)) / COLS;

export default function Hub() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<any>(null);

  const load = async () => {
    try { setStats(await apiGet("/dashboard/stats")); } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const visibleTiles = TILES.filter(t => !t.adminOnly || user?.role === "admin");

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      {/* Solar Halo Header — Full Mode mit pulsierendem Glow */}
      <SolarHaloHeader
        name={user?.name?.split(" ")[0] || "Profi"}
        greeting={getGreeting()}
        statusLabel={stats ? "Heute" : undefined}
        statusValue={stats ? `${stats.total_kwp || 0} kWp · ${stats.in_installation || 0} Montagen` : undefined}
        initials={(user?.name || "?").split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2)}
        mode="full"
        showCircuit={true}
      />

      {/* Logout-Button schwebend oben rechts */}
      <TouchableOpacity onPress={logout} style={s.logoutFloating} testID="logout-hub">
        <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Hauptgrid — 3 Spalten, 4 Reihen, NO SCROLL */}
      <View style={s.gridWrap}>
        <View style={s.grid}>
          {visibleTiles.map(tile => (
            <TileCard
              key={tile.key}
              tile={tile}
              onPress={() => router.push(tile.href as any)}
            />
          ))}
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.brandLine}>
          <View style={[s.brandSeg, { backgroundColor: colors.primary, flex: 2 }]} />
          <View style={[s.brandSeg, { backgroundColor: colors.accent, flex: 1 }]} />
          <View style={[s.brandSeg, { backgroundColor: colors.primary, flex: 3 }]} />
        </View>
        <Text style={s.footerT}>SOLAR MITTE · CRM · FIELD-SERVICE · KI</Text>
      </View>
    </SafeAreaView>
  );
}

function TileCard({ tile, onPress }: { tile: Tile; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      testID={`tile-${tile.key}`}
      style={[s.tile, { width: TILE_SIZE, height: TILE_SIZE }]}
      activeOpacity={0.85}
    >
      <View style={[s.tileGlow, { backgroundColor: tile.color }]} />

      {tile.badge && (
        <View style={[s.tileBadge, { backgroundColor: tile.color }]}>
          <Text style={s.tileBadgeT}>{tile.badge}</Text>
        </View>
      )}

      <View style={[s.tileIconWrap, { borderColor: tile.color, backgroundColor: `${tile.color}18` }]}>
        <Ionicons name={tile.icon} size={Math.min(TILE_SIZE * 0.26, 26)} color={tile.color} />
      </View>

      <Text style={s.tileLabel} numberOfLines={1}>{tile.label}</Text>
    </TouchableOpacity>
  );
}

function Stat({ n, l, highlight }: any) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={[s.statN, highlight && { color: colors.primary }]}>{n}</Text>
      <Text style={s.statL}>{l}</Text>
    </View>
  );
}
function Sep() { return <View style={s.statSep} />; }

function getGreeting() {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

function roleColor(role?: string) {
  if (role === "admin") return colors.accent;
  if (role === "vertrieb") return colors.primary;
  if (role === "monteur") return colors.orange;
  if (role === "planer") return colors.info;
  return colors.textSecondary;
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  logoutFloating: {
    position: "absolute", top: 50, right: 16, zIndex: 100,
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.paper, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },

  stats: {
    flexDirection: "row",
    marginHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.paper,
    borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
    alignItems: "center",
    display: "none", // Replaced by Halo Status-Snippet
  },
  statSep: { width: 1, height: 24, backgroundColor: colors.border },
  statN: { color: colors.textPrimary, fontSize: 18, fontWeight: "900", letterSpacing: -0.4 },
  statL: { color: colors.textSecondary, fontSize: 9, marginTop: 1, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },

  // Grid füllt verbleibenden Raum, Tiles in 3 Spalten + 4 Reihen.
  gridWrap: { flex: 1, justifyContent: "center", paddingHorizontal: spacing.md },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TILE_GAP,
    justifyContent: "flex-start",
  },

  tile: {
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tileGlow: {
    position: "absolute", top: -25, right: -25,
    width: 60, height: 60, borderRadius: 30, opacity: 0.15,
  },
  tileBadge: {
    position: "absolute", top: 6, right: 6,
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 999, zIndex: 2,
  },
  tileBadgeT: { color: "#000", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  tileIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, marginBottom: 6,
  },
  tileLabel: {
    color: colors.textPrimary, fontSize: 12,
    fontWeight: "800", letterSpacing: -0.2, textAlign: "center",
  },

  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: 6,
    paddingBottom: spacing.sm,
    alignItems: "center",
    gap: 6,
  },
  brandLine: { flexDirection: "row", height: 2, gap: 2, width: "60%" },
  brandSeg: { height: 2, borderRadius: 2 },
  footerT: { color: colors.textSecondary, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
});
