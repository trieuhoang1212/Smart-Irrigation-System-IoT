#include "app.h"

#include <DHT.h>
#include <Wire.h>

static DHT dht(DHT_PIN, DHT_TYPE);

float temperature = 0.0f;
float humidity = 0.0f;

void sensorsSetup() {
  Wire.begin(21, 22);
  dht.begin();

  pinMode(RAIN_DIGITAL_PIN, INPUT);
  pinMode(TANK_TRIG_PIN, OUTPUT);
  pinMode(TANK_ECHO_PIN, INPUT);

  analogReadResolution(12);
  for (int zone = 0; zone < ZONE_COUNT; zone++) {
    analogSetPinAttenuation(SOIL_ADC_PINS[zone], ADC_11db);
  }
}

void updateClimate() {
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
}

// Lấy trung vị 9 mẫu để bỏ qua nhiễu, rồi quy đổi ADC -> % theo hai mốc hiệu chuẩn.
static int readDirectMoisture(int pin) {
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
  return constrain(map(samples[4], SOIL_ADC_DRY, SOIL_ADC_WET, 0, 100), 0, 100);
}

int readZoneMoisture(int zone) {
  return readDirectMoisture(SOIL_ADC_PINS[zone]);
}

int readRainPercent() {
  int highSamples = 0;
  for (int sample = 0; sample < 100; sample++) {
    if (digitalRead(RAIN_DIGITAL_PIN) == HIGH) highSamples++;
    delay(1);
  }
  return constrain(map(highSamples, 0, RAIN_PWM_MAX_SAMPLES, 0, 100), 0, 100);
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
