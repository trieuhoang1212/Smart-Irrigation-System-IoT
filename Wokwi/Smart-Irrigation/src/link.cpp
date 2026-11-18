#include "app.h"

#include <WiFi.h>
#include <PubSubClient.h>
#include <esp_system.h>
#include <stdio.h>
#include <string.h>

static WiFiClient espClient;
static PubSubClient client(espClient);
static String telemetryJson;

static bool simulateOffline = false;
static bool netWasOnline = false;
static unsigned long lastWifiAttempt = 0;
static unsigned long lastMqttAttempt = 0;

static int findZoneIndex(const char* zoneId) {
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    if (strcmp(zoneNames[zone], zoneId) == 0) return zone;
  }
  return -1;
}

bool isNetOnline() {
  return WiFi.status() == WL_CONNECTED && client.connected();
}

bool isSimulatedOffline() {
  return simulateOffline;
}

void setSimulatedOffline(bool offline) {
  if (offline == simulateOffline) return;
  simulateOffline = offline;
  if (offline) {
    client.disconnect();
    WiFi.disconnect(true);
  } else {
    lastWifiAttempt = millis();
    lastMqttAttempt = 0;
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);
  }
}

// Trả về true khi lệnh đã được xử lý và tự in log riêng; false để callback in cảnh báo.
static bool handleCommand(const String& message) {
  if (message == "MODE_AUTO") {
    isAutoMode = true;
    saveMode();
    manualStartedAt = 0;
    Serial.println("mode: auto");
    return true;
  } else if (message == "MODE_MANUAL") {
    isAutoMode = false;
    saveMode();
    // Vào Thủ công phải dừng hết bơm; chỉ chạy khi người dùng bấm.
    stopAllZones("mode manual");
    manualStartedAt = 0;
    for (int i = 0; i < ZONE_COUNT; i++) zoneOverTarget[i] = false;
    Serial.println("mode: manual");
    updateLcds();
    return true;
  } else if (message == "PUMP_ON") {
    if (isAutoMode) {
      Serial.println("pump: ignored (auto)");
      return true;
    }
    manualStartedAt = millis();
    startAllZones();
    Serial.println(anyPumpRunning() ? "pump: on" : "pump: blocked");
    return true;
  } else if (message == "PUMP_OFF") {
    if (isAutoMode) {
      Serial.println("pump: ignored (auto)");
      return true;
    }
    stopAllZones("pump off");
    if (!anyPumpRunning()) Serial.println("pump: off");
    return true;
  } else if (message.startsWith("SET_TARGET_")) {
    char zoneId[5] = {0};
    int seconds = 0;
    if (sscanf(message.c_str(), "SET_TARGET_%4[^_]_%d", zoneId, &seconds) != 2) return false;
    seconds = constrain(seconds, 0, static_cast<int>(MAX_ZONE_RUNTIME_MS / 1000UL));
    const int zone = findZoneIndex(zoneId);
    if (zone < 0) return false;
    zoneTargetSeconds[zone] = seconds;
    prefs.putInt((String("tgt_") + zoneId).c_str(), seconds);
    Serial.print(zoneId);
    Serial.print(" target ");
    Serial.print(seconds);
    Serial.println("s");
    return true;
  } else if (message.startsWith("SET_FLOW_")) {
    char zoneId[5] = {0};
    int value = 0;
    if (sscanf(message.c_str(), "SET_FLOW_%4[^_]_%d", zoneId, &value) != 2) return false;
    value = constrain(value, 1, 200);
    const int zone = findZoneIndex(zoneId);
    if (zone < 0) return false;
    zoneFlowLph[zone] = value;
    prefs.putInt((String("flow_") + zoneId).c_str(), value);
    Serial.print(zoneId);
    Serial.print(" flow ");
    Serial.print(value);
    Serial.println("L/h");
    return true;
  } else if (message.startsWith("SET_RAIN_THRESHOLD_")) {
    int value = 0;
    if (sscanf(message.c_str(), "SET_RAIN_THRESHOLD_%d", &value) != 1) return false;
    rainThreshold = constrain(value, RAIN_THRESHOLD_MIN, RAIN_THRESHOLD_MAX);
    rainWarnThreshold = max(0, rainThreshold - RAIN_WARN_OFFSET);
    prefs.putInt("rain", rainThreshold);
    Serial.print("rain threshold ");
    Serial.println(rainThreshold);
    return true;
  } else if (message.startsWith("SET_THRESHOLD_")) {
    char zoneId[5] = {0};
    int value = 0;
    if (sscanf(message.c_str(), "SET_THRESHOLD_%4[^_]_%d", zoneId, &value) != 2) return false;
    value = constrain(value, 10, 90);
    const int zone = findZoneIndex(zoneId);
    if (zone < 0) return false;
    moistureOn[zone] = value;
    moistureOff[zone] = constrain(value + STOP_OFFSET, value + 5, 100);
    prefs.putInt((String("on_") + zoneId).c_str(), moistureOn[zone]);
    prefs.putInt((String("off_") + zoneId).c_str(), moistureOff[zone]);
    Serial.print(zoneId);
    Serial.print(" threshold ");
    Serial.print(value);
    Serial.print("/");
    Serial.println(moistureOff[zone]);
    return true;
  } else if (message.startsWith("SET_SOIL_")) {
    char zoneId[5] = {0};
    int value = 0;
    if (sscanf(message.c_str(), "SET_SOIL_%4[^_]_%d", zoneId, &value) != 2) return false;
    const int zone = findZoneIndex(zoneId);
    if (zone < 0) return false;
    const int before = moisturePercent[zone];
    soilOnSetSoil(zone, value);
    // Chỉ Backend gửi SET_SOIL, và chỉ khi phát hiện thiết bị vừa khởi động lại.
    Serial.print(zoneId);
    Serial.print(" soil ");
    Serial.print(before);
    if (moisturePercent[zone] == before) {
      Serial.println(" (unchanged)");
    } else {
      Serial.print("->");
      Serial.print(moisturePercent[zone]);
      Serial.println(" (restore)");
    }
    return true;
  } else if (message.startsWith("PUMP_ON_")) {
    // Điều khiển từng zone cụ thể: PUMP_ON_T001, PUMP_ON_T002,...
    // Chỉ nhận khi đang Thủ công; ở Tự động firmware tự quyết định.
    if (isAutoMode) {
      Serial.println("pump: ignored (auto)");
      return true;
    }
    manualStartedAt = millis();
    const String targetId = message.substring(8);
    const int zone = findZoneIndex(targetId.c_str());
    if (zone < 0) return false;
    startPump(zone);
    if (pumpRunning[zone]) {
      Serial.print("pump ");
      Serial.print(targetId);
      Serial.println(": on");
    }
    return true;
  } else if (message.startsWith("PUMP_OFF_")) {
    if (isAutoMode) {
      Serial.println("pump: ignored (auto)");
      return true;
    }
    const String targetId = message.substring(9);
    const int zone = findZoneIndex(targetId.c_str());
    if (zone < 0) return false;
    stopPump(zone, "pump off");
    return true;
  } else if (message == "WEATHER_GATE_ON") {
    weatherGateEnabled = true;
    prefs.putBool("gate", true);
    Serial.println("gate: on");
    return true;
  } else if (message == "WEATHER_GATE_OFF") {
    weatherGateEnabled = false;
    prefs.putBool("gate", false);
    Serial.println("gate: off");
    return true;
  }
  return false;
}

