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
#define RAIN_DIGITAL_PIN 32

// 6 Rơ-le điều khiển van từng luống. GPIO35 chỉ là chân input nên không dùng cho relay.
const int relayPins[ZONE_COUNT] = {16, 17, 18, 23, 15, 19};

// Ngưỡng tưới tương ứng (T001: Rau muống, T002: Cà chua, T003: Cà rốt, T004: Khoai lang, T005: Dưa leo, T006: Xà lách)
// Có thể chỉnh từ Web thông qua lệnh SET_THRESHOLD_T00X_YY.
int moistureOn[ZONE_COUNT]  = {60, 45, 35, 30, 45, 55};
int moistureOff[ZONE_COUNT] = {80, 65, 55, 50, 65, 75};
const char* zoneNames[ZONE_COUNT] = {"T001", "T002", "T003", "T004", "T005", "T006"};

const char* mqtt_server = "host.wokwi.internal";
const int mqtt_port = 1883;

// Thông tin xác thực MQTT (Bảo mật: allow_anonymous false)
const char* mqtt_user = "esp32_device";
const char* mqtt_password = "esp32_secret_123";

// Cờ cấu hình xác thực MQTT:
// - Đặt true: Gửi username & password khi kết nối Mosquitto (khuyến nghị cho môi trường có bảo mật).
// - Đặt false: Kết nối anonymous. Dùng để demo tạm nếu broker cho phép anonymous hoặc Wokwi Bridge gặp lỗi xác thực.
const bool USE_MQTT_AUTH = true;

const char* topic_status = "smart-irrigation/status";
const char* topic_cmd    = "smart-irrigation/cmd";

WiFiClient espClient;
PubSubClient client(espClient);
Preferences prefs;  // Lưu ngưỡng vào NVS để không mất khi reboot


bool isAutoMode = true;
bool pumpRunning[ZONE_COUNT] = {false, false, false, false, false, false};
bool weatherGateEnabled = true;
int moisturePercent[ZONE_COUNT] = {0, 0, 0, 0, 0, 0};
int rainPercent = 0;
bool isRaining = false;
bool previousRaining = false;
float temperature = 0.0;
float humidity = 0.0;

unsigned long previousMillis = 0;
const long interval = 2000;

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

void updateLcds() {
  if (!lcdReady) return;

  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    lcds[zone].clear();
    lcds[zone].setCursor(0, 0);
    lcds[zone].print(zoneNames[zone]);
    lcds[zone].print(" M:");
    lcds[zone].print(moisturePercent[zone]);
    lcds[zone].print("%");
    lcds[zone].setCursor(0, 1);
    lcds[zone].print(isRaining ? "RAIN " : (pumpRunning[zone] ? "PUMP ON " : "PUMP OFF"));
    lcds[zone].print(isAutoMode ? " AUTO" : " MAN");
  }
}

void updateRainAlarm() {
  if (isRaining) {
    tone(BUZZER_PIN, 1800);
  } else {
    noTone(BUZZER_PIN);
  }

  if (isRaining != previousRaining) {
    Serial.println(isRaining ? "RAIN ALERT: Dang mua" : "RAIN ALERT: Het mua");
    previousRaining = isRaining;
  }
}

void startPump(int zone) {
  if (zone < 0 || zone >= ZONE_COUNT) return;
  pumpRunning[zone] = true;
  digitalWrite(relayPins[zone], LOW); // Active LOW
  digitalWrite(LED_PIN, HIGH);
  masterValve.write(MASTER_VALVE_OPEN);
  
  updateLcds();
}

