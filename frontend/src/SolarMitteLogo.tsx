/**
 * Solar Mitte Logo — exakte SVG-Nachbildung der Vorlage.
 * Schwarzer Kreis · 24 gelbe Sonnenstrahlen · "SOLAR" grün · "MITTE" gelb.
 */
import React from "react";
import Svg, { Circle, Rect, Text as SvgText, G } from "react-native-svg";
import { View } from "react-native";
import { colors } from "./theme";

export function SolarMitteLogo({ size = 120, withText = true }: { size?: number; withText?: boolean }) {
  const cx = size / 2;
  const cy = size / 2;
  const r_inner = size * 0.35;       // schwarzer Kreis
  const r_ray_in = size * 0.42;       // Strahl-Innenradius
  const r_ray_out = size * 0.49;      // Strahl-Außenradius

  // 24 Strahlen (alternierend lang/kurz für authentisches Aussehen)
  const rays = [];
  const RAY_COUNT = 28;
  for (let i = 0; i < RAY_COUNT; i++) {
    const angle = (i * 360) / RAY_COUNT;
    const isLong = i % 2 === 0;
    const len = isLong ? r_ray_out : r_ray_out * 0.85;
    rays.push({ angle, len });
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Sonnenstrahlen */}
        <G>
          {rays.map((r, i) => (
            <Rect
              key={i}
              x={cx - 1.5}
              y={cy - r.len}
              width={3}
              height={r.len - r_ray_in}
              fill={colors.accent}
              transform={`rotate(${r.angle} ${cx} ${cy})`}
              rx="1"
            />
          ))}
        </G>
        {/* Schwarzer Kreis als Bühne */}
        <Circle cx={cx} cy={cy} r={r_inner} fill="#000000" />
        {withText && (
          <>
            {/* "SOLAR" grün */}
            <SvgText
              x={cx} y={cy - size * 0.02}
              fontSize={size * 0.16}
              fontWeight="900"
              fill={colors.primary}
              textAnchor="middle"
              fontFamily="Helvetica-Bold"
            >
              SOLAR
            </SvgText>
            {/* "MITTE" gelb */}
            <SvgText
              x={cx} y={cy + size * 0.13}
              fontSize={size * 0.09}
              fontWeight="900"
              fill={colors.accent}
              textAnchor="middle"
              fontFamily="Helvetica-Bold"
              letterSpacing={size * 0.012}
            >
              MITTE
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

/** Wortmarke (horizontal) — wie auf Beschilderung/Auto. */
export function SolarMitteWordmark({ height = 60, dark = false }: { height?: number; dark?: boolean }) {
  const w = height * 4.2;
  return (
    <View style={{ width: w, height, justifyContent: "center" }}>
      <Svg width={w} height={height} viewBox={`0 0 ${w} ${height}`}>
        <Rect x={0} y={0} width={w} height={height} rx={height * 0.12}
              fill={dark ? "transparent" : "#FFFFFF"} />
        {/* SOLAR (groß, grün) */}
        <SvgText
          x={w / 2} y={height * 0.55}
          fontSize={height * 0.55}
          fontWeight="900"
          fill={colors.primary}
          textAnchor="middle"
          fontFamily="Helvetica-Bold"
          letterSpacing={height * 0.02}
        >
          SOLAR
        </SvgText>
        {/* Striche links/rechts vom MITTE */}
        <Rect x={w * 0.18} y={height * 0.78} width={w * 0.18} height={height * 0.05} fill={colors.accent} rx={2} />
        <Rect x={w * 0.64} y={height * 0.78} width={w * 0.18} height={height * 0.05} fill={colors.accent} rx={2} />
        {/* MITTE (klein, gelb) */}
        <SvgText
          x={w / 2} y={height * 0.87}
          fontSize={height * 0.22}
          fontWeight="900"
          fill={colors.accent}
          textAnchor="middle"
          fontFamily="Helvetica-Bold"
          letterSpacing={height * 0.04}
        >
          MITTE
        </SvgText>
      </Svg>
    </View>
  );
}
