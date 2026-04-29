/**
 * RoofViewer3D — universal Komponente für den Customer-Twin
 *
 * Web (Three.js / react-three-fiber):
 *   Lädt das OBJ-Mesh des Daches via /api/blueprint/obj und rendert es interaktiv
 *   (drehen, zoomen). Solar-Mitte-Branding für Material.
 *
 * Native (Mobile, React Native):
 *   Fallback: Lädt ein hochauflösendes Top-Down-PNG via /api/blueprint/png mit
 *   Pinch/Pan-Geste (animiert), so sieht der Kunde sein digitales Dach auch ohne
 *   EAS Custom Dev Build.
 */
import React, { useEffect, useState, Suspense } from "react";
import { View, Text, StyleSheet, Platform, ActivityIndicator, Image } from "react-native";
import { colors } from "./theme";
import { apiPost, API_BASE } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Props = {
  auditId?: string | null;
  // Inline-Fallback für Direkt-Werte (wenn kein audit_id)
  inline?: {
    laenge: number; breite: number; first: number;
    walm?: number; neigung?: number; ausrichtung?: string;
    title?: string;
  };
  height?: number;
};

export function RoofViewer3D({ auditId, inline, height = 320 }: Props) {
  if (Platform.OS === "web") {
    return <WebViewer auditId={auditId} inline={inline} height={height} />;
  }
  return <MobileViewer auditId={auditId} inline={inline} height={height} />;
}

/* =================== WEB VIEWER (Three.js) =================== */

function WebViewer({ auditId, inline, height }: Props) {
  const [meshData, setMeshData] = useState<{ vertices: number[][]; faces: number[][] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError(null);
        const body = auditId ? { audit_id: auditId } : (inline ? { ...inline } : null);
        if (!body) { setError("Kein Aufmaß verknüpft"); return; }
        const r = await apiPost<{ obj: string; mtl: string }>("/blueprint/obj", body);
        if (!alive) return;
        const parsed = parseObj(r.obj);
        setMeshData(parsed);
      } catch (e: any) { if (alive) setError(e.message || "OBJ-Lade-Fehler"); }
    })();
    return () => { alive = false; };
  }, [auditId, JSON.stringify(inline)]);

  if (error) return <ViewerError msg={error} height={height} />;
  if (!meshData) return <ViewerLoading height={height} label="Digitalen Zwilling laden..." />;

  // Lazy load three components only on web
  return <ThreeCanvas mesh={meshData} height={height} />;
}

function ThreeCanvas({ mesh, height }: { mesh: any; height: number }) {
  // Dynamic require so Native bundler doesn't crash
  let Canvas: any = null;
  let extend: any = null;
  let useFrame: any = null;
  let THREE: any = null;
  try {
    const r3f = require("@react-three/fiber");
    Canvas = r3f.Canvas;
    extend = r3f.extend;
    useFrame = r3f.useFrame;
    THREE = require("three");
  } catch {
    return <ViewerError msg="3D-Engine nicht verfügbar" height={height} />;
  }

  return (
    <View style={[s.canvasWrap, { height }]}>
      <Canvas
        camera={{ position: [12, 10, 12], fov: 50, near: 0.1, far: 200 }}
        style={{ background: colors.bgDeep }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 10]} intensity={1.0} castShadow />
        <hemisphereLight args={[0xffffff, 0x222222, 0.4]} />
        <Suspense fallback={null}>
          <RoofMesh mesh={mesh} THREE={THREE} useFrame={useFrame} />
          <GroundPlane THREE={THREE} />
        </Suspense>
        <axesHelper args={[6]} />
        <gridHelper args={[30, 30, "#1E2D45", "#152740"]} />
      </Canvas>
      <View style={s.canvasOverlay}>
        <Text style={s.overlayT}>Solar Mitte · Digitaler Dach-Zwilling</Text>
        <Text style={s.overlayHint}>Maus ziehen = drehen · Mausrad = zoomen</Text>
      </View>
    </View>
  );
}

