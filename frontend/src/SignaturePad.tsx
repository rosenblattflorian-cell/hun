/**
 * SVG-basierter Signature-Pad — emittiert Strokes als JSON.
 * Das Backend zeichnet die Polylines direkt im PDF mit ReportLab.
 */
import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, PanResponder } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { monteurColors } from "./monteurTheme";

export type SigPoint = [number, number];
export type SigStroke = SigPoint[];

export function SignaturePad({
  onChange, height = 180, width = 320,
}: {
  onChange: (strokes: SigStroke[], hasContent: boolean) => void;
  height?: number; width?: number;
}) {
  const [version, setVersion] = useState(0);
  const strokesRef = useRef<SigStroke[]>([]);

  const commit = () => {
    setVersion(v => v + 1);
    onChange(strokesRef.current, strokesRef.current.some(s => s.length > 1));
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      strokesRef.current.push([[locationX, locationY]]);
      commit();
    },
    onPanResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      const cur = strokesRef.current[strokesRef.current.length - 1];
      if (cur) {
        cur.push([locationX, locationY]);
        // Throttle re-renders during move
        if (cur.length % 2 === 0) commit();
      }
    },
    onPanResponderRelease: () => commit(),
  })).current;

  const clear = () => { strokesRef.current = []; commit(); };

  const pathFor = (s: SigStroke) =>
    s.length === 0 ? "" : s.reduce((acc, [x, y], i) => acc + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`), "");

  return (
    <View style={s.wrap}>
      <View style={[s.canvas, { width, height }]} {...responder.panHandlers}>
        <Svg width={width} height={height}>
          <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
          {strokesRef.current.map((stroke, i) => (
            <Path key={`${version}-${i}`}
              d={pathFor(stroke)}
              stroke="#000000" strokeWidth="2.5" fill="none"
              strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
      </View>
      <View style={s.row}>
        <TouchableOpacity onPress={clear} style={s.btn}>
          <Text style={s.btnT}>Löschen</Text>
        </TouchableOpacity>
        <Text style={s.hint}>Mit Finger oder Stylus unterschreiben</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: 12, overflow: "hidden", backgroundColor: monteurColors.card, padding: 8, borderWidth: 2, borderColor: monteurColors.border },
  canvas: { borderRadius: 8, overflow: "hidden", backgroundColor: "#FFFFFF" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingHorizontal: 4 },
  btn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: monteurColors.borderSoft, borderWidth: 1, borderColor: monteurColors.textDim },
  btnT: { color: monteurColors.text, fontWeight: "800", fontSize: 13 },
  hint: { color: monteurColors.textDim, fontSize: 11 },
});