static void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += static_cast<char>(payload[i]);
  }

  if (String(topic) != TOPIC_CMD) return;
  if (!handleCommand(message)) {
    Serial.print("unknown: ");
    Serial.println(message);
  }
}

void setupLink() {
  randomSeed(esp_random());

  client.setServer(MQTT_SERVER, MQTT_PORT);
  client.setCallback(callback);
  // JSON telemetry (~1030 bytes) vượt xa buffer mặc định 256 byte của PubSubClient.
  client.setBufferSize(1536);
  client.setKeepAlive(30);
  // Giới hạn thời gian chờ TCP để connect() không treo vòng điều khiển khi broker lỗi.
  client.setSocketTimeout(3);
  telemetryJson.reserve(1200);

  // Không chặn ở setup: WiFi/MQTT nối nền, hệ thống tưới cục bộ chạy ngay.
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD, WIFI_CHANNEL);
  Serial.println("wifi: connecting");
}

void ensureNetwork() {
  if (simulateOffline) {
    if (netWasOnline) {
      netWasOnline = false;
      Serial.println("link: offline (sim)");
      updateLcds();
    }
    return;
  }

  const unsigned long now = millis();
  // Mã lỗi MQTT chỉ in khi đổi mã hoặc sau 60 giây, tránh lặp rc=-4 mỗi 5 giây.
  static int lastMqttFailCode = 0;
  static unsigned long lastMqttFailAt = 0;

  if (WiFi.status() != WL_CONNECTED) {
    if (elapsedSince(now, lastWifiAttempt, NET_RETRY_MS)) {
      lastWifiAttempt = now;
      Serial.println("wifi: reconnecting");
      WiFi.reconnect();
    }
  } else if (!client.connected() && elapsedSince(now, lastMqttAttempt, MQTT_RETRY_MS)) {
    lastMqttAttempt = now;
    const String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      client.subscribe(TOPIC_CMD);
      lastMqttFailCode = 0;
      Serial.println("mqtt: connected");
    } else {
      const int code = client.state();
      if (code != lastMqttFailCode || elapsedSince(now, lastMqttFailAt, 60000UL)) {
        lastMqttFailCode = code;
        lastMqttFailAt = now;
        Serial.print("mqtt: retry rc=");
        Serial.println(code);
      }
    }
  }

  const bool online = isNetOnline();
  if (online != netWasOnline) {
    netWasOnline = online;
    Serial.println(online ? "link: online" : "link: offline");
    updateLcds();
  }
}

void linkLoop() {
  client.loop();
}

static void buildTelemetry(String& json) {
  json = "{";
  json += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
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
}

void publishTelemetry() {
  // Retained: backend/web nhận ngay trạng thái mới nhất dù kết nối sau ESP32.
  // Khi offline thì bỏ qua publish, tránh log lỗi mỗi 2 giây.
  if (!client.connected()) return;

  buildTelemetry(telemetryJson);
  if (client.publish(TOPIC_STATUS, telemetryJson.c_str(), true)) return;

  static unsigned long lastFailAt = 0;
  if (elapsedSince(millis(), lastFailAt, 60000UL)) {
    lastFailAt = millis();
    Serial.print("publish failed, ");
    Serial.print(telemetryJson.length());
    Serial.println(" bytes");
  }
}
