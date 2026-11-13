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
#define MUX_SIG_PIN 34
#define MUX_S0_PIN 12
#define MUX_S1_PIN 13
#define MUX_S2_PIN 14
#define MUX_S3_PIN 25

// Hệ thống 6 khu vực cây trồng (T001 - T006)
#define ZONE_COUNT 6
#define LED_PIN 2
#define BUZZER_PIN 0
#define SERVO_PIN 5
#define MASTER_VALVE_CLOSED 0
#define MASTER_VALVE_OPEN 90
#define RAIN_SENSOR_PIN 33
#define RAIN_DIGITAL_PIN 36
#define TANK_TRIG_PIN 27  // HC-SR04 đo mực nước bồn
#define TANK_ECHO_PIN 26
#define WIFI_BUTTON_PIN 35  // nút mô phỏng mất WiFi, active LOW, có trở kéo 10k ngoài
#define MANUAL_BUTTON_PIN 32  // nút bật/tắt bơm thủ công, active LOW, pull-up nội bộ

// Rơ-le điều khiển van từng luống. GPIO35 input-only nên chỉ dùng cho nút nhấn.
const int relayPins[ZONE_COUNT] = {16, 17, 18, 23, 15, 19};

// Ngưỡng tưới tương ứng (T001: Rau muống, T002: Cà chua, T003: Cà rốt, T004: Khoai lang, T005: Dưa leo, T006: Xà lách)
// Có thể chỉnh từ Web thông qua lệnh SET_THRESHOLD_T00X_YY.
int moistureOn[ZONE_COUNT]  = {60, 45, 35, 30, 45, 55};
int moistureOff[ZONE_COUNT] = {80, 65, 55, 50, 65, 75};
// Thời gian tưới thủ công để đạt mục tiêu nước (giây), Backend đẩy qua SET_TARGET_T00X_YY.
int zoneTargetSeconds[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
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
int rainPercent = 0;
bool isRaining = false;
bool rainWarning = false;
bool previousRaining = false;
float temperature = 0.0;
float humidity = 0.0;

unsigned long previousMillis = 0;
const long interval = 2000;

// Bảo vệ khi đi vắng: giới hạn thời gian tưới và thời gian giữ chế độ MANUAL.
// Giảm xuống 1-2 phút nếu cần demo nhanh.
const unsigned long MAX_ZONE_RUNTIME_MS = 10UL * 60UL * 1000UL;
const unsigned long MAX_MANUAL_MS = 10UL * 60UL * 1000UL;
// Cảm biến mưa: 80% là cảnh báo có thể mưa, 100% mới dừng/chặn tưới.
const int RAIN_WARN_PERCENT = 80;
const int RAIN_FULL_PERCENT = 100;
const unsigned long RAIN_WARN_INTERVAL_MS = 15000UL;
const unsigned long OVERWATER_INTERVAL_MS = 10000UL;
// HC-SR04 gắn trên miệng bồn, đo khoảng cách tới mặt nước: xa quá nghĩa là bồn cạn.
const float TANK_EMPTY_CM = 80.0;
const float TANK_REFILL_CM = 60.0;
// Quá thời gian này không đọc được thì bỏ số đo cũ, tránh Web hiển thị mực nước đã lỗi thời.
const unsigned long TANK_STALE_MS = 10000UL;
unsigned long zoneStartedAt[ZONE_COUNT] = {0};
bool zoneLocked[ZONE_COUNT] = {false};
bool zoneOverTarget[ZONE_COUNT] = {false, false, false, false, false, false};
unsigned long manualStartedAt = 0;
bool tankEmpty = false;
bool tankValid = false;
float tankDistanceCm = 0.0;
unsigned long lastTankReadAt = 0;

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
  if (isRaining) {
    beepUntil = 0;
    target = 1800;
  } else {
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
  }

  if (target == buzzerTone) return;
  if (target == 0) noTone(BUZZER_PIN);
  else tone(BUZZER_PIN, target);
  buzzerTone = target;
}

