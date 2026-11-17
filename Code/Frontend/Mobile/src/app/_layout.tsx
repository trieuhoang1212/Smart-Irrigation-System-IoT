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
import { Easing } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { GlassTabBar } from "@/components/navigation/GlassTabBar";
import { GardenProvider } from "@/providers/GardenProvider";
import { NotificationsProvider } from "@/providers/NotificationsProvider";
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppTabs />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppTabs() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />

      <ToastProvider>
        <NotificationsProvider>
          <GardenProvider>
            <Tabs
              tabBar={(props) => <GlassTabBar {...props} />}
              screenOptions={{
                headerShown: false,
                animation: "fade",
                // Chuyển tab chỉ mờ dần và nhích lên rất nhẹ, không lướt ngang.
                transitionSpec: {
                  animation: "timing",
                  config: { duration: 120, easing: Easing.linear },
                },
                sceneStyleInterpolator: ({ current }) => ({
                  sceneStyle: {
                    opacity: current.progress.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [0, 1, 0],
                    }),
                    transform: [
                      {
                        translateY: current.progress.interpolate({
                          inputRange: [-1, 0, 1],
                          outputRange: [4, 0, 4],
                        }),
                      },
                    ],
                  },
                }),
                sceneStyle: { backgroundColor: colors.canvas },
              }}
            >
              <Tabs.Screen name="index" options={{ title: "Tổng quan" }} />
              <Tabs.Screen name="analysis" options={{ title: "Phân tích" }} />
              <Tabs.Screen name="history" options={{ title: "Lịch sử" }} />
              <Tabs.Screen name="activity" options={{ title: "Nhật ký" }} />
              <Tabs.Screen name="garden" options={{ title: "Khu vườn" }} />
              <Tabs.Screen name="settings" options={{ title: "Cài đặt" }} />
            </Tabs>
          </GardenProvider>
        </NotificationsProvider>
      </ToastProvider>
    </>
  );
}
