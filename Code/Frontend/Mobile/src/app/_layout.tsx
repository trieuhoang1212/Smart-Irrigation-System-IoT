import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { GardenProvider } from "@/providers/GardenProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { colors } from "@/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ToastProvider>
        <GardenProvider>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: colors.green,
              tabBarInactiveTintColor: colors.faint,
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopColor: colors.line,
              },
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: "600",
              },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: "Tổng quan",
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? "grid" : "grid-outline"} size={size} color={typeof color === "string" ? color : colors.faint} />
                ),
              }}
            />
            <Tabs.Screen
              name="history"
              options={{
                title: "Lịch sử",
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons
                    name={focused ? "analytics" : "analytics-outline"}
                    size={size}
                    color={typeof color === "string" ? color : colors.faint}
                  />
                ),
              }}
            />
            <Tabs.Screen
              name="settings"
              options={{
                title: "Cấu hình",
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons
                    name={focused ? "options" : "options-outline"}
                    size={size}
                    color={typeof color === "string" ? color : colors.faint}
                  />
                ),
              }}
            />
          </Tabs>
        </GardenProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
