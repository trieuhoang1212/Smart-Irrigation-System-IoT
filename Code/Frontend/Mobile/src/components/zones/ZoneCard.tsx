
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";

import type { LiveZone, Mode } from "../../api/types";
import { colors, radius, spacing } from "../../theme";
import { formatNumber } from "../../utils/format";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { ZoneSettingsForm } from "../settings/ZoneSettingsForm";

type Props = {
  zone: LiveZone;
  expanded?: boolean;
  onExpand?: () => void;
  onTogglePump?: (zoneId: string) => void;
  disabled?: boolean;
};

export function ZoneCard({
  zone,
  expanded = false,
  onExpand,
  onTogglePump,
  disabled = false,
}: Props) {
  const [showSettings, setShowSettings] = useState(false);

  // Trạng thái chế độ dùng để thử nghiệm giao diện.
  const [selectedMode, setSelectedMode] = useState<Mode>("auto");

  const moisture = zone.moisture;
  const needsWater = moisture !== null && moisture < zone.threshold;

  const status = zone.pump
    ? "Đang tưới"
    : moisture === null
      ? "Chưa có dữ liệu"
      : needsWater
        ? "Cần tưới"
        : "Đủ nước";

  const tone =
    zone.pump || (moisture !== null && !needsWater)
      ? "success"
      : moisture === null
        ? "neutral"
        : "warning";

  const fillWidth =
    `${Math.max(0, Math.min(100, moisture ?? 0))}%` as DimensionValue;

  const barColor =
    moisture === null
      ? colors.line
      : needsWater
        ? colors.amber
        : colors.green;

  return (
    <Card style={styles.card}>
      {/* Thông tin chính của khu vực */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onExpand}
        style={styles.main}
      >
        <View style={styles.header}>
          <View style={styles.nameBlock}>
            <Text style={styles.name} numberOfLines={1}>
              {zone.name}
            </Text>

            <Text style={styles.crop} numberOfLines={1}>
              {zone.id} · {zone.crop}
            </Text>
          </View>

          <View style={styles.headerRight}>
            <Badge label={status} tone={tone} />

            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </View>
        </View>

        <View style={styles.moistureRow}>
          <View style={styles.moistureBlock}>
            <Text style={styles.label}>Độ ẩm đất</Text>

            <Text style={styles.moisture}>
              {moisture === null
                ? "--"
                : `${formatNumber(moisture, 0)}%`}
            </Text>
          </View>

          {expanded && (
            <View style={styles.thresholdBlock}>
              <Text style={styles.label}>Ngưỡng tưới</Text>

              <Text style={styles.threshold}>
                {formatNumber(zone.threshold, 0)}%
              </Text>

              <Text style={styles.label}>
                Dừng ở {Math.min(100, zone.threshold + 20)}%
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bar}>
          <View
            style={[
              styles.barFill,
              {
                width: fillWidth,
                backgroundColor: barColor,
              },
            ]}
          />
        </View>

        {!expanded && (
          <View style={styles.thresholdRow}>
            <Text style={styles.label}>Ngưỡng tưới</Text>

            <Text style={styles.threshold}>
              {formatNumber(zone.threshold, 0)}%
            </Text>
          </View>
        )}
      </Pressable>

      {/* Các chức năng khi mở rộng thẻ */}
      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.pumpState}>
            <Ionicons
              name={zone.pump ? "water" : "water-outline"}
              size={17}
              color={zone.pump ? colors.blue : colors.faint}
            />

            <Text style={styles.pumpText}>
              {zone.pump
                ? "Máy bơm đang hoạt động"
                : "Máy bơm đang nghỉ"}
            </Text>
          </View>

          {/* Chọn chế độ hoạt động */}
          <Text style={styles.question}>Chế độ hoạt động</Text>

          <View style={styles.modeContainer}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                selected: selectedMode === "auto",
              }}
              onPress={() => {
                setSelectedMode("auto");
                setShowSettings(false);
              }}
              style={[
                styles.modeButton,
                selectedMode === "auto" && styles.modeButtonActive,
              ]}
            >
              <Ionicons
                name="sync-circle-outline"
                size={22}
                color={
                  selectedMode === "auto"
                    ? colors.white
                    : colors.greenStrong
                }
              />

              <Text
                style={[
                  styles.modeText,
                  selectedMode === "auto" && styles.modeTextActive,
                ]}
              >
                Tự động
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                selected: selectedMode === "manual",
              }}
              onPress={() => {
                setSelectedMode("manual");
                setShowSettings(false);
              }}
              style={[
                styles.modeButton,
                selectedMode === "manual" && styles.modeButtonActive,
              ]}
            >
              <Ionicons
                name="hand-left-outline"
                size={22}
                color={
                  selectedMode === "manual"
                    ? colors.white
                    : colors.greenStrong
                }
              />

              <Text
                style={[
                  styles.modeText,
                  selectedMode === "manual" && styles.modeTextActive,
                ]}
              >
                Thủ công
              </Text>
            </Pressable>
          </View>

          {/* Chế độ thủ công */}
          {selectedMode === "manual" && (
            <View style={styles.modeContent}>
              <Text style={styles.modeDescription}>
                Chủ động điều khiển máy bơm cho khu vực này.
              </Text>

              {onTogglePump && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    zone.pump
                      ? `Dừng bơm ${zone.name}`
                      : `Tưới ngay ${zone.name}`
                  }
                  disabled={disabled}
                  onPress={() => onTogglePump(zone.id)}
                  style={[
                    styles.actionButton,
                    styles.waterButton,
                    disabled && styles.disabled,
                  ]}
                >
                  <Ionicons
                    name={
                      zone.pump
                        ? "stop-circle-outline"
                        : "water-outline"
                    }
                    size={23}
                    color={colors.white}
                  />

                  <View style={styles.actionTextBlock}>
                    <Text style={styles.waterButtonText}>
                      {zone.pump ? "Dừng tưới" : "Tưới ngay"}
                    </Text>

                    <Text style={styles.waterHint}>
                      {zone.pump
                        ? "Dừng máy bơm khu vực này"
                        : "Bật máy bơm cho khu vực này"}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.white}
                  />
                </Pressable>
              )}

              <View style={styles.manualNote}>
                <Ionicons
                  name="time-outline"
                  size={17}
                  color={colors.muted}
                />
                <Text style={styles.noteText}>
                  Thời gian tưới thủ công tối đa 10 phút theo thiết kế hệ thống.
                </Text>
              </View>
            </View>
          )}

          {/* Chế độ tự động */}
          {selectedMode === "auto" && (
            <View style={styles.modeContent}>
              <Text style={styles.modeDescription}>
                Hệ thống tự tưới dựa trên ngưỡng độ ẩm đã cài đặt.
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showSettings }}
                onPress={() =>
                  setShowSettings((current) => !current)
                }
                style={styles.actionButton}
              >
                <Ionicons
                  name="options-outline"
                  size={23}
                  color={colors.greenStrong}
                />

                <View style={styles.actionTextBlock}>
                  <Text style={styles.settingsButtonText}>
                    Đặt ngưỡng tự động
                  </Text>

                  <Text style={styles.settingsHint}>
                    Cài đặt độ ẩm cho khu vực này
                  </Text>
                </View>

                <Ionicons
                  name={
                    showSettings
                      ? "chevron-up"
                      : "chevron-forward"
                  }
                  size={20}
                  color={colors.muted}
                />
              </Pressable>

              {showSettings && (
                <View style={styles.settingsForm}>
                  <ZoneSettingsForm zone={zone} embedded />

                  <Text style={styles.autoNote}>
                    Ngưỡng này được lưu riêng cho khu vực hiện tại.
                  </Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.demoNote}>
            Chế độ Auto / Manual hiện chỉ là lựa chọn giao diện thử nghiệm,
            chưa gửi lệnh chuyển chế độ đến thiết bị.
          </Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
    minWidth: 0,
  },
  main: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  crop: {
    fontSize: 11,
    color: colors.faint,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  moistureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  moistureBlock: {
    gap: 2,
  },
  thresholdBlock: {
    alignItems: "flex-end",
    gap: 3,
  },
  label: {
    fontSize: 11,
    color: colors.faint,
  },
  moisture: {
    fontSize: 27,
    fontWeight: "800",
    color: colors.ink,
  },
  bar: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.lineSoft,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: radius.pill,
  },
  thresholdRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  threshold: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.greenStrong,
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.lineSoft,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  pumpState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  pumpText: {
    fontSize: 11,
    color: colors.muted,
  },
  question: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
    marginTop: spacing.xs,
  },
  modeContainer: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  modeButtonActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  modeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.greenStrong,
  },
  modeTextActive: {
    color: colors.white,
  },
  modeContent: {
    gap: spacing.sm,
  },
  modeDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  actionButton: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  waterButton: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  actionTextBlock: {
    flex: 1,
    gap: 3,
  },
  waterButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.white,
  },
  waterHint: {
    fontSize: 11,
    color: colors.white,
  },
  settingsButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  settingsHint: {
    fontSize: 11,
    color: colors.muted,
  },
  settingsForm: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  autoNote: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
  manualNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  noteText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
  demoNote: {
    fontSize: 10,
    lineHeight: 15,
    color: colors.faint,
    fontStyle: "italic",
  },
  disabled: {
    opacity: 0.5,
  },
});
