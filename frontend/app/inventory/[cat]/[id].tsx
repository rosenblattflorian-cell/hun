import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../../../src/theme";
import { apiGet } from "../../../src/api";

const REL_COLOR: any = {
  erforderlich: colors.danger,
  empfohlen: colors.primary,
  passt_zu: colors.info,
  nicht_empfohlen: colors.textDisabled,
};
const REL_LABEL: any = {
  erforderlich: "Erforderlich",
  empfohlen: "Empfohlen",
  passt_zu: "Passt zu",
  nicht_empfohlen: "Nicht empfohlen",
};
const REL_ICON: any = {
  erforderlich: "alert-circle",
  empfohlen: "star",
  passt_zu: "link",
  nicht_empfohlen: "close-circle",
};

const TYPE_LABEL: any = {
  solar_module: "Modul", inverter: "Wechselrichter", battery: "Speicher",
  mounting_rail: "Schiene", roof_hook: "Dachhaken", screw: "Schraube",
  roof_type: "Dachtyp", tile_manufacturer: "Ziegelhersteller",
};
const TYPE_PLURAL: any = {
  solar_module: "modules", inverter: "inverters", battery: "batteries",
  mounting_rail: "rails", roof_hook: "hooks", screw: "screws",
};
const TYPE_ICON: any = {
  solar_module: "sunny", inverter: "flash", battery: "battery-charging",
  mounting_rail: "remove", roof_hook: "construct", screw: "build",
  roof_type: "home", tile_manufacturer: "business",
};

