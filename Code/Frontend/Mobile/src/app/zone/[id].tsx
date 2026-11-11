import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getDeviceConfig, getLatestTelemetry, type DeviceConfig, type Telemetry } from '../../api/client';
import { useLiveTelemetry } from '../../hooks/useLiveTelemetry';

const GREEN = '#16834B';
const NAMES: Record<string, string> = {
  T001: 'Khu vực 1', T002: 'Khu vực 2', T003: 'Khu vực 3',
  T004: 'Khu vực 4', T005: 'Khu vực 5', T006: 'Khu vực 6',
};

export default function ZoneDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const zoneId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { telemetry: liveTelemetry, updateTelemetry } = useLiveTelemetry();
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [initialTelemetry, setInitialTelemetry] = useState<Telemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const telemetry = liveTelemetry ?? initialTelemetry;
  const zone = useMemo(() => telemetry?.zones.find((item) => item.id === zoneId), [telemetry, zoneId]);
  const setting = config?.zones.find((item) => item.id === zoneId);

  const load = useCallback(async () => {
    if (!zoneId) return;
    setLoading(true); setError(null);
    try {
      const [deviceConfig, latest] = await Promise.all([getDeviceConfig(), getLatestTelemetry()]);
      setConfig(deviceConfig);
      if (latest) { setInitialTelemetry(latest); updateTelemetry(latest); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu khu vực');
    } finally { setLoading(false); }
  }, [zoneId, updateTelemetry]);

  useEffect(() => { load(); }, [load]);

  if (!zoneId) return <View style={styles.center}><Text>Không tìm thấy mã khu vực.</Text></View>;

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹  Quay lại</Text></Pressable>
      <Text style={styles.brand}>GREENFLOW</Text>
      <Text style={styles.title}>{NAMES[zoneId] ?? zoneId}</Text>
      <Text style={styles.subtitle}>{zoneId} · Chi tiết khu vực tưới</Text>
      {loading && <ActivityIndicator color={GREEN} style={{ margin: 20 }} />}
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.card}>
        <Text style={styles.label}>Độ ẩm đất hiện tại</Text>
        <Text style={styles.moisture}>{zone ? `${zone.moisture}%` : '--'}</Text>
        <View style={styles.progressBackground}>
          <View style={[styles.progressFill, {
            width: `${Math.max(0, Math.min(100, zone?.moisture ?? 0))}%`,
            backgroundColor: (zone?.moisture ?? 0) < 40 ? '#E99A38' : GREEN,
          }]} />
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.meta}>Trạng thái máy bơm</Text>
          <Text style={[styles.status, { color: zone?.pump ? GREEN : '#849087' }]}>
            {zone ? (zone.pump ? 'Đang chạy' : 'Đang tắt') : 'Chưa có dữ liệu'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cấu hình tưới</Text>
        <View style={styles.configRow}>
          <Text style={styles.meta}>Ngưỡng bật máy bơm</Text>
          <Text style={styles.configValue}>{setting?.threshold ?? zone?.threshold ?? '--'}%</Text>
        </View>
        <View style={styles.configRow}>
          <Text style={styles.meta}>Ngưỡng dừng máy bơm</Text>
          <Text style={styles.configValue}>{setting?.stopThreshold ?? zone?.stopThreshold ?? '--'}%</Text>
        </View>
        <Text style={styles.hint}>Máy bơm tự động hoạt động theo ngưỡng cấu hình khi hệ thống ở chế độ AUTO.</Text>
        <Pressable style={styles.editButton} onPress={() => router.push({
          pathname: '/zone/[id]/settings', params: { id: zoneId },
        })}>
          <Text style={styles.editText}>Chỉnh sửa ngưỡng</Text>
        </Pressable>
      </View>
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
  label: { color: '#78877D', fontSize: 12 },
  moisture: { color: '#173D2A', fontSize: 38, fontWeight: '800', marginTop: 5 },
  progressBackground: { height: 8, backgroundColor: '#E9EFEA', borderRadius: 8, overflow: 'hidden', marginTop: 14 },
  progressFill: { height: 8, borderRadius: 8 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  meta: { color: '#78877D', fontSize: 12 },
  status: { fontSize: 12, fontWeight: '800' },
  cardTitle: { color: '#294936', fontSize: 15, fontWeight: '800', marginBottom: 14 },
  configRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EDF1ED' },
  configValue: { color: '#173D2A', fontSize: 16, fontWeight: '800' },
  hint: { color: '#849087', fontSize: 11, lineHeight: 17, marginTop: 14 },
  editButton: { backgroundColor: GREEN, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 18 },
  editText: { color: '#FFF', fontWeight: '800' },
  error: { color: '#B42318', backgroundColor: '#FEE4E2', padding: 12, borderRadius: 10, marginBottom: 12 },
});
