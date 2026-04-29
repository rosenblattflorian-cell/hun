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
    const inKunde = segments[0] === "kunde";
    if (!user && !inAuth) router.replace("/login");
    else if (user && inAuth) {
      if (user.role === "monteur") router.replace("/monteur");
      else if (user.role === "customer") router.replace("/kunde");
      else router.replace("/hub");
    } else if (user && user.role === "monteur" && !inMonteur) {
      router.replace("/monteur");
    } else if (user && user.role === "customer" && !inKunde) {
      router.replace("/kunde");
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
            <Stack.Screen name="hub" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="customer/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="project/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="calendar" options={{ presentation: "card" }} />
            <Stack.Screen name="photo-audit" options={{ presentation: "card" }} />
            <Stack.Screen name="planning" options={{ presentation: "card" }} />
            <Stack.Screen name="quote/new" options={{ presentation: "card" }} />
            <Stack.Screen name="monteur/index" options={{ presentation: "card" }} />
            <Stack.Screen name="monteur/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="kunde/index" options={{ presentation: "card" }} />
            <Stack.Screen name="hero-sync" options={{ presentation: "card" }} />
            <Stack.Screen name="inventory/index" options={{ presentation: "card" }} />
            <Stack.Screen name="inventory/[cat]/[id]" options={{ presentation: "card" }} />
            <Stack.Screen name="audit/new" options={{ presentation: "modal" }} />
          </Stack>
        </Gate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
