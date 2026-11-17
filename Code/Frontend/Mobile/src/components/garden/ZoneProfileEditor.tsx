import { File as ExpoFile } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";

import {
  assetUrl,
  deleteZonePhoto,
  saveZoneProfile,
  uploadZonePhoto,
} from "../../api/garden";
import type { LiveZone, ZoneProfileInput } from "../../api/types";
import { useGarden } from "../../providers/GardenProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { useToast } from "../../providers/ToastProvider";
import { radius, spacing, typo, type Palette } from "../../theme";
import { useThemedStyles } from "../../theme/useThemedStyles";
import {
  CROP_GROUPS,
  GROUP_WATER_HINTS,
  harvestDate,
  initialGroup,
  toDateInput,
  type CropGroup,
} from "../../utils/crops";
import { AppIcon } from "../ui/AppIcon";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SectionHeader } from "../ui/SectionHeader";
import { Sheet } from "../ui/Sheet";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type DateParts = { day: string; month: string; year: string };

function toParts(timestamp: number | null | undefined): DateParts {
  if (!timestamp) return { day: "", month: "", year: "" };
  const [year, month, day] = toDateInput(timestamp).split("-");
  return { day, month, year };
}

// null = chưa nhập ngày, undefined = nhập thiếu hoặc không phải ngày có thật.
function partsToTimestamp(parts: DateParts): number | null | undefined {
  const { day, month, year } = parts;
  if (!day && !month && !year) return null;
  if (!day || !month || year.length !== 4) return undefined;

  const dayValue = Number(day);
  const monthValue = Number(month);
  const yearValue = Number(year);
  const date = new Date(yearValue, monthValue - 1, dayValue);

  if (
    date.getFullYear() !== yearValue ||
    date.getMonth() !== monthValue - 1 ||
    date.getDate() !== dayValue
  ) {
    return undefined;
  }

  return date.getTime();
}

function fromZone(zone: LiveZone): ZoneProfileInput {
  return {
    name: zone.name,
    crop: zone.crop,
    group: initialGroup(zone.group),
    plantedAt: zone.plantedAt ?? null,
    harvestDays: zone.harvestDays ?? null,
    notes: zone.notes ?? "",
  };
}