void updateRainAlarm() {
  if (isRaining != previousRaining) {
    Serial.println(isRaining ? "RAIN ALERT: Dang mua" : "RAIN ALERT: Het mua");
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
  pumpRunning[zone] = true;
  zoneStartedAt[zone] = millis();
  digitalWrite(relayPins[zone], LOW); // Active LOW
  digitalWrite(LED_PIN, HIGH);
  masterValve.write(MASTER_VALVE_OPEN);
  
  updateLcds();
}

void stopPump(int zone) {
  if (zone < 0 || zone >= ZONE_COUNT) return;
  pumpRunning[zone] = false;
  zoneStartedAt[zone] = 0;
  digitalWrite(relayPins[zone], HIGH);
  
  bool anyRunning = false;
  for (int i = 0; i < ZONE_COUNT; i++) {
    if (pumpRunning[i]) {
      anyRunning = true;
      break;
    }
  }

  if (!anyRunning) {
    digitalWrite(LED_PIN, LOW);
    masterValve.write(MASTER_VALVE_CLOSED);
    updateLcds();
  }
}

bool anyPumpRunning() {
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (pumpRunning[zone]) return true;
  }
  return false;
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
  if (!tankEmpty && distance >= TANK_EMPTY_CM) {
    tankEmpty = true;
    Serial.println("TANK: EMPTY - stop all pumps");
    stopAllZones();
    beepOnce(400);
    updateLcds();
  } else if (tankEmpty && distance <= TANK_REFILL_CM) {
    tankEmpty = false;
    Serial.println("TANK: water back");
    beepOnce(150);
    updateLcds();
  }
}

void enforceRuntimeLimits() {
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (pumpRunning[zone] &&
        millis() - zoneStartedAt[zone] >= MAX_ZONE_RUNTIME_MS) {
      Serial.print("SAFETY: ");
      Serial.print(zoneNames[zone]);
      Serial.println(" max runtime -> stop & lock");
      stopPump(zone);
      zoneLocked[zone] = true;
    }
    // Mở khóa khi đất đã đủ ẩm; cảm biến kẹt khô thì vẫn khóa để bơm không chạy mãi.
    if (zoneLocked[zone] && moisturePercent[zone] >= moistureOff[zone]) {
      zoneLocked[zone] = false;
    }
  }

  if (!isAutoMode && manualStartedAt != 0 &&
      millis() - manualStartedAt >= MAX_MANUAL_MS) {
    stopAllZones();
    isAutoMode = true;
    manualOverride = false;
    manualStartedAt = 0;
    Serial.println("SAFETY: manual 10 min -> AUTO");
    updateLcds();
  }
}

