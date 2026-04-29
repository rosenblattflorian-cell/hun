import { StyleSheet } from "react-native";

// Solar Mitte Brand Colors — Top-Tier Branding (User-Vorgabe)
//   bg = Deep Navy/Schwarz  · primary = Bright Apple Green · accent = Warn-Gelb
export const colors = {
  // Hintergründe
  bg: "#0A1628",                // Deep Navy (statt rein-schwarz für Premium-Look)
  bgDeep: "#050B14",            // noch dunkler für Hero-Sektionen
  paper: "#0F1E33",             // Cards (Navy gehoben)
  elevated: "#152740",          // Hover/Elevated Cards
  surface: "#0C1A2E",           // Subsurface

  // Brand
  primary: "#00C853",           // Bright Apple Green (primäre Action-Color)
  primaryDark: "#009639",       // Dunkelgrün für States
  primaryGlow: "rgba(0,200,83,0.22)",
  accent: "#FFD600",            // Warning-Gelb (MITTE/Sonnenstrahlen) — nur Akzent / Monteur-Modus
  accentDark: "#E6C200",
  accentGlow: "rgba(255,214,0,0.18)",

  // Status
  secondary: "#FFD600",
  secondaryDark: "#E6C200",
  danger: "#FF3B30",
  info: "#0A84FF",
  orange: "#FF9500",
  warn: "#FFD600",
  success: "#00C853",

  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "#94A3B8",     // Slate 400 — bessere Lesbarkeit auf Navy
  textDisabled: "#475569",      // Slate 600

  // Borders
  border: "#1E2D45",            // Subtile Navy-Border
  borderSoft: "#2A3B57",
  borderActive: "rgba(0,200,83,0.35)",

  // Pipeline (CRM Stages)
  roofOutline: "#FF3B30",
  rafterLines: "#0A84FF",
  pvModule: "rgba(0,200,83,0.35)",
  pvModuleStroke: "#00C853",
  chimney: "#FF9500",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const typography = StyleSheet.create({
  h1: { fontSize: 34, lineHeight: 40, fontWeight: "900", color: colors.textPrimary, letterSpacing: -1 },
  h2: { fontSize: 26, lineHeight: 32, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.5 },
  h3: { fontSize: 20, lineHeight: 26, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.3 },
  body: { fontSize: 16, lineHeight: 24, color: colors.textPrimary },
  body2: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  caption: { fontSize: 11, lineHeight: 16, color: colors.textSecondary, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "700" },
});

export const cardStyle = {
  backgroundColor: colors.paper,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.border,
  padding: 16,
};

export const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", kontakt: "Kontakt", angebot: "Angebot",
  vertrag: "Vertrag", installation: "Installation", abgeschlossen: "Abgeschlossen",
};

export const STAGE_COLORS: Record<string, string> = {
  lead: "#8E8E93",
  kontakt: "#0A84FF",
  angebot: "#FFD600",
  vertrag: "#BF5AF2",
  installation: "#FF9500",
  abgeschlossen: "#A8D930",
};

export const STAGES = ["lead", "kontakt", "angebot", "vertrag", "installation", "abgeschlossen"];
