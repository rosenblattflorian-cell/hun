import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <Ionicons name="grid" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kunden"
        options={{
          title: "Kunden",
          tabBarIcon: ({ color }) => <Ionicons name="people" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="aufmass"
        options={{
          title: "Aufmaß",
          tabBarIcon: ({ color }) => <Ionicons name="scan" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="projekte"
        options={{
          title: "Projekte",
          tabBarIcon: ({ color }) => <Ionicons name="briefcase" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mehr"
        options={{
          title: "Mehr",
          tabBarIcon: ({ color }) => <Ionicons name="ellipsis-horizontal" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
