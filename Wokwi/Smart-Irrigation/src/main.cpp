#include "app.h"

#include <LiquidCrystal_I2C.h>

const char* zoneNames[ZONE_COUNT] = {"T001", "T002", "T003", "T004", "T005", "T006"};

// Ngưỡng tưới mặc định (T001: Rau muống, T002: Cà chua, T003: Cà rốt,
// T004: Khoai lang, T005: Dưa leo, T006: Xà lách). Web chỉnh qua SET_THRESHOLD_T00X_YY.
int moistureOn[ZONE_COUNT] = {60, 45, 35, 30, 45, 55};
int moistureOff[ZONE_COUNT] = {80, 65, 55, 50, 65, 75};
// Thời gian tưới thủ công để đạt mục tiêu nước (giây), Backend đẩy qua SET_TARGET_T00X_YY.
int zoneTargetSeconds[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
// Lưu lượng đầu tưới (L/giờ) của từng vùng, Backend đẩy qua SET_FLOW_T00X_YY.
int zoneFlowLph[ZONE_COUNT] = {48, 60, 60, 60, 60, 48};
int rainThreshold = RAIN_THRESHOLD_MAX;
int rainWarnThreshold = RAIN_THRESHOLD_MAX - RAIN_WARN_OFFSET;
bool weatherGateEnabled = true;

Preferences prefs;  // Lưu ngưỡng và chế độ vào NVS để không mất khi reboot

static LiquidCrystal_I2C lcds[ZONE_COUNT] = {
  LiquidCrystal_I2C(LCD_ADDRESSES[0], 16, 2),
  LiquidCrystal_I2C(LCD_ADDRESSES[1], 16, 2),
  LiquidCrystal_I2C(LCD_ADDRESSES[2], 16, 2),
  LiquidCrystal_I2C(LCD_ADDRESSES[3], 16, 2),
  LiquidCrystal_I2C(LCD_ADDRESSES[4], 16, 2),
  LiquidCrystal_I2C(LCD_ADDRESSES[5], 16, 2),
};
static bool lcdReady = false;

static unsigned long previousMillis = 0;
static unsigned long beepUntil = 0;
static unsigned long lastRainWarnBeepAt = 0;
static unsigned long lastOverwaterBeepAt = 0;
static int buzzerTone = -1;

struct ButtonState {
  bool raw = false;
  bool stable = false;
  unsigned long changedAt = 0;
};
static ButtonState wifiButton;
static ButtonState manualButton;

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

static bool anyZoneOverTarget() {
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (zoneOverTarget[zone]) return true;
  }
  return false;
}

