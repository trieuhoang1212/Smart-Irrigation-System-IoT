#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ESP32Servo.h>

//  CẤU HÌNH CHÂN (PINOUT) 
#define DHTPIN 4
#define DHTTYPE DHT22
#define MUX_SIG_PIN 34
#define MUX_S0_PIN 12
#define MUX_S1_PIN 13
#define MUX_S2_PIN 14
#define MUX_S3_PIN 25
#define ZONE_COUNT 4
#define LED_PIN 2
#define SERVO_PIN 5
#define RAIN_SENSOR_PIN 33
#define RAIN_DIGITAL_PIN 32

const int relayPins[ZONE_COUNT] = {16, 17, 18, 23};
const int moistureOn[ZONE_COUNT] = {55, 45, 35, 20};
const int moistureOff[ZONE_COUNT] = {75, 65, 55, 35};
const char* zoneNames[ZONE_COUNT] = {"leafy", "fruiting", "root", "ornamental"};

//  CẤU HÌNH MQTT 
const char* mqtt_server = "host.wokwi.internal";
const int mqtt_port = 1883;

const char* topic_status = "smart-irrigation/status";
const char* topic_cmd    = "smart-irrigation/cmd";

WiFiClient espClient;
PubSubClient client(espClient);

//  BIẾN TOÀN CỤC 
bool isAutoMode = true;       // Chế độ Auto (true) / Manual (false)
bool pumpRunning[ZONE_COUNT] = {false, false, false, false};
bool weatherGateEnabled = true;
int moisturePercent[ZONE_COUNT] = {0, 0, 0, 0};
int rainPercent = 0;          // % Mức mưa
bool isRaining = false;
float temperature = 0.0;
float humidity = 0.0;

// Cấu hình tưới (Yêu cầu Hysteresis)
// Quản lý thời gian
unsigned long previousMillis = 0;
const long interval = 2000; // Đọc & gửi dữ liệu mỗi 2 giây

//  KHỞI TẠO ĐỐI TƯỢNG 
DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo waterPump;

//  HÀM ĐIỀU KHIỂN BƠM 
void startPump(int zone) {
  pumpRunning[zone] = true;
  digitalWrite(relayPins[zone], LOW); // Relay Active LOW
  digitalWrite(LED_PIN, HIGH);
  waterPump.write(90);          // Quay servo mô phỏng
  
  lcd.setCursor(0, 1);
  lcd.print("Pump: ON        ");
}

void stopPump(int zone) {
  pumpRunning[zone] = false;
  digitalWrite(relayPins[zone], HIGH);
  digitalWrite(LED_PIN, LOW);
  waterPump.write(0);
  
  lcd.setCursor(0, 1);
  lcd.print("Pump: OFF       ");
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
  delayMicroseconds(100);
  return constrain(map(analogRead(MUX_SIG_PIN), 0, 4095, 0, 100), 0, 100);
}

// ================= XỬ LÝ NHẬN LỆNH TỪ WEB (MQTT CALLBACK) =================
void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.print("MQTT message arrived [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);

  if (String(topic) == topic_cmd) {
    if (message == "MODE_AUTO") {
      isAutoMode = true;
      Serial.println("Switched to AUTO mode");
    } else if (message == "MODE_MANUAL") {
      isAutoMode = false;
      Serial.println("Switched to MANUAL mode");
    } else if (message == "PUMP_ON") {
      if (!isAutoMode) {
        for (int zone = 0; zone < ZONE_COUNT; zone++) startPump(zone);
        Serial.println("Manual: Pump ON");
      }
    } else if (message == "PUMP_OFF") {
      if (!isAutoMode) {
        for (int zone = 0; zone < ZONE_COUNT; zone++) stopPump(zone);
        Serial.println("Manual: Pump OFF");
      }
    } else if (message == "WEATHER_GATE_ON") {
      weatherGateEnabled = true;
      Serial.println("Weather gate: ON");
    } else if (message == "WEATHER_GATE_OFF") {
      weatherGateEnabled = false;
      Serial.println("Weather gate: OFF");
    }
  }
}

