import { useState } from "react";
import { Image, StyleSheet, Text, View, type DimensionValue } from "react-native";

import { assetUrl } from "../../api/garden";
import type { LiveZone } from "../../api/types";
import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatNumber } from "../../utils/format";
import { AppIcon } from "../ui/AppIcon";
import { Badge, type BadgeTone } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

export function ZoneSheet({
  zone,
  onClose,
  onEdit,
}: {
  zone: LiveZone | null;
  onClose: () => void;
  onEdit: (zoneId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { mode, pending, toggleZonePump } = useGarden();

  // Giữ khu vực vừa đóng để sheet còn chạy được animation trượt xuống.
  const [lastZone, setLastZone] = useState<LiveZone | null>(zone);
  if (zone && zone !== lastZone) setLastZone(zone);

  const displayed = zone ?? lastZone;
  if (!displayed) return null;

  const moisture = displayed.moisture;
  const hasMoisture = moisture !== null;
  const needsWater = hasMoisture && moisture < displayed.threshold;

  const status = displayed.pump
    ? "Đang tưới"
    : needsWater
      ? "Cần tưới"
      : "Đủ ẩm";

  const tone: BadgeTone =
    displayed.pump || !needsWater ? "success" : "warning";

  const fillWidth = `${Math.max(0, Math.min(100, moisture ?? 0))}%` as DimensionValue;
  const markerLeft = `${Math.max(0, Math.min(100, displayed.threshold))}%` as DimensionValue;

  const pumpDisabled = Boolean(pending) || !displayed.online || mode !== "manual";

  const pumpLabel = !displayed.online
    ? "Thiết bị mất kết nối"
    : mode !== "manual"
      ? "Cần chế độ thủ công"
      : displayed.pump
        ? "Tắt tưới khu vực"
        : "Bật tưới khu vực";

  return (
    <Sheet
      visible={zone !== null}
      onClose={onClose}
      title={displayed.name}
    >
      <Text style={styles.subtitle}>
        {displayed.id} · {displayed.crop} · {displayed.group}
      </Text>

      <ZoneCover
        key={`${displayed.id}-${displayed.photoUrl ?? ""}`}
        zone={displayed}
      />

      <View style={styles.summary}>
        <Text
          style={[styles.moisture, moisture === null && styles.moistureEmpty]}
          numberOfLines={1}
        >
          {moisture === null
            ? "Chưa có dữ liệu"
            : `${formatNumber(moisture, 0)}%`}
        </Text>

        {hasMoisture ? <Badge label={status} tone={tone} /> : null}
      </View>

      <View>
        <View style={styles.track}>
          <View
            style={[
              styles.trackFill,
              {
                width: fillWidth,
                backgroundColor: needsWater ? colors.amber : colors.green,
              },
            ]}
          />

          <View style={[styles.marker, { left: markerLeft }]} />
        </View>

        <View style={styles.trackLegend}>
          <Text style={styles.legend}>Độ ẩm đất</Text>
          <Text style={styles.legend}>
            Ngưỡng tưới {formatNumber(displayed.threshold, 0)}%
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat
          label="Dừng tưới"
          value={`${formatNumber(displayed.stopThreshold, 0)}%`}
        />
        <Stat
          label="Lưu lượng"
          value={`${formatNumber(displayed.flowLitersPerHour, 0)} L/giờ`}
        />
        <Stat
          label="Mỗi lần"
          value={`${formatNumber(displayed.targetLiters, 1)} L`}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label={pumpLabel}
          variant={displayed.pump ? "danger" : "primary"}
          disabled={pumpDisabled}
          onPress={() => void toggleZonePump(displayed.id)}
        />

        <Button
          label="Chỉnh thông số tưới"
          variant="secondary"
          onPress={() => onEdit(displayed.id)}
        />
      </View>
    </Sheet>
  );
}

/** Ảnh khu vườn do người dùng tải lên; chưa có ảnh thì hiện khung gợi ý. */
function ZoneCover({ zone }: { zone: LiveZone }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const photo = assetUrl(zone.photoUrl);
  const [broken, setBroken] = useState(false);

  if (!photo || broken) {
    return (
      <View style={styles.cover}>
        <View style={styles.coverEmpty}>
          <View style={styles.coverBadge}>
            <AppIcon name="leaf" size={16} color={colors.green} />
          </View>
          <Text style={styles.coverEmptyText}>Chưa có ảnh khu vườn</Text>
          <Text style={styles.coverHint}>Thêm ảnh trong tab Khu vườn</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cover}>
      <Image
        source={{ uri: photo }}
        resizeMode="cover"
        onError={() => setBroken(true)}
        accessibilityRole="image"
        accessibilityLabel={`Ảnh khu vườn ${zone.name}`}
        style={styles.coverImage}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    subtitle: {
      ...typo.small,
      color: colors.muted,
      marginTop: -6,
    },
    cover: {
      height: 168,
      borderRadius: 12,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.lineSoft,
      backgroundColor: colors.surfaceSunken,
    },
    coverImage: {
      width: "100%",
      height: "100%",
    },
    coverEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    coverBadge: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.greenSoft,
    },
    coverEmptyText: {
      ...typo.small,
      color: colors.muted,
    },
    coverHint: {
      ...typo.caption,
      color: colors.faint,
    },
    summary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    moisture: {
      ...typo.display,
      color: colors.ink,
    },
    moistureEmpty: {
      ...typo.section,
      color: colors.muted,
    },
    track: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.lineSoft,
    },
    trackFill: {
      height: "100%",
      borderRadius: 999,
    },
    marker: {
      position: "absolute",
      top: -4,
      bottom: -4,
      width: 2,
      borderRadius: 999,
      backgroundColor: colors.amber,
    },
    trackLegend: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
    },
    legend: {
      ...typo.caption,
      color: colors.faint,
    },
    stats: {
      flexDirection: "row",
      gap: 8,
    },
    stat: {
      flex: 1,
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.surfaceSunken,
      gap: 2,
    },
    statLabel: {
      ...typo.caption,
      color: colors.muted,
    },
    statValue: {
      ...typo.bodyStrong,
      color: colors.ink,
    },
    actions: {
      gap: 8,
      paddingTop: 2,
    },
  });
