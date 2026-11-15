#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <Preferences.h>

#define DHTPIN 4
#define DHTTYPE DHT22
#define RAIN_DIGITAL_PIN 27
#define TANK_TRIG_PIN 12
#define WIFI_BUTTON_PIN 14
#define MANUAL_BUTTON_PIN 13
#define TANK_ECHO_PIN 26

// 1: mô phỏng động học đất (bơm chạy thì ẩm lên, tắt thì khô dần), chiết áp là tay chỉnh.
// 0: chiết áp là số đo trực tiếp, bơm chạy không làm đổi số đo.
#define SIMULATE_SOIL_DYNAMICS 1

// Hệ thống 6 khu vực cây trồng (T001 - T006)
#define ZONE_COUNT 6
#define LED_PIN 2
#define BUZZER_PIN 0
#define SERVO_PIN 5
#define MASTER_VALVE_CLOSED 0
#define MASTER_VALVE_OPEN 90
const int soilAdcPins[ZONE_COUNT] = {32, 33, 34, 35, 36, 39};

// Rơ-le điều khiển van từng luống (Active LOW).
const int relayPins[ZONE_COUNT] = {16, 17, 18, 23, 15, 19};

// Ngưỡng tưới tương ứng (T001: Rau muống, T002: Cà chua, T003: Cà rốt, T004: Khoai lang, T005: Dưa leo, T006: Xà lách)
// Có thể chỉnh từ Web thông qua lệnh SET_THRESHOLD_T00X_YY.
int moistureOn[ZONE_COUNT]  = {60, 45, 35, 30, 45, 55};
int moistureOff[ZONE_COUNT] = {80, 65, 55, 50, 65, 75};
// Thời gian tưới thủ công để đạt mục tiêu nước (giây), Backend đẩy qua SET_TARGET_T00X_YY.
int zoneTargetSeconds[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
// Lưu lượng đầu tưới (L/giờ) của từng vùng, Backend đẩy qua SET_FLOW_T00X_YY.
int zoneFlowLph[ZONE_COUNT] = {48, 60, 60, 60, 60, 48};
const char* zoneNames[ZONE_COUNT] = {"T001", "T002", "T003", "T004", "T005", "T006"};

const char* mqtt_server = "host.wokwi.internal";
const int mqtt_port = 1883;

const char* topic_status = "smart-irrigation/status";
const char* topic_cmd    = "smart-irrigation/cmd";

WiFiClient espClient;
PubSubClient client(espClient);
Preferences prefs;  // Lưu ngưỡng vào NVS để không mất khi reboot


bool isAutoMode = true;
bool manualOverride = false;
bool simulateOffline = false;
bool pumpRunning[ZONE_COUNT] = {false, false, false, false, false, false};
bool weatherGateEnabled = true;
int moisturePercent[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
#if SIMULATE_SOIL_DYNAMICS
float soilMoisture[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
float soilManualTarget[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
bool soilManualChase[ZONE_COUNT] = {false, false, false, false, false, false};
bool soilStateRestored[ZONE_COUNT] = {false, false, false, false, false, false};
int lastPotValue[ZONE_COUNT] = {-1, -1, -1, -1, -1, -1};
float soilPotDrift[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
// Wokwi xoá NVS mỗi lần chạy lại: vài giây đầu mới có ngưỡng thật từ Backend.
// Trong cửa sổ này, độ ẩm khởi tạo được đặt lại theo ngưỡng vừa đồng bộ.
bool soilSeedPending[ZONE_COUNT] = {true, true, true, true, true, true};
const unsigned long SOIL_SEED_WINDOW_MS = 30000UL;
const unsigned long SOIL_PERSIST_INTERVAL_MS = 30000UL;
unsigned long lastSoilPersistAt = 0;
float lastPersistedSoil[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
#endif
int zoneStartMoisture[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
int rainPercent = 0;
bool isRaining = false;
bool rainWarning = false;
bool previousRaining = false;
float temperature = 0.0;
float humidity = 0.0;

unsigned long previousMillis = 0;
const unsigned long CONTROL_INTERVAL_MS = 2000UL;

// Bảo vệ khi đi vắng: giới hạn thời gian tưới và thời gian giữ chế độ MANUAL.
// Giảm xuống 1-2 phút nếu cần demo nhanh.
const unsigned long MAX_ZONE_RUNTIME_MS = 10UL * 60UL * 1000UL;
const unsigned long MAX_MANUAL_MS = 10UL * 60UL * 1000UL;
// Nghỉ ngắn sau khi chạm giới hạn mỗi lượt để auto không chạy nối tiếp liền mạch.
const unsigned long ZONE_COOLDOWN_MS = 2UL * 60UL * 1000UL;
// Cảm biến mưa: ngưỡng "đang mưa" chỉnh từ Web qua SET_RAIN_THRESHOLD_xx.
// Cảnh báo "có thể mưa" đi trước ngưỡng 20 điểm, giống cặp ngưỡng tưới/dừng của đất.
const int RAIN_THRESHOLD_MIN = 40;
const int RAIN_THRESHOLD_MAX = 100;
const int RAIN_WARN_OFFSET = 20;
// Mưa phải giảm dưới ngưỡng 5 điểm mới coi là tạnh, tránh bơm bật/tắt quanh ngưỡng.
const int RAIN_HYSTERESIS = 5;
// Ngưỡng dừng = ngưỡng bật + 20 điểm, giống Backend (deriveStopThreshold).
const int STOP_OFFSET = 20;
const unsigned long RAIN_WARN_INTERVAL_MS = 15000UL;
const unsigned long OVERWATER_INTERVAL_MS = 10000UL;
int rainThreshold = RAIN_THRESHOLD_MAX;
int rainWarnThreshold = RAIN_THRESHOLD_MAX - RAIN_WARN_OFFSET;
// Độ ẩm tăng theo lượng nước nhận được: 1 L nâng khoảng 2% độ ẩm vùng.
// Tốc độ tăng (%/phút) = SOIL_PERCENT_PER_LITER * lưu lượng đầu tưới (L/giờ) / 60.
const float SOIL_PERCENT_PER_LITER = 2.0f;
// Ở 25°C / 60% RH; nóng thì nhanh hơn, ẩm/mưa thì chậm lại (xem soilDryingFactor).
// Chọn mức để vòng demo khô -> tự tưới -> đủ ẩm gói trong khoảng 15 phút.
const float SOIL_DRY_PER_MIN = 3.5f;
// Chiết áp là tay điều khiển để test: bám gần như tức thì trong 1 chu kỳ 2 giây.
const float SOIL_MANUAL_PER_SEC = 20.0f;
const unsigned long SOIL_STEP_CAP_MS = 10000UL;
// HC-SR04 gắn trên miệng bồn, đo khoảng cách tới mặt nước: xa quá nghĩa là bồn cạn.
const float TANK_EMPTY_CM = 80.0;
const float TANK_REFILL_CM = 60.0;
// Quá thời gian này không đọc được thì bỏ số đo cũ, tránh Web hiển thị mực nước đã lỗi thời.
const unsigned long TANK_STALE_MS = 10000UL;
// Một xung nhiễu không đủ để đổi trạng thái bồn: cần 2 lần đọc liên tiếp.
const int TANK_CONFIRM_READS = 2;
unsigned long zoneStartedAt[ZONE_COUNT] = {0};
unsigned long zoneCooldownUntil[ZONE_COUNT] = {0};
bool zoneLocked[ZONE_COUNT] = {false};
bool zoneOverTarget[ZONE_COUNT] = {false, false, false, false, false, false};
unsigned long manualStartedAt = 0;
bool tankEmpty = false;
bool tankValid = false;
float tankDistanceCm = 0.0;
unsigned long lastTankReadAt = 0;
int tankEmptyStreak = 0;
int tankRefillStreak = 0;

bool netWasOnline = false;
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
unsigned long beepUntil = 0;
unsigned long lastRainWarnBeepAt = 0;
unsigned long lastOverwaterBeepAt = 0;
int buzzerTone = -1;

struct ButtonState {
  bool raw = false;
  bool stable = false;
  unsigned long changedAt = 0;
};
ButtonState wifiButton;
ButtonState manualButton;

DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcds[ZONE_COUNT] = {
  LiquidCrystal_I2C(0x20, 16, 2),
  LiquidCrystal_I2C(0x21, 16, 2),
  LiquidCrystal_I2C(0x22, 16, 2),
  LiquidCrystal_I2C(0x23, 16, 2),
  LiquidCrystal_I2C(0x24, 16, 2),
  LiquidCrystal_I2C(0x25, 16, 2),
};
bool lcdReady = false;
Servo masterValve;

bool isNetOnline() {
  return WiFi.status() == WL_CONNECTED && client.connected();
}

void updateLcds() {
  if (!lcdReady) return;

  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    String status = String("PUMP ") + (pumpRunning[zone] ? "ON " : "OFF ");
    if (tankEmpty) status = "TANK EMPTY";
    else if (!isNetOnline()) status += "OFFLINE";
    else if (isRaining) status += "RAIN";
    else if (rainWarning) status += "RAIN?";
    else status += isAutoMode ? "AUTO" : "MAN";

    lcds[zone].clear();
    lcds[zone].setCursor(0, 0);
    lcds[zone].print(zoneNames[zone]);
    lcds[zone].print(" M:");
    lcds[zone].print(moisturePercent[zone]);
    lcds[zone].print("%");
    lcds[zone].setCursor(0, 1);
    lcds[zone].print(status);
  }
}

void beepOnce(unsigned long durationMs) {
  beepUntil = millis() + durationMs;
}

bool anyZoneOverTarget() {
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (zoneOverTarget[zone]) return true;
  }
  return false;
}

void updateBuzzer() {
  const unsigned long now = millis();
  int target = 0;
  if (rainWarning && now - lastRainWarnBeepAt >= RAIN_WARN_INTERVAL_MS) {
    lastRainWarnBeepAt = now;
    beepOnce(500);
  }
  if (anyZoneOverTarget() && now - lastOverwaterBeepAt >= OVERWATER_INTERVAL_MS) {
    lastOverwaterBeepAt = now;
    beepOnce(900);
  }
  if (beepUntil != 0 && now < beepUntil) target = 1200;
  else beepUntil = 0;

  if (target == buzzerTone) return;
  if (target == 0) noTone(BUZZER_PIN);
  else tone(BUZZER_PIN, target);
  buzzerTone = target;
}

void updateRainAlarm() {
  if (isRaining != previousRaining) {
    Serial.println(isRaining ? "RAIN ALERT: Dang mua" : "RAIN ALERT: Het mua");
    if (isRaining) beepOnce(1500);
    previousRaining = isRaining;
  }
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
#if SIMULATE_SOIL_DYNAMICS
  // Đã có nước thật vào đất thì không chỉnh lại điểm khởi tạo nữa.
  soilSeedPending[zone] = false;
#endif
  digitalWrite(relayPins[zone], LOW); // Active LOW
  digitalWrite(LED_PIN, HIGH);
  masterValve.write(MASTER_VALVE_OPEN);
  
  updateLcds();
}

#if SIMULATE_SOIL_DYNAMICS
void persistSoilState(int zone) {
  if (zone < 0 || zone >= ZONE_COUNT) return;
  const String key = String("soil_") + zoneNames[zone];
  prefs.putFloat(key.c_str(), soilMoisture[zone]);
  lastPersistedSoil[zone] = soilMoisture[zone];
}
#endif

bool anyPumpRunning() {
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (pumpRunning[zone]) return true;
  }
  return false;
}

void stopPump(int zone) {
  if (zone < 0 || zone >= ZONE_COUNT) return;
  const bool wasRunning = pumpRunning[zone];
  pumpRunning[zone] = false;
  zoneStartedAt[zone] = 0;
#if SIMULATE_SOIL_DYNAMICS
  if (wasRunning) persistSoilState(zone);
#endif
  digitalWrite(relayPins[zone], HIGH);

  if (!anyPumpRunning()) {
    digitalWrite(LED_PIN, LOW);
    masterValve.write(MASTER_VALVE_CLOSED);
    updateLcds();
  }
}

void startAllZones() {
  for (int zone = 0; zone < ZONE_COUNT; zone++) startPump(zone);
}

void stopAllZones() {
  for (int zone = 0; zone < ZONE_COUNT; zone++) stopPump(zone);
}

float readTankDistanceCm() {
  digitalWrite(TANK_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TANK_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TANK_TRIG_PIN, LOW);

  const unsigned long duration = pulseIn(TANK_ECHO_PIN, HIGH, 30000UL);
  if (duration == 0) return -1;  // cảm biến không trả về xung
  return duration / 58.0;
}

void updateTank() {
  const unsigned long now = millis();
  const float distance = readTankDistanceCm();
  if (distance < 0 || distance > 400) {
    tankEmptyStreak = 0;
    tankRefillStreak = 0;
    // Cảm biến lỗi kéo dài: báo distanceCm = null thay vì phát mãi số đo cũ.
    if (tankValid && now - lastTankReadAt >= TANK_STALE_MS) {
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
      Serial.println("TANK: EMPTY - stop all pumps");
      stopAllZones();
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

#if SIMULATE_SOIL_DYNAMICS
// Nóng thì đất khô nhanh hơn, không khí ẩm hoặc đang mưa thì khô chậm lại.
// Sàn 0,6 giữ tốc độ khô đủ nhanh khi phòng mát để demo một vòng trong ~15 phút.
float soilDryingFactor() {
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

void enforceRuntimeLimits() {
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (pumpRunning[zone] &&
        millis() - zoneStartedAt[zone] >= MAX_ZONE_RUNTIME_MS) {
      Serial.print("SAFETY: ");
      Serial.print(zoneNames[zone]);
      Serial.println(" max runtime -> stop");
      stopPump(zone);
      zoneCooldownUntil[zone] = millis() + ZONE_COOLDOWN_MS;
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
      millis() - manualStartedAt >= MAX_MANUAL_MS) {
    stopAllZones();
    isAutoMode = true;
    manualOverride = false;
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
      now - zoneStartedAt[zone] >=
        static_cast<unsigned long>(zoneTargetSeconds[zone]) * 1000UL;
    if (targetReached) {
      Serial.print("ALERT: ");
      Serial.print(zoneNames[zone]);
      Serial.println(" water target reached -> stop pump");
      zoneOverTarget[zone] = true;
      lastOverwaterBeepAt = now - OVERWATER_INTERVAL_MS;
      stopPump(zone);
    }
  }
}

bool buttonPressed(int pin, ButtonState &state) {
  const bool raw = digitalRead(pin) == LOW;
  const unsigned long now = millis();
  if (raw != state.raw) {
    state.raw = raw;
    state.changedAt = now;
  } else if (raw != state.stable && now - state.changedAt >= 50) {
    state.stable = raw;
    return raw;
  }
  return false;
}

// Bấm nút vật lý: vào MANUAL và bật cả 6 vùng (có thể bị chặn vì bồn cạn / đang mưa).
void startManualFromButton() {
  manualStartedAt = millis();
  const bool blocked = tankEmpty || (weatherGateEnabled && isRaining);
  startAllZones();
  Serial.println(blocked ? "BTN: manual ON (bon can hoac dang mua - bi chan)"
                         : "BTN: manual ON (T001-T006)");
  beepOnce(blocked ? 400 : 150);
}

void handleButtons() {
  // Nút mô phỏng mất WiFi: nhấn lần 1 ngắt, nhấn lần 2 nối lại.
  if (buttonPressed(WIFI_BUTTON_PIN, wifiButton)) {
    if (simulateOffline) {
      simulateOffline = false;
      lastWifiAttempt = millis();
      lastMqttAttempt = 0;
      WiFi.begin("Wokwi-GUEST", "", 6);
      Serial.println("BTN: WiFi -> reconnect");
    } else {
      simulateOffline = true;
      client.disconnect();
      WiFi.disconnect(true);
      Serial.println("BTN: WiFi -> simulated offline");
    }
    beepOnce(150);
    updateLcds();
  }

  // Nút vật lý: bật/tắt cả 6 vùng ở chế độ thủ công, không cần Web/WiFi.
  // Khi tắt vẫn giữ MANUAL; sau MAX_MANUAL_MS tự về AUTO để không tưới mãi khi đi vắng.
  if (buttonPressed(MANUAL_BUTTON_PIN, manualButton)) {
    if (!manualOverride) {
      manualOverride = true;
      isAutoMode = false;
      startManualFromButton();
    } else if (anyPumpRunning()) {
      stopAllZones();
      Serial.println("BTN: manual OFF (giu MANUAL)");
      beepOnce(150);
    } else {
      startManualFromButton();
    }
    updateLcds();
  }
}

void ensureNetwork() {
  if (simulateOffline) {
    if (netWasOnline) {
      netWasOnline = false;
      Serial.println("NET: OFFLINE (simulated)");
      updateLcds();
    }
    return;
  }

  const unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (now - lastWifiAttempt >= 10000) {
      lastWifiAttempt = now;
      Serial.println("NET: WiFi reconnecting...");
      WiFi.reconnect();
    }
  } else if (!client.connected()) {
    if (now - lastMqttAttempt >= 5000) {
      lastMqttAttempt = now;
      Serial.print("NET: MQTT connecting...");
      String clientId = "ESP32-SmartIrrigation-" + String(random(0xffff), HEX);
      if (client.connect(clientId.c_str())) {
        Serial.println(" connected");
        client.subscribe(topic_cmd);
      } else {
        Serial.print(" failed, rc=");
        Serial.println(client.state());
      }
    }
  }

  const bool online = isNetOnline();
  if (online != netWasOnline) {
    netWasOnline = online;
    Serial.println(online ? "NET: ONLINE" : "NET: OFFLINE");
    updateLcds();
  }
}

int readDirectMoisture(int pin) {
  int samples[9];
  for (int sample = 0; sample < 9; sample++) {
    samples[sample] = analogRead(pin);
    delayMicroseconds(100);
  }
  for (int i = 1; i < 9; i++) {
    const int value = samples[i];
    int j = i - 1;
    while (j >= 0 && samples[j] > value) {
      samples[j + 1] = samples[j];
      j--;
    }
    samples[j + 1] = value;
  }
  return constrain(map(samples[4], 0, 4095, 0, 100), 0, 100);
}

// Chip mưa xuất PWM tối đa 90/100 ms, nên 90 mẫu HIGH tương ứng 100% mưa.
const int RAIN_PWM_MAX_SAMPLES = 90;

int readRainPercent() {
  int highSamples = 0;
  for (int sample = 0; sample < 100; sample++) {
    if (digitalRead(RAIN_DIGITAL_PIN) == HIGH) highSamples++;
    delay(1);
  }
  return constrain(map(highSamples, 0, RAIN_PWM_MAX_SAMPLES, 0, 100), 0, 100);
}

int readZoneMoisture(int zone) {
  return readDirectMoisture(soilAdcPins[zone]);
}

int findZoneIndex(const char* zoneId) {
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (strcmp(zoneNames[zone], zoneId) == 0) return zone;
  }
  return -1;
}

void setSimulatedSoilMoisture(int zone, int value) {
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

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print("MQTT [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);

  if (String(topic) == topic_cmd) {
    if (message == "MODE_AUTO") {
      isAutoMode = true;
      manualOverride = false;
      manualStartedAt = 0;
      Serial.println("Mode: AUTO");
    } else if (message == "MODE_MANUAL") {
      isAutoMode = false;
      manualOverride = false;
      // Vào Thủ công phải dừng hết bơm; chỉ chạy khi người dùng bấm.
      stopAllZones();
      manualStartedAt = 0;
      for (int i = 0; i < ZONE_COUNT; i++) zoneOverTarget[i] = false;
      Serial.println("Mode: MANUAL (pumps stopped)");
      updateLcds();
    } else if (message == "PUMP_ON") {
      if (!isAutoMode) {
        manualStartedAt = millis();
        startAllZones();
      }
    } else if (message == "PUMP_OFF") {
      if (!isAutoMode) stopAllZones();
    } else if (message.startsWith("SET_TARGET_")) {
      char zoneId[5] = {0};
      int seconds = 0;
      if (sscanf(message.c_str(), "SET_TARGET_%4[^_]_%d", zoneId, &seconds) == 2) {
        seconds = constrain(seconds, 0, static_cast<int>(MAX_ZONE_RUNTIME_MS / 1000UL));
        const int zone = findZoneIndex(zoneId);
        if (zone >= 0) {
          zoneTargetSeconds[zone] = seconds;
          prefs.putInt((String("tgt_") + zoneId).c_str(), seconds);
          Serial.print("Set target ");
          Serial.print(zoneId);
          Serial.print(" -> ");
          Serial.print(seconds);
          Serial.println("s");
        }
      }
    } else if (message.startsWith("SET_FLOW_")) {
      char zoneId[5] = {0};
      int value = 0;
      if (sscanf(message.c_str(), "SET_FLOW_%4[^_]_%d", zoneId, &value) == 2) {
        value = constrain(value, 1, 200);
        const int zone = findZoneIndex(zoneId);
        if (zone >= 0) {
          zoneFlowLph[zone] = value;
          prefs.putInt((String("flow_") + zoneId).c_str(), value);
          Serial.print("Set flow ");
          Serial.print(zoneId);
          Serial.print(" -> ");
          Serial.print(value);
          Serial.println(" L/h");
        }
      }
    } else if (message.startsWith("SET_RAIN_THRESHOLD_")) {
      int value = 0;
      if (sscanf(message.c_str(), "SET_RAIN_THRESHOLD_%d", &value) == 1) {
        rainThreshold = constrain(value, RAIN_THRESHOLD_MIN, RAIN_THRESHOLD_MAX);
        rainWarnThreshold = max(0, rainThreshold - RAIN_WARN_OFFSET);
        prefs.putInt("rain", rainThreshold);
        Serial.print("Set rain threshold -> ");
        Serial.println(rainThreshold);
      }
    } else if (message.startsWith("SET_THRESHOLD_")) {
      char zoneId[5] = {0};
      int value = 0;
      if (sscanf(message.c_str(), "SET_THRESHOLD_%4[^_]_%d", zoneId, &value) == 2) {
        value = constrain(value, 10, 90);
        const int zone = findZoneIndex(zoneId);
        if (zone >= 0) {
          moistureOn[zone] = value;
          moistureOff[zone] = constrain(value + STOP_OFFSET, value + 5, 100);
          prefs.putInt((String("on_") + zoneId).c_str(), moistureOn[zone]);
          prefs.putInt((String("off_") + zoneId).c_str(), moistureOff[zone]);
#if SIMULATE_SOIL_DYNAMICS
          // Ngay sau khi khởi động, ngưỡng thật về muộn hơn điểm khởi tạo mặc định:
          // đặt lại độ ẩm giữa cặp ngưỡng thật để số liệu sau reset ổn định.
          if (soilSeedPending[zone] && !pumpRunning[zone] &&
              millis() < SOIL_SEED_WINDOW_MS) {
            soilMoisture[zone] = (moistureOn[zone] + moistureOff[zone]) / 2.0f;
            soilManualTarget[zone] = soilMoisture[zone];
            soilPotDrift[zone] = 0.0f;
            moisturePercent[zone] = static_cast<int>(round(soilMoisture[zone]));
          }
          soilSeedPending[zone] = false;
#endif
          Serial.print("Set threshold ");
          Serial.print(zoneId);
          Serial.print(" -> ");
          Serial.println(value);
        }
      }
    } else if (message.startsWith("SET_SOIL_")) {
      char zoneId[5] = {0};
      int value = 0;
      if (sscanf(message.c_str(), "SET_SOIL_%4[^_]_%d", zoneId, &value) == 2) {
        const int zone = findZoneIndex(zoneId);
        if (zone >= 0) {
          setSimulatedSoilMoisture(zone, value);
          Serial.print("Set simulated moisture ");
          Serial.print(zoneId);
          Serial.print(" -> ");
          Serial.print(constrain(value, 0, 100));
          Serial.println("%");
        }
      }
    } else if (message.startsWith("PUMP_ON_")) {
      // Điều khiển từng zone cụ thể: PUMP_ON_T001, PUMP_ON_T002,...
      // Chỉ nhận khi đang Thủ công; ở Tự động firmware tự quyết định.
      if (!isAutoMode) {
        manualStartedAt = millis();
        String targetId = message.substring(8);
        const int zone = findZoneIndex(targetId.c_str());
        if (zone >= 0) startPump(zone);
      }
    } else if (message.startsWith("PUMP_OFF_")) {
      if (!isAutoMode) {
        String targetId = message.substring(9);
        const int zone = findZoneIndex(targetId.c_str());
        if (zone >= 0) stopPump(zone);
      }
    } else if (message == "WEATHER_GATE_ON") {
      weatherGateEnabled = true;
    } else if (message == "WEATHER_GATE_OFF") {
      weatherGateEnabled = false;
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Khôi phục ngưỡng đã lưu trong NVS (nếu có), nếu chưa thì dùng mặc định.
  prefs.begin("irrigation", false);
  for (int i = 0; i < ZONE_COUNT; i++) {
    String keyOn = String("on_") + zoneNames[i];
    String keyOff = String("off_") + zoneNames[i];
    moistureOn[i] = constrain(prefs.getInt(keyOn.c_str(), moistureOn[i]), 10, 90);
    moistureOff[i] = constrain(
      prefs.getInt(keyOff.c_str(), moistureOff[i]), moistureOn[i] + 5, 100);
    String keyTarget = String("tgt_") + zoneNames[i];
    zoneTargetSeconds[i] =
      constrain(prefs.getInt(keyTarget.c_str(), 0), 0,
                static_cast<int>(MAX_ZONE_RUNTIME_MS / 1000UL));
    String keyFlow = String("flow_") + zoneNames[i];
    zoneFlowLph[i] = constrain(prefs.getInt(keyFlow.c_str(), zoneFlowLph[i]), 1, 200);
#if SIMULATE_SOIL_DYNAMICS
    const String keySoil = String("soil_") + zoneNames[i];
    if (prefs.isKey(keySoil.c_str())) {
      const float savedSoil = prefs.getFloat(keySoil.c_str());
      soilMoisture[i] = constrain(savedSoil, 0.0f, 100.0f);
      soilManualTarget[i] = soilMoisture[i];
      moisturePercent[i] = static_cast<int>(round(soilMoisture[i]));
      lastPersistedSoil[i] = soilMoisture[i];
      soilStateRestored[i] = true;
      soilSeedPending[i] = false;
    }
#endif
  }
  rainThreshold = constrain(
    prefs.getInt("rain", RAIN_THRESHOLD_MAX), RAIN_THRESHOLD_MIN, RAIN_THRESHOLD_MAX);
  rainWarnThreshold = max(0, rainThreshold - RAIN_WARN_OFFSET);

  Wire.begin(21, 22);

  pinMode(RAIN_DIGITAL_PIN, INPUT);
  pinMode(TANK_TRIG_PIN, OUTPUT);
  pinMode(TANK_ECHO_PIN, INPUT);
  pinMode(WIFI_BUTTON_PIN, INPUT);  // Có trở kéo 10k ngoài lên 3V3
  pinMode(MANUAL_BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);
  analogReadResolution(12);
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    analogSetPinAttenuation(soilAdcPins[zone], ADC_11db);
  }

  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    pinMode(relayPins[zone], OUTPUT);
    stopPump(zone);
  }
  pinMode(LED_PIN, OUTPUT);

  dht.begin();
  masterValve.attach(SERVO_PIN);
  masterValve.write(MASTER_VALVE_CLOSED);
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    lcds[zone].init();
    lcds[zone].backlight();
    lcds[zone].setCursor(0, 0);
    lcds[zone].print(zoneNames[zone]);
    lcds[zone].setCursor(0, 1);
    lcds[zone].print("Connecting WiFi");
  }

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  // JSON telemetry (~700 bytes) vượt xa buffer mặc định 256 byte của PubSubClient.
  // Nếu không tăng buffer, publish sẽ thất bại âm thầm và Backend không nhận được gì.
  client.setBufferSize(1536);
  client.setKeepAlive(30);
  // Giới hạn thời gian chờ TCP để connect() không treo vòng điều khiển khi broker lỗi.
  client.setSocketTimeout(3);

  // Không chặn ở setup: WiFi/MQTT nối nền, hệ thống tưới cục bộ chạy ngay.
  WiFi.setAutoReconnect(true);
  WiFi.begin("Wokwi-GUEST", "", 6);
  Serial.println("WiFi connecting...");

  lcdReady = true;
  updateLcds();
}

void loop() {
  // WiFi/MQTT chỉ là kênh giám sát; mất mạng thì vẫn đọc cảm biến và tưới cục bộ.
  ensureNetwork();
  client.loop();
  updateBuzzer();
  handleButtons();

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= CONTROL_INTERVAL_MS) {
#if SIMULATE_SOIL_DYNAMICS
    const unsigned long elapsedMs =
      min(currentMillis - previousMillis, SOIL_STEP_CAP_MS);
#endif
    previousMillis = currentMillis;

    rainPercent = readRainPercent();
    const bool wasWarning = rainWarning;
    // Bật mưa ở ngưỡng, chỉ tắt khi giảm dưới ngưỡng 5 điểm để bơm không nháy.
    const int rainStopAt = max(0, rainThreshold - RAIN_HYSTERESIS);
    isRaining = isRaining ? rainPercent >= rainStopAt : rainPercent >= rainThreshold;
    rainWarning = !isRaining && rainPercent >= rainWarnThreshold;
    if (rainWarning && !wasWarning) {
      Serial.println("RAIN: co the mua - canh bao");
      lastRainWarnBeepAt = millis() - RAIN_WARN_INTERVAL_MS;
    }
    updateRainAlarm();

    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

#if SIMULATE_SOIL_DYNAMICS
    // Bơm chạy thì đất ẩm lên, tắt thì khô dần; chiết áp đóng vai trò tay chỉnh nhanh.
    const float dtMin = elapsedMs / 60000.0f;
    const float dtSec = elapsedMs / 1000.0f;
    const float dryFactor = soilDryingFactor();
    const bool seedWindowOpen = currentMillis < SOIL_SEED_WINDOW_MS;
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
    if (currentMillis - lastSoilPersistAt >= SOIL_PERSIST_INTERVAL_MS) {
      for (int zone = 0; zone < ZONE_COUNT; zone++) {
        if (fabs(soilMoisture[zone] - lastPersistedSoil[zone]) >= 0.5f) {
          persistSoilState(zone);
        }
      }
      lastSoilPersistAt = currentMillis;
    }
#else
    for (int zone = 0; zone < ZONE_COUNT; zone++) {
      moisturePercent[zone] = readZoneMoisture(zone);
    }
#endif

    updateTank();
    enforceRuntimeLimits();
    enforceWaterTargets();

    // Mưa 100% + bật hoãn: dừng cả bơm tự động lẫn thủ công.
    if (weatherGateEnabled && isRaining && anyPumpRunning()) {
      Serial.println("SAFETY: rain 100% -> stop all pumps");
      stopAllZones();
    }

    // Logic Hysteresis Auto Mode cho từng luống
    if (isAutoMode) {
      for (int zone = 0; zone < ZONE_COUNT; zone++) {
        if (weatherGateEnabled && isRaining && pumpRunning[zone]) {
          stopPump(zone);
        } else if (pumpRunning[zone] &&
                   moisturePercent[zone] >= moistureOff[zone]) {
          stopPump(zone);
        } else if (!pumpRunning[zone] && !tankEmpty && !zoneLocked[zone] &&
                   static_cast<long>(millis() - zoneCooldownUntil[zone]) >= 0 &&
                   (!weatherGateEnabled || !isRaining) &&
                   moisturePercent[zone] <= moistureOn[zone]) {
          startPump(zone);
        }
      }
    }

    updateLcds();

    Serial.print("Net=");
    Serial.print(isNetOnline() ? "ON" : "OFF");
    Serial.print(" Auto=");
    Serial.print(isAutoMode ? "ON" : "OFF");
    Serial.print(" Override=");
    Serial.print(manualOverride ? "ON" : "OFF");
    Serial.print(" Rain=");
    Serial.print(isRaining ? "YES" : "NO");
    Serial.print(" Tank=");
    Serial.print(tankDistanceCm, 0);
    Serial.print(tankEmpty ? "cm/EMPTY" : "cm/OK");
    Serial.print(" Moisture: ");
    for (int zone = 0; zone < ZONE_COUNT; zone++) {
      Serial.print(zoneNames[zone]);
      Serial.print("=");
      Serial.print(moisturePercent[zone]);
      Serial.print("%/");
      Serial.print(pumpRunning[zone] ? "ON" : "OFF");
      if (zone < ZONE_COUNT - 1) Serial.print(", ");
    }
    Serial.println();

    // Gửi JSON trực tiếp dạng 6 Zone T001 - T006 cho Web
    String json;
    json.reserve(1200);  // JSON đầy đủ khoảng 1000-1030 byte
    json = "{";
    json += "\"deviceId\":\"esp32-garden-01\",";
    json += "\"uptimeMs\":" + String(millis()) + ",";
    if (isnan(temperature)) json += "\"temperature\":null,";
    else json += "\"temperature\":" + String(temperature, 1) + ",";
    if (isnan(humidity)) json += "\"humidity\":null,";
    else json += "\"humidity\":" + String(humidity, 1) + ",";
    json += "\"rain\":" + String(rainPercent) + ",";
    json += "\"rainThreshold\":" + String(rainThreshold) + ",";
    json += "\"raining\":" + String(isRaining ? "true" : "false") + ",";
    json += "\"rainWarning\":" + String(rainWarning ? "true" : "false") + ",";
    json += "\"weatherGate\":" + String(weatherGateEnabled ? "true" : "false") + ",";
    json += "\"pump\":" + String(anyPumpRunning() ? "true" : "false") + ",";
    json += "\"zones\":[";
    for (int zone = 0; zone < ZONE_COUNT; zone++) {
      if (zone > 0) json += ",";
      json += "{\"id\":\"" + String(zoneNames[zone]) + "\",";
      json += "\"moisture\":" + String(moisturePercent[zone]) + ",";
      json += "\"threshold\":" + String(moistureOn[zone]) + ",";
      json += "\"stopThreshold\":" + String(moistureOff[zone]) + ",";
      json += "\"targetSeconds\":" + String(zoneTargetSeconds[zone]) + ",";
      json += "\"flowLph\":" + String(zoneFlowLph[zone]) + ",";
      json += "\"over\":" + String(zoneOverTarget[zone] ? "true" : "false") + ",";
      json += "\"pump\":" + String(pumpRunning[zone] ? "true" : "false") + "}";
    }
    json += "],";
    json += "\"servoAngle\":" + String(anyPumpRunning() ? MASTER_VALVE_OPEN : MASTER_VALVE_CLOSED) + ",";
    json += "\"tank\":{";
    if (tankValid) json += "\"distanceCm\":" + String(tankDistanceCm, 1);
    else json += "\"distanceCm\":null";
    json += ",\"empty\":" + String(tankEmpty ? "true" : "false") + "},";
    json += "\"mode\":\"" + String(isAutoMode ? "auto" : "manual") + "\"";
    json += "}";

    // Retained: backend/web nhận ngay trạng thái mới nhất dù kết nối sau ESP32.
    // Khi offline thì bỏ qua publish, tránh log lỗi mỗi 2 giây.
    if (client.connected()) {
      bool published = client.publish(topic_status, json.c_str(), true);
      if (published) {
        Serial.print("Published to MQTT: ");
        Serial.println(json);
      } else {
        Serial.print("MQTT publish FAILED (");
        Serial.print(json.length());
        Serial.println(" bytes). Kiểm tra setBufferSize/độ dài payload.");
      }
    }
  }
}
