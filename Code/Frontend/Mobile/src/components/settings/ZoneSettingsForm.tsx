
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LiveZone, ZoneConfigInput } from "../../api/types";
import { useGarden } from "../../providers/GardenProvider";
import { colors, radius, spacing } from "../../theme";
import { formatNumber } from "../../utils/format";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { NumberField } from "../ui/NumberField";
import { SectionHeader } from "../ui/SectionHeader";

type Draft = {
  threshold: number;
  pumpSeconds: string;
  flowLitersPerHour: string;
  targetLiters: string;
};

type Props = {
  zone: LiveZone;
  embedded?: boolean;
};

const THRESHOLD_MIN = 10;
const THRESHOLD_MAX = 90;
const THRESHOLD_STEP = 5;
const STOP_OFFSET = 20;

function toDraft(zone: LiveZone): Draft {
  return {
    threshold: Math.round(zone.threshold),
    pumpSeconds: String(zone.pumpSeconds),
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
  const pumpSeconds = parseNumber(draft.pumpSeconds);
  const flow = parseNumber(draft.flowLitersPerHour);
  const target = parseNumber(draft.targetLiters);

  if (
    !Number.isInteger(pumpSeconds) ||
    pumpSeconds < 10 ||
    pumpSeconds > 600
  ) {
    return {
      error: "Thời gian bơm mỗi lần phải từ 10 đến 600 giây.",
    };
  }

  if (!Number.isFinite(flow) || flow < 1 || flow > 200) {
    return {
      error: "Lưu lượng bơm phải từ 1 đến 200 L/giờ.",
    };
  }

  if (!Number.isFinite(target) || target < 0.1 || target > 20) {
    return {
      error: "Lượng nước mục tiêu phải từ 0.1 đến 20 L.",
    };
  }

  return {
    input: {
      threshold: draft.threshold,
      pumpSeconds,
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
  return (
    <View style={styles.stepperRow}>
      <View style={styles.stepperLabelBlock}>
        <Text style={styles.stepperLabel}>Ngưỡng tưới</Text>

        <Text style={styles.stepperHint}>
          Tưới khi độ ẩm dưới {value}%, dừng khi đạt{" "}
          {Math.min(100, value + STOP_OFFSET)}%.
        </Text>
      </View>

      <View style={styles.stepper}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Giảm ngưỡng tưới"
          hitSlop={6}
          onPress={() =>
            onChange(
              Math.max(THRESHOLD_MIN, value - THRESHOLD_STEP)
            )
          }
          style={styles.stepButton}
        >
          <Text style={styles.stepSymbol}>-</Text>
        </Pressable>

        <Text style={styles.stepValue}>{value}%</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tăng ngưỡng tưới"
          hitSlop={6}
          onPress={() =>
            onChange(
              Math.min(THRESHOLD_MAX, value + THRESHOLD_STEP)
            )
          }
          style={styles.stepButton}
        >
          <Text style={styles.stepSymbol}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function ZoneSettingsForm({
  zone,
  embedded = false,
}: Props) {
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
      await saveZone(zone.id, result.input);
    } catch {
      setError("Không thể lưu cấu hình. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <>
      <SectionHeader
        title="Thông số tưới"
        hint={
          zone.moisture === null
            ? "CHƯA CÓ DỮ LIỆU"
            : `ĐỘ ẨM ${formatNumber(zone.moisture, 0)}%`
        }
      />

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
        label="Thời gian bơm mỗi lần"
        hint="10 - 600 giây"
        unit="giây"
        value={draft.pumpSeconds}
        onChangeText={(value) => update("pumpSeconds", value)}
      />

      <NumberField
        label="Lưu lượng bơm"
        hint="1 - 200 L/giờ"
        unit="L/giờ"
        value={draft.flowLitersPerHour}
        onChangeText={(value) =>
          update("flowLitersPerHour", value)
        }
        keyboardType="decimal-pad"
      />

      <NumberField
        label="Lượng nước mục tiêu"
        hint="0.1 - 20 L"
        unit="L"
        value={draft.targetLiters}
        onChangeText={(value) =>
          update("targetLiters", value)
        }
        keyboardType="decimal-pad"
      />

      <View style={styles.estimate}>
        <Text style={styles.estimateLabel}>
          Ước tính thời gian cấp nước
        </Text>

        <Text style={styles.estimateValue}>
          {estimateMinutes === null
            ? "--"
            : `Khoảng ${formatNumber(
                estimateMinutes,
                1
              )} phút cho ${formatNumber(target, 1)} L`}
        </Text>
      </View>

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <Button
        label="Lưu cấu hình"
        variant="primary"
        loading={saving}
        onPress={() => void submit()}
        style={styles.save}
      />
    </>
  );

  return embedded ? (
    <View style={styles.embedded}>{content}</View>
  ) : (
    <Card>{content}</Card>
  );
}

const styles = StyleSheet.create({
  embedded: {
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  stepperLabelBlock: {
    flex: 1,
    gap: 2,
  },
  stepperLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.inkSoft,
  },
  stepperHint: {
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.faint,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepSymbol: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.greenStrong,
  },
  stepValue: {
    minWidth: 42,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  estimate: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.greenSoft,
    gap: 2,
  },
  estimateLabel: {
    fontSize: 10.5,
    color: colors.muted,
  },
  estimateValue: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.greenStrong,
  },
  error: {
    marginTop: spacing.sm,
    fontSize: 11.5,
    lineHeight: 16,
    color: colors.red,
  },
  save: {
    marginTop: spacing.sm,
  },
})