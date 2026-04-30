/**
 * SolarHaloHeader — High-End Premium Header
 *
 * Visuelles Konzept:
 *   - Rundes Profilbild zentriert
 *   - Pulsierender Glow ringsum (Apple Green → Yellow Halo)
 *   - Sonnenstrahlen-Effekt (Solar Mitte Logo) als Aura
 *   - Circuit-Pattern Hintergrund (Leiterbahnen-SVG)
 *   - Begrüßung + Status-Snippet
 *
 * Modes:
 *   - "full"    → Großer Hero-Halo (für Customer-Portal, Onboarding)
 *   - "compact" → Kleiner Halo für Hub-Header
 */
import React, { useEffect } from "react";
import {
  View, Text, StyleSheet, Image, Platform, Dimensions,
} from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  Easing, interpolate, Extrapolate,
} from "react-native-reanimated";
import Svg, { Path, Line, Defs, LinearGradient, Stop, Circle, RadialGradient } from "react-native-svg";
import { colors } from "./theme";
import { SolarMitteLogo } from "./SolarMitteLogo";

type Props = {
  name?: string;
  greeting?: string;
  statusLabel?: string;     // z.B. "Heutiger Ertrag: 29.5 kWh"
  statusValue?: string;     // separat für Hervorhebung
  avatarUri?: string | null;
  initials?: string;        // Fallback wenn kein Bild
  mode?: "full" | "compact";
  showCircuit?: boolean;
};

const { width: SW } = Dimensions.get("window");

