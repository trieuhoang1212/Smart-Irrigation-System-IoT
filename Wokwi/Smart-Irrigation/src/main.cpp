#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ESP32Servo.h>

// ================= CẤU HÌNH CHÂN (PINOUT) =================
#define DHTPIN 4
#define DHTTYPE DHT22
#define SOIL_MOISTURE_PIN 34
#define RELAY_PIN 18
#define LED_PIN 2
#define SERVO_PIN 5

// ================= CẤU HÌNH MQTT =================
// IP máy chủ Mosquitto của bạn (hoặc "10.0.2.2" nếu dùng Wokwi Gateway, hoặc test.mosquitto.org)
const char* mqtt_server = "192.168.1.147"; 
const int mqtt_port = 1883;

const char* topic_status = "smart-irrigation/status";
const char* topic_cmd    = "smart-irrigation/cmd";

WiFiClient espClient;
PubSubClient client(espClient);

// ================= BIẾN TOÀN CỤC =================
bool isAutoMode = true;       // Chế độ Auto (true) / Manual (false)
bool isPumpRunning = false;   // Trạng thái Bơm
int moisturePercent = 0;      // % Độ ẩm đất
float temperature = 0.0;
float humidity = 0.0;

// Cấu hình tưới (Yêu cầu Hysteresis)
int thresholdLow = 40;  // Dưới 40% -> Bật bơm
int thresholdHigh = 60; // Trên 60% -> Tắt bơm

// Quản lý thời gian
unsigned long previousMillis = 0;
const long interval = 2000; // Đọc & gửi dữ liệu mỗi 2 giây

// ================= KHỞI TẠO ĐỐI TƯỢNG =================
DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2);
Servo waterPump;

// ================= HÀM ĐIỀU KHIỂN BƠM =================
void startPump() {
  isPumpRunning = true;
  digitalWrite(RELAY_PIN, LOW); // Relay Active LOW
  digitalWrite(LED_PIN, HIGH);
  waterPump.write(90);          // Quay servo mô phỏng
  
  lcd.setCursor(0, 1);
  lcd.print("Pump: ON        ");
}

void stopPump() {
  isPumpRunning = false;
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(LED_PIN, LOW);
  waterPump.write(0);
  
  lcd.setCursor(0, 1);
  lcd.print("Pump: OFF       ");
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
        startPump();
        Serial.println("Manual: Pump ON");
      }
    } else if (message == "PUMP_OFF") {
      if (!isAutoMode) {
        stopPump();
        Serial.println("Manual: Pump OFF");
      }
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

  pinMode(SOIL_MOISTURE_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  stopPump();
  
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
    int analogValue = analogRead(SOIL_MOISTURE_PIN);
    moisturePercent = map(analogValue, 0, 4095, 0, 100); 
    
    temperature = dht.readTemperature();
    humidity = dht.readHumidity();

    // 2. Hiển thị LCD
    lcd.setCursor(0, 0);
    lcd.print("M:");
    lcd.print(moisturePercent);
    lcd.print("% T:");
    lcd.print(temperature, 1);
    lcd.print("C  ");

    // 3. Logic tự động (Auto Mode)
    if (isAutoMode) {
      if (moisturePercent < thresholdLow && !isPumpRunning) {
        startPump();
      } 
      else if (moisturePercent > thresholdHigh && isPumpRunning) {
        stopPump();
      }
    }

    // 4. Publish JSON lên Mosquitto Broker cho Web Dashboard
    String json = "{";
    json += "\"moisture\":" + String(moisturePercent) + ",";
    json += "\"temperature\":" + String(isnan(temperature) ? 0.0 : temperature, 1) + ",";
    json += "\"humidity\":" + String(isnan(humidity) ? 0.0 : humidity, 1) + ",";
    json += "\"pump\":" + String(isPumpRunning ? "true" : "false") + ",";
    json += "\"mode\":\"" + String(isAutoMode ? "auto" : "manual") + "\"";
    json += "}";

    client.publish(topic_status, json.c_str());
    Serial.print("Published to MQTT: ");
    Serial.println(json);
  }
}
