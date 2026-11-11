
import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const zones = [
  { id: 'T001', name: 'Khu vực 1', moisture: 35, pump: true },
  { id: 'T002', name: 'Khu vực 2', moisture: 62, pump: false },
  { id: 'T003', name: 'Khu vực 3', moisture: 48, pump: false },
  { id: 'T004', name: 'Khu vực 4', moisture: 28, pump: true },
  { id: 'T005', name: 'Khu vực 5', moisture: 75, pump: false },
  { id: 'T006', name: 'Khu vực 6', moisture: 55, pump: false },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [pump, setPump] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>GREENFLOW</Text>
            <Text style={styles.heading}>Smart Irrigation</Text>
            <Text style={styles.subtitle}>Hệ thống tưới cây thông minh</Text>
          </View>

          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>

        {/* Overview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Tổng quan</Text>
          <Text style={styles.liveText}>● LIVE</Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metricCard}>
            <Text style={styles.metricIcon}>🌡️</Text>
            <Text style={styles.metricValue}>29°C</Text>
            <Text style={styles.metricLabel}>Nhiệt độ</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricIcon}>💧</Text>
            <Text style={styles.metricValue}>72%</Text>
            <Text style={styles.metricLabel}>Độ ẩm không khí</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricIcon}>🌧️</Text>
            <Text style={styles.metricValue}>Không</Text>
            <Text style={styles.metricLabel}>Trạng thái mưa</Text>
          </View>
        </View>

        {/* Control */}
        <Text style={styles.sectionTitle}>Điều khiển hệ thống</Text>

        <View style={styles.controlCard}>
          <Text style={styles.cardTitle}>Chế độ hoạt động</Text>

          <View style={styles.modeContainer}>
            {(['AUTO', 'MANUAL'] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => setMode(item)}
                style={[
                  styles.modeButton,
                  mode === item && styles.modeActive,
                ]}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === item && styles.modeTextActive,
                  ]}
                >
                  {item === 'AUTO' ? 'Tự động' : 'Thủ công'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.pumpRow}>
            <View>
              <Text style={styles.cardTitle}>Máy bơm tổng</Text>
              <Text style={styles.pumpStatus}>
                {pump ? 'Đang bật' : 'Đang tắt'}
              </Text>
            </View>

            <Pressable
              disabled={mode === 'AUTO'}
              onPress={() => setPump(!pump)}
              style={[
                styles.pumpButton,
                pump && styles.pumpActive,
                mode === 'AUTO' && styles.disabledButton,
              ]}
            >
              <Text style={styles.pumpButtonText}>
                {pump ? 'BẬT' : 'TẮT'}
              </Text>
            </Pressable>
          </View>

          {mode === 'AUTO' && (
            <Text style={styles.note}>
              Chuyển sang chế độ thủ công để điều khiển máy bơm.
            </Text>
          )}
        </View>

        {/* Zones */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Khu vực tưới</Text>
          <Text style={styles.zoneCount}>06 khu vực</Text>
        </View>

        <View style={styles.zoneGrid}>
          {zones.map((zone) => (
            <View key={zone.id} style={styles.zoneCard}>
              <View style={styles.zoneHeader}>
                <Text style={styles.zoneId}>{zone.id}</Text>
                <View
                  style={[
                    styles.zoneDot,
                    { backgroundColor: zone.pump ? '#16A34A' : '#9CA3AF' },
                  ]}
                />
              </View>

              <Text style={styles.zoneName}>{zone.name}</Text>

              <Text style={styles.moistureValue}>
                {zone.moisture}%
              </Text>
              <Text style={styles.moistureLabel}>Độ ẩm đất</Text>

              <View style={styles.progressBackground}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${zone.moisture}%`,
                      backgroundColor:
                        zone.moisture < 40 ? '#E99A38' : '#16A34A',
                    },
                  ]}
                />
              </View>

              <View style={styles.zoneFooter}>
                <Text style={styles.zoneFooterLabel}>Máy bơm</Text>
                <Text
                  style={[
                    styles.zonePump,
                    { color: zone.pump ? '#16A34A' : '#777777' },
                  ]}
                >
                  {zone.pump ? 'Đang chạy' : 'Đang tắt'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          SMART IRRIGATION SYSTEM · GREENFLOW
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F8F5',
  },
  container: {
    padding: 20,
    paddingBottom: 35,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  brand: {
    color: '#16834B',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  heading: {
    color: '#173D2A',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 5,
  },
  subtitle: {
    color: '#78877D',
    fontSize: 13,
    marginTop: 5,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 6,
  },
  onlineText: {
    color: '#16834B',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#173D2A',
    marginBottom: 14,
  },
  liveText: {
    color: '#16A34A',
    fontSize: 11,
    fontWeight: '800',
  },
  metrics: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 27,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 12,
    minHeight: 112,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9EFEA',
  },
  metricIcon: {
    fontSize: 21,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#173D2A',
  },
  metricLabel: {
    color: '#7B8980',
    fontSize: 10,
    marginTop: 5,
  },
  controlCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 17,
    marginBottom: 27,
    borderWidth: 1,
    borderColor: '#E9EFEA',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#294936',
  },
  modeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F4F0',
    borderRadius: 12,
    padding: 4,
    marginTop: 12,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 9,
  },
  modeActive: {
    backgroundColor: '#16834B',
  },
  modeText: {
    color: '#68786C',
    fontWeight: '700',
    fontSize: 13,
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  pumpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EDF1ED',
    paddingTop: 17,
  },
  pumpStatus: {
    color: '#849087',
    fontSize: 12,
    marginTop: 5,
  },
  pumpButton: {
    backgroundColor: '#E7ECE8',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  pumpActive: {
    backgroundColor: '#16834B',
  },
  disabledButton: {
    opacity: 0.45,
  },
  pumpButtonText: {
    color: '#173D2A',
    fontSize: 12,
    fontWeight: '800',
  },
  note: {
    color: '#8B958D',
    fontSize: 11,
    marginTop: 13,
  },
  zoneCount: {
    color: '#849087',
    fontSize: 12,
    marginBottom: 14,
  },
  zoneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  zoneCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EFEA',
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zoneId: {
    color: '#16834B',
    fontWeight: '800',
    fontSize: 13,
  },
  zoneDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  zoneName: {
    color: '#7B8980',
    fontSize: 11,
    marginTop: 7,
  },
  moistureValue: {
    fontSize: 27,
    fontWeight: '800',
    color: '#173D2A',
    marginTop: 14,
  },
  moistureLabel: {
    fontSize: 11,
    color: '#849087',
    marginTop: 2,
  },
  progressBackground: {
    height: 6,
    backgroundColor: '#E9EFEA',
    borderRadius: 5,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 5,
  },
  zoneFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  zoneFooterLabel: {
    color: '#849087',
    fontSize: 10,
  },
  zonePump: {
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    color: '#A0AAA2',
    textAlign: 'center',
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 30,
  },
});
