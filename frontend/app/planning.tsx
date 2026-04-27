import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Polygon, Defs, Pattern, Line, Text as SvgText } from "react-native-svg";
import { colors, typography, spacing } from "../src/theme";
import { apiPost } from "../src/api";

const SYSTEMS = [
  { key: "string", label: "String", icon: "git-branch", desc: "Klassisch" },
  { key: "hybrid", label: "Sigenergy", icon: "battery-charging", desc: "Hybrid + Speicher" },
  { key: "micro_hoymiles", label: "Hoymiles", icon: "apps", desc: "Microinverter" },
  { key: "optimized_solaredge", label: "SolarEdge", icon: "flash", desc: "Mit Optimierern" },
] as const;

const MODULE_PRESETS = [
  { label: "Trina Vertex S+ 440W", l: 1.762, w: 1.134, p: 440 },
  { label: "JA Solar 420W", l: 1.722, w: 1.134, p: 420 },
  { label: "Solar Fabrik S4 BC 475W", l: 1.722, w: 1.134, p: 475 },
];

export default function Planning() {
  const router = useRouter();
  const [width, setWidth] = useState("12");
  const [height, setHeight] = useState("8");
  const [orient, setOrient] = useState<"portrait" | "landscape">("portrait");
  const [modulePreset, setModulePreset] = useState(0);
  const [system, setSystem] = useState<typeof SYSTEMS[number]["key"]>("optimized_solaredge");
  const [batteryKwh, setBatteryKwh] = useState("8");
  const [obstacles, setObstacles] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [obsX, setObsX] = useState("5"); const [obsY, setObsY] = useState("3");
  const [obsW, setObsW] = useState("1"); const [obsH, setObsH] = useState("1");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const m = MODULE_PRESETS[modulePreset];
  const W = parseFloat(width) || 1;
  const H = parseFloat(height) || 1;

  const generate = async () => {
    setLoading(true);
    try {
      const r = await apiPost<any>("/planning/generate", {
        roof_width_m: W, roof_height_m: H,
        obstacles_m: obstacles.map(o => [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]]),
        module_length_m: m.l, module_width_m: m.w, module_power_w: m.p,
        inverter_system: system, orientation: orient,
        sigenergy_battery_kwh: system === "hybrid" ? parseFloat(batteryKwh) : null,
      });
      setResult(r);
    } catch (e: any) { Alert.alert("Fehler", e.message); }
    finally { setLoading(false); }
  };

  // Auto-generate beim Ändern der Inputs (Live-Update)
  useEffect(() => {
    const t = setTimeout(generate, 500);
    return () => clearTimeout(t);
  }, [width, height, orient, modulePreset, system, batteryKwh, obstacles]);

  // SVG-Skalierung für Canvas
  const canvasW = 340;
  const canvasH = Math.min(canvasW * (H / W), 280);
  const sx = canvasW / W;
  const sy = canvasH / H;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={typography.h3}>PV-Layout & Stückliste</Text>
          <Text style={s.sub}>Multi-Brand · Live-BOM</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}>
          {/* Canvas */}
          <View style={s.canvasBox}>
            <Svg width={canvasW} height={canvasH}>
              <Defs>
                <Pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <Rect width="20" height="20" fill={colors.bg} />
                  <Line x1="0" y1="0" x2="20" y2="0" stroke="#1f2a44" strokeWidth="0.5" />
                  <Line x1="0" y1="0" x2="0" y2="20" stroke="#1f2a44" strokeWidth="0.5" />
                </Pattern>
              </Defs>
              <Rect x={0} y={0} width={canvasW} height={canvasH} fill="url(#grid)" />
              {/* Dachfläche */}
              <Rect x={0} y={0} width={canvasW} height={canvasH} fill="none" stroke={colors.danger} strokeWidth="2" />
              {/* Sperrflächen */}
              {obstacles.map((o, i) => (
                <Rect key={i} x={o.x * sx} y={o.y * sy} width={o.w * sx} height={o.h * sy}
                  fill="rgba(239,68,68,0.4)" stroke={colors.danger} strokeWidth="1.5" />
              ))}
              {/* Module */}
              {result?.layout?.modules?.map((md: any, i: number) => (
                <Rect key={i}
                  x={md.x_m * sx + 1} y={md.y_m * sy + 1}
                  width={md.w_m * sx - 2} height={md.h_m * sy - 2}
                  fill="rgba(0,200,83,0.45)" stroke={colors.primary} strokeWidth="1" rx="1" />
              ))}
              <SvgText x={canvasW / 2} y={canvasH - 6} fill={colors.textSecondary} fontSize="9" textAnchor="middle">
                {W.toFixed(1)} m × {H.toFixed(1)} m
              </SvgText>
            </Svg>
          </View>

          {/* KPI */}
          {result?.layout && (
            <View style={s.kpiRow}>
              <KpiBox label="Module" v={result.layout.modules_count} />
              <KpiBox label="kWp" v={result.layout.kwp} highlight color={colors.primary} />
              <KpiBox label="Reihen×Spalten" v={`${result.layout.rows}×${result.layout.cols_max}`} small />
            </View>
          )}

          {/* Inputs */}
          <Text style={s.label}>DACHMAßE</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <NumField label="Breite" v={width} set={setWidth} unit="m" />
            <NumField label="Höhe" v={height} set={setHeight} unit="m" />
          </View>

          <Text style={s.label}>MODUL-AUSRICHTUNG</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <ChipBtn active={orient === "portrait"} onPress={() => setOrient("portrait")} label="Hochkant" icon="phone-portrait" />
            <ChipBtn active={orient === "landscape"} onPress={() => setOrient("landscape")} label="Querformat" icon="phone-landscape" />
          </View>

          <Text style={s.label}>MODUL-TYP</Text>
          <View style={{ gap: 6 }}>
            {MODULE_PRESETS.map((mp, i) => (
              <TouchableOpacity key={i} onPress={() => setModulePreset(i)}
                style={[s.modBtn, modulePreset === i && s.modBtnA]}>
                <Ionicons name="sunny" size={16} color={modulePreset === i ? "#000" : colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.modT, modulePreset === i && { color: "#000" }]}>{mp.label}</Text>
                  <Text style={[s.modS, modulePreset === i && { color: "rgba(0,0,0,0.6)" }]}>{mp.l}×{mp.w}m · {mp.p}W</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>WECHSELRICHTER-SYSTEM</Text>
          <View style={s.sysGrid}>
            {SYSTEMS.map(sy => (
              <TouchableOpacity key={sy.key} onPress={() => setSystem(sy.key)}
                style={[s.sysBtn, system === sy.key && s.sysBtnA]}>
                <Ionicons name={sy.icon as any} size={20} color={system === sy.key ? "#000" : colors.primary} />
                <Text style={[s.sysT, system === sy.key && { color: "#000" }]}>{sy.label}</Text>
                <Text style={[s.sysD, system === sy.key && { color: "rgba(0,0,0,0.6)" }]}>{sy.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {system === "hybrid" && (
            <>
              <Text style={s.label}>SPEICHER (kWh)</Text>
              <NumField label="Sigenergy SigenBat" v={batteryKwh} set={setBatteryKwh} unit="kWh" />
            </>
          )}

          {/* Sperrflächen */}
          <Text style={s.label}>SPERRFLÄCHEN ({obstacles.length})</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TextInput style={[s.miniInput, { flex: 1 }]} value={obsX} onChangeText={setObsX} placeholder="x" placeholderTextColor={colors.textDisabled} keyboardType="decimal-pad" />
            <TextInput style={[s.miniInput, { flex: 1 }]} value={obsY} onChangeText={setObsY} placeholder="y" placeholderTextColor={colors.textDisabled} keyboardType="decimal-pad" />
            <TextInput style={[s.miniInput, { flex: 1 }]} value={obsW} onChangeText={setObsW} placeholder="b" placeholderTextColor={colors.textDisabled} keyboardType="decimal-pad" />
            <TextInput style={[s.miniInput, { flex: 1 }]} value={obsH} onChangeText={setObsH} placeholder="h" placeholderTextColor={colors.textDisabled} keyboardType="decimal-pad" />
            <TouchableOpacity style={s.addObsBtn} onPress={() => {
              const o = { x: parseFloat(obsX) || 0, y: parseFloat(obsY) || 0, w: parseFloat(obsW) || 1, h: parseFloat(obsH) || 1 };
              setObstacles([...obstacles, o]);
            }}><Ionicons name="add" size={18} color="#000" /></TouchableOpacity>
          </View>
          {obstacles.map((o, i) => (
            <View key={i} style={s.obsRow}>
              <Text style={s.obsT}>#{i + 1}: {o.x},{o.y} · {o.w}×{o.h}m</Text>
              <TouchableOpacity onPress={() => setObstacles(obstacles.filter((_, j) => j !== i))}>
                <Ionicons name="trash" size={14} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Warnungen */}
          {result?.bom?.warnings?.length > 0 && (
            <View style={s.warnBox}>
              <Text style={s.warnT}>⚠ ELEKTRISCHE VALIDIERUNG</Text>
              {result.bom.warnings.map((w: string, i: number) => <Text key={i} style={s.warnLine}>{w}</Text>)}
            </View>
          )}

          {/* BOM */}
          {result?.bom?.items?.length > 0 && (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 24 }}>
                <Text style={[s.label, { marginTop: 0 }]}>STÜCKLISTE (BOM)</Text>
                {loading && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
              <View style={s.bomCard}>
                {Object.entries(groupBy(result.bom.items, "category")).map(([cat, items]: any) => (
                  <View key={cat}>
                    <Text style={s.bomCat}>{cat.toUpperCase()}</Text>
                    {(items as any[]).map((it, i) => (
                      <View key={i} style={s.bomRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.bomName}>{it.name}</Text>
                          {it.note ? <Text style={s.bomNote}>{it.note}</Text> : null}
                        </View>
                        <Text style={s.bomQty}>{it.qty} {it.unit}</Text>
                        <Text style={s.bomPrice}>€ {it.total_net.toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
                <View style={s.bomTotal}>
                  <Text style={s.bomTotalL}>NETTO</Text>
                  <Text style={s.bomTotalV}>€ {result.bom.total_net.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={[s.bomTotal, { borderTopWidth: 0, paddingTop: 4 }]}>
                  <Text style={s.bomTotalL}>BRUTTO (19% USt)</Text>
                  <Text style={[s.bomTotalV, { color: colors.primary, fontSize: 22 }]}>€ {result.bom.total_net_with_vat_19.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>

              <TouchableOpacity
                testID="open-quote-wizard"
                onPress={() => {
                  const layoutP = encodeURIComponent(JSON.stringify(result.layout));
                  const bomP = encodeURIComponent(JSON.stringify(result.bom));
                  router.push(`/quote/new?layout=${layoutP}&bom=${bomP}` as any);
                }}
                style={[s.aiQuoteBtn]}
              >
                <Ionicons name="sparkles" size={20} color="#000" />
                <View style={{ flex: 1 }}>
                  <Text style={s.aiQuoteT}>Angebot mit KI generieren</Text>
                  <Text style={s.aiQuoteS}>Claude strukturiert · PDF-Download · Solar-Mitte-Branding</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function groupBy(arr: any[], key: string) {
  return arr.reduce((g, it) => ((g[it[key]] = g[it[key]] || []).push(it), g), {});
}

function KpiBox({ label, v, highlight, color = colors.textPrimary, small }: any) {
  return (
    <View style={[s.kpi, highlight && { borderColor: color, backgroundColor: `${color}18` }]}>
      <Text style={[s.kpiV, small && { fontSize: 16 }, { color }]}>{v}</Text>
      <Text style={s.kpiL}>{label}</Text>
    </View>
  );
}

function NumField({ label, v, set, unit }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.fL}>{label}</Text>
      <View style={s.fBox}>
        <TextInput value={v} onChangeText={set} keyboardType="decimal-pad" style={s.fI} />
        <Text style={s.fU}>{unit}</Text>
      </View>
    </View>
  );
}

function ChipBtn({ active, onPress, label, icon }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipA]}>
      <Ionicons name={icon} size={14} color={active ? "#000" : colors.textPrimary} />
      <Text style={[s.chipT, active && { color: "#000" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  canvasBox: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 8, alignItems: "center", overflow: "hidden" },
  kpiRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  kpi: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  kpiV: { fontSize: 24, fontWeight: "800" },
  kpiL: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 18, marginBottom: 8 },
  fL: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", marginBottom: 4 },
  fBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingRight: 12 },
  fI: { flex: 1, color: colors.textPrimary, padding: 12, fontSize: 16 },
  fU: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  chipA: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipT: { color: colors.textPrimary, fontWeight: "700", fontSize: 12 },
  modBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  modBtnA: { backgroundColor: colors.primary, borderColor: colors.primary },
  modT: { color: colors.textPrimary, fontWeight: "700", fontSize: 14 },
  modS: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  sysGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sysBtn: { width: "48%", padding: 12, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: "center" },
  sysBtnA: { backgroundColor: colors.primary, borderColor: colors.primary },
  sysT: { color: colors.textPrimary, fontWeight: "700", fontSize: 13, marginTop: 4 },
  sysD: { color: colors.textSecondary, fontSize: 10, marginTop: 2 },
  miniInput: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.textPrimary, fontSize: 13, textAlign: "center" },
  addObsBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  obsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: colors.paper, marginTop: 4 },
  obsT: { color: colors.textPrimary, fontSize: 12 },
  warnBox: { marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: `${colors.danger}18`, borderWidth: 1, borderColor: colors.danger },
  warnT: { color: colors.danger, fontWeight: "800", fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  warnLine: { color: colors.textPrimary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  bomCard: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  bomCat: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: 12, marginBottom: 6 },
  bomRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  bomName: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  bomNote: { color: colors.textSecondary, fontSize: 10, marginTop: 2, fontStyle: "italic" },
  bomQty: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", minWidth: 56, textAlign: "right" },
  bomPrice: { color: colors.textPrimary, fontSize: 12, fontWeight: "700", minWidth: 80, textAlign: "right" },
  bomTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16, paddingTop: 12, borderTopWidth: 2, borderTopColor: colors.primary },
  bomTotalL: { color: colors.textSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  bomTotalV: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  aiQuoteBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 12, backgroundColor: colors.primary, marginTop: 16 },
  aiQuoteT: { color: "#000", fontWeight: "800", fontSize: 15 },
  aiQuoteS: { color: "rgba(0,0,0,0.7)", fontSize: 11, marginTop: 2 },
});
