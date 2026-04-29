/**
 * Blueprint-Screen (Scan-to-Blueprint)
 * ====================================
 * Generiert maßstabsgetreue PDF/DXF/OBJ/PNG Pläne aus Aufmaß-Daten:
 *   • PDF — Vektor-Blueprint im Solar-Mitte-Branding
 *   • DXF — K2-Base-konformer CAD-Plan mit KEEPOUT-Layer für Sperrflächen
 *   • OBJ — 3D-Mesh des parametrischen Dachmodells
 *   • PNG — Hochauflösendes Top-Down-Rendering
 *
 * Workflow:
 *   1. Audit auswählen (oder Inline-Werte angeben)
 *   2. Sperrflächen optional erkennen (KI-Foto-Aufmaß) ODER manuell ergänzen
 *   3. Format-Auswahl & Download
 *   4. Optional: PDF + DXF an HERO-Akte pushen
 */
import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../src/theme";
import { apiGet, apiPost, apiDownloadBlob } from "../src/api";

type Audit = {
  id: string;
  title: string;
  laenge: number; breite: number; first: number; walm: number;
  neigung: number; ausrichtung: string;
  customer_id?: string; customer_name?: string;
};

type PhotoAudit = {
  id: string;
  title: string;
  customer_id?: string;
  dimensions: any;
  obstacles: any[];
  obstacle_area_m2?: number;
  usable_area_m2?: number;
  created_at: string;
};

type ValidationIssue = {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  field?: string;
};

type Obstacle = {
  type: string; x: number; y: number; w: number; h: number; label?: string;
  // x,y,w,h sind 0..1 RELATIV zur Dachfläche
};

const OBSTACLE_TYPES = [
  { v: "chimney",   l: "Schornstein", icon: "flame" as const },
  { v: "skylight",  l: "Dachfenster", icon: "sunny" as const },
  { v: "vent",      l: "Lüfter",      icon: "swap-vertical" as const },
  { v: "dormer",    l: "Gaube",       icon: "home" as const },
  { v: "antenna",   l: "Antenne",     icon: "radio" as const },
];

const FORMATS = [
  { key: "pdf",  label: "PDF",  endpoint: "/blueprint/pdf",  mime: "application/pdf",
    color: "#FF3B30", icon: "document-text" as const,
    desc: "Vektor-Blueprint im Solar-Mitte-Branding" },
  { key: "dxf",  label: "DXF",  endpoint: "/blueprint/dxf",  mime: "application/dxf",
    color: colors.primary, icon: "construct" as const,
    desc: "K2-Base-CAD mit KEEPOUT-Layer" },
  { key: "obj",  label: "OBJ",  endpoint: "/blueprint/obj",  mime: "model/obj",
    color: "#0288D1", icon: "cube" as const,
    desc: "3D-Mesh für Blender / SketchUp" },
  { key: "png",  label: "PNG",  endpoint: "/blueprint/png",  mime: "image/png",
    color: colors.accent, icon: "image" as const,
    desc: "Hochauflösendes Top-Down-Bild" },
];

type ScaffoldingResult = {
  hoehe_geruest_m: number;
  laenge_geruest_m: number;
  flaeche_m2: number;
  estimate_eur_min: number;
  estimate_eur_max: number;
  lastklasse: string;
  norm: string;
  aufbau_dauer_tage: number;
};

type GeometryResult = {
  alpha_deg: number;
  h_traufe: number; h_first: number;
  breite_traufe: number;
  sparrenlaenge_m: number;
  tiefe_horizontal_m: number;
  hoehe_dach_m: number;
  flaeche_geneigt_m2: number;
  flaeche_grundriss_m2: number;
  suggested_type: "satteldach" | "pultdach" | "walmdach" | "flachdach";
};