// ================= KẾT NỐI LẠI MQTT =================
void reconnectMQTT() {
  while (!client.connected()) {
    Serial.print("Connecting to Mosquitto MQTT...");
    String clientId = "ESP32-SmartIrrigation-" + String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      Serial.println(" Connected!");
      client.subscribe(topic_cmd); // Đăng ký nhận lệnh từ Web
      Serial.print("Subscribed to: ");
      Serial.println(topic_cmd);
    } else {
      Serial.print(" Failed, rc=");
      Serial.print(client.state());
      Serial.println(" Retrying in 2 seconds...");
      delay(2000);
    }
  }
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);

  pinMode(MUX_SIG_PIN, INPUT);
  pinMode(MUX_S0_PIN, OUTPUT);
  pinMode(MUX_S1_PIN, OUTPUT);
  pinMode(MUX_S2_PIN, OUTPUT);
  pinMode(MUX_S3_PIN, OUTPUT);
  pinMode(RAIN_DIGITAL_PIN, INPUT);
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    pinMode(relayPins[zone], OUTPUT);
    stopPump(zone);
  }
  pinMode(LED_PIN, OUTPUT);
  
  dht.begin();
  waterPump.attach(SERVO_PIN);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi.");

  // Kết nối WiFi Wokwi
  WiFi.begin("Wokwi-GUEST", "", 6);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected!");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connected!");
  delay(1000);
  lcd.clear();

  // Khởi tạo MQTT Client
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// ================= LOOP =================
void loop() {
  if (!client.connected()) {
    reconnectMQTT();
  }
  client.loop(); // Duy trì lắng nghe MQTT liên tục

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // 1. Đọc cảm biến
    for (int zone = 0; zone < ZONE_COUNT; zone++) {
      moisturePercent[zone] = readZoneMoisture(zone);
    }
    int rainValue = analogRead(RAIN_SENSOR_PIN);
    rainPercent = constrain(map(rainValue, 0, 4095, 0, 100), 0, 100);
    isRaining = digitalRead(RAIN_DIGITAL_PIN) == HIGH;
    
    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    // 2. Hiển thị LCD
    lcd.setCursor(0, 0);
    lcd.print("M:");
    lcd.print(moisturePercent[0]);
    lcd.print("% T:");
    lcd.print(temperature, 1);
    lcd.print("C  ");

    // 3. Logic tự động (Auto Mode)
    if (isAutoMode) {
      for (int zone = 0; zone < ZONE_COUNT; zone++) {
        if (weatherGateEnabled && isRaining && pumpRunning[zone]) {
          stopPump(zone);
        }
        else if ((!weatherGateEnabled || !isRaining) &&
                 moisturePercent[zone] < moistureOn[zone] && !pumpRunning[zone]) {
          startPump(zone);
        } 
        else if ((!weatherGateEnabled || !isRaining) &&
                 moisturePercent[zone] > moistureOff[zone] && pumpRunning[zone]) {
          stopPump(zone);
        }
      }
    }

    // 4. Publish JSON lên Mosquitto Broker cho Web Dashboard
    String json = "{";
    json += "\"moisture\":" + String(moisturePercent[0]) + ",";
    json += "\"temperature\":" + String(isnan(temperature) ? 0.0 : temperature, 1) + ",";
    json += "\"humidity\":" + String(isnan(humidity) ? 0.0 : humidity, 1) + ",";
    json += "\"rain\":" + String(rainPercent) + ",";
    json += "\"raining\":" + String(isRaining ? "true" : "false") + ",";
    json += "\"weatherGate\":" + String(weatherGateEnabled ? "true" : "false") + ",";
    json += "\"pump\":" + String(anyPumpRunning() ? "true" : "false") + ",";
    json += "\"zones\":[";
    for (int zone = 0; zone < ZONE_COUNT; zone++) {
      if (zone > 0) json += ",";
      json += "{\"id\":\"" + String(zoneNames[zone]) + "\",";
      json += "\"moisture\":" + String(moisturePercent[zone]) + ",";
      json += "\"pump\":" + String(pumpRunning[zone] ? "true" : "false") + "}";
    }
    json += "],";
    json += "\"mode\":\"" + String(isAutoMode ? "auto" : "manual") + "\"";
    json += "}";

    client.publish(topic_status, json.c_str());
    Serial.print("Published to MQTT: ");
    Serial.println(json);
  }
}