export function SolarHaloHeader({
  name, greeting = "Willkommen zurück",
  statusLabel, statusValue,
  avatarUri, initials,
  mode = "full",
  showCircuit = true,
}: Props) {
  const haloSize = mode === "full" ? Math.min(SW * 0.55, 280) : 100;
  const avatarSize = haloSize * 0.55;

  // Pulse-Animation (Halo skaliert subtil + Opacity-Modulation)
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
      -1, true,
    );
  }, []);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1.0, 1.06], Extrapolate.CLAMP) }],
    opacity: interpolate(pulse.value, [0, 1], [0.85, 1.0], Extrapolate.CLAMP),
  }));
  const innerGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.4, 0.8], Extrapolate.CLAMP),
  }));

  return (
    <View style={[s.container, mode === "compact" && s.containerCompact]}>
      {/* Circuit Pattern Background */}
      {showCircuit && mode === "full" && <CircuitPattern />}

      {/* Halo mit Sonnenstrahlen */}
      <View style={[s.haloWrap, { width: haloSize, height: haloSize }]}>
        {/* Pulsierende äußere Glow-Schicht (radial gradient) */}
        <Animated.View style={[s.outerGlow, { width: haloSize * 1.2, height: haloSize * 1.2 }, innerGlowStyle]}>
          <Svg width={haloSize * 1.2} height={haloSize * 1.2}>
            <Defs>
              <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
                <Stop offset="40%" stopColor={colors.primary} stopOpacity="0.4" />
                <Stop offset="80%" stopColor={colors.accent} stopOpacity="0.15" />
                <Stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#halo)" />
          </Svg>
        </Animated.View>

        {/* Sonnenstrahlen (Logo-Element ringsum) */}
        <Animated.View style={[s.rays, haloStyle]} pointerEvents="none">
          <SunRays size={haloSize} />
        </Animated.View>

        {/* Profilbild */}
        <View style={[s.avatarBorder, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
          <View style={[s.avatarInner, { width: avatarSize - 8, height: avatarSize - 8, borderRadius: (avatarSize - 8) / 2 }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImg} />
            ) : (
              <Text style={[s.avatarInitials, { fontSize: avatarSize * 0.36 }]}>
                {(initials || (name?.[0] || "?")).toUpperCase()}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* SOLAR MITTE Schriftzug (nur im Full-Modus) */}
      {mode === "full" && (
        <View style={s.brand}>
          <Text style={s.brandSolar}>SOLAR</Text>
          <View style={s.brandMittRow}>
            <View style={s.brandSep} />
            <Text style={s.brandMitt}>MITTE</Text>
            <View style={s.brandSep} />
          </View>
        </View>
      )}

      {/* Begrüßung */}
      {name && (
        <Text style={[s.greeting, mode === "compact" && s.greetingCompact]}>
          {greeting}, <Text style={s.greetingName}>{name}!</Text>
        </Text>
      )}

      {/* Status-Snippet */}
      {(statusLabel || statusValue) && (
        <View style={s.status}>
          {statusLabel && <Text style={s.statusLabel}>{statusLabel}</Text>}
          {statusValue && <Text style={s.statusValue}>{statusValue}</Text>}
        </View>
      )}
    </View>
  );
}

/** Sonnenstrahlen — gelbe Strahlen ringsum das Profilbild */
function SunRays({ size }: { size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const innerR = size * 0.32;     // Wo Strahlen anfangen
  const outerR = size * 0.50;     // Wo Strahlen enden
  // 24 Strahlen, abwechselnd lang/kurz
  const rays = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    const isLong = i % 2 === 0;
    const len = isLong ? outerR : outerR * 0.78;
    const width = isLong ? size * 0.05 : size * 0.03;
    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * len;
    const y2 = cy + Math.sin(angle) * len;
    rays.push({ x1, y1, x2, y2, width, key: i });
  }

  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="rayGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={colors.accent} stopOpacity="1" />
          <Stop offset="100%" stopColor={colors.accent} stopOpacity="0.6" />
        </LinearGradient>
      </Defs>
      {rays.map(r => (
        <Line
          key={r.key}
          x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
          stroke="url(#rayGrad)"
          strokeWidth={r.width}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

/** Circuit-Pattern — Leiterbahnen-Hintergrund */
function CircuitPattern() {
  const W = SW;
  const H = 380;
  return (
    <View style={s.circuit} pointerEvents="none">
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="cFade" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {/* Horizontale & vertikale Bahnen */}
        {[60, 130, 220, 290].map((y, i) => (
          <Line key={`h${i}`} x1="0" y1={y} x2={W} y2={y} stroke="url(#cFade)" strokeWidth="0.8" />
        ))}
        {[40, 110, 180, 250, 320, W - 40, W - 110, W - 180].map((x, i) => (
          <Line key={`v${i}`} x1={x} y1="0" x2={x} y2={H} stroke="url(#cFade)" strokeWidth="0.7" />
        ))}
        {/* Eckige Pfade (Leiterbahn-typisch) */}
        <Path
          d={`M 20 40 L 90 40 L 90 110 L 200 110`}
          stroke={colors.primary} strokeOpacity="0.18" strokeWidth="1" fill="none"
        />
        <Path
          d={`M ${W - 20} 80 L ${W - 100} 80 L ${W - 100} 200 L ${W - 250} 200`}
          stroke={colors.primary} strokeOpacity="0.18" strokeWidth="1" fill="none"
        />
        <Path
          d={`M 40 ${H - 40} L 120 ${H - 40} L 120 ${H - 120} L 240 ${H - 120}`}
          stroke={colors.accent} strokeOpacity="0.12" strokeWidth="1" fill="none"
        />
        {/* Kontakt-Punkte */}
        {[[90, 40], [200, 110], [W - 100, 80], [W - 250, 200], [120, H - 40], [240, H - 120]].map(([x, y], i) => (
          <Circle key={`c${i}`} cx={x} cy={y} r="2" fill={colors.primary} fillOpacity="0.5" />
        ))}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: "100%",
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    overflow: "hidden",
    position: "relative",
  },
  containerCompact: {
    paddingVertical: 8,
    flexDirection: "row",
    paddingHorizontal: 16,
    justifyContent: "flex-start",
    gap: 12,
  },
  circuit: { position: "absolute", top: 0, left: 0, right: 0, height: 380, opacity: 0.7 },
  haloWrap: { alignItems: "center", justifyContent: "center", position: "relative" },
  outerGlow: { position: "absolute", alignItems: "center", justifyContent: "center" },
  rays: { position: "absolute", alignItems: "center", justifyContent: "center" },
  avatarBorder: {
    backgroundColor: colors.bgDeep,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: colors.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12 },
      android: { elevation: 10 },
    }),
  },
  avatarInner: {
    backgroundColor: colors.paper,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderActive,
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarInitials: { color: colors.primary, fontWeight: "900", letterSpacing: -1 },

  brand: { alignItems: "center", marginTop: 12, marginBottom: 6 },
  brandSolar: { fontSize: 38, fontWeight: "900", color: colors.primary, letterSpacing: 4, lineHeight: 42 },
  brandMittRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  brandSep: { width: 16, height: 2, backgroundColor: colors.accent },
  brandMitt: { fontSize: 18, fontWeight: "900", color: colors.accent, letterSpacing: 8 },

  greeting: {
    color: colors.textPrimary,
    fontSize: 16,
    marginTop: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  greetingCompact: { fontSize: 13, marginTop: 0, textAlign: "left", flex: 1 },
  greetingName: { color: colors.primary, fontWeight: "900" },

  status: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primaryGlow,
    borderWidth: 1,
    borderColor: colors.borderActive,
    alignItems: "center",
  },
  statusLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  statusValue: { color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 0.4 },
});
