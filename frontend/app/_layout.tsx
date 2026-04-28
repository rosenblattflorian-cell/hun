import React from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../src/auth";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { colors } from "../src/theme";
import { SafeAreaProvider } from "react-native-safe-area-context";

function Gate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  React.useEffect(() => {
    if (user === undefined) return;
    const inAuth = segments[0] === "login";
    const inMonteur = segments[0] === "monteur";
    if (!user && !inAuth) router.replace("/login");
    else if (user && inAuth) {
      // Rollen-basierter Redirect nach Login
      if (user.role === "monteur") router.replace("/monteur");
      else router.replace("/(tabs)/dashboard");
    } else if (user && user.role === "monteur" && !inMonteur) {
      // Monteur darf nur Monteur-Bereich sehen
      router.replace("/monteur");
    }
  }, [user, segments]);

  if (user === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Gate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="customer/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="project/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="calendar" options={{ presentation: "card" }} />
            <Stack.Screen name="photo-audit" options={{ presentation: "card" }} />
            <Stack.Screen name="planning" options={{ presentation: "card" }} />
            <Stack.Screen name="quote/new" options={{ presentation: "card" }} />
            <Stack.Screen name="monteur/index" options={{ presentation: "card" }} />
            <Stack.Screen name="monteur/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="inventory/index" options={{ presentation: "card" }} />
            <Stack.Screen name="inventory/[cat]/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="audit/new" options={{ presentation: "modal" }} />
          </Stack>
        </Gate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
