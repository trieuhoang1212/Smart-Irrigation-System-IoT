#include "app.h"

#include <ESP32Servo.h>

bool isAutoMode = true;
bool pumpRunning[ZONE_COUNT] = {false, false, false, false, false, false};

unsigned long zoneStartedAt[ZONE_COUNT] = {0};
int zoneStartMoisture[ZONE_COUNT] = {0};
unsigned long zoneCooldownUntil[ZONE_COUNT] = {0};
bool zoneLocked[ZONE_COUNT] = {false};
bool zoneOverTarget[ZONE_COUNT] = {false, false, false, false, false, false};
unsigned long manualStartedAt = 0;

int rainPercent = 0;
bool isRaining = false;
bool rainWarning = false;
static bool previousRaining = false;

bool tankEmpty = false;
bool tankValid = false;
float tankDistanceCm = 0.0f;
static unsigned long lastTankReadAt = 0;
static int tankEmptyStreak = 0;
static int tankRefillStreak = 0;

static Servo masterValve;

void controlSetup() {
  masterValve.attach(SERVO_PIN);
  masterValve.write(MASTER_VALVE_CLOSED);
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    pinMode(RELAY_PINS[zone], OUTPUT);
    stopPump(zone);
  }
}

void saveMode() {
  prefs.putBool("auto", isAutoMode);
}

bool anyPumpRunning() {
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (pumpRunning[zone]) return true;
  }
  return false;
}

void startPump(int zone) {
  if (zone < 0 || zone >= ZONE_COUNT) return;
  if (tankEmpty || zoneLocked[zone]) {
    Serial.print("BLOCK ");
    Serial.print(zoneNames[zone]);
    Serial.println(tankEmpty ? " tank empty" : " runtime lock");
    return;
  }
  // Chặn ngay từ đầu thay vì bật 2 giây rồi bị khối mưa tắt, tránh nháy relay.
  if (weatherGateEnabled && isRaining) {
    Serial.print("BLOCK ");
    Serial.print(zoneNames[zone]);
    Serial.println(" rain");
    return;
  }

  pumpRunning[zone] = true;
  zoneStartedAt[zone] = millis();
  zoneStartMoisture[zone] = moisturePercent[zone];
  soilOnPumpStarted(zone);

  digitalWrite(RELAY_PINS[zone], LOW);  // Active LOW
  digitalWrite(LED_PIN, HIGH);
  masterValve.write(MASTER_VALVE_OPEN);
  updateLcds();
}

void stopPump(int zone, const char* reason) {
  if (zone < 0 || zone >= ZONE_COUNT) return;
  const bool wasRunning = pumpRunning[zone];
  pumpRunning[zone] = false;
  zoneStartedAt[zone] = 0;

  if (wasRunning && reason != nullptr) {
    Serial.print("STOP ");
    Serial.print(zoneNames[zone]);
    Serial.print(": ");
    Serial.println(reason);
  }
  soilOnPumpStopped(zone, wasRunning);

  digitalWrite(RELAY_PINS[zone], HIGH);
  if (!anyPumpRunning()) {
    digitalWrite(LED_PIN, LOW);
    masterValve.write(MASTER_VALVE_CLOSED);
    updateLcds();
  }
}

void startAllZones() {
  for (int zone = 0; zone < ZONE_COUNT; zone++) startPump(zone);
}

void stopAllZones(const char* reason) {
  for (int zone = 0; zone < ZONE_COUNT; zone++) stopPump(zone, reason);
}

void updateRainState() {
  rainPercent = readRainPercent();
  const bool wasWarning = rainWarning;
  // Bật mưa ở ngưỡng, chỉ tắt khi giảm dưới ngưỡng 5 điểm để bơm không nháy.
  const int rainStopAt = max(0, rainThreshold - RAIN_HYSTERESIS);
  isRaining = isRaining ? rainPercent >= rainStopAt : rainPercent >= rainThreshold;
  rainWarning = !isRaining && rainPercent >= rainWarnThreshold;

  if (rainWarning && !wasWarning) {
    Serial.println("RAIN: co the mua - canh bao");
  }
  if (isRaining != previousRaining) {
    Serial.println(isRaining ? "RAIN ALERT: Dang mua" : "RAIN ALERT: Het mua");
    if (isRaining) beepOnce(1500);
    previousRaining = isRaining;
  }
}

