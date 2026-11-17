import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LiveZone, ZoneConfigInput } from "../../api/types";
import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { font, spacing, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import { formatNumber } from "../../utils/format";
import { Button } from "../ui/Button";
import { NumberField } from "../ui/NumberField";

type Draft = {
  threshold: number;
  flowLitersPerHour: string;
  targetLiters: string;
};

type Props = {
  zone: LiveZone;
};

const THRESHOLD_MIN = 10;
const THRESHOLD_MAX = 90;
const THRESHOLD_STEP = 5;
const STOP_OFFSET = 20;
// Firmware chỉ chạy trong khoảng 10 giây - 10 phút mỗi lần.
const MIN_RUNTIME_SECONDS = 10;
const MAX_RUNTIME_MINUTES = 10;

function toDraft(zone: LiveZone): Draft {
  return {
    threshold: Math.round(zone.threshold),
    flowLitersPerHour: String(zone.flowLitersPerHour),
    targetLiters: String(zone.targetLiters),
  };
}

function parseNumber(value: string): number {
  return Number(value.replace(",", "."));
}

function validate(
  draft: Draft
): { input: ZoneConfigInput } | { error: string } {
  const flow = parseNumber(draft.flowLitersPerHour);
  const target = parseNumber(draft.targetLiters);

  // Firmware đọc lưu lượng bằng %d nên chỉ nhận số nguyên.
  if (!Number.isInteger(flow) || flow < 1 || flow > 200) {
    return {
      error: "Lưu lượng bơm phải là số nguyên từ 1 đến 200 L/giờ.",
    };
  }

  if (!Number.isFinite(target) || target < 0.1 || target > 20) {
    return {
      error: "Lượng nước mục tiêu phải từ 0.1 đến 20 L.",
    };
  }

  if ((target / flow) * 60 > MAX_RUNTIME_MINUTES) {
    return {
      error: `Mục tiêu cần hơn ${MAX_RUNTIME_MINUTES} phút mỗi lần. Hạ lượng nước hoặc tăng lưu lượng.`,
    };
  }
  if ((target / flow) * 3600 < MIN_RUNTIME_SECONDS) {
    return {
      error: `Mỗi lần chạy dưới ${MIN_RUNTIME_SECONDS} giây. Tăng lượng nước hoặc giảm lưu lượng.`,
    };
  }

  return {
    input: {
      threshold: draft.threshold,
      flowLitersPerHour: flow,
      targetLiters: target,
    },
  };
}

function ThresholdStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.threshold}>
      <View style={styles.thresholdRow}>
        <Text style={styles.thresholdLabel}>Bắt đầu tưới dưới</Text>

        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Giảm ngưỡng tưới"
            hitSlop={6}
            onPress={() => onChange(Math.max(THRESHOLD_MIN, value - THRESHOLD_STEP))}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <Text style={styles.stepSymbol}>−</Text>
          </Pressable>

          <Text style={styles.stepValue}>{value}%</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tăng ngưỡng tưới"
            hitSlop={6}
            onPress={() => onChange(Math.min(THRESHOLD_MAX, value + THRESHOLD_STEP))}
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <Text style={styles.stepSymbol}>+</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.thresholdHint}>
        Dừng khi độ ẩm đạt {Math.min(100, value + STOP_OFFSET)}%.
      </Text>
    </View>
  );
}

