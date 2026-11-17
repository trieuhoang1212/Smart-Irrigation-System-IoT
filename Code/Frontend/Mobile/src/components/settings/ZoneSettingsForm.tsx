import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LiveZone, ZoneConfigInput } from "../../api/types";
import { useGarden } from "../../providers/GardenProvider";
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
    <View style={styles.stepperRow}>
      <View style={styles.stepperLabelBlock}>
        <Text style={styles.stepperLabel}>Ngưỡng tưới</Text>

        <Text style={styles.stepperHint}>
          Tưới dưới {value}% · dừng ở {Math.min(100, value + STOP_OFFSET)}%
        </Text>
      </View>

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
  );
}

export function ZoneSettingsForm({ zone }: Props) {
  const styles = useThemedStyles(createStyles);
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
      <ThresholdStepper
        value={draft.threshold}
        onChange={(threshold) => {
          setDraft((current) => ({
            ...current,
            threshold,
          }));
        }}
      />

      <NumberField
        label="Lưu lượng bơm"
        hint="1 - 200 L/giờ"
        unit="L/giờ"
        value={draft.flowLitersPerHour}
        onChangeText={(value) => update("flowLitersPerHour", value)}
        keyboardType="number-pad"
      />

      <NumberField
        label="Lượng nước mục tiêu"
        hint="0.1 - 20 L"
        unit="L"
        value={draft.targetLiters}
        onChangeText={(value) => update("targetLiters", value)}
        keyboardType="decimal-pad"
      />

      <View style={styles.estimate}>
        <View style={styles.estimateHead}>
          <Text style={styles.estimateLabel}>Ước tính thời gian cấp nước</Text>

          <Text style={styles.estimateValue}>
            {estimateMinutes === null
              ? "--"
              : `${formatNumber(estimateMinutes, 1)} phút`}
          </Text>
        </View>

        <Text style={styles.estimateNote}>
          {estimateMinutes === null
            ? "Nhập lưu lượng và lượng nước để xem thời gian."
            : `Cho ${formatNumber(target, 1)} L nước mỗi lần.`}
        </Text>

        {runtimeWarning ? (
          <Text style={styles.estimateWarning}>{runtimeWarning}</Text>
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
      gap: 18,
    },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    stepperLabelBlock: {
      flex: 1,
      gap: 2,
    },
    stepperLabel: {
      fontFamily: font.medium,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.muted,
    },
    stepperHint: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 17,
      color: colors.muted,
    },
    stepper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    stepButton: {
      width: 30,
      height: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
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
      minWidth: 48,
      textAlign: "center",
      fontFamily: font.semibold,
      fontSize: 15,
      lineHeight: 20,
      fontVariant: ["tabular-nums"],
      color: colors.ink,
    },
    pressed: {
      opacity: 0.55,
    },
    estimate: {
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
      gap: 3,
    },
    estimateHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    estimateLabel: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.muted,
    },
    estimateValue: {
      fontFamily: font.semibold,
      fontSize: 13,
      lineHeight: 18,
      fontVariant: ["tabular-nums"],
      color: colors.greenStrong,
    },
    estimateNote: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 17,
      color: colors.faint,
    },
    estimateWarning: {
      fontFamily: font.regular,
      fontSize: 11.5,
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
