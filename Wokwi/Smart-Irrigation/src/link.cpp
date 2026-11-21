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

static void handleCommand(const String& message) {
  if (message == "MODE_AUTO") {
    isAutoMode = true;
    saveMode();
    manualStartedAt = 0;
    Serial.println("Mode: AUTO");
  } else if (message == "MODE_MANUAL") {
    isAutoMode = false;
    saveMode();
    // Vào Thủ công phải dừng hết bơm; chỉ chạy khi người dùng bấm.
    stopAllZones("mode manual");
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
    if (!isAutoMode) stopAllZones("pump off");
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
        soilOnThresholdSynced(zone);
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
        soilOnSetSoil(zone, value);
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
      const String targetId = message.substring(8);
      const int zone = findZoneIndex(targetId.c_str());
      if (zone >= 0) startPump(zone);
    }
  } else if (message.startsWith("PUMP_OFF_")) {
    if (!isAutoMode) {
      const String targetId = message.substring(9);
      const int zone = findZoneIndex(targetId.c_str());
      if (zone >= 0) stopPump(zone, "pump off");
    }
  } else if (message == "WEATHER_GATE_ON") {
    weatherGateEnabled = true;
    prefs.putBool("gate", true);
  } else if (message == "WEATHER_GATE_OFF") {
    weatherGateEnabled = false;
    prefs.putBool("gate", false);
  }
}

static void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += static_cast<char>(payload[i]);
  }
  Serial.print("MQTT [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);

  if (String(topic) == TOPIC_CMD) handleCommand(message);
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
  Serial.println("WiFi connecting...");
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
    if (elapsedSince(now, lastWifiAttempt, NET_RETRY_MS)) {
      lastWifiAttempt = now;
      Serial.println("NET: WiFi reconnecting...");
      WiFi.reconnect();
    }
  } else if (!client.connected()) {
    if (elapsedSince(now, lastMqttAttempt, MQTT_RETRY_MS)) {
      lastMqttAttempt = now;
      Serial.print("NET: MQTT connecting...");
      const String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);
      if (client.connect(clientId.c_str())) {
        Serial.println(" connected");
        client.subscribe(TOPIC_CMD);
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
  const bool published = client.publish(TOPIC_STATUS, telemetryJson.c_str(), true);
  if (published) {
    Serial.print("Published to MQTT: ");
    Serial.println(telemetryJson);
  } else {
    Serial.print("MQTT publish FAILED (");
    Serial.print(telemetryJson.length());
    Serial.println(" bytes). Kiểm tra setBufferSize/độ dài payload.");
  }
}
