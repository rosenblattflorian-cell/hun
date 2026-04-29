/**
 * Solar Mitte Hub — der zentrale Auswahlbildschirm.
 * Alle Funktionen auf einen Blick · Logo prominent · Touch-optimiert.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../src/theme";
import { SolarMitteLogo } from "../src/SolarMitteLogo";
import { useAuth } from "../src/auth";
import { apiGet } from "../src/api";

type Tile = {
  key: string;
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
  color: string;
  badge?: string;
  adminOnly?: boolean;
};

const TILES: Tile[] = [
  { key: "dashboard", label: "Dashboard", sub: "KPIs · Pipeline · Trend",  icon: "grid",          href: "/(tabs)/dashboard", color: colors.primary },
  { key: "kunden",    label: "Kunden",    sub: "CRM · Pipeline · Leads",   icon: "people",        href: "/(tabs)/kunden",    color: colors.accent },
  { key: "aufmass",   label: "Aufmaß",    sub: "Manuell · Walm · First",    icon: "scan",          href: "/(tabs)/aufmass",   color: colors.primary },
  { key: "photo",     label: "KI-Foto-Aufmaß", sub: "Homographie · OpenCV", icon: "camera",        href: "/photo-audit",      color: colors.accent, badge: "KI" },
  { key: "planning",  label: "PV-Layout", sub: "Multi-Brand · Live-BOM",   icon: "apps",          href: "/planning",         color: colors.primary, badge: "BOM" },
  { key: "inventory", label: "Inventar",  sub: "Module · WR · Speicher",   icon: "cube",          href: "/inventory",        color: colors.accent },
  { key: "projekte",  label: "Projekte",  sub: "Status · Bautagebuch",     icon: "briefcase",     href: "/(tabs)/projekte",  color: colors.primary },
  { key: "calendar",  label: "Kalender",  sub: "Tag · Woche · Liste",      icon: "calendar",      href: "/calendar",         color: colors.accent },
  { key: "monteur",   label: "Monteur",   sub: "Checklisten · Foto · Abnahme", icon: "hammer",    href: "/monteur",          color: colors.primary },
  { key: "ai",        label: "KI-Assistent", sub: "Claude Sonnet 4.5",     icon: "sparkles",      href: "/(tabs)/mehr",      color: colors.accent, badge: "AI" },
  { key: "hero",      label: "HERO Sync", sub: "Pull · Push · Audit",      icon: "git-merge",     href: "/hero-sync",        color: colors.primary, adminOnly: true },
  { key: "settings",  label: "Mehr",      sub: "Profil · Export · Daten",  icon: "ellipsis-horizontal", href: "/(tabs)/mehr", color: colors.accent },
];

const { width: SCREEN_W } = Dimensions.get("window");
const COLS = SCREEN_W > 600 ? 3 : 2;
const TILE_SIZE = (SCREEN_W - 32 - 16 * (COLS - 1)) / COLS;

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
    <SafeAreaView style={s.container} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Top: Logo + User */}
        <View style={s.header}>
          <View style={s.logoArea}>
            <SolarMitteLogo size={88} />
          </View>
          <View style={s.userArea}>
            <Text style={s.greet}>{getGreeting()}</Text>
            <Text style={s.userName}>{user?.name}</Text>
            <View style={[s.roleBadge, { borderColor: roleColor(user?.role) }]}>
              <View style={[s.roleDot, { backgroundColor: roleColor(user?.role) }]} />
              <Text style={[s.roleT, { color: roleColor(user?.role) }]}>{(user?.role || "").toUpperCase()}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={logout} style={s.logoutBtn} testID="logout-hub">
            <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Quick-Stats Stripe (Live) */}
        {stats && (
          <View style={s.statsRow}>
            <Stat n={stats.total_customers} l="Kunden" />
            <View style={s.statSep} />
            <Stat n={stats.angebote} l="Angebote" />
            <View style={s.statSep} />
            <Stat n={stats.in_installation} l="Montage" />
            <View style={s.statSep} />
            <Stat n={`${stats.total_kwp || 0}`} l="kWp" highlight />
          </View>
        )}

        {/* Funktions-Grid */}
        <View style={s.grid}>
          {visibleTiles.map(tile => (
            <TileCard key={tile.key} tile={tile} onPress={() => router.push(tile.href as any)} />
          ))}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.brandLine}>
            <View style={[s.brandDot, { backgroundColor: colors.primary }]} />
            <View style={[s.brandDot, { backgroundColor: colors.accent }]} />
            <View style={[s.brandDot, { backgroundColor: colors.primary }]} />
          </View>
          <Text style={s.footerT}>SOLAR MITTE · CRM & FIELD-SERVICE PLATTFORM</Text>
          <Text style={s.footerS}>Photovoltaik · Speicher · Wallbox · Made in Mitte</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TileCard({ tile, onPress }: { tile: Tile; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} testID={`tile-${tile.key}`}
      style={[s.tile, { width: TILE_SIZE, height: TILE_SIZE }]}>
      {/* Glow Akzent oben rechts */}
      <View style={[s.tileGlow, { backgroundColor: tile.color }]} />

      {tile.badge && (
        <View style={[s.tileBadge, { backgroundColor: tile.color }]}>
          <Text style={s.tileBadgeT}>{tile.badge}</Text>
        </View>
      )}

      <View style={[s.tileIconWrap, { borderColor: tile.color, backgroundColor: `${tile.color}15` }]}>
        <Ionicons name={tile.icon} size={28} color={tile.color} />
      </View>

      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Text style={s.tileLabel} numberOfLines={1}>{tile.label}</Text>
        <Text style={s.tileSub} numberOfLines={1}>{tile.sub}</Text>
      </View>

      <View style={[s.tileArrow, { borderColor: tile.color }]}>
        <Ionicons name="arrow-forward" size={14} color={tile.color} />
      </View>
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
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, paddingTop: spacing.lg, gap: spacing.md },
  logoArea: { alignItems: "center", justifyContent: "center" },
  userArea: { flex: 1 },
  greet: { color: colors.textSecondary, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },
  userName: { color: colors.textPrimary, fontSize: 22, fontWeight: "900", letterSpacing: -0.5, marginTop: 2 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, backgroundColor: colors.bg },
  roleDot: { width: 5, height: 5, borderRadius: 3 },
  roleT: { fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },

  statsRow: { flexDirection: "row", marginHorizontal: spacing.md, padding: 14, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, alignItems: "center" },
  statSep: { width: 1, height: 28, backgroundColor: colors.border },
  statN: { color: colors.textPrimary, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  statL: { color: colors.textSecondary, fontSize: 9, marginTop: 2, letterSpacing: 1, textTransform: "uppercase", fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.md, gap: 16, marginTop: 4 },
  tile: { borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, padding: 16, overflow: "hidden", justifyContent: "space-between", position: "relative" },
  tileGlow: { position: "absolute", top: -30, right: -30, width: 80, height: 80, borderRadius: 40, opacity: 0.15 },
  tileBadge: { position: "absolute", top: 12, right: 12, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, zIndex: 2 },
  tileBadgeT: { color: "#000", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  tileIconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  tileLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  tileSub: { color: colors.textSecondary, fontSize: 11, marginTop: 2, fontWeight: "500" },
  tileArrow: { position: "absolute", bottom: 14, right: 14, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, backgroundColor: colors.bg },

  footer: { marginTop: 32, padding: 24, alignItems: "center" },
  brandLine: { flexDirection: "row", gap: 8, marginBottom: 12 },
  brandDot: { width: 8, height: 8, borderRadius: 4 },
  footerT: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  footerS: { color: colors.textDisabled, fontSize: 10, marginTop: 4, letterSpacing: 0.5 },
});