void updateOverTarget() {
  const unsigned long now = millis();
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    const bool over = !isAutoMode && pumpRunning[zone] && zoneTargetSeconds[zone] > 0 &&
                      now - zoneStartedAt[zone] >=
                        static_cast<unsigned long>(zoneTargetSeconds[zone]) * 1000UL;
    if (over && !zoneOverTarget[zone]) {
      Serial.print("ALERT: ");
      Serial.print(zoneNames[zone]);
      Serial.println(" over water target");
      // Kêu ngay lần đầu vượt mục tiêu, sau đó lặp theo OVERWATER_INTERVAL_MS.
      lastOverwaterBeepAt = now - OVERWATER_INTERVAL_MS;
    }
    zoneOverTarget[zone] = over;
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
      manualStartedAt = millis();
      startAllZones();
      Serial.println(tankEmpty ? "BTN: manual ON (tank empty, pump blocked)"
                               : "BTN: manual ON (T001-T006)");
      beepOnce(tankEmpty ? 400 : 150);
    } else if (anyPumpRunning()) {
      stopAllZones();
      Serial.println("BTN: manual OFF (giu MANUAL)");
      beepOnce(150);
    } else {
      manualStartedAt = millis();
      startAllZones();
      Serial.println(tankEmpty ? "BTN: manual ON (tank empty, pump blocked)"
                               : "BTN: manual ON (T001-T006)");
      beepOnce(tankEmpty ? 400 : 150);
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

void selectMuxChannel(int channel) {
  digitalWrite(MUX_S0_PIN, channel & 1);
  digitalWrite(MUX_S1_PIN, (channel >> 1) & 1);
  digitalWrite(MUX_S2_PIN, (channel >> 2) & 1);
  digitalWrite(MUX_S3_PIN, (channel >> 3) & 1);
}

int readZoneMoisture(int zone) {
  selectMuxChannel(zone);
  delayMicroseconds(500);

  // Bỏ mẫu đầu sau khi chuyển kênh MUX và lấy trung bình để tránh nhiễu/kênh trước.
  analogRead(MUX_SIG_PIN);
  long total = 0;
  for (int sample = 0; sample < 5; sample++) {
    total += analogRead(MUX_SIG_PIN);
    delayMicroseconds(100);
  }

  const int rawValue = static_cast<int>(total / 5);
  return constrain(map(rawValue, 0, 4095, 0, 100), 0, 100);
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
      manualStartedAt = millis();
      Serial.println("Mode: MANUAL");
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
        for (int i = 0; i < ZONE_COUNT; i++) {
          if (String(zoneNames[i]) == zoneId) {
            zoneTargetSeconds[i] = seconds;
            prefs.putInt((String("tgt_") + zoneId).c_str(), zoneTargetSeconds[i]);
            Serial.print("Set target ");
            Serial.print(zoneId);
            Serial.print(" -> ");
            Serial.print(zoneTargetSeconds[i]);
            Serial.println("s");
          }
        }
      }
    } else if (message.startsWith("SET_THRESHOLD_")) {
      char zoneId[5] = {0};
      int value = 0;
      if (sscanf(message.c_str(), "SET_THRESHOLD_%4[^_]_%d", zoneId, &value) == 2) {
        value = constrain(value, 10, 90);
        for (int i = 0; i < ZONE_COUNT; i++) {
          if (String(zoneNames[i]) == zoneId) {
            moistureOn[i] = value;
            moistureOff[i] = constrain(value + 20, value + 5, 100);
            prefs.putInt((String("on_") + zoneId).c_str(), moistureOn[i]);
            prefs.putInt((String("off_") + zoneId).c_str(), moistureOff[i]);
            Serial.print("Set threshold ");
            Serial.print(zoneId);
            Serial.print(" -> ");
            Serial.println(value);
          }
        }
      }
    } else if (message.startsWith("PUMP_ON_")) {
      // Điều khiển từng zone cụ thể: PUMP_ON_T001, PUMP_ON_T002,...
      if (!isAutoMode) manualStartedAt = millis();
      String targetId = message.substring(8);
      for (int i = 0; i < ZONE_COUNT; i++) {
        if (String(zoneNames[i]) == targetId) startPump(i);
      }
    } else if (message.startsWith("PUMP_OFF_")) {
      String targetId = message.substring(9);
      for (int i = 0; i < ZONE_COUNT; i++) {
        if (String(zoneNames[i]) == targetId) stopPump(i);
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
  }

  Wire.begin(21, 22);

  pinMode(MUX_SIG_PIN, INPUT);
  pinMode(MUX_S0_PIN, OUTPUT);
  pinMode(MUX_S1_PIN, OUTPUT);
  pinMode(MUX_S2_PIN, OUTPUT);
  pinMode(MUX_S3_PIN, OUTPUT);
  pinMode(RAIN_DIGITAL_PIN, INPUT);
  pinMode(TANK_TRIG_PIN, OUTPUT);
  pinMode(TANK_ECHO_PIN, INPUT);
  pinMode(WIFI_BUTTON_PIN, INPUT);  // GPIO35 input-only, dùng trở kéo 10k ngoài
  pinMode(MANUAL_BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);
  analogSetPinAttenuation(MUX_SIG_PIN, ADC_11db);

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
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // Đọc cảm biến độ ẩm 6 luống từ MUX 74HC4067 (C0 - C5)
    for (int zone = 0; zone < ZONE_COUNT; zone++) {
      moisturePercent[zone] = readZoneMoisture(zone);
    }

    int rainValue = analogRead(RAIN_SENSOR_PIN);
    rainPercent = constrain(map(rainValue, 0, 4095, 0, 100), 0, 100);
    const bool wasWarning = rainWarning;
    isRaining = rainPercent >= RAIN_FULL_PERCENT;
    rainWarning = !isRaining && rainPercent >= RAIN_WARN_PERCENT;
    if (rainWarning && !wasWarning) {
      Serial.println("RAIN: co the mua - canh bao");
      lastRainWarnBeepAt = millis() - RAIN_WARN_INTERVAL_MS;
    }
    updateRainAlarm();

    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    updateTank();
    enforceRuntimeLimits();
    updateOverTarget();

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
    Serial.print(" Manual=");
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
    json.reserve(768);
    json = "{";
    json += "\"deviceId\":\"esp32-garden-01\",";
    json += "\"moisture\":" + String(moisturePercent[1]) + ","; // Zone T002 đại diện
    if (isnan(temperature)) json += "\"temperature\":null,";
    else json += "\"temperature\":" + String(temperature, 1) + ",";
    if (isnan(humidity)) json += "\"humidity\":null,";
    else json += "\"humidity\":" + String(humidity, 1) + ",";
    json += "\"rain\":" + String(rainPercent) + ",";
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
