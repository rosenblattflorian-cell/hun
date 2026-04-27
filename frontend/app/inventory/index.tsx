import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, typography, spacing } from "../../src/theme";
import { apiGet } from "../../src/api";

const CATS = [
  { key: "modules", label: "Module", icon: "sunny", color: colors.primary },
  { key: "inverters", label: "Wechselrichter", icon: "flash", color: colors.secondary },
  { key: "batteries", label: "Speicher", icon: "battery-charging", color: colors.info },
  { key: "rails", label: "Schienen", icon: "remove", color: "#A855F7" },
  { key: "hooks", label: "Dachhaken", icon: "construct", color: colors.orange },
  { key: "screws", label: "Schrauben", icon: "build", color: colors.textSecondary },
] as const;

type Cat = typeof CATS[number]["key"];

export default function Inventory() {
  const router = useRouter();
  const [cat, setCat] = useState<Cat>("inverters");
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setSummary(await apiGet("/inventory"));
      const q = search ? `?search=${encodeURIComponent(search)}` : "";
      setItems(await apiGet(`/inventory/${cat}${q}`));
    } finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { load(); }, [cat, search]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={typography.h3}>Inventar</Text>
          <Text style={s.sub}>{summary.compatibilities ?? 0} Kompatibilitäten verknüpft</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {CATS.map(c => (
          <TouchableOpacity key={c.key} onPress={() => setCat(c.key)}
            style={[s.tab, cat === c.key && { backgroundColor: c.color, borderColor: c.color }]}>
            <Ionicons name={c.icon as any} size={14} color={cat === c.key ? "#000" : c.color} />
            <Text style={[s.tabT, cat === c.key && { color: "#000" }]}>{c.label}</Text>
            <View style={[s.count, cat === c.key && { backgroundColor: "rgba(0,0,0,0.2)" }]}>
              <Text style={[s.countT, cat === c.key && { color: "#000" }]}>{summary[c.key] ?? 0}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="inv-search"
          style={s.searchInput}
          value={search} onChangeText={setSearch}
          placeholder="Hersteller, Modell, SKU..."
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={() => <View style={{ padding: 40, alignItems: "center" }}><Ionicons name="cube-outline" size={48} color={colors.textDisabled} /><Text style={{ color: colors.textSecondary, marginTop: 12 }}>Keine Artikel</Text></View>}
          renderItem={({ item }) => <ItemCard cat={cat} item={item} onPress={() => router.push(`/inventory/${cat}/${item.id}`)} />}
        />
      )}
    </SafeAreaView>
  );
}

function ItemCard({ cat, item, onPress }: any) {
  const subtitle = (() => {
    if (cat === "modules") return `${item.power_wp} Wp · ${item.efficiency_percent}% · ${item.cell_type}`;
    if (cat === "inverters") return `${item.ac_power_kw} kW · ${item.phase} · ${item.type}`;
    if (cat === "batteries") return `${item.capacity_kwh} kWh · ${item.chemistry} · ${item.cycles ?? "?"}+ Zyklen`;
    if (cat === "rails") return `${item.length_mm}mm · ${item.material} · ${item.profile ?? ""}`;
    if (cat === "hooks") return `${item.material} · ${(item.suitable_roof_types || []).join(", ")}`;
    if (cat === "screws") return `${item.diameter_mm}×${item.length_mm}mm · ${item.material} · ${item.package_size}er Pack`;
    return "";
  })();

  const stockColor = item.stock_status === "available" ? colors.primary :
    item.stock_status === "low" ? colors.secondary :
    item.stock_status === "out_of_stock" ? colors.danger : colors.textDisabled;

  return (
    <TouchableOpacity onPress={onPress} style={s.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={s.brand}>{item.manufacturer}</Text>
          <Text style={s.model} numberOfLines={2}>{item.model}</Text>
          <Text style={s.sku}>SKU {item.sku}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {item.price_net ? <Text style={s.price}>€ {item.price_net.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</Text> : null}
          <View style={[s.stock, { borderColor: stockColor }]}>
            <View style={[s.stockDot, { backgroundColor: stockColor }]} />
            <Text style={[s.stockT, { color: stockColor }]}>{item.stock_quantity ?? 0} Stk.</Text>
          </View>
        </View>
      </View>
      <Text style={s.specs}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  tabs: { padding: spacing.md, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border },
  tabT: { color: colors.textSecondary, fontWeight: "700", fontSize: 12 },
  count: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.elevated, marginLeft: 2 },
  countT: { color: colors.textSecondary, fontSize: 10, fontWeight: "700" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: spacing.md, marginBottom: 4, paddingHorizontal: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 10 },
  searchInput: { flex: 1, color: colors.textPrimary, paddingVertical: 12, fontSize: 14 },
  card: { padding: spacing.md, borderRadius: 12, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  brand: { color: colors.primary, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  model: { color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 2 },
  sku: { color: colors.textSecondary, fontSize: 11, marginTop: 4, fontFamily: "monospace" },
  price: { color: colors.textPrimary, fontSize: 16, fontWeight: "800" },
  stock: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  stockDot: { width: 6, height: 6, borderRadius: 3 },
  stockT: { fontSize: 10, fontWeight: "700" },
  specs: { color: colors.textSecondary, fontSize: 13, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
});
