import React from "react";
import Svg, { Line, Polygon, Rect, Text as SvgText, Defs, Pattern, G } from "react-native-svg";
import { colors } from "./theme";

type Props = {
  laenge: number;
  breite: number;
  walm: number;
  first: number;
  sparren: number;
  modules?: { cols: number; rows: number };
  moduleL?: number;
  moduleW?: number;
  width?: number;
  height?: number;
};

export default function RoofPlan({
  laenge, breite, walm, first, sparren,
  modules, moduleL = 1.722, moduleW = 1.134, width = 340, height = 180,
}: Props) {
  const pad = 40;
  const W = width - pad * 2;
  const H = height - pad * 2;
  const scale = Math.min(W / Math.max(laenge, 0.1), H / Math.max(breite, 0.1));
  const rw = laenge * scale;
  const rh = breite * scale;
  const ox = (width - rw) / 2;
  const oy = (height - rh) / 2;
  const walmPx = walm * scale;

  // rafter lines
  const sparrenPx = Math.max(sparren * scale, 4);
  const rafters: number[] = [];
  for (let x = ox + sparrenPx; x < ox + rw; x += sparrenPx) rafters.push(x);

  // ridge line
  const ridgeY = oy + rh / 2;
  const ridgeX1 = ox + walmPx;
  const ridgeX2 = ox + rw - walmPx;

  // roof outline polygon (with hip)
  const poly = `${ox},${oy} ${ox + rw},${oy} ${ox + rw},${oy + rh} ${ox},${oy + rh}`;

  // Modules
  const mods: { x: number; y: number; w: number; h: number }[] = [];
  if (modules && modules.cols > 0 && modules.rows > 0) {
    const edge = 0.3 * scale;
    const gap = 0.02 * scale;
    const mW = moduleL * scale;
    const mH = moduleW * scale;
    // top side
    const topY0 = oy + edge;
    const topX0 = ox + walmPx + edge;
    for (let r = 0; r < modules.rows; r++) {
      for (let c = 0; c < modules.cols; c++) {
        mods.push({
          x: topX0 + c * (mW + gap),
          y: topY0 + r * (mH + gap),
          w: mW - 1, h: mH - 1,
        });
      }
    }
    // bottom side (mirror)
    const botY0 = ridgeY + edge;
    for (let r = 0; r < modules.rows; r++) {
      for (let c = 0; c < modules.cols; c++) {
        mods.push({
          x: topX0 + c * (mW + gap),
          y: botY0 + r * (mH + gap),
          w: mW - 1, h: mH - 1,
        });
      }
    }
  }

  return (
    <Svg width={width} height={height}>
      <Defs>
        <Pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <Rect width="16" height="16" fill={colors.bg} />
          <Line x1="0" y1="0" x2="16" y2="0" stroke="#1f2a44" strokeWidth="0.5" />
          <Line x1="0" y1="0" x2="0" y2="16" stroke="#1f2a44" strokeWidth="0.5" />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#grid)" />

      {/* rafter lines */}
      <G>
        {rafters.map((x, i) => (
          <Line key={i} x1={x} y1={oy} x2={x} y2={oy + rh} stroke={colors.rafterLines} strokeWidth="0.6" opacity="0.7" />
        ))}
      </G>

      {/* PV modules */}
      {mods.map((m, i) => (
        <Rect key={i} x={m.x} y={m.y} width={m.w} height={m.h}
          fill={colors.pvModule} stroke={colors.pvModuleStroke} strokeWidth="0.8" />
      ))}

      {/* hip (Walm) diagonals + ridge */}
      {walmPx > 0 && (
        <>
          <Line x1={ox} y1={oy} x2={ridgeX1} y2={ridgeY} stroke={colors.roofOutline} strokeWidth="2" />
          <Line x1={ox} y1={oy + rh} x2={ridgeX1} y2={ridgeY} stroke={colors.roofOutline} strokeWidth="2" />
          <Line x1={ox + rw} y1={oy} x2={ridgeX2} y2={ridgeY} stroke={colors.roofOutline} strokeWidth="2" />
          <Line x1={ox + rw} y1={oy + rh} x2={ridgeX2} y2={ridgeY} stroke={colors.roofOutline} strokeWidth="2" />
        </>
      )}
      <Line x1={ridgeX1} y1={ridgeY} x2={ridgeX2} y2={ridgeY} stroke={colors.roofOutline} strokeWidth="3" />

      {/* roof outline */}
      <Polygon points={poly} fill="none" stroke={colors.roofOutline} strokeWidth="2" />

      {/* dimension labels */}
      <SvgText x={width / 2} y={oy - 12} fill={colors.textPrimary} fontSize="10" fontWeight="700" textAnchor="middle">
        Länge {laenge.toFixed(1)} m
      </SvgText>
      <SvgText x={ox - 6} y={oy + rh / 2} fill={colors.textPrimary} fontSize="10" fontWeight="700"
        textAnchor="end" transform={`rotate(-90, ${ox - 6}, ${oy + rh / 2})`}>
        Breite {breite.toFixed(1)} m
      </SvgText>
      <SvgText x={(ridgeX1 + ridgeX2) / 2} y={ridgeY - 4} fill={colors.roofOutline} fontSize="9" fontWeight="700" textAnchor="middle">
        First {first.toFixed(1)} m
      </SvgText>
      {walmPx > 0 && (
        <SvgText x={ox + walmPx / 2} y={ridgeY + 12} fill={colors.roofOutline} fontSize="9" textAnchor="middle">
          Walm {walm.toFixed(1)} m
        </SvgText>
      )}
    </Svg>
  );
}
