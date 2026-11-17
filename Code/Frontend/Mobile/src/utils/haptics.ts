import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const native = Platform.OS === "ios" || Platform.OS === "android";

// Rung rất nhẹ khi chọn qua lại; web không có phản hồi rung nên bỏ qua.
export function tickHaptic() {
  if (!native) return;
  void Haptics.selectionAsync();
}

// Rung rõ hơn một nhịp cho thao tác điều khiển thiết bị.
export function pressHaptic() {
  if (!native) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
