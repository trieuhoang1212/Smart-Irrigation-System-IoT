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
import { font, spacing, type Palette } from "../../theme";
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
import { Panel } from "../ui/Panel";
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
    <View style={styles.section}>
      <Panel index="02" title="Hồ sơ cây trồng" hint={zone.id}>

      <View style={styles.plateWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photo ? "Đổi ảnh khu vườn" : "Thêm ảnh khu vườn"}
          disabled={uploading || removing}
          onPress={() => void pickPhoto()}
          style={({ pressed }) => [styles.plate, pressed && styles.pressed]}
        >
          {showPhoto ? (
            <Image
              source={{ uri: photo }}
              resizeMode="cover"
              onError={() => setPhotoBroken(true)}
              style={styles.plateImage}
            />
          ) : (
            <View style={styles.plateEmpty}>
              <View style={styles.plateLeaf}>
                <AppIcon name="leaf" size={150} color="rgba(242,247,241,0.06)" />
              </View>

              <View style={styles.plateCircle}>
                <AppIcon name="camera" size={18} color={colors.onDeep} />
              </View>

              <Text style={styles.plateTitle}>Thêm ảnh khu vườn</Text>
              <Text style={styles.plateMeta}>
                JPEG · PNG · WebP · tối đa 4 MB
              </Text>
            </View>
          )}

          {uploading ? (
            <View style={styles.plateBusy}>
              <ActivityIndicator size="small" color={colors.onDeep} />
            </View>
          ) : null}
        </Pressable>

        {photo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Xoá ảnh khu vườn"
            disabled={uploading || removing}
            onPress={() => void removePhoto()}
            style={({ pressed }) => [
              styles.trash,
              pressed && styles.pressed,
              (uploading || removing) && styles.disabled,
            ]}
          >
            {removing ? (
              <ActivityIndicator size="small" color={colors.onDeep} />
            ) : (
              <AppIcon name="trash" size={15} color={colors.onDeep} />
            )}
          </Pressable>
        ) : null}
      </View>

      {growth && growthNote ? (
        <View style={styles.growth}>
          <View style={styles.growthHead}>
            <Text style={styles.growthLabel}>Tiến độ</Text>
            <Text style={styles.growthDay}>
              {growth.day} / {growth.totalDays} ngày
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

          <Text
            style={[
              styles.growthNote,
              growth.overdueDays > 0 && { color: colors.amber },
            ]}
          >
            {growthNote}
          </Text>
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
          <Text style={styles.fieldLabel}>Nhóm cây</Text>

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
              size={13}
              color={colors.faint}
            />
          </Pressable>
        </View>

        <View style={styles.waterHint}>
          <View style={styles.waterHintHead}>
            <AppIcon name="water" size={12} color={colors.blue} />
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
          <Text style={styles.fieldLabel}>Ngày trồng</Text>

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
          hint="1 – 365"
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
          hint={`${notes.length}/500`}
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
            : "Chỉ cập nhật hồ sơ, ngưỡng tưới ở mục Tưới."}
        </Text>

        <Button
          label="Lưu hồ sơ"
          variant="primary"
          loading={saving}
          disabled={!dirty || uploading || removing}
          onPress={() => void save()}
          style={styles.save}
        />
      </View>
      </Panel>

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
    </View>
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
  const [focused, setFocused] = useState(false);

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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          focused && styles.inputFocused,
        ]}
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
  const [focused, setFocused] = useState(false);

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
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.dateInput,
        wide && styles.dateInputWide,
        focused && styles.inputFocused,
      ]}
    />
  );
}