export function ZoneSettingsForm({ zone }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { saveZone } = useGarden();

  const [draft, setDraft] = useState<Draft>(() => toDraft(zone));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flow = parseNumber(draft.flowLitersPerHour);
  const target = parseNumber(draft.targetLiters);

  const estimateMinutes =
    Number.isFinite(flow) &&
    flow > 0 &&
    Number.isFinite(target) &&
    target > 0
      ? (target / flow) * 60
      : null;

  const runtimeWarning =
    estimateMinutes === null
      ? null
      : estimateMinutes > MAX_RUNTIME_MINUTES
        ? `Vượt ${MAX_RUNTIME_MINUTES} phút mỗi lần, thiết bị sẽ tự dừng trước khi đủ nước.`
        : estimateMinutes * 60 < MIN_RUNTIME_SECONDS
          ? `Ngắn hơn ${MIN_RUNTIME_SECONDS} giây tối thiểu của thiết bị.`
          : null;

  const estimateLabel =
    estimateMinutes === null
      ? "—"
      : estimateMinutes < 1
        ? `≈ ${formatNumber(estimateMinutes * 60, 0)} giây`
        : `≈ ${formatNumber(estimateMinutes, 1)} phút`;

  const runtimeRatio =
    estimateMinutes === null ? 0 : estimateMinutes / MAX_RUNTIME_MINUTES;
  const runtimePercent = Math.min(100, Math.round(runtimeRatio * 100));
  const runtimeColor =
    runtimeRatio > 1
      ? colors.red
      : runtimeRatio > 0.75
        ? colors.amber
        : colors.greenStrong;

  const update = (field: keyof Draft, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = async () => {
    const result = validate(draft);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const saved = await saveZone(zone.id, result.input);
      if (!saved) {
        setError("Không lưu được cấu hình. Kiểm tra Backend rồi thử lại.");
      }
    } catch {
      setError("Không thể lưu cấu hình. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Ngưỡng tưới</Text>

        <ThresholdStepper
          value={draft.threshold}
          onChange={(threshold) => {
            setDraft((current) => ({
              ...current,
              threshold,
            }));
          }}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Lượng nước mỗi lần</Text>

        <View style={styles.amounts}>
          <View style={styles.amountCell}>
            <NumberField
              label="Lưu lượng bơm"
              hint="1 – 200"
              unit="L/giờ"
              value={draft.flowLitersPerHour}
              onChangeText={(value) => update("flowLitersPerHour", value)}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.amountRule} />

          <View style={styles.amountCell}>
            <NumberField
              label="Nước mục tiêu"
              hint="0.1 – 20"
              unit="L"
              value={draft.targetLiters}
              onChangeText={(value) => update("targetLiters", value)}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      </View>

      <View style={styles.summary}>
        <View style={styles.summaryHead}>
          <Text style={styles.summaryLabel}>Thời gian mỗi lần tưới</Text>

          <Text style={[styles.summaryValue, { color: runtimeColor }]}>
            {estimateLabel}
          </Text>
        </View>

        <View style={styles.track}>
          <View
            style={[
              styles.trackFill,
              { width: `${runtimePercent}%`, backgroundColor: runtimeColor },
            ]}
          />
        </View>

        <Text style={styles.summaryNote}>
          {estimateMinutes === null
            ? "Nhập lưu lượng và lượng nước để xem thời gian."
            : `Bơm ${formatNumber(target, 1)} L mỗi lần · tối đa ${MAX_RUNTIME_MINUTES} phút.`}
        </Text>

        {runtimeWarning ? (
          <Text style={styles.warning}>{runtimeWarning}</Text>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Lưu cấu hình"
        variant="primary"
        loading={saving}
        onPress={() => void submit()}
        style={styles.save}
      />
    </View>
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    form: {
      gap: 16,
    },
    section: {
      gap: 7,
    },
    sectionLabel: {
      fontFamily: font.semibold,
      fontSize: 9.5,
      lineHeight: 12,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.faint,
    },
    threshold: {
      gap: 3,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.lineSoft,
      backgroundColor: colors.greenSoft,
    },
    thresholdRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    thresholdLabel: {
      flexShrink: 1,
      fontFamily: font.medium,
      fontSize: 12,
      lineHeight: 17,
      color: colors.inkSoft,
    },
    thresholdHint: {
      fontFamily: font.regular,
      fontSize: 11,
      lineHeight: 16,
      color: colors.muted,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    stepButton: {
      width: 32,
      height: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    stepSymbol: {
      fontFamily: font.medium,
      fontSize: 16,
      lineHeight: 19,
      color: colors.greenStrong,
    },
    stepValue: {
      minWidth: 46,
      textAlign: "center",
      fontFamily: font.semibold,
      fontSize: 16,
      lineHeight: 21,
      fontVariant: ["tabular-nums"],
      color: colors.ink,
    },
    pressed: {
      opacity: 0.55,
    },
    amounts: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 12,
    },
    amountCell: {
      flex: 1,
      minWidth: 0,
    },
    amountRule: {
      width: 1,
      backgroundColor: colors.lineSoft,
    },
    summary: {
      gap: 7,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    summaryHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    summaryLabel: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.muted,
    },
    summaryValue: {
      fontFamily: font.semibold,
      fontSize: 15,
      lineHeight: 20,
      fontVariant: ["tabular-nums"],
    },
    track: {
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.surfaceSunken,
      overflow: "hidden",
    },
    trackFill: {
      height: "100%",
      borderRadius: 999,
    },
    summaryNote: {
      fontFamily: font.regular,
      fontSize: 11,
      lineHeight: 16,
      color: colors.faint,
    },
    warning: {
      fontFamily: font.regular,
      fontSize: 11,
      lineHeight: 16,
      color: colors.red,
    },
    error: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.red,
    },
    save: {
      marginTop: 2,
      borderRadius: 10,
    },
  });