void stopPump(int zone) {
  if (zone < 0 || zone >= ZONE_COUNT) return;
  pumpRunning[zone] = false;
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
      Serial.println("Mode: AUTO");
    } else if (message == "MODE_MANUAL") {
      isAutoMode = false;
      Serial.println("Mode: MANUAL");
    } else if (message == "PUMP_ON") {
      if (!isAutoMode) {
        for (int zone = 0; zone < ZONE_COUNT; zone++) startPump(zone);
      }
    } else if (message == "PUMP_OFF") {
      if (!isAutoMode) {
        for (int zone = 0; zone < ZONE_COUNT; zone++) stopPump(zone);
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

void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Connecting to Mosquitto MQTT...");
    String clientId = "ESP32-SmartIrrigation-" + String(random(0xffff), HEX);

    bool connected = false;
    if (USE_MQTT_AUTH && strlen(mqtt_user) > 0) {
      connected = client.connect(clientId.c_str(), mqtt_user, mqtt_password);
    } else {
      // Demo tạm anonymous nếu broker cấu hình allow_anonymous true hoặc Wokwi không nối được với auth
      connected = client.connect(clientId.c_str());
    }

    if (connected) {
      Serial.println(" Connected!");
      client.subscribe(topic_cmd);
    } else {
      Serial.print(" Failed, rc=");
      Serial.print(client.state());
      Serial.println(" Retrying in 2 seconds...");
      // Ghi chú gỡ lỗi:
      // rc=5: Not authorized (sai username/password hoặc broker cấm anonymous mà client không gửi credentials).
      // Nếu Wokwi không nối được qua NAT/Bridge hoặc cần demo nhanh:
      // Có thể tạm đặt USE_MQTT_AUTH = false và chuyển Mosquitto sang 'allow_anonymous true'.
      delay(2000);
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
  }

  Wire.begin(21, 22);

  pinMode(MUX_SIG_PIN, INPUT);
  pinMode(MUX_S0_PIN, OUTPUT);
  pinMode(MUX_S1_PIN, OUTPUT);
  pinMode(MUX_S2_PIN, OUTPUT);
  pinMode(MUX_S3_PIN, OUTPUT);
  pinMode(RAIN_DIGITAL_PIN, INPUT_PULLUP);
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

  WiFi.begin("Wokwi-GUEST", "", 6);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");

  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    lcds[zone].clear();
    lcds[zone].setCursor(0, 0);
    lcds[zone].print(zoneNames[zone]);
    lcds[zone].setCursor(0, 1);
    lcds[zone].print("WiFi Connected");
  }
  delay(1000);
  lcdReady = true;
  updateLcds();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  // JSON telemetry (~700 bytes) vượt xa buffer mặc định 256 byte của PubSubClient.
  // Nếu không tăng buffer, publish sẽ thất bại âm thầm và Backend không nhận được gì.
  client.setBufferSize(1024);
  client.setKeepAlive(30);
}

void loop() {
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop();

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // Đọc cảm biến độ ẩm 6 luống từ MUX 74HC4067 (C0 - C5)
    for (int zone = 0; zone < ZONE_COUNT; zone++) {
      moisturePercent[zone] = readZoneMoisture(zone);
    }

    int rainValue = analogRead(RAIN_SENSOR_PIN);
    rainPercent = constrain(map(rainValue, 0, 4095, 0, 100), 0, 100);
    isRaining = digitalRead(RAIN_DIGITAL_PIN) == HIGH;
    updateRainAlarm();

    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    // Logic Hysteresis Auto Mode cho từng luống
    if (isAutoMode) {
      for (int zone = 0; zone < ZONE_COUNT; zone++) {
        if (weatherGateEnabled && isRaining && pumpRunning[zone]) {
          stopPump(zone);
        } else if (pumpRunning[zone] &&
                   moisturePercent[zone] >= moistureOff[zone]) {
          stopPump(zone);
        } else if (!pumpRunning[zone] &&
                   (!weatherGateEnabled || !isRaining) &&
                   moisturePercent[zone] <= moistureOn[zone]) {
          startPump(zone);
        }
      }
    }

    updateLcds();

    Serial.print("Auto=");
    Serial.print(isAutoMode ? "ON" : "OFF");
    Serial.print(" Rain=");
    Serial.print(isRaining ? "YES" : "NO");
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
    json += "\"weatherGate\":" + String(weatherGateEnabled ? "true" : "false") + ",";
    json += "\"pump\":" + String(anyPumpRunning() ? "true" : "false") + ",";
    json += "\"zones\":[";
    for (int zone = 0; zone < ZONE_COUNT; zone++) {
      if (zone > 0) json += ",";
      json += "{\"id\":\"" + String(zoneNames[zone]) + "\",";
      json += "\"moisture\":" + String(moisturePercent[zone]) + ",";
      json += "\"threshold\":" + String(moistureOn[zone]) + ",";
      json += "\"stopThreshold\":" + String(moistureOff[zone]) + ",";
      json += "\"pump\":" + String(pumpRunning[zone] ? "true" : "false") + "}";
    }
    json += "],";
    json += "\"mode\":\"" + String(isAutoMode ? "auto" : "manual") + "\"";
    json += "}";

    // Retained: backend/web nhận ngay trạng thái mới nhất dù kết nối sau ESP32 
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