export function ZoneProfileEditor({
  zone,
  onReload,
}: {
  zone: LiveZone;
  onReload: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { notify } = useToast();
  const { deviceId } = useGarden();

  const [baseline, setBaseline] = useState<ZoneProfileInput>(() => fromZone(zone));
  const [name, setName] = useState(baseline.name);
  const [crop, setCrop] = useState(baseline.crop);
  const [group, setGroup] = useState<CropGroup>(() => initialGroup(baseline.group));
  const [dateParts, setDateParts] = useState<DateParts>(() => toParts(baseline.plantedAt));
  const [harvestDays, setHarvestDays] = useState(
    baseline.harvestDays === null ? "" : String(baseline.harvestDays),
  );
  const [notes, setNotes] = useState(baseline.notes);
  const [groupOpen, setGroupOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(() => assetUrl(zone.photoUrl));
  const [photoBroken, setPhotoBroken] = useState(false);

  const draftPlantedAt = partsToTimestamp(dateParts);
  const draftHarvest = harvestDays.trim() === "" ? null : Number(harvestDays);
  const expectedHarvest =
    typeof draftPlantedAt === "number" &&
    draftHarvest !== null &&
    Number.isInteger(draftHarvest)
      ? harvestDate(draftPlantedAt, draftHarvest)
      : null;

  const baselineHarvest =
    baseline.harvestDays === null ? "" : String(baseline.harvestDays);
  const dirty =
    name.trim() !== baseline.name ||
    crop.trim() !== baseline.crop ||
    group !== baseline.group ||
    draftPlantedAt !== baseline.plantedAt ||
    harvestDays.trim() !== baselineHarvest ||
    notes.trim() !== baseline.notes;

  const waterWindow = GROUP_WATER_HINTS[group];
  const growth = zone.growth;
  const growthNote = growth
    ? growth.overdueDays > 0
      ? `${growth.label} · trễ ${growth.overdueDays} ngày`
      : growth.daysLeft > 0
        ? `${growth.label} · còn ${growth.daysLeft} ngày`
        : growth.label
    : null;

  const setDatePart = (key: keyof DateParts, value: string) => {
    const limit = key === "year" ? 4 : 2;
    const digits = value.replace(/\D/g, "").slice(0, limit);
    setDateParts((current) => ({ ...current, [key]: digits }));
  };

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Tên cây trồng không được để trống.");
      return;
    }

    if (draftPlantedAt === undefined) {
      setError("Ngày trồng không hợp lệ. Nhập đủ ngày, tháng, năm.");
      return;
    }

    if (
      draftHarvest !== null &&
      (!Number.isInteger(draftHarvest) || draftHarvest < 1 || draftHarvest > 365)
    ) {
      setError("Số ngày thu hoạch phải là số nguyên từ 1 đến 365.");
      return;
    }

    const input: ZoneProfileInput = {
      name: trimmedName,
      crop: crop.trim(),
      group,
      plantedAt: draftPlantedAt,
      harvestDays: draftHarvest,
      notes: notes.trim(),
    };

    setError(null);
    setSaving(true);

    try {
      await saveZoneProfile(deviceId, zone.id, input);
      setName(input.name);
      setCrop(input.crop);
      setNotes(input.notes);
      setHarvestDays(input.harvestDays === null ? "" : String(input.harvestDays));
      setDateParts(toParts(input.plantedAt));
      setBaseline(input);
      notify("Đã lưu hồ sơ cây trồng.", "success");
      onReload();
    } catch {
      setError("Không lưu được hồ sơ. Kiểm tra Backend rồi thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    setError(null);

    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError("Cần quyền truy cập thư viện ảnh để chọn ảnh khu vườn.");
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.6,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) return;

      const contentType = asset.mimeType ?? "image/jpeg";
      if (!ALLOWED_TYPES.includes(contentType)) {
        setError("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.");
        return;
      }

      if (asset.fileSize && asset.fileSize > MAX_PHOTO_BYTES) {
        setError("Ảnh vượt quá 4 MB. Chọn ảnh nhỏ hơn hoặc chụp lại.");
        return;
      }

      setUploading(true);
      const body = asset.file ?? (new ExpoFile(asset.uri) as unknown as Blob);
      const photoUrl = await uploadZonePhoto(deviceId, zone.id, body, contentType);

      setPhoto(assetUrl(photoUrl));
      setPhotoBroken(false);
      notify("Đã cập nhật ảnh khu vườn.", "success");
      onReload();
    } catch {
      setError("Không tải ảnh lên được. Kiểm tra Backend rồi thử lại.");
    } finally {
      setUploading(false);
    }
  };

  const confirmRemove = async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      return window.confirm("Xoá ảnh của khu vườn này? Bạn có thể tải ảnh mới sau.");
    }

    return new Promise((resolve) => {
      Alert.alert(
        "Xoá ảnh khu vườn",
        "Bạn có thể tải ảnh mới sau khi xoá.",
        [
          { text: "Huỷ", style: "cancel", onPress: () => resolve(false) },
          { text: "Xoá", style: "destructive", onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });
  };

  const removePhoto = async () => {
    const confirmed = await confirmRemove();
    if (!confirmed) return;

    setError(null);
    setRemoving(true);

    try {
      await deleteZonePhoto(deviceId, zone.id);
      setPhoto(null);
      setPhotoBroken(false);
      notify("Đã xoá ảnh khu vườn.", "info");
      onReload();
    } catch {
      setError("Không xoá được ảnh. Kiểm tra Backend rồi thử lại.");
    } finally {
      setRemoving(false);
    }
  };

  const showPhoto = photo !== null && !photoBroken;

  return (
    <Card style={styles.card}>
      <SectionHeader title="Hồ sơ cây trồng" hint={zone.id} />

      <View style={styles.hero}>
        {showPhoto ? (
          <Image
            source={{ uri: photo }}
            resizeMode="cover"
            onError={() => setPhotoBroken(true)}
            style={styles.heroImage}
          />
        ) : (
          <View style={styles.heroEmpty}>
            <View style={styles.heroGlow} />
            <View style={styles.heroIcon}>
              <AppIcon name="leaf" size={22} color={colors.greenStrong} />
            </View>
            <Text style={styles.heroTitle}>Chưa có ảnh khu vườn</Text>
            <Text style={styles.heroHint}>
              Thêm ảnh để dễ nhận diện ô trồng trên tổng quan.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.photoRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? "Đổi ảnh khu vườn" : "Thêm ảnh khu vườn"}
          disabled={uploading || removing}
          onPress={() => void pickPhoto()}
          style={({ pressed }) => [
            styles.photoButton,
            pressed && styles.pressed,
            (uploading || removing) && styles.disabled,
          ]}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.greenStrong} />
          ) : (
            <AppIcon name="camera" size={15} color={colors.greenStrong} />
          )}
          <Text style={styles.photoButtonText}>
            {uploading ? "Đang tải ảnh..." : photo ? "Đổi ảnh" : "Thêm ảnh"}
          </Text>
        </Pressable>

        {photo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xoá ảnh khu vườn"
            disabled={uploading || removing}
            onPress={() => void removePhoto()}
            style={({ pressed }) => [
              styles.trashButton,
              pressed && styles.pressed,
              (uploading || removing) && styles.disabled,
            ]}
          >
            {removing ? (
              <ActivityIndicator size="small" color={colors.red} />
            ) : (
              <AppIcon name="trash" size={16} color={colors.red} />
            )}
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.photoHint}>
        JPEG, PNG hoặc WebP · tối đa 4 MB. Ảnh được lưu trên Backend.
      </Text>

      {growth && growthNote ? (
        <View style={styles.growth}>
          <View style={styles.growthHead}>
            <Text style={styles.growthLabel}>Tiến độ hiện tại</Text>
            <Text style={styles.growthDay}>
              Ngày {growth.day}/{growth.totalDays}
            </Text>
          </View>

          <View style={styles.growthTrack}>
            <View
              style={[
                styles.growthFill,
                {
                  width: `${Math.max(0, Math.min(100, growth.progress))}%`,
                  backgroundColor: growth.overdueDays > 0 ? colors.amber : colors.green,
                },
              ]}
            />
          </View>

          <Text style={styles.growthText}>{growthNote}</Text>
        </View>
      ) : null}

      <View style={styles.fields}>
        <Field
          label="Tên cây trồng"
          value={name}
          onChangeText={setName}
          placeholder="Ví dụ: Cà chua"
          maxLength={60}
          autoCapitalize="words"
        />

        <View style={styles.field}>
          <View style={styles.fieldHead}>
            <Text style={styles.fieldLabel}>Nhóm cây</Text>
            <Text style={styles.fieldHint}>{`${CROP_GROUPS.length} NHÓM`}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Nhóm cây: ${group}`}
            onPress={() => setGroupOpen(true)}
            style={({ pressed }) => [
              styles.select,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.selectValue}>{group}</Text>
            <AppIcon
              name="chevronRight"
              variant="outline"
              size={14}
              color={colors.faint}
            />
          </Pressable>
        </View>

        <View style={styles.waterHint}>
          <View style={styles.waterHintHead}>
            <AppIcon name="water" size={13} color={colors.blue} />
            <Text style={styles.waterHintTitle}>
              {waterWindow.label} · {waterWindow.start}–{waterWindow.end}
            </Text>
          </View>
          <Text style={styles.waterHintText}>
            {waterWindow.note} Hệ thống vẫn tưới theo độ ẩm, chưa hẹn giờ.
          </Text>
        </View>

        <Field
          label="Đặc điểm / mô tả ngắn"
          value={crop}
          onChangeText={setCrop}
          placeholder="Ví dụ: Ưa ẩm, tránh nứt quả"
          maxLength={160}
        />

        <View style={styles.field}>
          <View style={styles.fieldHead}>
            <Text style={styles.fieldLabel}>Ngày trồng</Text>
            <Text style={styles.fieldHint}>NGÀY / THÁNG / NĂM</Text>
          </View>

          <View style={styles.dateRow}>
            <DateInput
              accessibilityLabel="Ngày trồng, ngày"
              placeholder="DD"
              value={dateParts.day}
              onChangeText={(value) => setDatePart("day", value)}
            />
            <Text style={styles.dateSlash}>/</Text>
            <DateInput
              accessibilityLabel="Ngày trồng, tháng"
              placeholder="MM"
              value={dateParts.month}
              onChangeText={(value) => setDatePart("month", value)}
            />
            <Text style={styles.dateSlash}>/</Text>
            <DateInput
              accessibilityLabel="Ngày trồng, năm"
              placeholder="YYYY"
              value={dateParts.year}
              onChangeText={(value) => setDatePart("year", value)}
              wide
            />
          </View>
        </View>

        <Field
          label="Số ngày đến thu hoạch"
          hint="1 - 365"
          value={harvestDays}
          onChangeText={(value) => setHarvestDays(value.replace(/\D/g, "").slice(0, 3))}
          placeholder="Ví dụ: 60"
          keyboardType="number-pad"
        />

        <View style={styles.harvest}>
          <Text style={styles.harvestLabel}>Thu hoạch dự kiến</Text>
          <Text style={styles.harvestValue}>
            {expectedHarvest ?? "Chưa đủ ngày trồng và số ngày"}
          </Text>
        </View>

        <Field
          label="Ghi chú"
          hint="500 KÝ TỰ"
          value={notes}
          onChangeText={setNotes}
          placeholder="Chăm sóc, sâu bệnh, phân bón..."
          maxLength={500}
          multiline
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.footer}>
        <Text style={[styles.dirty, dirty && { color: colors.amber }]}>
          {dirty
            ? "Có thay đổi chưa lưu."
            : "Chỉ cập nhật hồ sơ; ngưỡng tưới đổi ở mục Tưới."}
        </Text>

        <Button
          label="Lưu thay đổi"
          variant="primary"
          loading={saving}
          disabled={!dirty || uploading || removing}
          onPress={() => void save()}
        />
      </View>

      <Sheet
        visible={groupOpen}
        onClose={() => setGroupOpen(false)}
        title="Nhóm cây trồng"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.groupList}
        >
          {CROP_GROUPS.map((option) => {
            const active = option === group;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setGroup(option);
                  setGroupOpen(false);
                }}
                style={({ pressed }) => [
                  styles.groupItem,
                  active && styles.groupItemActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.groupLabel, active && styles.groupLabelActive]}
                >
                  {option}
                </Text>
                {active ? (
                  <AppIcon name="check" size={15} color={colors.greenStrong} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </Card>
  );
}

function Field({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  maxLength,
  keyboardType,
  multiline = false,
  autoCapitalize = "sentences",
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        maxLength={maxLength}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        selectionColor={colors.green}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function DateInput({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  wide = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  wide?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      keyboardType="number-pad"
      maxLength={wide ? 4 : 2}
      accessibilityLabel={accessibilityLabel}
      selectionColor={colors.green}
      style={[styles.dateInput, wide && styles.dateInputWide]}
    />
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    card: {
      gap: spacing.md,
    },
    hero: {
      aspectRatio: 16 / 10,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: colors.surfaceSunken,
      borderWidth: 1,
      borderColor: colors.line,
    },
    heroImage: {
      width: "100%",
      height: "100%",
    },
    heroEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: spacing.lg,
    },
    heroGlow: {
      position: "absolute",
      width: 190,
      height: 190,
      borderRadius: 999,
      backgroundColor: colors.greenSoft,
      opacity: 0.75,
    },
    heroIcon: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    heroTitle: {
      ...typo.bodyStrong,
      color: colors.inkSoft,
    },
    heroHint: {
      ...typo.caption,
      maxWidth: 230,
      textAlign: "center",
      color: colors.faint,
    },
    photoRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: -4,
    },
    photoButton: {
      flex: 1,
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.greenSoft,
    },
    photoButtonText: {
      ...typo.smallStrong,
      color: colors.greenStrong,
    },
    trashButton: {
      width: 42,
      height: 42,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.redSoft,
    },
    pressed: {
      opacity: 0.75,
    },
    disabled: {
      opacity: 0.5,
    },
    photoHint: {
      ...typo.caption,
      color: colors.faint,
      marginTop: -6,
    },
    growth: {
      gap: 6,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunken,
    },
    growthHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    growthLabel: {
      ...typo.smallStrong,
      color: colors.inkSoft,
    },
    growthDay: {
      ...typo.caption,
      color: colors.muted,
    },
    growthTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: colors.line,
      overflow: "hidden",
    },
    growthFill: {
      height: "100%",
      borderRadius: 999,
    },
    growthText: {
      ...typo.caption,
      color: colors.muted,
    },
    fields: {
      gap: spacing.md,
    },
    field: {
      gap: 5,
    },
    fieldHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    fieldLabel: {
      ...typo.smallStrong,
      color: colors.inkSoft,
    },
    fieldHint: {
      ...typo.micro,
      color: colors.faint,
    },
    input: {
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.canvas,
      ...typo.body,
      color: colors.ink,
      outlineWidth: 0,
      outlineColor: "transparent",
    },
    inputMultiline: {
      minHeight: 86,
      textAlignVertical: "top",
    },
    select: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.canvas,
    },
    selectValue: {
      ...typo.bodyStrong,
      color: colors.ink,
    },
    waterHint: {
      gap: 3,
      padding: 11,
      borderRadius: radius.md,
      backgroundColor: colors.blueSoft,
      borderWidth: 1,
      borderColor: colors.line,
    },
    waterHintHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    waterHintTitle: {
      ...typo.smallStrong,
      color: colors.blue,
    },
    waterHintText: {
      ...typo.caption,
      lineHeight: 16,
      color: colors.muted,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    dateInput: {
      width: 56,
      minHeight: 44,
      textAlign: "center",
      paddingVertical: 10,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.canvas,
      ...typo.bodyStrong,
      color: colors.ink,
      outlineWidth: 0,
      outlineColor: "transparent",
    },
    dateInputWide: {
      width: 82,
    },
    dateSlash: {
      ...typo.section,
      color: colors.faint,
    },
    harvest: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      padding: 11,
      borderRadius: radius.md,
      backgroundColor: colors.greenSoft,
    },
    harvestLabel: {
      ...typo.caption,
      color: colors.muted,
    },
    harvestValue: {
      ...typo.smallStrong,
      flexShrink: 1,
      textAlign: "right",
      color: colors.greenStrong,
    },
    error: {
      ...typo.caption,
      color: colors.red,
    },
    footer: {
      gap: spacing.sm,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    dirty: {
      ...typo.caption,
      color: colors.faint,
    },
    groupList: {
      gap: 4,
      paddingBottom: 6,
    },
    groupItem: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: 14,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceSunken,
    },
    groupItemActive: {
      backgroundColor: colors.greenSoft,
    },
    groupLabel: {
      ...typo.bodyStrong,
      color: colors.inkSoft,
    },
    groupLabelActive: {
      color: colors.greenStrong,
    },
  });
