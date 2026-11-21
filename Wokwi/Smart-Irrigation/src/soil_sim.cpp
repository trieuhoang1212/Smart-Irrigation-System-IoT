#include "app.h"

int moisturePercent[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};

#if SIMULATE_SOIL_DYNAMICS
static float soilMoisture[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
static float soilManualTarget[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
static bool soilManualChase[ZONE_COUNT] = {false, false, false, false, false, false};
static bool soilStateRestored[ZONE_COUNT] = {false, false, false, false, false, false};
static int lastPotValue[ZONE_COUNT] = {-1, -1, -1, -1, -1, -1};
static float soilPotDrift[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
// Wokwi xoá NVS mỗi lần chạy lại: vài giây đầu mới có ngưỡng thật từ Backend.
// Trong cửa sổ này, độ ẩm khởi tạo được đặt lại theo ngưỡng vừa đồng bộ.
static bool soilSeedPending[ZONE_COUNT] = {true, true, true, true, true, true};
static unsigned long lastSoilPersistAt = 0;
static float lastPersistedSoil[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};

static void persistSoilState(int zone) {
  const String key = String("soil_") + zoneNames[zone];
  prefs.putFloat(key.c_str(), soilMoisture[zone]);
  lastPersistedSoil[zone] = soilMoisture[zone];
}

// Nóng thì đất khô nhanh hơn, không khí ẩm hoặc đang mưa thì khô chậm lại.
// Sàn 0,6 giữ tốc độ khô đủ nhanh khi phòng mát để demo một vòng trong ~15 phút.
static float soilDryingFactor() {
  float factor = 1.0f;
  if (!isnan(temperature)) {
    factor *= constrain(1.0f + (temperature - 25.0f) * 0.04f, 0.6f, 2.0f);
  }
  if (!isnan(humidity)) {
    factor *= constrain(1.0f - (humidity - 60.0f) * 0.008f, 0.2f, 1.5f);
  }
  if (isRaining) factor *= 0.25f;
  return factor;
}
#endif

void soilSetup() {
#if SIMULATE_SOIL_DYNAMICS
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    const String key = String("soil_") + zoneNames[zone];
    if (!prefs.isKey(key.c_str())) continue;
    const float saved = prefs.getFloat(key.c_str());
    soilMoisture[zone] = constrain(saved, 0.0f, 100.0f);
    soilManualTarget[zone] = soilMoisture[zone];
    moisturePercent[zone] = static_cast<int>(round(soilMoisture[zone]));
    lastPersistedSoil[zone] = soilMoisture[zone];
    soilStateRestored[zone] = true;
    soilSeedPending[zone] = false;
  }
#endif
}

void soilOnPumpStarted(int zone) {
#if SIMULATE_SOIL_DYNAMICS
  if (zone >= 0 && zone < ZONE_COUNT) soilSeedPending[zone] = false;
#else
  (void)zone;
#endif
}

void soilOnPumpStopped(int zone, bool wasRunning) {
#if SIMULATE_SOIL_DYNAMICS
  if (wasRunning && zone >= 0 && zone < ZONE_COUNT) persistSoilState(zone);
#else
  (void)zone;
  (void)wasRunning;
#endif
}

void soilOnThresholdSynced(int zone) {
#if SIMULATE_SOIL_DYNAMICS
  if (zone < 0 || zone >= ZONE_COUNT) return;
  // Ngay sau khi khởi động, ngưỡng thật về muộn hơn điểm khởi tạo mặc định:
  // đặt lại độ ẩm giữa cặp ngưỡng thật để số liệu sau reset ổn định.
  if (soilSeedPending[zone] && !pumpRunning[zone] && millis() < SOIL_SEED_WINDOW_MS) {
    soilMoisture[zone] = (moistureOn[zone] + moistureOff[zone]) / 2.0f;
    soilManualTarget[zone] = soilMoisture[zone];
    soilPotDrift[zone] = 0.0f;
    moisturePercent[zone] = static_cast<int>(round(soilMoisture[zone]));
  }
  soilSeedPending[zone] = false;
#else
  (void)zone;
#endif
}

void soilOnSetSoil(int zone, int value) {
#if SIMULATE_SOIL_DYNAMICS
  if (zone < 0 || zone >= ZONE_COUNT) return;
  soilMoisture[zone] = constrain(value, 0, 100);
  soilManualTarget[zone] = soilMoisture[zone];
  soilManualChase[zone] = false;
  soilPotDrift[zone] = 0.0f;
  soilStateRestored[zone] = true;
  soilSeedPending[zone] = false;
  moisturePercent[zone] = static_cast<int>(round(soilMoisture[zone]));
  persistSoilState(zone);
#else
  (void)zone;
  (void)value;
#endif
}

void soilUpdate(unsigned long elapsedMs) {
#if SIMULATE_SOIL_DYNAMICS
  // Bơm chạy thì đất ẩm lên, tắt thì khô dần; chiết áp đóng vai trò tay chỉnh nhanh.
  const float dtMin = elapsedMs / 60000.0f;
  const float dtSec = elapsedMs / 1000.0f;
  const float dryFactor = soilDryingFactor();
  const bool seedWindowOpen = millis() < SOIL_SEED_WINDOW_MS;

  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (!seedWindowOpen) soilSeedPending[zone] = false;
    const int pot = readZoneMoisture(zone);
    if (lastPotValue[zone] < 0) {
      // Không ghi đè giá trị đã khôi phục sau reset; chỉ seed vùng chưa có dữ liệu.
      if (!soilStateRestored[zone]) {
        soilMoisture[zone] = (moistureOn[zone] + moistureOff[zone]) / 2.0f;
        soilManualTarget[zone] = soilMoisture[zone];
      }
    } else {
      // Cộng dồn thay đổi thay vì so từng mẫu: kéo chậm 1%/2 giây vẫn phải bám kịp.
      soilPotDrift[zone] += pot - lastPotValue[zone];
      if (fabs(soilPotDrift[zone]) >= 2.0f) {
        soilManualTarget[zone] = pot;
        soilManualChase[zone] = true;
        soilPotDrift[zone] = 0.0f;
        // Người dùng đã tự vặn chiết áp: giữ đúng số đó, không re-seed theo ngưỡng.
        soilSeedPending[zone] = false;
        soilStateRestored[zone] = false;
      }
    }
    lastPotValue[zone] = pot;

    if (soilManualChase[zone]) {
      const float maxStep = SOIL_MANUAL_PER_SEC * dtSec;
      const float remaining = soilManualTarget[zone] - soilMoisture[zone];
      if (fabs(remaining) <= maxStep) {
        soilMoisture[zone] = soilManualTarget[zone];
        soilManualChase[zone] = false;
      } else {
        soilMoisture[zone] += remaining > 0 ? maxStep : -maxStep;
      }
    } else if (pumpRunning[zone]) {
      const float wetPerMin = SOIL_PERCENT_PER_LITER * zoneFlowLph[zone] / 60.0f;
      soilMoisture[zone] += wetPerMin * dtMin;
    } else {
      soilMoisture[zone] -= SOIL_DRY_PER_MIN * dtMin * dryFactor;
    }
    soilMoisture[zone] = constrain(soilMoisture[zone], 0.0f, 100.0f);
    moisturePercent[zone] = static_cast<int>(round(soilMoisture[zone]));
  }

  if (elapsedSince(millis(), lastSoilPersistAt, SOIL_PERSIST_INTERVAL_MS)) {
    for (int zone = 0; zone < ZONE_COUNT; zone++) {
      if (fabs(soilMoisture[zone] - lastPersistedSoil[zone]) >= 0.5f) {
        persistSoilState(zone);
      }
    }
    lastSoilPersistAt = millis();
  }
#else
  (void)elapsedMs;
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    moisturePercent[zone] = readZoneMoisture(zone);
  }
#endif
}
