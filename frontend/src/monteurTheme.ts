/**
 * Monteur-Theme: Hoch-Kontrast, große Touch-Targets, Sonnenlicht-tauglich.
 * Wird zusätzlich zum Standard-Theme verwendet.
 */
import { StyleSheet } from "react-native";

export const monteurColors = {
  bg: "#000000",
  card: "#0F172A",
  border: "#FFD600",        // Solar-Gelb für Kontrast
  borderSoft: "#1F2937",
  primary: "#00E676",       // helleres Grün für Outdoor
  primaryDark: "#00C853",
  done: "#00E676",
  todo: "#94A3B8",
  warn: "#FFAB00",
  danger: "#FF5252",
  text: "#FFFFFF",
  textDim: "#CBD5E1",
};

export const monteurType = StyleSheet.create({
  h1: { fontSize: 32, fontWeight: "900", color: monteurColors.text, letterSpacing: -1 },
  h2: { fontSize: 22, fontWeight: "800", color: monteurColors.text },
  body: { fontSize: 17, color: monteurColors.text, lineHeight: 24 },     // groß für Outdoor
  label: { fontSize: 13, color: monteurColors.textDim, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: "800" },
});

// Touch-Targets sind mindestens 56px (statt 44) für Arbeitshandschuhe
export const TARGET = 56;