const createStyles = (colors: Palette) =>
  StyleSheet.create({
    section: {
      gap: spacing.lg,
    },
    plateWrap: {
      position: "relative",
    },
    plate: {
      aspectRatio: 16 / 10,
      borderRadius: 6,
      overflow: "hidden",
      backgroundColor: colors.deep,
      borderWidth: 1,
      borderColor: colors.line,
    },
    plateImage: {
      width: "100%",
      height: "100%",
    },
    plateEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingHorizontal: spacing.lg,
    },
    plateLeaf: {
      position: "absolute",
      right: -28,
      bottom: -34,
    },
    plateCircle: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "rgba(242,247,241,0.22)",
      backgroundColor: "rgba(242,247,241,0.06)",
    },
    plateTitle: {
      fontFamily: font.medium,
      fontSize: 12.5,
      lineHeight: 17,
      color: colors.onDeep,
    },
    plateMeta: {
      fontFamily: font.medium,
      fontSize: 9,
      lineHeight: 11,
      letterSpacing: 0.7,
      textTransform: "uppercase",
      color: colors.onDeepSoft,
    },
    plateBusy: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11,23,16,0.45)",
    },
    trash: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11,23,16,0.66)",
      borderWidth: 1,
      borderColor: "rgba(242,247,241,0.12)",
    },
    pressed: {
      opacity: 0.78,
    },
    disabled: {
      opacity: 0.5,
    },
    growth: {
      gap: 7,
    },
    growthHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    growthLabel: {
      fontFamily: font.semibold,
      fontSize: 12.5,
      lineHeight: 16,
      color: colors.inkSoft,
    },
    growthDay: {
      fontFamily: font.medium,
      fontSize: 10.5,
      lineHeight: 14,
      fontVariant: ["tabular-nums"],
      color: colors.muted,
    },
    growthTrack: {
      height: 2,
      backgroundColor: colors.line,
      overflow: "hidden",
    },
    growthFill: {
      height: 2,
    },
    growthNote: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 17,
      color: colors.muted,
    },
    fields: {
      gap: 18,
    },
    field: {
      gap: 2,
    },
    fieldHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    fieldLabel: {
      fontFamily: font.medium,
      fontSize: 11.5,
      lineHeight: 15,
      letterSpacing: 0.1,
      color: colors.muted,
    },
    fieldHint: {
      fontFamily: font.semibold,
      fontSize: 9,
      lineHeight: 11,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: colors.faint,
    },
    input: {
      minHeight: 40,
      paddingHorizontal: 0,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      backgroundColor: "transparent",
      fontFamily: font.regular,
      fontSize: 15,
      lineHeight: 21,
      color: colors.ink,
      outlineWidth: 0,
      outlineColor: "transparent",
    },
    inputMultiline: {
      minHeight: 76,
      paddingTop: 8,
      textAlignVertical: "top",
    },
    inputFocused: {
      borderBottomColor: colors.green,
    },
    select: {
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    selectValue: {
      fontFamily: font.medium,
      fontSize: 15,
      lineHeight: 21,
      color: colors.ink,
    },
    waterHint: {
      gap: 3,
      marginTop: -4,
      paddingLeft: 10,
      borderLeftWidth: 2,
      borderLeftColor: colors.blue,
    },
    waterHintHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    waterHintTitle: {
      fontFamily: font.semibold,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.blue,
    },
    waterHintText: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 17,
      color: colors.muted,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    dateInput: {
      width: 40,
      minHeight: 40,
      textAlign: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      backgroundColor: "transparent",
      fontFamily: font.semibold,
      fontSize: 15,
      lineHeight: 21,
      color: colors.ink,
      outlineWidth: 0,
      outlineColor: "transparent",
    },
    dateInputWide: {
      width: 62,
    },
    dateSlash: {
      fontFamily: font.regular,
      fontSize: 13,
      color: colors.faint,
    },
    harvest: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    harvestLabel: {
      fontFamily: font.medium,
      fontSize: 11.5,
      lineHeight: 15,
      color: colors.muted,
    },
    harvestValue: {
      fontFamily: font.semibold,
      fontSize: 13,
      lineHeight: 18,
      fontVariant: ["tabular-nums"],
      flexShrink: 1,
      textAlign: "right",
      color: colors.greenStrong,
    },
    error: {
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 16,
      color: colors.red,
    },
    footer: {
      gap: 10,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.lineSoft,
    },
    dirty: {
      fontFamily: font.medium,
      fontSize: 10.5,
      lineHeight: 14,
      color: colors.faint,
    },
    save: {
      borderRadius: 10,
    },
    groupList: {
      gap: 0,
      paddingBottom: 4,
    },
    groupItem: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: 2,
      borderBottomWidth: 1,
      borderBottomColor: colors.lineSoft,
    },
    groupLabel: {
      fontFamily: font.medium,
      fontSize: 14.5,
      lineHeight: 20,
      color: colors.inkSoft,
    },
    groupLabelActive: {
      color: colors.greenStrong,
    },
  });
