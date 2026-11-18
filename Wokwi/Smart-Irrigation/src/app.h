#pragma once

#include <Arduino.h>
#include <Preferences.h>

#include "config.h"

// Cấu hình chỉnh từ Web và lưu trong NVS
extern const char* zoneNames[ZONE_COUNT];
extern int moistureOn[ZONE_COUNT];
extern int moistureOff[ZONE_COUNT];
extern int zoneTargetSeconds[ZONE_COUNT];
extern int zoneFlowLph[ZONE_COUNT];
extern int rainThreshold;
extern int rainWarnThreshold;
extern bool weatherGateEnabled;
extern Preferences prefs;

// Trạng thái dùng chung giữa các module
extern bool isAutoMode;
extern int moisturePercent[ZONE_COUNT];
extern bool pumpRunning[ZONE_COUNT];
extern unsigned long zoneStartedAt[ZONE_COUNT];
extern int zoneStartMoisture[ZONE_COUNT];
extern unsigned long zoneCooldownUntil[ZONE_COUNT];
extern bool zoneLocked[ZONE_COUNT];
extern bool zoneOverTarget[ZONE_COUNT];
extern unsigned long manualStartedAt;
extern int rainPercent;
extern bool isRaining;
extern bool rainWarning;
extern float temperature;
extern float humidity;
extern bool tankEmpty;
extern bool tankValid;
extern float tankDistanceCm;

// sensors.cpp
void sensorsSetup();
void updateClimate();
int readZoneMoisture(int zone);
int readRainPercent();
float readTankDistanceCm();

// soil_sim.cpp
void soilSetup();
void soilUpdate(unsigned long elapsedMs);
void soilOnPumpStopped(int zone, bool wasRunning);

// control.cpp
void controlSetup();
void saveMode();
void updateRainState();
void startPump(int zone);
void stopPump(int zone, const char* reason = nullptr);
void startAllZones();
void stopAllZones(const char* reason = nullptr);
bool anyPumpRunning();
void updateTank();
void enforceRuntimeLimits();
void enforceWaterTargets();
void runAutoControl();
void startManualFromButton();

// link.cpp
void setupLink();
void ensureNetwork();
void linkLoop();
void publishTelemetry();
bool isNetOnline();
bool isSimulatedOffline();
void setSimulatedOffline(bool offline);

// main.cpp
void updateLcds();
void beepOnce(unsigned long durationMs);
void updateBuzzer();