function RoofMesh({ mesh, THREE, useFrame }: any) {
  const meshRef = React.useRef<any>(null);

  // Build geometry from parsed OBJ
  const geometry = React.useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions: number[] = [];
    for (const f of mesh.faces) {
      // Convert quads/tris to triangles (fan from vertex 0)
      for (let i = 1; i < f.length - 1; i++) {
        const v0 = mesh.vertices[f[0] - 1];
        const v1 = mesh.vertices[f[i] - 1];
        const v2 = mesh.vertices[f[i + 1] - 1];
        positions.push(v0[0], v0[2], -v0[1]);  // Y-up swap (OBJ Z up)
        positions.push(v1[0], v1[2], -v1[1]);
        positions.push(v2[0], v2[2], -v2[1]);
      }
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    g.center();  // Center mesh
    return g;
  }, [mesh, THREE]);

  // Auto-Rotate
  useFrame((state: any, delta: number) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.15;
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        color="#A0522D" metalness={0.05} roughness={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GroundPlane({ THREE }: any) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#0A1628" roughness={0.9} />
    </mesh>
  );
}

/* =================== MOBILE VIEWER (PNG Fallback) =================== */

function MobileViewer({ auditId, inline, height }: Props) {
  const [pngUri, setPngUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const body = auditId ? { audit_id: auditId } : (inline ? { ...inline } : null);
        if (!body) { setError("Kein Aufmaß verknüpft"); return; }
        const token = await AsyncStorage.getItem("access_token");
        // Native: data-URI über fetch und base64
        const r = await fetch(`${API_BASE}/api/blueprint/png`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) { setError("PNG-Fehler"); return; }
        const blob = await r.blob();
        const reader = new FileReader();
        reader.onload = () => alive && setPngUri(reader.result as string);
        reader.readAsDataURL(blob);
      } catch (e: any) { if (alive) setError(e.message); }
    })();
    return () => { alive = false; };
  }, [auditId, JSON.stringify(inline)]);

  if (error) return <ViewerError msg={error} height={height} />;
  if (!pngUri) return <ViewerLoading height={height} label="Plan rendern..." />;

  return (
    <View style={[s.mobileWrap, { height }]}>
      <Image source={{ uri: pngUri }} style={s.mobileImg} resizeMode="contain" />
      <View style={s.canvasOverlay}>
        <Text style={s.overlayT}>Solar Mitte · Mein digitales Dach</Text>
        <Text style={s.overlayHint}>Top-Down Plan · für 3D im Browser öffnen</Text>
      </View>
    </View>
  );
}

/* =================== HELPERS =================== */

function ViewerLoading({ height, label }: { height: number; label: string }) {
  return (
    <View style={[s.loading, { height }]}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={s.loadingT}>{label}</Text>
    </View>
  );
}

function ViewerError({ msg, height }: { msg: string; height: number }) {
  return (
    <View style={[s.loading, { height, borderColor: colors.danger, backgroundColor: `${colors.danger}10` }]}>
      <Text style={[s.loadingT, { color: colors.danger }]}>3D-Twin nicht verfügbar</Text>
      <Text style={s.loadingHint}>{msg}</Text>
    </View>
  );
}

function parseObj(obj: string): { vertices: number[][]; faces: number[][] } {
  const verts: number[][] = [];
  const faces: number[][] = [];
  for (const line of obj.split("\n")) {
    const t = line.trim();
    if (t.startsWith("v ")) {
      const p = t.split(/\s+/).slice(1).map(parseFloat);
      verts.push(p);
    } else if (t.startsWith("f ")) {
      const p = t.split(/\s+/).slice(1).map(s => parseInt(s.split("/")[0], 10));
      faces.push(p);
    }
  }
  return { vertices: verts, faces };
}

const s = StyleSheet.create({
  canvasWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderActive,
    backgroundColor: colors.bgDeep,
    position: "relative",
  },
  canvasOverlay: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(10,22,40,0.85)",
    borderWidth: 1,
    borderColor: colors.borderActive,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overlayT: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  overlayHint: { color: colors.textSecondary, fontSize: 9 },
  mobileWrap: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderActive,
    backgroundColor: "#fff",
    position: "relative",
  },
  mobileImg: { width: "100%", height: "100%" },
  loading: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingT: { color: colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  loadingHint: { color: colors.textSecondary, fontSize: 11 },
});