void updateTank() {
  const unsigned long now = millis();
  const float distance = readTankDistanceCm();
  if (distance < 0 || distance > 400) {
    tankEmptyStreak = 0;
    tankRefillStreak = 0;
    // Cảm biến lỗi kéo dài: báo distanceCm = null thay vì phát mãi số đo cũ.
    if (tankValid && elapsedSince(now, lastTankReadAt, TANK_STALE_MS)) {
      tankValid = false;
      Serial.println("TANK: sensor stale - distance unknown");
    }
    return;
  }

  tankDistanceCm = distance;
  tankValid = true;
  lastTankReadAt = now;

  if (!tankEmpty) {
    tankRefillStreak = 0;
    tankEmptyStreak = distance >= TANK_EMPTY_CM ? tankEmptyStreak + 1 : 0;
    if (tankEmptyStreak >= TANK_CONFIRM_READS) {
      tankEmptyStreak = 0;
      tankEmpty = true;
      stopAllZones("tank empty");
      beepOnce(400);
      updateLcds();
    }
  } else {
    tankEmptyStreak = 0;
    tankRefillStreak = distance <= TANK_REFILL_CM ? tankRefillStreak + 1 : 0;
    if (tankRefillStreak >= TANK_CONFIRM_READS) {
      tankRefillStreak = 0;
      tankEmpty = false;
      Serial.println("TANK: water back");
      beepOnce(150);
      updateLcds();
    }
  }
}

void enforceRuntimeLimits() {
  const unsigned long now = millis();
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (pumpRunning[zone] && elapsedSince(now, zoneStartedAt[zone], MAX_ZONE_RUNTIME_MS)) {
      stopPump(zone, "max runtime");
      zoneCooldownUntil[zone] = now + ZONE_COOLDOWN_MS;

      // Chỉ khoá khi suốt lượt tưới đất không ẩm lên (cảm biến không phản hồi).
      // Ngưỡng "có ẩm lên" tính theo lưu lượng: flow nhỏ thì chỉ cần 1 điểm.
      const int rise = moisturePercent[zone] - zoneStartMoisture[zone];
#if SIMULATE_SOIL_DYNAMICS
      const float expectedRise = SOIL_PERCENT_PER_LITER * zoneFlowLph[zone] *
                                 (MAX_ZONE_RUNTIME_MS / 60000.0f) / 60.0f;
      const int minRise = constrain(static_cast<int>(expectedRise * 0.3f), 1, 3);
      const bool sensorStuck = expectedRise >= 1.0f && rise < minRise;
#else
      const bool sensorStuck = rise < 3;
#endif
      if (sensorStuck) {
        zoneLocked[zone] = true;
        Serial.println("SAFETY: no moisture rise -> lock zone");
      }
    }
    // Mở khóa khi đất đã đủ ẩm; cảm biến kẹt khô thì vẫn khóa để bơm không chạy mãi.
    if (zoneLocked[zone] && moisturePercent[zone] >= moistureOff[zone]) {
      zoneLocked[zone] = false;
    }
  }

  // Chỉ đếm 10 phút khi bơm đang chạy thật: chuyển sang Thủ công rồi tắt bơm
  // thì phải đứng yên chờ người dùng bấm, không tự về Tự động.
  if (!isAutoMode && manualStartedAt != 0 && anyPumpRunning() &&
      elapsedSince(now, manualStartedAt, MAX_MANUAL_MS)) {
    stopAllZones("manual timeout");
    isAutoMode = true;
    saveMode();
    manualStartedAt = 0;
    Serial.println("SAFETY: manual 10 min -> AUTO");
    updateLcds();
  }
}

void enforceWaterTargets() {
  const unsigned long now = millis();
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    zoneOverTarget[zone] = false;
    const bool targetReached =
      !isAutoMode && pumpRunning[zone] && zoneTargetSeconds[zone] > 0 &&
      elapsedSince(now, zoneStartedAt[zone],
                   static_cast<unsigned long>(zoneTargetSeconds[zone]) * 1000UL);
    if (targetReached) {
      zoneOverTarget[zone] = true;
      stopPump(zone, "water target reached");
    }
  }
}

void runAutoControl() {
  const unsigned long now = millis();
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (weatherGateEnabled && isRaining && pumpRunning[zone]) {
      stopPump(zone, "rain");
    } else if (pumpRunning[zone] && moisturePercent[zone] >= moistureOff[zone]) {
      stopPump(zone, "moisture reached");
    } else if (!pumpRunning[zone] && !tankEmpty && !zoneLocked[zone] &&
               deadlineReached(now, zoneCooldownUntil[zone]) &&
               (!weatherGateEnabled || !isRaining) &&
               moisturePercent[zone] <= moistureOn[zone]) {
      startPump(zone);
    }
  }
}

// Bấm nút vật lý: vào MANUAL và bật cả 6 vùng (có thể bị chặn vì bồn cạn / đang mưa).
void startManualFromButton() {
  isAutoMode = false;
  saveMode();
  manualStartedAt = millis();
  const bool blocked = tankEmpty || (weatherGateEnabled && isRaining);
  startAllZones();
  Serial.println(blocked ? "BTN: manual ON (bon can hoac dang mua - bi chan)"
                         : "BTN: manual ON (T001-T006)");
  beepOnce(blocked ? 400 : 150);
}