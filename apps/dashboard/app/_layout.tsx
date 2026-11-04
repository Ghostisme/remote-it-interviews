import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display";
import { ToastProvider, tokens as t } from "@odyssey/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppShell } from "../src/components/layout";

/** Compose the shared query cache, bundled fonts, notifications, and responsive application shell. */
export default function Layout() {
  // Keep one cache instance for the lifetime of this root layout.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10000, retry: 1, refetchOnWindowFocus: true },
          // Business hooks explicitly control retries and order idempotency keys.
          mutations: { retry: false },
        },
      }),
  );
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    DMSerifDisplay_400Regular,
  });
  // Continue rendering if fonts fail so a loading indicator cannot block the entire app.
  if (!fontsLoaded && !fontError)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: t.color.canvas,
        }}
      >
        <ActivityIndicator color={t.color.brand} />
      </View>
    );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <StatusBar style="dark" />
          <AppShell>
            <Slot />
          </AppShell>
        </ToastProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
