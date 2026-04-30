import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
  GestureResponderEvent, Dimensions, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import Svg, { Polygon, Circle, Line, Rect, Text as SvgText, G } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, typography, spacing } from "../src/theme";
import { apiPost } from "../src/api";

type Pt = { x: number; y: number };

const COLORS = ["#00C853", "#3B82F6", "#F59E0B", "#A855F7"]; // 4 corners
const ONBOARD_KEY = "photo_audit_onboarded_v1";

export default function PhotoAudit() {
  const router = useRouter();
  const [image, setImage] = useState<{ uri: string; base64: string; w: number; h: number } | null>(null);
  const [points, setPoints] = useState<Pt[]>([]);
  const [refIdx, setRefIdx] = useState<[number, number]>([0, 1]);
  const [refMeters, setRefMeters] = useState("10");
  const [obstacleMode, setObstacleMode] = useState(false);
  const [obstacles, setObstacles] = useState<Pt[][]>([]);
  const [currentObstacle, setCurrentObstacle] = useState<Pt[]>([]);
  const [obstacleSuggestions, setObstacleSuggestions] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });

  // 3-Werte-Wizard (Easy-Mode)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizard, setWizard] = useState({ alpha: "35", h_t: "4.5", h_f: "7.5" });
  const [engineResult, setEngineResult] = useState<any>(null);

  // Onboarding
  const [onboardStep, setOnboardStep] = useState<number>(-1);
  useEffect(() => {
    AsyncStorage.getItem(ONBOARD_KEY).then(v => {
      if (!v) setOnboardStep(0);
    });
  }, []);
  const nextOnboard = async () => {
    if (onboardStep >= 2) {
      setOnboardStep(-1);
      await AsyncStorage.setItem(ONBOARD_KEY, "done");
    } else {
      setOnboardStep(onboardStep + 1);
    }
  };

  const screenW = Dimensions.get("window").width - 32;

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Berechtigung", "Galerie-Zugriff nötig");
    const r = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    const a = r.assets[0];
    setImage({
      uri: `data:image/jpeg;base64,${a.base64}`,
      base64: `data:image/jpeg;base64,${a.base64}`,
      w: a.width, h: a.height,
    });
    setPoints([]); setObstacles([]); setObstacleSuggestions([]); setResult(null);
    // Easy-Mode: 3-Werte-Wizard automatisch öffnen
    setTimeout(() => setWizardOpen(true), 400);
  };

  /** Easy-Mode Wizard: α + h_T + h_F → Engine + automatische Vorschau-Box */
  const submitWizard = async () => {
    const alpha = parseFloat(wizard.alpha) || 0;
    const h_t = parseFloat(wizard.h_t) || 0;
    const h_f = parseFloat(wizard.h_f) || 0;
    if (alpha <= 0 || h_t <= 0 || h_f <= 0 || h_f < h_t) {
      Alert.alert("Eingabe prüfen", "Alle 3 Werte müssen > 0 sein, und Firsthöhe ≥ Traufhöhe.");
      return;
    }
    // Default Trauflänge: User kann später über Referenzmaß anpassen
    const W = parseFloat(refMeters) || 10;
    try {
      const r = await apiPost<any>("/roof-engine/compute", {
        alpha_deg: alpha, h_traufe: h_t, h_first: h_f, breite_traufe: W,
      });
      setEngineResult(r);
    } catch {}

    // Vorschau-Box: zentrale Box, Seitenverhältnis W:L aus Engine
    if (image) {
      // Ideale 2D-Projektion: Bildfläche 60%, zentriert
      const padX = image.w * 0.15;
      const padY = image.h * 0.20;
      setPoints([
        { x: padX, y: padY },                           // TL
        { x: image.w - padX, y: padY },                 // TR
        { x: image.w - padX, y: image.h - padY },       // BR
        { x: padX, y: image.h - padY },                 // BL
      ]);
    }
    setWizardOpen(false);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Berechtigung", "Kamera-Zugriff nötig");
    const r = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 });
    if (r.canceled || !r.assets?.[0]?.base64) return;
    const a = r.assets[0];
    setImage({
      uri: `data:image/jpeg;base64,${a.base64}`,
      base64: `data:image/jpeg;base64,${a.base64}`,
      w: a.width, h: a.height,
    });
    setPoints([]); setObstacles([]); setObstacleSuggestions([]); setResult(null);
  };

  const canvasH = image ? Math.round(screenW * (image.h / image.w)) : 0;

  // Touch-Koordinaten in Bild-Pixel umrechnen
  const toImageCoords = (touchX: number, touchY: number): Pt => {
    if (!image) return { x: 0, y: 0 };
    return {
      x: (touchX / screenW) * image.w,
      y: (touchY / canvasH) * image.h,
    };
  };

  const handleCanvasTap = (e: GestureResponderEvent) => {
    if (!image) return;
    const { locationX, locationY } = e.nativeEvent;
    const p = toImageCoords(locationX, locationY);
    if (obstacleMode) {
      setCurrentObstacle([...currentObstacle, p]);
    } else {
      if (points.length < 4) setPoints([...points, p]);
      else {
        // ersten Punkt ersetzen (rotierend)
        const idx = points.length % 4;
        const np = [...points];
        np[idx] = p;
        setPoints(np);
      }
    }
  };

  const finishObstacle = () => {
    if (currentObstacle.length >= 3) {
      setObstacles([...obstacles, currentObstacle]);
    }
    setCurrentObstacle([]);
  };

  const detectAuto = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const r = await apiPost<any>("/photo-audit/detect-obstacles", { image_base64: image.base64 });
      setObstacleSuggestions(r.candidates || []);
      if (r.candidates.length === 0) Alert.alert("Keine Vorschläge", "Es wurden keine offensichtlichen Hindernisse erkannt. Bitte manuell markieren.");
    } catch (e: any) { Alert.alert("Fehler", e.message); }
    finally { setLoading(false); }
  };

  /** KI-Auto-Snap: erkennt automatisch die 4 Eckpunkte des Daches */
  const autoSnapCorners = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const r = await apiPost<any>("/photo-audit/auto-snap", {
        image_b64: image.base64.startsWith("data:") ? image.base64 : `data:image/jpeg;base64,${image.base64}`,
      });
      // Konvertiere 0..1 Corners → Bild-Pixel
      const newPoints = (r.corners || []).map((c: any) => ({
        x: c.x * image.w, y: c.y * image.h,
      }));
      if (newPoints.length === 4) {
        setPoints(newPoints);
        const cnf = Math.round((r.confidence || 0) * 100);
        const method = r.method === "contour" ? "KI-Erkennung" : "Heuristik";
        Alert.alert(
          `Auto-Snap (${cnf}% sicher)`,
          `${method}: 4 Eckpunkte gesetzt.\n\n${r.method === "contour"
            ? "Du kannst Punkte einzeln nachschieben."
            : "Heuristik aktiv — bitte verifizieren."}`,
        );
      } else {
        Alert.alert("Auto-Snap fehlgeschlagen", "Bitte manuell markieren.");
      }
    } catch (e: any) { Alert.alert("Auto-Snap-Fehler", e.message); }
    finally { setLoading(false); }
  };

  const acceptSuggestion = (s: any) => {
    setObstacles([...obstacles, s.polygon.map(([x, y]: number[]) => ({ x, y }))]);
    setObstacleSuggestions(obstacleSuggestions.filter(x => x !== s));
  };

  const calculate = async () => {
    if (!image || points.length !== 4) return Alert.alert("Fehlt", "Bitte alle 4 Eckpunkte markieren");
    const ref = parseFloat(refMeters);
    if (!(ref > 0)) return Alert.alert("Fehlt", "Referenzmaß muss > 0 sein");
    setLoading(true);
    try {
      const r = await apiPost<any>("/photo-audit/measure", {
        image_base64: image.base64,
        quad_points: points.map(p => [p.x, p.y]),
        reference_pair: refIdx,
        reference_meters: ref,
        obstacles: obstacles.map(poly => poly.map(p => [p.x, p.y])),
        snap: true,
      });
      setResult(r);
    } catch (e: any) { Alert.alert("Berechnung fehlgeschlagen", e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={typography.h3}>Foto-Aufmaß</Text>
          <Text style={s.sub}>KI-gestützte Perspektivkorrektur</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 80 }}>
          {!image ? (
            <View style={s.empty}>
              <Ionicons name="camera-outline" size={48} color={colors.textDisabled} />
              <Text style={s.emptyT}>Foto laden</Text>
              <Text style={s.emptyS}>Drohnenfoto, Schrägbild oder Polycam-Export</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 20 }}>
                <TouchableOpacity onPress={takePhoto} style={s.btn}><Ionicons name="camera" size={18} color="#000" /><Text style={s.btnT}>Aufnehmen</Text></TouchableOpacity>
                <TouchableOpacity onPress={pickImage} style={[s.btn, { backgroundColor: colors.elevated }]}><Ionicons name="images" size={18} color={colors.primary} /><Text style={[s.btnT, { color: colors.primary }]}>Galerie</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {/* Canvas mit Image + SVG Overlay */}
              <Text style={s.label}>{obstacleMode ? "SPERRFLÄCHE MARKIEREN" : `ECKPUNKT ${points.length + 1}/4 MARKIEREN`}</Text>
              <TouchableOpacity activeOpacity={1} onPress={handleCanvasTap}
                style={[s.canvas, { width: screenW, height: canvasH }]}
                onLayout={(e) => setCanvasSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
                <Image source={{ uri: image.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                <Svg width={screenW} height={canvasH} style={StyleSheet.absoluteFillObject} pointerEvents="none">
                  {/* Sperrflächen */}
                  {obstacles.map((poly, i) => (
                    <Polygon key={i} points={poly.map(p => `${p.x / image.w * screenW},${p.y / image.h * canvasH}`).join(" ")}
                      fill="rgba(239,68,68,0.35)" stroke={colors.danger} strokeWidth="2" />
                  ))}
                  {currentObstacle.map((p, i) => {
                    const sx = p.x / image.w * screenW, sy = p.y / image.h * canvasH;
                    return <Circle key={"co" + i} cx={sx} cy={sy} r="4" fill={colors.danger} />;
                  })}
                  {/* Vorschläge (gestrichelt) */}
                  {obstacleSuggestions.map((sg, i) => (
                    <Rect key={"sg" + i}
                      x={sg.bbox.x / image.w * screenW} y={sg.bbox.y / image.h * canvasH}
                      width={sg.bbox.w / image.w * screenW} height={sg.bbox.h / image.h * canvasH}
                      fill="rgba(245,158,11,0.20)" stroke={colors.secondary} strokeWidth="2" strokeDasharray="6,4" />
                  ))}
                  {/* Quad-Polygon */}
                  {points.length >= 2 && (
                    <Polygon points={points.map(p => `${p.x / image.w * screenW},${p.y / image.h * canvasH}`).join(" ")}
                      fill={points.length === 4 ? "rgba(0,200,83,0.15)" : "transparent"}
                      stroke={colors.primary} strokeWidth="2.5" strokeLinejoin="round" />
                  )}
                  {/* Eckpunkte mit Crosshair */}
                  {points.map((p, i) => {
                    const sx = p.x / image.w * screenW, sy = p.y / image.h * canvasH;
                    const isRef = refIdx[0] === i || refIdx[1] === i;
                    return (
                      <G key={i}>
                        <Line x1={sx - 14} y1={sy} x2={sx + 14} y2={sy} stroke={COLORS[i]} strokeWidth="2" />
                        <Line x1={sx} y1={sy - 14} x2={sx} y2={sy + 14} stroke={COLORS[i]} strokeWidth="2" />
                        <Circle cx={sx} cy={sy} r="9" fill="none" stroke={COLORS[i]} strokeWidth="2.5" />
                        <Circle cx={sx} cy={sy} r="3" fill={COLORS[i]} />
                        {isRef && <Circle cx={sx} cy={sy} r="14" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="2,2" />}
                        <SvgText x={sx + 16} y={sy - 14} fill={COLORS[i]} fontSize="13" fontWeight="800">{i + 1}</SvgText>
                      </G>
                    );
                  })}
                  {/* Referenzlinie */}
                  {points.length >= 2 && refIdx[0] < points.length && refIdx[1] < points.length && (
                    <Line
                      x1={points[refIdx[0]].x / image.w * screenW} y1={points[refIdx[0]].y / image.h * canvasH}
                      x2={points[refIdx[1]].x / image.w * screenW} y2={points[refIdx[1]].y / image.h * canvasH}
                      stroke="#fff" strokeWidth="1.5" strokeDasharray="6,3" />
                  )}
                </Svg>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <SmallBtn icon="refresh" label="Reset" onPress={() => { setPoints([]); setObstacles([]); setObstacleSuggestions([]); setResult(null); }} />
                <SmallBtn icon="trash-outline" label="Letzter Punkt" onPress={() => obstacleMode ? setCurrentObstacle(currentObstacle.slice(0, -1)) : setPoints(points.slice(0, -1))} />
                <SmallBtn icon="image" label="Neues Foto" onPress={pickImage} />
              </View>

              {/* KI-Auto-Snap Hero-Button */}
              <TouchableOpacity
                onPress={autoSnapCorners}
                disabled={loading}
                style={[s.snapBtn, loading && { opacity: 0.5 }]}
                testID="auto-snap-btn"
                activeOpacity={0.85}
              >
                <View style={s.snapIcon}>
                  {loading
                    ? <ActivityIndicator color="#000" />
                    : <Ionicons name="flash" size={20} color="#000" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.snapT}>KI-AUTO-SNAP</Text>
                  <Text style={s.snapS}>Eckpunkte automatisch erkennen</Text>
                </View>
                <Ionicons name="sparkles" size={18} color="#000" />
              </TouchableOpacity>

              {/* Referenz */}
              <Text style={s.label}>REFERENZMAß</Text>
              <View style={s.refRow}>
                <Text style={s.refTxt}>Pkt</Text>
                {[0, 1, 2, 3].map(i => (
                  <TouchableOpacity key={i} onPress={() => setRefIdx([i, refIdx[1] === i ? refIdx[0] : refIdx[1]])}
                    style={[s.refBtn, refIdx[0] === i && { backgroundColor: COLORS[i], borderColor: COLORS[i] }]}>
                    <Text style={[s.refBtnT, refIdx[0] === i && { color: "#000" }]}>{i + 1}</Text>
                  </TouchableOpacity>
                ))}
                <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} style={{ marginHorizontal: 4 }} />
                {[0, 1, 2, 3].map(i => (
                  <TouchableOpacity key={i} onPress={() => setRefIdx([refIdx[0] === i ? refIdx[1] : refIdx[0], i])}
                    style={[s.refBtn, refIdx[1] === i && { backgroundColor: COLORS[i], borderColor: COLORS[i] }]}>
                    <Text style={[s.refBtnT, refIdx[1] === i && { color: "#000" }]}>{i + 1}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.refInputRow}>
                <TextInput style={s.refInput} value={refMeters} onChangeText={setRefMeters} keyboardType="decimal-pad" />
                <Text style={s.refUnit}>m</Text>
              </View>
              <Text style={s.hint}>Tipp: Trauflänge ist meist die genaueste Referenz (z.B. 10–15m)</Text>

              {/* Sperrflächen-Tools */}
              <Text style={s.label}>SPERRFLÄCHEN ({obstacles.length})</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity onPress={() => setObstacleMode(!obstacleMode)}
                  style={[s.smallBtn, obstacleMode && { backgroundColor: colors.danger, borderColor: colors.danger }]}>
                  <Ionicons name={obstacleMode ? "checkmark" : "add"} size={14} color={obstacleMode ? "#fff" : colors.danger} />
                  <Text style={[s.smallBtnT, obstacleMode && { color: "#fff" }]}>{obstacleMode ? "Modus AN — tippen" : "Manuell markieren"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={detectAuto} style={s.smallBtn} disabled={loading}>
                  <Ionicons name="sparkles" size={14} color={colors.secondary} />
                  <Text style={[s.smallBtnT, { color: colors.secondary }]}>Auto-Erkennung</Text>
                </TouchableOpacity>
              </View>
              {obstacleMode && currentObstacle.length > 0 && (
                <TouchableOpacity onPress={finishObstacle} style={[s.smallBtn, { marginTop: 8, alignSelf: "flex-start", backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <Ionicons name="checkmark-done" size={14} color="#000" />
                  <Text style={[s.smallBtnT, { color: "#000" }]}>Polygon schließen ({currentObstacle.length} Pkt.)</Text>
                </TouchableOpacity>
              )}
              {obstacleSuggestions.map((sg, i) => (
                <View key={i} style={s.sugRow}>
                  <Ionicons name={sg.kind === "schornstein" ? "business" : "albums"} size={16} color={colors.secondary} />
                  <Text style={s.sugT}>{sg.kind === "schornstein" ? "Schornstein" : "Dachfenster"} (Conf {sg.confidence})</Text>
                  <TouchableOpacity onPress={() => acceptSuggestion(sg)} style={s.sugBtn}><Text style={s.sugBtnT}>Übernehmen</Text></TouchableOpacity>
                </View>
              ))}

              {/* Berechnen */}
              <TouchableOpacity onPress={calculate} disabled={loading || points.length !== 4} style={[s.calcBtn, (loading || points.length !== 4) && { opacity: 0.5 }]}>
                {loading ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Ionicons name="calculator" size={18} color="#000" />
                    <Text style={s.calcBtnT}>Maße berechnen</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Ergebnis */}
              {result && (
                <View style={{ marginTop: 24 }}>
                  <Text style={s.resultTitle}>ERGEBNIS</Text>
                  <View style={s.resultGrid}>
                    <ResultCard label="Breite" v={`${result.dimensions.width_m} m`} />
                    <ResultCard label="Höhe" v={`${result.dimensions.height_m} m`} />
                    <ResultCard label="Fläche" v={`${result.dimensions.area_m2} m²`} highlight />
                    <ResultCard label="Nutzbar" v={`${result.usable_area_m2} m²`} highlight color={colors.secondary} />
                    <ResultCard label="Sperrflächen" v={`${result.obstacle_area_m2} m²`} color={colors.danger} />
                    <ResultCard label="Rechteckigkeit" v={`${(result.dimensions.rectangularity_score * 100).toFixed(0)}%`} />
                  </View>
                  <Text style={s.label}>ORTHOFOTO (Draufsicht)</Text>
                  <Image source={{ uri: result.rectified_image_base64 }} style={s.ortho} resizeMode="contain" />
                  <Text style={s.hint}>
                    Skala: {(result.scale_meters_per_pixel_rectified * 1000).toFixed(2)} mm / Pixel ·
                    Diag {result.dimensions.diagonal_1_m}/{result.dimensions.diagonal_2_m} m
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══════════ 3-WERTE-WIZARD ═══════════ */}
      <Modal visible={wizardOpen} transparent animationType="slide"
             onRequestClose={() => setWizardOpen(false)}>
        <View style={s.wizOverlay}>
          <View style={s.wizBox}>
            <View style={s.wizHead}>
              <Ionicons name="flash" size={22} color={colors.accent} />
              <Text style={s.wizT}>NUR 3 WERTE</Text>
              <TouchableOpacity onPress={() => setWizardOpen(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={s.wizSub}>
              Für perfekte Präzision benötigt die KI nur diese 3 Werte:
            </Text>

            <View style={s.wizField}>
              <View style={s.wizFieldHead}>
                <Ionicons name="triangle-outline" size={14} color={colors.primary} />
                <Text style={s.wizLabel}>Dachneigung α</Text>
                <Text style={s.wizHint}>(°)</Text>
              </View>
              <TextInput value={wizard.alpha}
                onChangeText={v => setWizard({ ...wizard, alpha: v })}
                style={s.wizInput} keyboardType="decimal-pad"
                placeholder="z.B. 35" placeholderTextColor={colors.textDisabled} />
              <Text style={s.wizTip}>Typisch 30–45° bei Satteldächern</Text>
            </View>

            <View style={s.wizField}>
              <View style={s.wizFieldHead}>
                <Ionicons name="arrow-up" size={14} color={colors.primary} />
                <Text style={s.wizLabel}>Traufhöhe h_T</Text>
                <Text style={s.wizHint}>(m vom Boden zur Traufkante)</Text>
              </View>
              <TextInput value={wizard.h_t}
                onChangeText={v => setWizard({ ...wizard, h_t: v })}
                style={s.wizInput} keyboardType="decimal-pad"
                placeholder="z.B. 4.5" placeholderTextColor={colors.textDisabled} />
            </View>

            <View style={s.wizField}>
              <View style={s.wizFieldHead}>
                <Ionicons name="arrow-up-circle" size={14} color={colors.primary} />
                <Text style={s.wizLabel}>Firsthöhe h_F</Text>
                <Text style={s.wizHint}>(m vom Boden zum Firstpunkt)</Text>
              </View>
              <TextInput value={wizard.h_f}
                onChangeText={v => setWizard({ ...wizard, h_f: v })}
                style={s.wizInput} keyboardType="decimal-pad"
                placeholder="z.B. 7.5" placeholderTextColor={colors.textDisabled} />
            </View>

            <TouchableOpacity onPress={submitWizard} style={s.wizBtn} testID="wizard-submit">
              <Ionicons name="flash" size={18} color="#000" />
              <Text style={s.wizBtnT}>Übernehmen & Vorschau-Box</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setWizardOpen(false)} style={s.wizSkip}>
              <Text style={s.wizSkipT}>Überspringen (manuell markieren)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══════════ ONBOARDING (nur beim ersten Aufruf) ═══════════ */}
      {onboardStep >= 0 && (
        <View style={s.obOverlay}>
          <View style={s.obCard}>
            <View style={s.obStep}>
              <Text style={s.obStepN}>{onboardStep + 1}/3</Text>
            </View>
            <Ionicons
              name={onboardStep === 0 ? "image-outline" : onboardStep === 1 ? "scan" : "sparkles"}
              size={32} color={colors.primary} />
            <Text style={s.obTitle}>
              {onboardStep === 0 && "Schritt 1: Foto wählen"}
              {onboardStep === 1 && "Schritt 2: Eckpunkte grob markieren"}
              {onboardStep === 2 && "Schritt 3: Maße & Blueprint"}
            </Text>
            <Text style={s.obText}>
              {onboardStep === 0 && "Nimm ein Foto deines Dachs auf oder wähle eins aus der Galerie. Je direkter von oben, desto besser die KI-Erkennung."}
              {onboardStep === 1 && "Die KI hilft dir mit Auto-Snap! Oder setze die 4 Eckpunkte (TL, TR, BR, BL) mit dem Finger — grob reicht."}
              {onboardStep === 2 && "Gib die 3 Kernmaße ein (Neigung, Traufhöhe, Firsthöhe). Die Engine berechnet alles andere — Blueprint fertig in Sekunden!"}
            </Text>
            <TouchableOpacity onPress={nextOnboard} style={s.obNext}>
              <Text style={s.obNextT}>
                {onboardStep < 2 ? "Weiter" : "Loslegen"}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => {
              setOnboardStep(-1);
              await AsyncStorage.setItem(ONBOARD_KEY, "skipped");
            }}>
              <Text style={s.obSkip}>Überspringen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </SafeAreaView>
  );
}

function SmallBtn({ icon, label, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={s.smallBtn}>
      <Ionicons name={icon} size={14} color={colors.textPrimary} />
      <Text style={s.smallBtnT}>{label}</Text>
    </TouchableOpacity>
  );
}

function ResultCard({ label, v, highlight, color = colors.textPrimary }: any) {
  return (
    <View style={[s.resCard, highlight && { borderColor: color, backgroundColor: `${color}18` }]}>
      <Text style={s.resL}>{label}</Text>
      <Text style={[s.resV, { color }]}>{v}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  empty: { padding: 50, alignItems: "center", borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  emptyT: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", marginTop: 12 },
  emptyS: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  btn: { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderRadius: 10, backgroundColor: colors.primary, paddingHorizontal: 18 },
  btnT: { color: "#000", fontWeight: "800" },
  label: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 18, marginBottom: 8 },
  canvas: { borderRadius: 12, overflow: "hidden", backgroundColor: "#000", borderWidth: 1, borderColor: colors.border, alignSelf: "center" },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },

  /* Easy-Mode Auto-Snap Hero-Button */
  snapBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, marginTop: 12,
    backgroundColor: colors.primary,
    borderWidth: 2, borderColor: colors.primary,
    ...Platform.select({
      ios: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  snapIcon: {
    width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  snapT: { color: "#000", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  snapS: { color: "rgba(0,0,0,0.7)", fontSize: 11, marginTop: 1 },

  /* 3-Werte-Wizard Modal */
  wizOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 20 },
  wizBox: { width: "100%", maxWidth: 400, backgroundColor: colors.paper, borderRadius: 20, padding: 20, borderWidth: 2, borderColor: colors.accent, gap: 12 },
  wizHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  wizT: { flex: 1, color: colors.accent, fontSize: 14, fontWeight: "900", letterSpacing: 1.4 },
  wizSub: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  wizField: { gap: 6 },
  wizFieldHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  wizLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: "800", flex: 1 },
  wizHint: { color: colors.textSecondary, fontSize: 10 },
  wizInput: { backgroundColor: colors.bgDeep, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  wizTip: { color: colors.textSecondary, fontSize: 10, fontStyle: "italic" },
  wizBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, backgroundColor: colors.primary, marginTop: 6 },
  wizBtnT: { color: "#000", fontSize: 14, fontWeight: "900", letterSpacing: 0.6 },
  wizSkip: { padding: 8, alignItems: "center" },
  wizSkipT: { color: colors.textSecondary, fontSize: 11, textDecorationLine: "underline" },

  /* Onboarding */
  obOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20, zIndex: 999 },
  obCard: { width: "100%", maxWidth: 360, backgroundColor: colors.paper, borderRadius: 20, padding: 24, borderWidth: 2, borderColor: colors.primary, gap: 12, alignItems: "center" },
  obStep: { position: "absolute", top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.primary },
  obStepN: { color: "#000", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  obTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "900", textAlign: "center" },
  obText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: "center" },
  obNext: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, paddingHorizontal: 24, borderRadius: 999, backgroundColor: colors.primary, marginTop: 6 },
  obNextT: { color: "#000", fontSize: 14, fontWeight: "900", letterSpacing: 0.6 },
  obSkip: { color: colors.textSecondary, fontSize: 11, textDecorationLine: "underline", marginTop: 4 },
  smallBtnT: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
  refRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  refTxt: { color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginRight: 4 },
  refBtn: { width: 30, height: 30, borderRadius: 999, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  refBtnT: { color: colors.textPrimary, fontWeight: "800", fontSize: 13 },
  refInputRow: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14 },
  refInput: { flex: 1, color: colors.textPrimary, padding: 12, fontSize: 18, fontWeight: "700" },
  refUnit: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  hint: { color: colors.textDisabled, fontSize: 11, marginTop: 6, fontStyle: "italic" },
  sugRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.secondary },
  sugT: { color: colors.textPrimary, fontSize: 13, flex: 1 },
  sugBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.secondary, borderRadius: 6 },
  sugBtnT: { color: "#000", fontSize: 11, fontWeight: "800" },
  calcBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 12, backgroundColor: colors.primary, marginTop: 24 },
  calcBtnT: { color: "#000", fontWeight: "800", fontSize: 16 },
  resultTitle: { color: colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 },
  resultGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  resCard: { width: "48%", padding: 12, borderRadius: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  resL: { color: colors.textSecondary, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" },
  resV: { fontSize: 22, fontWeight: "800", marginTop: 4 },
  ortho: { width: "100%", aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: "#000", borderWidth: 1, borderColor: colors.border },
});
