import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getDeviceConfig, updateZoneThreshold, type DeviceConfig } from '../../../api/client';

const GREEN = '#16834B';
const NAMES: Record<string, string> = {
  T001: 'Khu vực 1', T002: 'Khu vực 2', T003: 'Khu vực 3',
  T004: 'Khu vực 4', T005: 'Khu vực 5', T006: 'Khu vực 6',
};

export default function ZoneSettingsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const zoneId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [threshold, setThreshold] = useState(40);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setting = useMemo(() => config?.zones.find((item) => item.id === zoneId), [config, zoneId]);

  const load = useCallback(async () => {
    if (!zoneId) return;
    setLoading(true); setError(null);
    try {
      const deviceConfig = await getDeviceConfig();
      setConfig(deviceConfig);
      const current = deviceConfig.zones.find((item) => item.id === zoneId);
      if (current) setThreshold(current.threshold);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải cấu hình khu vực');
    } finally { setLoading(false); }
  }, [zoneId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!zoneId || saving) return;
    setSaving(true);
    try {
      await updateZoneThreshold(zoneId, threshold);
      const fresh = await getDeviceConfig();
      setConfig(fresh);
      const updated = fresh.zones.find((item) => item.id === zoneId);
      if (updated) setThreshold(updated.threshold);
      Alert.alert('Đã lưu', 'Ngưỡng độ ẩm đã được cập nhật.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Không thể lưu', e instanceof Error ? e.message : 'Đã xảy ra lỗi');
    } finally { setSaving(false); }
  };

  if (!zoneId) return <View style={styles.center}><Text>Không tìm thấy mã khu vực.</Text></View>;

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Quay lại chi tiết</Text></Pressable>
      <Text style={styles.brand}>GREENFLOW</Text>
      <Text style={styles.title}>Chỉnh sửa ngưỡng</Text>
      <Text style={styles.subtitle}>{zoneId} · {NAMES[zoneId] ?? zoneId}</Text>
      {loading && <ActivityIndicator color={GREEN} style={{ margin: 20 }} />}
      {!!error && <Text style={styles.error}>{error}</Text>}

      {!loading && !!setting && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ngưỡng bật máy bơm</Text>
          <Text style={styles.threshold}>{threshold}%</Text>
          <View style={styles.adjustRow}>
            <Pressable style={styles.adjustButton} disabled={threshold <= 10} onPress={() => setThreshold((v) => Math.max(10, v - 1))}>
              <Text style={styles.adjustText}>−</Text>
            </Pressable>
            <View style={styles.range}>
              <View style={[styles.rangeFill, { width: `${((threshold - 10) / 80) * 100}%` }]} />
            </View>
            <Pressable style={styles.adjustButton} disabled={threshold >= 90} onPress={() => setThreshold((v) => Math.min(90, v + 1))}>
              <Text style={styles.adjustText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.quickRow}>
            {[20, 30, 40, 50, 60, 70, 80].map((value) => (
              <Pressable key={value} onPress={() => setThreshold(value)} style={[styles.quick, threshold === value && styles.quickActive]}>
                <Text style={[styles.quickText, threshold === value && styles.quickTextActive]}>{value}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.meta}>Ngưỡng dừng hiện tại: {setting.stopThreshold}%</Text>
          <Text style={styles.hint}>Cho phép chọn ngưỡng bật từ 10% đến 90%. Ngưỡng dừng được quản lý theo cấu hình Backend.</Text>
          <Pressable style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={save} disabled={saving || loading}>
            <Text style={styles.saveText}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F8F5' },
  container: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { color: GREEN, fontWeight: '700', marginBottom: 20, fontSize: 14 },
  brand: { color: GREEN, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: '#173D2A', fontSize: 26, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#78877D', marginTop: 5, marginBottom: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 17, borderWidth: 1, borderColor: '#E9EFEA', padding: 18, marginBottom: 14 },
  cardTitle: { color: '#294936', fontSize: 15, fontWeight: '800' },
  threshold: { color: GREEN, fontSize: 36, fontWeight: '800', textAlign: 'center', marginVertical: 16 },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adjustButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#E7F3EA', alignItems: 'center', justifyContent: 'center' },
  adjustText: { color: GREEN, fontSize: 26, fontWeight: '700' },
  range: { flex: 1, height: 8, backgroundColor: '#E9EFEA', borderRadius: 8, overflow: 'hidden' },
  rangeFill: { height: 8, backgroundColor: GREEN },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  quick: { paddingVertical: 8, paddingHorizontal: 9, borderRadius: 8, backgroundColor: '#F0F4F0' },
  quickActive: { backgroundColor: GREEN },
  quickText: { color: '#68786C', fontSize: 11, fontWeight: '700' },
  quickTextActive: { color: '#FFF' },
  meta: { color: '#78877D', fontSize: 12, marginTop: 18 },
  hint: { color: '#849087', fontSize: 11, lineHeight: 17, marginTop: 12 },
  saveButton: { backgroundColor: GREEN, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 18 },
  saveText: { color: '#FFF', fontWeight: '800' },
  error: { color: '#B42318', backgroundColor: '#FEE4E2', padding: 12, borderRadius: 10, marginBottom: 12 },
});