void updateBuzzer() {
  const unsigned long now = millis();
  int target = 0;
  if (rainWarning && elapsedSince(now, lastRainWarnBeepAt, RAIN_WARN_INTERVAL_MS)) {
    lastRainWarnBeepAt = now;
    beepOnce(500);
  }
  if (anyZoneOverTarget() && elapsedSince(now, lastOverwaterBeepAt, OVERWATER_INTERVAL_MS)) {
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

static bool buttonPressed(int pin, ButtonState& state) {
  const bool raw = digitalRead(pin) == LOW;
  const unsigned long now = millis();
  if (raw != state.raw) {
    state.raw = raw;
    state.changedAt = now;
  } else if (raw != state.stable && elapsedSince(now, state.changedAt, 50)) {
    state.stable = raw;
    return raw;
  }
  return false;
}

static void handleButtons() {
  // Nút mô phỏng mất WiFi: nhấn lần 1 ngắt, nhấn lần 2 nối lại.
  if (buttonPressed(WIFI_BUTTON_PIN, wifiButton)) {
    const bool offline = !isSimulatedOffline();
    setSimulatedOffline(offline);
    Serial.println(offline ? "BTN: WiFi -> simulated offline" : "BTN: WiFi -> reconnect");
    beepOnce(150);
    updateLcds();
  }

  // Nút vật lý: bật/tắt cả 6 vùng ở chế độ thủ công, không cần Web/WiFi.
  // Khi tắt vẫn giữ MANUAL; sau MAX_MANUAL_MS tự về AUTO để không tưới mãi khi đi vắng.
  if (buttonPressed(MANUAL_BUTTON_PIN, manualButton)) {
    if (isAutoMode) {
      startManualFromButton();
    } else if (anyPumpRunning()) {
      stopAllZones("manual off");
      Serial.println("BTN: manual OFF (giu MANUAL)");
      beepOnce(150);
    } else {
      startManualFromButton();
    }
    updateLcds();
  }
}

static void printStatusLine() {
  Serial.print("Net=");
  Serial.print(isNetOnline() ? "ON" : "OFF");
  Serial.print(" Auto=");
  Serial.print(isAutoMode ? "ON" : "OFF");
  Serial.print(" Rain=");
  Serial.print(isRaining ? "YES" : "NO");
  Serial.print(" Tank=");
  if (tankValid) {
    body += String(tankDistanceCm, 0);
    body += "cm";
  } else {
    Serial.print("?");
  }
  Serial.print(tankEmpty ? "/EMPTY" : "/OK");
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
}

void setup() {
  Serial.begin(115200);

  // Khôi phục ngưỡng, chế độ và Weather Gate đã lưu trong NVS (nếu có).
  prefs.begin("irrigation", false);
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    const String keyOn = String("on_") + zoneNames[zone];
    const String keyOff = String("off_") + zoneNames[zone];
    moistureOn[zone] = constrain(prefs.getInt(keyOn.c_str(), moistureOn[zone]), 10, 90);
    moistureOff[zone] = constrain(
      prefs.getInt(keyOff.c_str(), moistureOff[zone]), moistureOn[zone] + 10, 100);

    const String keyTarget = String("tgt_") + zoneNames[zone];
    zoneTargetSeconds[zone] = constrain(
      prefs.getInt(keyTarget.c_str(), 0), 0,
      static_cast<int>(MAX_ZONE_RUNTIME_MS / 1000UL));

    const String keyFlow = String("flow_") + zoneNames[zone];
    zoneFlowLph[zone] = constrain(prefs.getInt(keyFlow.c_str(), zoneFlowLph[zone]), 1, 200);
  }
  rainThreshold = constrain(
    prefs.getInt("rain", RAIN_THRESHOLD_MAX), RAIN_THRESHOLD_MIN, RAIN_THRESHOLD_MAX);
  rainWarnThreshold = max(0, rainThreshold - RAIN_WARN_OFFSET);
  weatherGateEnabled = prefs.getBool("gate", true);
  // Đăng nhập lại thì về đúng chế độ trước đó; lần đầu chạy mặc định AUTO.
  isAutoMode = prefs.getBool("auto", true);

  sensorsSetup();
  soilSetup();

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  controlSetup();

  pinMode(WIFI_BUTTON_PIN, INPUT);  // Có trở kéo 10k ngoài lên 3V3
  pinMode(MANUAL_BUTTON_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);

  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    lcds[zone].init();
    lcds[zone].backlight();
    lcds[zone].setCursor(0, 0);
    lcds[zone].print(zoneNames[zone]);
    lcds[zone].setCursor(0, 1);
    lcds[zone].print("Connecting WiFi");
  }

  lcdReady = true;
  updateLcds();
  setupLink();
}

void loop() {
  // WiFi/MQTT chỉ là kênh giám sát; mất mạng thì vẫn đọc cảm biến và tưới cục bộ.
  ensureNetwork();
  linkLoop();
  updateBuzzer();
  handleButtons();

  const unsigned long now = millis();
  if (!elapsedSince(now, previousMillis, CONTROL_INTERVAL_MS)) return;

  unsigned long elapsedMs = now - previousMillis;
  if (elapsedMs > SOIL_STEP_CAP_MS) elapsedMs = SOIL_STEP_CAP_MS;
  previousMillis = now;

  updateRainState();
  updateClimate();
  soilUpdate(elapsedMs);
  updateTank();
  enforceRuntimeLimits();
  enforceWaterTargets();

  // Mưa + bật hoãn: dừng cả bơm thủ công, không chỉ bơm tự động.
  if (weatherGateEnabled && isRaining && anyPumpRunning()) stopAllZones("rain");
  if (isAutoMode) runAutoControl();

  updateLcds();
  printStatusLine();
  publishTelemetry();
}