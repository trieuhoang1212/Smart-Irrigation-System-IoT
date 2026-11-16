import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";

import { darkPalette, lightPalette, type Palette } from "../theme/palette";

export type ThemeMode = "system" | "light" | "dark";

type ThemeContextValue = {
  colors: Palette;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const STORAGE_KEY = "greenflow.theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "system" || value === "light" || value === "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    let disposed = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!disposed && isThemeMode(stored)) setModeState(stored);
      })
      .catch(() => {
        // Không đọc được bộ nhớ thì giữ theme hệ thống.
      });

    return () => {
      disposed = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Ghi thất bại không chặn thao tác đổi theme trong phiên hiện tại.
    });
  }, []);

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";

  const value = useMemo<ThemeContextValue>(() => {
    const colors = isDark ? darkPalette : lightPalette;
    return {
      colors,
      mode,
      isDark,
      setMode,
      toggle: () => setMode(isDark ? "light" : "dark"),
    };
  }, [isDark, mode, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
