#pragma once

#include <stdint.h>

// Chân GPIO
constexpr int DHT_PIN = 4;
constexpr int DHT_TYPE = 22;
constexpr int RAIN_DIGITAL_PIN = 27;
constexpr int TANK_TRIG_PIN = 12;
constexpr int TANK_ECHO_PIN = 26;
constexpr int WIFI_BUTTON_PIN = 14;
constexpr int MANUAL_BUTTON_PIN = 13;
constexpr int LED_PIN = 2;
constexpr int BUZZER_PIN = 0;
constexpr int SERVO_PIN = 5;

// 6 khu vực T001 - T006
constexpr int ZONE_COUNT = 6;
constexpr int SOIL_ADC_PINS[ZONE_COUNT] = {32, 33, 34, 35, 36, 39};
// Rơ-le điều khiển van từng luống (Active LOW).
constexpr int RELAY_PINS[ZONE_COUNT] = {16, 17, 18, 23, 15, 19};
constexpr uint8_t LCD_ADDRESSES[ZONE_COUNT] = {0x20, 0x21, 0x22, 0x23, 0x24, 0x25};
constexpr int MASTER_VALVE_CLOSED = 0;
constexpr int MASTER_VALVE_OPEN = 90;

// WiFi / MQTT
constexpr const char* WIFI_SSID = "Wokwi-GUEST";
constexpr const char* WIFI_PASSWORD = "";
constexpr int WIFI_CHANNEL = 6;
// constexpr const char* MQTT_SERVER = "test.mosquitto.org";
constexpr const char* MQTT_SERVER = "192.168.0.215";
constexpr int MQTT_PORT = 1883;
constexpr const char* DEVICE_ID = "esp32-garden-01";
constexpr const char* TOPIC_STATUS = "smart-irrigation/trieuhoang1212/status";
constexpr const char* TOPIC_CMD = "smart-irrigation/trieuhoang1212/cmd";

// Chu kỳ và thời gian chờ
constexpr unsigned long CONTROL_INTERVAL_MS = 2000UL;
constexpr unsigned long NET_RETRY_MS = 10000UL;
constexpr unsigned long MQTT_RETRY_MS = 5000UL;
constexpr unsigned long RAIN_WARN_INTERVAL_MS = 15000UL;
constexpr unsigned long OVERWATER_INTERVAL_MS = 10000UL;

// Giới hạn an toàn: tưới tối đa 10 phút/lượt, nghỉ 2 phút, MANUAL tự về AUTO sau 10 phút.
constexpr unsigned long MAX_ZONE_RUNTIME_MS = 10UL * 60UL * 1000UL;
constexpr unsigned long MAX_MANUAL_MS = 10UL * 60UL * 1000UL;
constexpr unsigned long ZONE_COOLDOWN_MS = 2UL * 60UL * 1000UL;

// Ngưỡng mưa (chỉnh từ Web) và ngưỡng dừng của đất
constexpr int RAIN_THRESHOLD_MIN = 40;
constexpr int RAIN_THRESHOLD_MAX = 100;
constexpr int RAIN_WARN_OFFSET = 20;
constexpr int RAIN_HYSTERESIS = 5;

// Chip mưa xuất PWM tối đa 90/100 ms, nên 90 mẫu HIGH tương ứng 100% mưa.
constexpr int RAIN_PWM_MAX_SAMPLES = 90;

// Mô phỏng độ ẩm: 1 L nước nâng khoảng 2% độ ẩm vùng.
// Tốc độ tăng (%/phút) = SOIL_PERCENT_PER_LITER * lưu lượng (L/giờ) / 60.
constexpr float SOIL_PERCENT_PER_LITER = 2.0f;
constexpr float SOIL_DRY_PER_MIN = 3.5f;
constexpr float SOIL_MANUAL_PER_SEC = 20.0f;
constexpr unsigned long SOIL_STEP_CAP_MS = 10000UL;
constexpr unsigned long SOIL_PERSIST_INTERVAL_MS = 30000UL;

// Wokwi: chiết áp 0 -> khô, 4095 -> ướt.
// Cảm biến thật thường đảo chiều, ví dụ đo được khô 3000 và ướt 1200 thì đổi hai số này.
constexpr int SOIL_ADC_DRY = 0;
constexpr int SOIL_ADC_WET = 4095;
static_assert(SOIL_ADC_DRY != SOIL_ADC_WET, "Hai moc hieu chuan ADC phai khac nhau");

// HC-SR04 gắn trên miệng bồn, đo khoảng cách tới mặt nước: xa quá nghĩa là bồn cạn.
constexpr float TANK_EMPTY_CM = 80.0f;
constexpr float TANK_REFILL_CM = 60.0f;
constexpr unsigned long TANK_STALE_MS = 10000UL;
// Một xung nhiễu không đủ để đổi trạng thái bồn: cần 2 lần đọc liên tiếp.
constexpr int TANK_CONFIRM_READS = 2;

// 1: mô phỏng động học đất (bơm chạy thì ẩm lên, tắt thì khô dần), chiết áp là tay chỉnh.
// 0: chiết áp là số đo trực tiếp, bơm chạy không làm đổi số đo.
#ifndef SIMULATE_SOIL_DYNAMICS
#define SIMULATE_SOIL_DYNAMICS 1
#endif

// So sánh millis an toàn khi bộ đếm tràn sau ~49,7 ngày.
inline bool elapsedSince(unsigned long now, unsigned long since, unsigned long interval) {
  return now - since >= interval;
}

// Dùng cho mốc thời gian trong tương lai (cooldown).
inline bool deadlineReached(unsigned long now, unsigned long deadline) {
  return static_cast<long>(now - deadline) >= 0;
}