export default function InventoryDetail() {
  const { cat, id } = useLocalSearchParams<{ cat: string; id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setData(await apiGet(`/inventory/${cat}/${id}`)); }
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, [cat, id]));

  if (loading || !data) return <ActivityIndicator color={colors.primary} style={{ flex: 1, backgroundColor: colors.bg }} />;

  // Gruppieren nach Relation
  const grouped: Record<string, any[]> = {};
  (data.compatibilities || []).forEach((c: any) => {
    grouped[c.relation] = grouped[c.relation] || [];
    grouped[c.relation].push(c);
  });

  // Spec-Felder
  const specFields = (() => {
    if (cat === "modules") return [
      ["Leistung", `${data.power_wp} Wp`], ["Wirkungsgrad", `${data.efficiency_percent}%`],
      ["Zelltyp", data.cell_type], ["Maße", `${data.length_mm}×${data.width_mm}×${data.thickness_mm}mm`],
      ["Gewicht", `${data.weight_kg} kg`], ["Voc", `${data.voc_v} V`], ["Isc", `${data.isc_a} A`],
      ["Glas", data.glass_type], ["Bifazial", data.bifacial ? "Ja" : "Nein"],
    ];
    if (cat === "inverters") return [
      ["AC-Leistung", `${data.ac_power_kw} kW`], ["DC max", `${data.dc_max_power_kw ?? "-"} kW`],
      ["Typ", data.type], ["Phase", data.phase], ["MPPT", `${data.mppt_count} Tracker`],
      ["IP", data.protection_class || "-"], ["Batterie-IF", data.with_battery_interface ? "Ja" : "Nein"],
      ["Monitoring", (data.monitoring || []).join(", ")],
    ];
    if (cat === "batteries") return [
      ["Kapazität", `${data.capacity_kwh} kWh`], ["Nutzbar", `${data.usable_capacity_kwh ?? "-"} kWh`],
      ["Chemie", data.chemistry], ["Zyklen", `${data.cycles ?? "-"}`],
      ["Max Entladung", `${data.max_discharge_kw ?? "-"} kW`],
      ["Stapelbar", data.stackable ? `${data.min_modules}–${data.max_modules} Module` : "Nein"],
      ["Notstrom", data.emergency_power ? "Ja" : "Nein"],
      ["Temperatur", data.operating_temp_range_c || "-"],
    ];
    if (cat === "rails") return [
      ["Material", data.material], ["Länge", `${data.length_mm}mm`],
      ["Profil", data.profile || "-"], ["Last", `${data.load_capacity_kg_m ?? "-"} kg/m`],
      ["Geeignet für", (data.suitable_for || []).join(", ")],
    ];
    if (cat === "hooks") return [
      ["Material", data.material], ["Verstellbar", data.height_adjustable ? "Ja" : "Nein"],
      ["Traglast", `${data.max_load_n ?? "-"} N`], ["Gewinde", data.thread_size || "-"],
      ["Dächer", (data.suitable_roof_types || []).join(", ")],
    ];
    if (cat === "screws") return [
      ["Typ", data.type], ["Material", data.material],
      ["Maße", `${data.diameter_mm} × ${data.length_mm}mm`],
      ["Kopf", data.head_type || "-"], ["VPE", `${data.package_size} Stück`],
    ];
    return [];
  })();

  const stockColor = data.stock_status === "available" ? colors.primary :
    data.stock_status === "low" ? colors.secondary :
    data.stock_status === "out_of_stock" ? colors.danger : colors.textDisabled;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
        <Text style={s.headT}>Artikel-Detail</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 60 }}>
        {/* Header Card */}
        <View style={s.card}>
          <Text style={s.brand}>{data.manufacturer}</Text>
          <Text style={s.title}>{data.model}</Text>
          <Text style={s.sku}>SKU {data.sku}</Text>
          {data.description ? <Text style={s.desc}>{data.description}</Text> : null}
          <View style={s.headRow}>
            {data.price_net ? <View style={s.headStat}><Text style={s.headStatV}>€ {data.price_net.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text><Text style={s.headStatL}>Netto</Text></View> : null}
            <View style={s.headStat}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: stockColor }} />
                <Text style={[s.headStatV, { color: stockColor }]}>{data.stock_quantity}</Text>
              </View>
              <Text style={s.headStatL}>Lagerbestand</Text>
            </View>
            {data.warranty_years ? <View style={s.headStat}><Text style={s.headStatV}>{data.warranty_years} J.</Text><Text style={s.headStatL}>Garantie</Text></View> : null}
          </View>
        </View>

        {/* Specs */}
        <Text style={s.sectionT}>TECHNISCHE DATEN</Text>
        <View style={s.specsCard}>
          {specFields.map(([k, v], i) => (
            <View key={i} style={[s.specRow, i === specFields.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={s.specK}>{k}</Text>
              <Text style={s.specV}>{String(v)}</Text>
            </View>
          ))}
        </View>

        {/* Zertifizierungen */}
        {(data.certifications || []).length > 0 && (
          <>
            <Text style={s.sectionT}>ZERTIFIZIERUNGEN</Text>
            <View style={s.chipRow}>
              {data.certifications.map((c: string, i: number) => (
                <View key={i} style={s.certChip}><Ionicons name="shield-checkmark" size={12} color={colors.primary} /><Text style={s.certT}>{c}</Text></View>
              ))}
            </View>
          </>
        )}

        {/* KOMPATIBILITÄTS-GRAPH (Hauptfeature) */}
        <Text style={s.sectionT}>KOMPATIBILITÄTEN ({data.compatibilities?.length ?? 0})</Text>

        {(data.compatibilities?.length ?? 0) === 0 ? (
          <View style={s.emptyCompat}>
            <Ionicons name="git-network-outline" size={36} color={colors.textDisabled} />
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Noch keine Verknüpfungen</Text>
          </View>
        ) : (
          // In gewünschter Reihenfolge: erforderlich → empfohlen → passt_zu → nicht_empfohlen
          ["erforderlich", "empfohlen", "passt_zu", "nicht_empfohlen"]
            .filter(rel => grouped[rel])
            .map(rel => (
              <View key={rel} style={s.relGroup}>
                <View style={s.relHead}>
                  <Ionicons name={REL_ICON[rel]} size={16} color={REL_COLOR[rel]} />
                  <Text style={[s.relLabel, { color: REL_COLOR[rel] }]}>{REL_LABEL[rel]}</Text>
                  <Text style={s.relCount}>{grouped[rel].length}</Text>
                </View>
                {grouped[rel].map((c: any) => (
                  <CompatItem key={c.edge_id} compat={c} onPress={() => {
                    if (c.partner && c.partner_type in TYPE_PLURAL) {
                      router.push(`/inventory/${TYPE_PLURAL[c.partner_type]}/${c.partner_id}`);
                    }
                  }} />
                ))}
              </View>
            ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CompatItem({ compat, onPress }: any) {
  const partnerName = compat.partner
    ? `${compat.partner.manufacturer} ${compat.partner.model}`
    : compat.partner_key || "Unbekannt";
  const isClickable = !!compat.partner && compat.partner_type in TYPE_PLURAL;

  return (
    <TouchableOpacity onPress={onPress} disabled={!isClickable} style={[s.compatItem, !isClickable && { opacity: 0.85 }]}>
      <View style={[s.compatIcon, { borderColor: REL_COLOR[compat.relation] }]}>
        <Ionicons name={TYPE_ICON[compat.partner_type] || "ellipse"} size={16} color={REL_COLOR[compat.relation]} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={s.compatType}>{TYPE_LABEL[compat.partner_type] || compat.partner_type}</Text>
          <Ionicons name={compat.direction === "outgoing" ? "arrow-forward" : "arrow-back"} size={10} color={colors.textDisabled} />
        </View>
        <Text style={s.compatName} numberOfLines={1}>{partnerName}</Text>
        {compat.rule_context ? <Text style={s.compatCtx} numberOfLines={2}>{compat.rule_context}</Text> : null}
        {compat.certified_by ? <Text style={s.compatCert}>✓ {compat.certified_by}</Text> : null}
      </View>
      {isClickable && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headT: { ...typography.h3, fontSize: 17 },
  card: { padding: spacing.md, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  brand: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" },
  title: { color: colors.textPrimary, fontSize: 22, fontWeight: "800", marginTop: 4, lineHeight: 28 },
  sku: { color: colors.textSecondary, fontSize: 11, marginTop: 6, fontFamily: "monospace" },
  desc: { color: colors.textSecondary, fontSize: 13, marginTop: 10, lineHeight: 19 },
  headRow: { flexDirection: "row", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 16 },
  headStat: { alignItems: "flex-start" },
  headStatV: { color: colors.textPrimary, fontSize: 18, fontWeight: "800" },
  headStatL: { color: colors.textSecondary, fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 1 },
  sectionT: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginTop: 24, marginBottom: 10 },
  specsCard: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md },
  specRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  specK: { color: colors.textSecondary, fontSize: 13 },
  specV: { color: colors.textPrimary, fontSize: 13, fontWeight: "700", maxWidth: "60%", textAlign: "right" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  certChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: `${colors.primary}18`, borderWidth: 1, borderColor: colors.primary },
  certT: { color: colors.primary, fontSize: 11, fontWeight: "700" },
  emptyCompat: { padding: 30, alignItems: "center", backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
  relGroup: { marginBottom: 14, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  relHead: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.elevated },
  relLabel: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, flex: 1 },
  relCount: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },
  compatItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  compatIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, backgroundColor: colors.bg },
  compatType: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  compatName: { color: colors.textPrimary, fontSize: 14, fontWeight: "700", marginTop: 2 },
  compatCtx: { color: colors.textSecondary, fontSize: 11, marginTop: 2, fontStyle: "italic" },
  compatCert: { color: colors.primary, fontSize: 10, marginTop: 2, fontWeight: "700" },
});