export default function BlueprintScreen() {
  const router = useRouter();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [photoAudits, setPhotoAudits] = useState<PhotoAudit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [showInline, setShowInline] = useState(false);
  const [validation, setValidation] = useState<{
    errors: ValidationIssue[]; warnings: ValidationIssue[]; info: ValidationIssue[];
  }>({ errors: [], warnings: [], info: [] });
  // Universal Roof Engine
  const [showEngine, setShowEngine] = useState(false);
  const [eng, setEng] = useState({ alpha: "35", h_t: "4.5", h_f: "7.5", w: "12.5" });
  const [engResult, setEngResult] = useState<{ geometry: GeometryResult; scaffolding: ScaffoldingResult } | null>(null);
  const [engBusy, setEngBusy] = useState(false);
  const [inline, setInline] = useState({
    title: "Neues Dach", laenge: "12", breite: "10", first: "10",
    walm: "0", neigung: "35", ausrichtung: "Süd",
  });

  const load = async () => {
    try {
      setAudits(await apiGet<Audit[]>("/roof-audits"));
      setPhotoAudits(await apiGet<PhotoAudit[]>("/photo-audits"));
    } catch {}
  };
  useFocusEffect(useCallback(() => { load(); }, []));

  const selected = audits.find(a => a.id === selectedId);

  const buildRequestBody = () => {
    if (selected) {
      return { audit_id: selected.id, obstacles: obstacles.map(o => ({ ...o, relative: true })) };
    }
    if (showInline) {
      return {
        title: inline.title,
        laenge: parseFloat(inline.laenge) || 0,
        breite: parseFloat(inline.breite) || 0,
        first: parseFloat(inline.first) || 0,
        walm: parseFloat(inline.walm) || 0,
        neigung: parseFloat(inline.neigung) || 35,
        ausrichtung: inline.ausrichtung,
        obstacles: obstacles.map(o => ({ ...o, relative: true })),
      };
    }
    return null;
  };

  /** Live-Validate: schickt aktuelle Daten an Backend und zeigt Issues inline. */
  const runValidate = async () => {
    const body = buildRequestBody();
    if (!body) return;
    try {
      const v = await apiPost<any>("/blueprint/validate", body);
      setValidation({ errors: v.errors || [], warnings: v.warnings || [], info: v.info || [] });
    } catch {}
  };

  // Auto-validate on changes (debounced)
  React.useEffect(() => {
    const t = setTimeout(() => { runValidate(); }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, showInline, JSON.stringify(obstacles), JSON.stringify(inline)]);

  /** Universal Roof Engine: 3 Eingaben → Geometrie + Gerüst */
  const computeEngine = async () => {
    setEngBusy(true);
    try {
      const r = await apiPost<any>("/roof-engine/compute", {
        alpha_deg: parseFloat(eng.alpha) || 0,
        h_traufe: parseFloat(eng.h_t) || 0,
        h_first: parseFloat(eng.h_f) || 0,
        breite_traufe: parseFloat(eng.w) || 0,
        obstacles_pct: obstacles,
      });
      setEngResult({ geometry: r.geometry, scaffolding: r.scaffolding });
      // Übernehme berechnete Werte in inline-Felder für Blueprint
      setInline(s => ({
        ...s,
        title: `Engine ${r.geometry.suggested_type} ${r.geometry.alpha_deg}°`,
        laenge: String(r.geometry.breite_traufe),
        breite: String(r.geometry.tiefe_horizontal_m),
        first: String(r.geometry.breite_traufe),
        walm: "0",
        neigung: String(r.geometry.alpha_deg),
      }));
      setShowInline(true);
      setSelectedId(null);
    } catch (e: any) {
      Alert.alert("Engine-Fehler", e.message);
    } finally { setEngBusy(false); }
  };

  const pushEngineToHero = async () => {
    try {
      const r = await apiPost<any>("/roof-engine/push-hero", {
        alpha_deg: parseFloat(eng.alpha) || 0,
        h_traufe: parseFloat(eng.h_t) || 0,
        h_first: parseFloat(eng.h_f) || 0,
        breite_traufe: parseFloat(eng.w) || 0,
      });
      Alert.alert(
        r.is_mock ? "HERO Sync (MOCK)" : "HERO Sync",
        `Roof-Geometrie + Gerüst-BOM (${r.scaffolding_summary.m2}m², €${r.scaffolding_summary.eur_range}) an HERO-Akte gepusht.`,
      );
    } catch (e: any) { Alert.alert("Fehler", e.message); }
  };

  const downloadFormat = async (fmt: typeof FORMATS[0]) => {
    const body = buildRequestBody();
    if (!body) {
      Alert.alert("Hinweis", "Bitte ein Aufmaß auswählen oder Werte manuell eingeben.");
      return;
    }
    // 1) Plausibilitäts-Check VOR dem Download
    try {
      const v = await apiPost<any>("/blueprint/validate", body);
      setValidation({ errors: v.errors || [], warnings: v.warnings || [], info: v.info || [] });
      if (!v.ok) {
        Alert.alert(
          "Plausibilitäts-Fehler",
          v.errors.map((e: any) => `• ${e.message}`).join("\n") +
          "\n\nBitte korrigieren — Export wurde abgebrochen.",
        );
        return;
      }
      if (v.warnings && v.warnings.length > 0) {
        // Warnungen nur loggen, nicht blocken
        console.log("Blueprint-Warnungen:", v.warnings);
      }
    } catch (e: any) {
      Alert.alert("Validate-Fehler", e.message);
      return;
    }
    setBusy(fmt.key);
    try {
      if (fmt.key === "obj") {
        const r = await apiPost<any>(fmt.endpoint, body);
        triggerDownloadText(r.obj, r.filename_obj, "model/obj");
        setTimeout(() => triggerDownloadText(r.mtl, r.filename_mtl, "model/mtl"), 600);
        Alert.alert("OBJ + MTL erstellt", `${r.filename_obj}\n+ ${r.filename_mtl}\n\nFür Blender/SketchUp.`);
      } else {
        const { blob, filename, size } = await apiDownloadBlob(
          fmt.endpoint, body, `Blueprint.${fmt.key}`,
        );
        triggerDownloadBlob(blob, filename);
        Alert.alert(`${fmt.label} erstellt`, `${filename}\n${(size / 1024).toFixed(1)} KB`);
      }
    } catch (e: any) {
      Alert.alert("Fehler", e.message || "Generierung fehlgeschlagen");
    } finally { setBusy(null); }
  };

  /** Magic-Workflow: Foto-Audit laden — übernimmt Maße + KI-Sperrflächen */
  const loadFromPhotoAudit = (pa: PhotoAudit) => {
    const dims = pa.dimensions || {};
    const L = parseFloat(dims.laenge_m || dims.laenge || 10);
    const B = parseFloat(dims.breite_m || dims.breite || 8);
    setInline({
      title: pa.title || "Foto-Aufmaß",
      laenge: String(L),
      breite: String(B),
      first: String(dims.first_m || dims.first || L * 0.9),
      walm: String(dims.walm_m || dims.walm || 0),
      neigung: String(dims.neigung || 35),
      ausrichtung: dims.ausrichtung || "Süd",
    });
    // Sperrflächen aus KI-Detection in 0..1 Prozent konvertieren
    const newObs: Obstacle[] = (pa.obstacles || []).map((o: any) => ({
      type: o.type || "obstacle",
      label: o.label || o.type || "Hindernis",
      x: (o.x_m || 0) / Math.max(L, 0.01),
      y: (o.y_m || 0) / Math.max(B, 0.01),
      w: (o.width_m || 0.5) / Math.max(L, 0.01),
      h: (o.height_m || 0.5) / Math.max(B, 0.01),
    }));
    setObstacles(newObs);
    setShowInline(true);
    setSelectedId(null);
    Alert.alert(
      "Foto-Audit geladen",
      `${L}×${B}m · ${newObs.length} KI-erkannte Sperrfläche${newObs.length === 1 ? "" : "n"} übernommen.\n\nDiese landen automatisch im KEEPOUT-Layer beim Export.`,
    );
  };

  const pushToHero = async () => {
    const body = buildRequestBody();
    if (!body) {
      Alert.alert("Hinweis", "Bitte zuerst ein Aufmaß auswählen.");
      return;
    }
    setPushing(true);
    try {
      const r = await apiPost<any>("/blueprint/push-hero", body);
      Alert.alert(
        r.is_mock ? "HERO Sync (MOCK)" : "HERO Sync",
        `PDF (${(r.pdf_size / 1024).toFixed(1)} KB) + DXF (${(r.dxf_size / 1024).toFixed(1)} KB) wurden an die HERO-Akte gepusht.`,
      );
    } catch (e: any) {
      Alert.alert("Fehler", e.message);
    } finally { setPushing(false); }
  };

  const addObstacle = (type: string) => {
    const sample: Obstacle = {
      type, label: OBSTACLE_TYPES.find(t => t.v === type)?.l,
      x: 0.4 + Math.random() * 0.2, y: 0.4 + Math.random() * 0.2,
      w: 0.06 + Math.random() * 0.04, h: 0.05 + Math.random() * 0.04,
    };
    setObstacles([...obstacles, sample]);
  };
  const removeObstacle = (idx: number) =>
    setObstacles(obstacles.filter((_, i) => i !== idx));

  const hasInput = !!selected || (showInline &&
    parseFloat(inline.laenge) > 0 && parseFloat(inline.breite) > 0 && parseFloat(inline.first) > 0);

  return (
    <SafeAreaView style={s.c} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}>

          {/* Header */}
          <View style={s.head}>
            <TouchableOpacity testID="hub-button" onPress={() => router.replace("/hub")} style={s.hubBtn}>
              <Ionicons name="grid" size={16} color={colors.primary} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Blueprint</Text>
              <Text style={s.subtitle}>Scan-to-Blueprint · PDF · DXF · OBJ · PNG</Text>
            </View>
            <View style={s.proBadge}>
              <Text style={s.proBadgeT}>PRO</Text>
            </View>
          </View>

          {/* Universal Roof Engine — Trigonometrie + Gerüst */}
          <View style={s.engineBox}>
            <TouchableOpacity onPress={() => setShowEngine(!showEngine)} style={s.engineHead} testID="toggle-engine">
              <Ionicons name="calculator" size={16} color={colors.primary} />
              <Text style={s.engineT}>UNIVERSAL ROOF ENGINE</Text>
              <View style={s.proBadge}>
                <Text style={s.proBadgeT}>PRO</Text>
              </View>
              <Ionicons name={showEngine ? "chevron-up" : "chevron-down"} size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={s.engineSub}>
              3 Eingaben → Sparrenlänge · Dachfläche · Gerüst-m² · €-Range
            </Text>

            {showEngine && (
              <View style={{ marginTop: 12, gap: 10 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <NumField label="Neigung α (°)" v={eng.alpha} set={(v: string) => setEng(s => ({ ...s, alpha: v }))} />
                  <NumField label="Trauf-Breite W (m)" v={eng.w} set={(v: string) => setEng(s => ({ ...s, w: v }))} />
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <NumField label="Traufhöhe h_T (m)" v={eng.h_t} set={(v: string) => setEng(s => ({ ...s, h_t: v }))} />
                  <NumField label="Firsthöhe h_F (m)" v={eng.h_f} set={(v: string) => setEng(s => ({ ...s, h_f: v }))} />
                </View>

                <TouchableOpacity onPress={computeEngine} disabled={engBusy} style={s.engineBtn} testID="engine-compute">
                  {engBusy ? <ActivityIndicator color="#000" />
                    : <>
                        <Ionicons name="flash" size={16} color="#000" />
                        <Text style={s.engineBtnT}>Berechnen + Übernehmen</Text>
                      </>
                  }
                </TouchableOpacity>

                {engResult && (
                  <View style={s.engineResult}>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Dachtyp</Text>
                      <Text style={s.engineVal}>{engResult.geometry.suggested_type.toUpperCase()}</Text>
                    </View>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Sparrenlänge L</Text>
                      <Text style={s.engineVal}>{engResult.geometry.sparrenlaenge_m} m</Text>
                    </View>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Tiefe (Grundriss)</Text>
                      <Text style={s.engineVal}>{engResult.geometry.tiefe_horizontal_m} m</Text>
                    </View>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Geneigte Fläche</Text>
                      <Text style={s.engineVal}>{engResult.geometry.flaeche_geneigt_m2} m²</Text>
                    </View>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Δh Dach</Text>
                      <Text style={s.engineVal}>{engResult.geometry.hoehe_dach_m} m</Text>
                    </View>

                    {/* Gerüst-Block */}
                    <View style={s.scaffoldHead}>
                      <Ionicons name="construct" size={14} color={colors.accent} />
                      <Text style={s.scaffoldT}>GERÜST-KALKULATION (DIN/ArbSchG)</Text>
                    </View>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Gerüst-Höhe</Text>
                      <Text style={s.engineVal}>{engResult.scaffolding.hoehe_geruest_m} m</Text>
                    </View>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Gerüst-Länge</Text>
                      <Text style={s.engineVal}>{engResult.scaffolding.laenge_geruest_m} m</Text>
                    </View>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Fläche</Text>
                      <Text style={[s.engineVal, { color: colors.accent }]}>{engResult.scaffolding.flaeche_m2} m²</Text>
                    </View>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Kostenrahmen</Text>
                      <Text style={[s.engineVal, { color: colors.accent }]}>
                        €{engResult.scaffolding.estimate_eur_min} – €{engResult.scaffolding.estimate_eur_max}
                      </Text>
                    </View>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Aufbau-Dauer</Text>
                      <Text style={s.engineVal}>{engResult.scaffolding.aufbau_dauer_tage} Tage</Text>
                    </View>
                    <View style={s.engineResultRow}>
                      <Text style={s.engineKey}>Lastklasse</Text>
                      <Text style={s.engineValSm}>{engResult.scaffolding.lastklasse}</Text>
                    </View>
                    <Text style={s.engineNorm}>{engResult.scaffolding.norm}</Text>

                    <TouchableOpacity onPress={pushEngineToHero} style={s.heroBtnEngine} testID="engine-push-hero">
                      <Ionicons name="cloud-upload" size={16} color="#000" />
                      <Text style={s.heroBtnT}>Gerüst-BOM an HERO pushen</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Magic Workflow: Foto-Audit → Blueprint */}
          {photoAudits.length > 0 && (
            <View style={s.magicBox}>
              <View style={s.magicHead}>
                <Ionicons name="sparkles" size={16} color={colors.accent} />
                <Text style={s.magicT}>FOTO → BLUEPRINT MAGIC</Text>
              </View>
              <Text style={s.magicSub}>
                {photoAudits.length} Foto-Aufmaß{photoAudits.length === 1 ? "" : "e"} mit
                KI-erkannten Sperrflächen verfügbar. Mit einem Klick als KEEPOUT-Zonen übernehmen.
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {photoAudits.slice(0, 5).map(pa => (
                  <TouchableOpacity
                    key={pa.id}
                    testID={`photo-audit-${pa.id}`}
                    onPress={() => loadFromPhotoAudit(pa)}
                    style={s.photoChip}
                  >
                    <Ionicons name="camera" size={12} color={colors.accent} />
                    <Text style={s.photoChipT}>{pa.title}</Text>
                    <View style={s.photoBadge}>
                      <Text style={s.photoBadgeT}>{pa.obstacles?.length || 0} ⚠️</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 1: Audit auswählen */}
          <Section title="1 · Aufmaß wählen" icon="layers">
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {audits.map(a => (
                <TouchableOpacity
                  key={a.id}
                  testID={`audit-${a.id}`}
                  onPress={() => { setSelectedId(a.id); setShowInline(false); }}
                  style={[s.auditChip, selectedId === a.id && s.auditChipActive]}
                >
                  <Ionicons name="layers" size={12}
                    color={selectedId === a.id ? "#000" : colors.textSecondary} />
                  <Text style={[s.auditChipT, selectedId === a.id && { color: "#000" }]}>
                    {a.title}
                  </Text>
                  <Text style={[s.auditChipS, selectedId === a.id && { color: "#000" }]}>
                    {a.laenge}×{a.breite}m
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => { setShowInline(!showInline); setSelectedId(null); }}
                style={[s.auditChip, showInline && s.auditChipActive]}
              >
                <Ionicons name="add" size={14} color={showInline ? "#000" : colors.primary} />
                <Text style={[s.auditChipT, showInline && { color: "#000" }]}>Manuell</Text>
              </TouchableOpacity>
            </View>

            {showInline && (
              <View style={{ marginTop: spacing.md, gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <NumField label="Trauflänge (m)" v={inline.laenge}
                    set={(v: string) => setInline(s => ({ ...s, laenge: v }))} />
                  <NumField label="Tiefe (m)" v={inline.breite}
                    set={(v: string) => setInline(s => ({ ...s, breite: v }))} />
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <NumField label="First (m)" v={inline.first}
                    set={(v: string) => setInline(s => ({ ...s, first: v }))} />
                  <NumField label="Walm (m)" v={inline.walm}
                    set={(v: string) => setInline(s => ({ ...s, walm: v }))} />
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <NumField label="Pitch (°)" v={inline.neigung}
                    set={(v: string) => setInline(s => ({ ...s, neigung: v }))} />
                  <NumField label="Bezeichnung" v={inline.title}
                    set={(v: string) => setInline(s => ({ ...s, title: v }))} numeric={false} />
                </View>
              </View>
            )}
          </Section>

          {/* Step 2: Sperrflächen */}
          <Section title="2 · Sperrflächen (Keep-out)" icon="warning">
            <Text style={s.help}>
              Markiere Schornsteine, Dachfenster oder Lüfter als „Verbotszonen". Diese werden
              im DXF auf einem eigenen Layer (KEEPOUT_OBSTACLES) gespeichert — K2-Base
              importiert sie direkt als Sperrflächen.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {OBSTACLE_TYPES.map(t => (
                <TouchableOpacity
                  key={t.v} onPress={() => addObstacle(t.v)} style={s.addObsBtn}
                  testID={`add-obstacle-${t.v}`}
                >
                  <Ionicons name={t.icon} size={14} color={colors.accent} />
                  <Text style={s.addObsT}>+ {t.l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {obstacles.length > 0 && (
              <View style={{ marginTop: spacing.md, gap: 6 }}>
                {obstacles.map((o, i) => (
                  <View key={i} style={s.obsRow}>
                    <View style={s.obsBadge}>
                      <Text style={s.obsBadgeT}>KEEPOUT</Text>
                    </View>
                    <Text style={s.obsLabel} numberOfLines={1}>
                      {o.label || o.type}
                    </Text>
                    <Text style={s.obsCoord}>
                      {(o.x * 100).toFixed(0)}/{(o.y * 100).toFixed(0)}%
                    </Text>
                    <Text style={s.obsCoord}>
                      {(o.w * 100).toFixed(0)}×{(o.h * 100).toFixed(0)}%
                    </Text>
                    <TouchableOpacity onPress={() => removeObstacle(i)}>
                      <Ionicons name="trash" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </Section>

          {/* Step 3: Export */}
          <Section title="3 · Export" icon="download">
            <Text style={s.help}>
              Wähle das gewünschte Format. Alle Dateien sind maßstabsgetreu (Meter)
              und enthalten Bemaßung, Pitch und Sperrflächen-Layer.
            </Text>

            {/* Live Validation Banner — Guardian Engine */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <View style={[
                s.guardBanner,
                { borderColor: validation.errors.length > 0 ? colors.danger : colors.accent,
                  backgroundColor: validation.errors.length > 0 ? `${colors.danger}15` : colors.accentGlow },
              ]}>
                <View style={s.guardHead}>
                  <Ionicons
                    name={validation.errors.length > 0 ? "alert-circle" : "warning"}
                    size={16}
                    color={validation.errors.length > 0 ? colors.danger : colors.accent}
                  />
                  <Text style={[s.guardT, {
                    color: validation.errors.length > 0 ? colors.danger : colors.accent,
                  }]}>
                    GUARDIAN PRÜFUNG · {validation.errors.length} Fehler · {validation.warnings.length} Warnungen
                  </Text>
                </View>
                {validation.errors.map((e, i) => (
                  <View key={`err-${i}`} style={s.guardRow}>
                    <Text style={[s.guardCode, { color: colors.danger }]}>✗ {e.code}</Text>
                    <Text style={s.guardMsg}>{e.message}</Text>
                  </View>
                ))}
                {validation.warnings.map((w, i) => (
                  <View key={`warn-${i}`} style={s.guardRow}>
                    <Text style={[s.guardCode, { color: colors.accent }]}>⚠ {w.code}</Text>
                    <Text style={s.guardMsg}>{w.message}</Text>
                  </View>
                ))}
                {validation.errors.length === 0 && validation.warnings.length > 0 && (
                  <Text style={s.guardNote}>
                    Warnungen blocken den Export nicht — nur zur Aufmerksamkeit.
                  </Text>
                )}
              </View>
            )}
            {validation.errors.length === 0 && validation.warnings.length === 0 && hasInput && (
              <View style={s.guardOk}>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                <Text style={s.guardOkT}>Plausibilitätscheck OK · alle Geometrien valide</Text>
              </View>
            )}

            <View style={{ marginTop: 10, gap: 8 }}>
              {FORMATS.map(fmt => (
                <TouchableOpacity
                  key={fmt.key}
                  testID={`export-${fmt.key}`}
                  disabled={!hasInput || busy !== null || validation.errors.length > 0}
                  onPress={() => downloadFormat(fmt)}
                  style={[
                    s.fmtBtn,
                    { borderColor: fmt.color },
                    (!hasInput || validation.errors.length > 0) && { opacity: 0.4 },
                  ]}
                >
                  <View style={[s.fmtIcon, { borderColor: fmt.color, backgroundColor: `${fmt.color}18` }]}>
                    {busy === fmt.key
                      ? <ActivityIndicator color={fmt.color} />
                      : <Ionicons name={fmt.icon} size={20} color={fmt.color} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fmtLabel}>{fmt.label}</Text>
                    <Text style={s.fmtDesc}>{fmt.desc}</Text>
                  </View>
                  <Ionicons name="download" size={18} color={fmt.color} />
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Step 4: HERO Push */}
          <Section title="4 · HERO Sync (optional)" icon="git-merge">
            <Text style={s.help}>
              Pusht PDF + DXF direkt in die HERO-Akte des Projekts.
            </Text>
            <TouchableOpacity
              testID="push-hero"
              onPress={pushToHero}
              disabled={!hasInput || pushing}
              style={[s.heroBtn, !hasInput && { opacity: 0.4 }]}
            >
              {pushing
                ? <ActivityIndicator color="#000" />
                : <>
                    <Ionicons name="cloud-upload" size={18} color="#000" />
                    <Text style={s.heroBtnT}>An HERO-Akte pushen</Text>
                  </>
              }
            </TouchableOpacity>
          </Section>

          {/* DXF-Layer-Info */}
          <View style={s.layerInfo}>
            <Text style={s.layerHead}>DXF-LAYER (K2-Base-Konvention · Goldstandard)</Text>
            {[
              ["K2_OUTLINE",  "Außenkontur Dach"],
              ["K2_RIDGE",    "First"],
              ["K2_EAVE",     "Traufe"],
              ["K2_HIP",      "Walm"],
              ["K2_DIM",      "Bemaßungen"],
              ["K2_OBSTACLE", "Sperrflächen ⚠️ (KEEP-OUT)"],
              ["K2_LABEL",    "Beschriftungen"],
              ["K2_MODULE",   "PV-Belegung"],
            ].map(([n, d]) => (
              <View key={n} style={s.layerRow}>
                <Text style={s.layerName}>{n}</Text>
                <Text style={s.layerDesc}>{d}</Text>
              </View>
            ))}
            <Text style={s.layerNote}>
              ✓ Direktimport in K2 Base ohne Umbenennen{"\n"}
              ✓ Einheit: Meter · DXF Version R2018
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, icon, children }: any) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <Ionicons name={icon} size={14} color={colors.primary} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function NumField({ label, v, set, numeric = true }: any) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.fLabel}>{label}</Text>
      <TextInput
        value={v} onChangeText={set} style={s.fInput}
        keyboardType={numeric ? "decimal-pad" : "default"}
        placeholderTextColor={colors.textDisabled}
      />
    </View>
  );
}

/** Cross-platform Download for Web (Native: TBD via expo-sharing). */
function triggerDownloadBlob(blob: Blob, filename: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}
function triggerDownloadText(content: string, filename: string, _mime: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const blob = new Blob([content], { type: "text/plain" });
    triggerDownloadBlob(blob, filename);
  }
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },

  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md },
  hubBtn: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderActive, backgroundColor: colors.primaryGlow },
  title: { ...typography.h2, fontSize: 24, marginBottom: 2 },
  subtitle: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  proBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primary },
  proBadgeT: { color: "#000", fontSize: 10, fontWeight: "900", letterSpacing: 1 },

  section: { padding: spacing.md, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" },
  help: { color: colors.textSecondary, fontSize: 12, lineHeight: 18 },

  auditChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  auditChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  auditChipT: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  auditChipS: { color: colors.textSecondary, fontSize: 10, fontWeight: "600" },

  fLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" },
  fInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, color: colors.textPrimary, fontSize: 14 },

  addObsBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentGlow,
  },
  addObsT: { color: colors.accent, fontSize: 11, fontWeight: "800" },

  obsRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 8, backgroundColor: `${colors.danger}15`, borderWidth: 1, borderColor: colors.danger },
  obsBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.danger },
  obsBadgeT: { color: "#fff", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  obsLabel: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: "700" },
  obsCoord: { color: colors.textSecondary, fontSize: 10, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },

  fmtBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, backgroundColor: colors.surface },
  fmtIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  fmtLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  fmtDesc: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },

  heroBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, marginTop: 10, backgroundColor: colors.primary },
  heroBtnT: { color: "#000", fontSize: 14, fontWeight: "900", letterSpacing: 0.5 },

  layerInfo: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginTop: spacing.sm },
  layerHead: { color: colors.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginBottom: 8 },
  layerRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  layerName: { color: colors.primary, fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontWeight: "700" },
  layerDesc: { color: colors.textSecondary, fontSize: 11 },
  layerNote: { color: colors.textSecondary, fontSize: 10, marginTop: 8, lineHeight: 14, fontStyle: "italic" },

  magicBox: {
    padding: spacing.md, borderRadius: 14,
    backgroundColor: colors.accentGlow,
    borderWidth: 2, borderColor: colors.accent,
    marginBottom: spacing.sm,
  },
  magicHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  magicT: { color: colors.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  magicSub: { color: colors.textPrimary, fontSize: 12, marginTop: 6, lineHeight: 17 },
  photoChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.bgDeep,
  },
  photoChipT: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  photoBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.accent, marginLeft: 4 },
  photoBadgeT: { color: "#000", fontSize: 9, fontWeight: "900" },

  /* Guardian Validation Banner */
  guardBanner: {
    marginTop: 10, padding: 10, borderRadius: 10,
    borderWidth: 1.5, gap: 6,
  },
  guardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  guardT: { fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  guardRow: { flexDirection: "row", gap: 8, paddingTop: 4, alignItems: "flex-start" },
  guardCode: { fontSize: 10, fontWeight: "900", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", minWidth: 110 },
  guardMsg: { flex: 1, color: colors.textPrimary, fontSize: 11, lineHeight: 16 },
  guardNote: { color: colors.textSecondary, fontSize: 10, fontStyle: "italic", marginTop: 4 },
  guardOk: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primaryGlow, borderWidth: 1, borderColor: colors.borderActive, marginTop: 10 },
  guardOkT: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },

  /* Universal Roof Engine */
  engineBox: {
    padding: spacing.md, borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 2, borderColor: colors.primary,
    marginBottom: spacing.sm,
  },
  engineHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  engineT: { color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 1.2, flex: 1 },
  engineSub: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  engineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 10, backgroundColor: colors.primary },
  engineBtnT: { color: "#000", fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  engineResult: { padding: 10, borderRadius: 10, backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.borderSoft, gap: 4 },
  engineResultRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  engineKey: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  engineVal: { color: colors.textPrimary, fontSize: 12, fontWeight: "900", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  engineValSm: { color: colors.textPrimary, fontSize: 10, fontWeight: "700" },
  engineNorm: { color: colors.textSecondary, fontSize: 9, fontStyle: "italic", marginTop: 6, textAlign: "right" },
  scaffoldHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.accent },
  scaffoldT: { color: colors.accent, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  heroBtnEngine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 10, backgroundColor: colors.accent, marginTop: 8 },
});
