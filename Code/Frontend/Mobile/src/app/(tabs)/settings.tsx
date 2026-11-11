import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { getConfigChanges, getDeviceConfig, type ConfigChangesResponse, type DeviceConfig, type ZoneConfig } from '../../api/client';

const GREEN = '#16834B';
const NAMES: Record<string, string> = { T001: 'Khu vực 1', T002: 'Khu vực 2', T003: 'Khu vực 3', T004: 'Khu vực 4', T005: 'Khu vực 5', T006: 'Khu vực 6' };

export default function SettingsScreen() {
  const [config, setConfig] = useState<DeviceConfig | null>(null);
  const [history, setHistory] = useState<ConfigChangesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [deviceConfig, changes] = await Promise.all([getDeviceConfig(), getConfigChanges(50)]);
      setConfig(deviceConfig);
      setHistory(changes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải cấu hình');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const zones: ZoneConfig[] = config?.zones ?? [];
  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
      <Text style={styles.brand}>GREENFLOW</Text>
      <Text style={styles.title}>Cài đặt</Text>
      <Text style={styles.subtitle}>Quản lý ngưỡng độ ẩm cho các khu vực tưới</Text>
      {loading && <ActivityIndicator color={GREEN} style={{ margin: 24 }} />}
      {!!error && <Text style={styles.error}>{error}</Text>}
      {!loading && zones.map((zone) => (
        <Pressable key={zone.id} style={styles.zoneCard} onPress={() => router.push(`/zone/${zone.id}`)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.zoneId}>{zone.id} · {NAMES[zone.id] ?? zone.id}</Text>
            <Text style={styles.zoneMeta}>Ngưỡng bật: {zone.threshold}%  ·  Ngưỡng dừng: {zone.stopThreshold}%</Text>
          </View>
          <Text style={styles.edit}>Chỉnh sửa ›</Text>
        </Pressable>
      ))}
      <Text style={styles.section}>Lịch sử thay đổi</Text>
      {!loading && (history?.changes?.length ?? 0) === 0 && <Text style={styles.empty}>Chưa có lịch sử thay đổi.</Text>}
      {history?.changes?.map((item, index) => (
        <View key={`${item.zoneId}-${item.updatedAt}-${index}`} style={styles.historyCard}>
          <Text style={styles.zoneId}>{item.zoneId}</Text>
          <Text style={styles.zoneMeta}>{item.oldThreshold == null ? 'Mới' : `${item.oldThreshold}% → `}{item.threshold}% · Dừng: {item.stopThreshold}%</Text>
          <Text style={styles.date}>{Number.isFinite(item.updatedAt) ? new Date(item.updatedAt).toLocaleString() : String(item.updatedAt)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F5F8F5' }, container: { padding: 20, paddingBottom: 40 }, brand: { color: GREEN, fontSize: 12, fontWeight: '800', letterSpacing: 2 }, title: { color: '#173D2A', fontSize: 26, fontWeight: '800', marginTop: 5 }, subtitle: { color: '#78877D', marginTop: 5, marginBottom: 22 }, zoneCard: { backgroundColor: '#FFF', borderRadius: 15, borderWidth: 1, borderColor: '#E9EFEA', padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }, zoneId: { color: '#173D2A', fontWeight: '800', fontSize: 14 }, zoneMeta: { color: '#78877D', fontSize: 12, marginTop: 6 }, edit: { color: GREEN, fontWeight: '700', fontSize: 12 }, section: { color: '#173D2A', fontWeight: '800', fontSize: 18, marginTop: 20, marginBottom: 12 }, historyCard: { backgroundColor: '#FFF', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E9EFEA' }, date: { color: '#9AA49C', fontSize: 10, marginTop: 6 }, empty: { color: '#78877D', fontSize: 12 }, error: { color: '#B42318', backgroundColor: '#FEE4E2', padding: 12, borderRadius: 10, marginBottom: 12 } });
