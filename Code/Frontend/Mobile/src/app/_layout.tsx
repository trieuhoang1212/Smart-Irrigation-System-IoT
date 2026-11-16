import {
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
  Lexend_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/lexend";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { Tabs } from "expo-router/js-tabs";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { GlassTabBar } from "@/components/navigation/GlassTabBar";
import { GardenProvider } from "@/providers/GardenProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { ToastProvider } from "@/providers/ToastProvider";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
    Lexend_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppTabs />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppTabs() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ToastProvider>
        <GardenProvider>
          <Tabs
            tabBar={(props) => <GlassTabBar {...props} />}
            screenOptions={{
              headerShown: false,
              animation: "fade",
              sceneStyle: { backgroundColor: colors.canvas },
            }}
          >
            <Tabs.Screen name="index" options={{ title: "Tổng quan" }} />
            <Tabs.Screen name="analysis" options={{ title: "Phân tích" }} />
            <Tabs.Screen name="history" options={{ title: "Lịch sử" }} />
            <Tabs.Screen name="activity" options={{ title: "Nhật ký" }} />
            <Tabs.Screen name="settings" options={{ title: "Cài đặt" }} />
          </Tabs>
        </GardenProvider>
      </ToastProvider>
    </>
  );
}
