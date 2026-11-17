import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

const COUNT_DURATION = 420;
const PAINT_INTERVAL = 33;

/**
 * Số liệu đếm dần từ 0 mỗi lần vào tab, và từ giá trị đang hiển thị khi
 * telemetry đổi — con số không bị nhảy thô.
 */
export function AnimatedNumber({
  value,
  format,
  style,
  empty = "—",
  numberOfLines = 1,
}: {
  value: number | null;
  format: (value: number) => string;
  style?: StyleProp<TextStyle>;
  empty?: string;
  numberOfLines?: number;
}) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const focusedRef = useRef(false);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const enteredTab = focused && !focusedRef.current;
    focusedRef.current = focused;

    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }

    if (value === null) {
      shownRef.current = 0;
      return;
    }

    if (reduced || !focused) {
      shownRef.current = value;
      return;
    }

    const from = enteredTab ? 0 : shownRef.current;
    const startedAt = Date.now();
    let lastPaint = 0;
    const step = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(1, elapsed / COUNT_DURATION);
      const eased = 1 - (1 - progress) ** 3;
      const next = from + (value - from) * eased;
      shownRef.current = next;
      // Vẽ ~30fps là đủ mượt cho số đếm, giảm một nửa số lần render.
      if (progress === 1 || elapsed - lastPaint >= PAINT_INTERVAL) {
        lastPaint = elapsed;
        setShown(next);
      }
      frame.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
  }, [focused, reduced, value]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {value === null ? empty : format(reduced ? value : shown)}
    </Text>
  );
}
