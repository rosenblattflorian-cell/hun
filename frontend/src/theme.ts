import { StyleSheet } from "react-native";

export const colors = {
  bg: "#000000",
  paper: "#0F172A",
  elevated: "#1E293B",
  primary: "#00C853",
  primaryDark: "#009624",
  secondary: "#F59E0B",
  secondaryDark: "#D97706",
  danger: "#EF4444",
  info: "#3B82F6",
  orange: "#F97316",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  textDisabled: "#475569",
  border: "#1E293B",
  roofOutline: "#EF4444",
  rafterLines: "#3B82F6",
  pvModule: "rgba(16, 185, 129, 0.35)",
  pvModuleStroke: "#10B981",
  chimney: "#F97316",
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const typography = StyleSheet.create({
  h1: { fontSize: 32, lineHeight: 40, fontWeight: "700", color: colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 24, lineHeight: 32, fontWeight: "700", color: colors.textPrimary, letterSpacing: -0.5 },
  h3: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: colors.textPrimary },
  body: { fontSize: 16, lineHeight: 24, color: colors.textPrimary },
  body2: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  caption: { fontSize: 12, lineHeight: 16, color: colors.textSecondary, letterSpacing: 0.5, textTransform: "uppercase", fontWeight: "500" },
});

export const cardStyle = {
  backgroundColor: colors.paper,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.border,
  padding: 16,
};

export const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  kontakt: "Kontakt",
  angebot: "Angebot",
  vertrag: "Vertrag",
  installation: "Installation",
  abgeschlossen: "Abgeschlossen",
};

export const STAGE_COLORS: Record<string, string> = {
  lead: "#64748B",
  kontakt: "#3B82F6",
  angebot: "#F59E0B",
  vertrag: "#A855F7",
  installation: "#F97316",
  abgeschlossen: "#10B981",
};

export const STAGES = ["lead", "kontakt", "angebot", "vertrag", "installation", "abgeschlossen"];
