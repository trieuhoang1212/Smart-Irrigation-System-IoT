import { type Telemetry } from "./domain.js";
import { sendPushToDevice, type PushPayload } from "./push.js";
import { getZoneProfile } from "./zone-profile-repository.js";

// Cooldown cho từng loại thông báo để tránh gửi liên tục làm phiền người dùng.
const OFFLINE_ALERT_COOLDOWN_MS = 5 * 60_000;
const ENVIRONMENT_ALERT_COOLDOWN_MS = 30 * 60_000;
const MODE_ALERT_COOLDOWN_MS = 60_000;
const WATERING_ALERT_COOLDOWN_MS = 5 * 60_000;
const MOISTURE_ALERT_COOLDOWN_MS = 30 * 60_000;
// Thiếu ẩm và bắt đầu tưới dùng chung một thông báo, cooldown đủ dài để mốc
// thứ hai (bơm vừa bật) không bắn thêm ngay sau mốc đầu.
const ZONE_WATER_ALERT_COOLDOWN_MS = 10 * 60_000;
const TEMPERATURE_ALERT_COOLDOWN_MS = 60 * 60_000;
const TANK_ALERT_COOLDOWN_MS = 30 * 60_000;

const HIGH_TEMPERATURE_THRESHOLD = 37;
const RAIN_PRE_ALERT_THRESHOLD = 40;

const lastAlertAt = new Map<string, number>();

function notify(
  deviceId: string,
  kind: string,
  cooldownMs: number,
  payload: PushPayload,
): void {
  const key = `${deviceId}:${kind}`;
  const now = Date.now();
  if (now - (lastAlertAt.get(key) ?? 0) < cooldownMs) return;
  lastAlertAt.set(key, now);

  void sendPushToDevice(deviceId, payload).catch((error) => {
    console.error(
      "Push notification failed:",
      error instanceof Error ? error.message : error,
    );
  });
}

async function getZoneLabel(
  deviceId: string,
  zoneId: string,
): Promise<string> {
  try {
    const profile = await getZoneProfile(deviceId, zoneId);
    if (profile?.name && profile.name.trim()) {
      return `Khu ${zoneId} (${profile.name.trim()})`;
    }
  } catch {
    // Không đọc được DB; dùng mã mặc định.
  }
  return `Khu ${zoneId}`;
}

function getTankPercent(distanceCm: number | null): number | null {
  if (distanceCm === null || !Number.isFinite(distanceCm)) return null;
  return Math.max(0, Math.min(100, Math.round(100 - distanceCm)));
}

/**
 * Kiểm tra các thay đổi trạng thái giữa 2 lần telemetry để gửi push notification phù hợp.
 */
export async function checkTelemetryAlerts(
  previous: Telemetry,
  current: Telemetry,
): Promise<void> {
  const deviceId = current.deviceId;

  // 1. Chuyển đổi chế độ (Auto <-> Manual)
  if (previous.mode !== current.mode) {
    if (current.mode === "auto") {
      notify(deviceId, "mode_auto", MODE_ALERT_COOLDOWN_MS, {
        title: "Chế độ Tự động",
        body: "Hệ thống sẽ tự động tưới nước theo ngưỡng ẩm từng khu vực.",
        data: { type: "mode", mode: "auto", deviceId },
      });
    } else {
      notify(deviceId, "mode_manual", MODE_ALERT_COOLDOWN_MS, {
        title: "Chế độ Thủ công",
        body: "Tự động tưới đã tắt, bạn có thể chủ động điều khiển bơm các khu vực.",
        data: { type: "mode", mode: "manual", deviceId },
      });
    }
  }

  // 2. Mưa & Weather Gate
  // 2.1 Cảnh báo sớm sắp có mưa khi cảm biến tăng nhưng chưa đạt cờ ngắt
  if (
    previous.rain < RAIN_PRE_ALERT_THRESHOLD &&
    current.rain >= RAIN_PRE_ALERT_THRESHOLD &&
    !current.raining
  ) {
    notify(deviceId, "rain_forecast", ENVIRONMENT_ALERT_COOLDOWN_MS, {
      title: "Dự báo sắp có mưa",
      body: `Cảm biến phát hiện chỉ số mưa tăng (${Math.round(current.rain)}%), chuẩn bị hoãn tưới nếu mưa lớn.`,
      data: { type: "rain_forecast", deviceId, rain: current.rain },
    });
  }

  // 2.2 Bắt đầu mưa lớn
  if (!previous.raining && current.raining) {
    notify(deviceId, "rain", ENVIRONMENT_ALERT_COOLDOWN_MS, {
      title: "Trời bắt đầu mưa",
      body: current.weatherGate
        ? "Cảm biến phát hiện mưa lớn. Hệ thống đã tạm hoãn tưới tự động để tránh ngập úng."
        : "Trời đang mưa lớn. Chế độ chặn tưới khi mưa (Weather Gate) đang tắt.",
      data: { type: "rain", deviceId },
    });
  }

  // 2.3 Trời tạnh mưa
  if (previous.raining && !current.raining) {
    notify(deviceId, "rain_stopped", ENVIRONMENT_ALERT_COOLDOWN_MS, {
      title: "Trời đã tạnh mưa",
      body: "Hệ thống sẵn sàng khôi phục chu kỳ tưới tự động bình thường.",
      data: { type: "rain_stopped", deviceId },
    });
  }

  // 3. Mực nước bồn (Cạn bồn, Sắp hết nước, Đầy nước)
  const prevPercent = getTankPercent(previous.tank.distanceCm);
  const currPercent = getTankPercent(current.tank.distanceCm);

  if (!previous.tank.empty && current.tank.empty) {
    notify(deviceId, "tank_empty", TANK_ALERT_COOLDOWN_MS, {
      title: "Bồn nước đã cạn",
      body: "Tưới tự động đã tạm dừng và khóa bơm để chống cháy động cơ.",
      data: { type: "tank_empty", deviceId },
    });
  } else if (
    prevPercent !== null &&
    currPercent !== null &&
    prevPercent > 25 &&
    currPercent <= 25 &&
    !current.tank.empty
  ) {
    notify(deviceId, "tank_low", TANK_ALERT_COOLDOWN_MS, {
      title: "Bồn nước sắp cạn",
      body: `Mực nước bồn chỉ còn ${currPercent}%, vui lòng bơm thêm nước.`,
      data: { type: "tank_low", deviceId, percent: currPercent },
    });
  } else if (
    prevPercent !== null &&
    currPercent !== null &&
    prevPercent < 90 &&
    currPercent >= 90
  ) {
    notify(deviceId, "tank_full", TANK_ALERT_COOLDOWN_MS * 2, {
      title: "Bồn nước đã đầy",
      body: `Mực nước bồn đạt ${currPercent}%, sẵn sàng cấp nước tưới.`,
      data: { type: "tank_full", deviceId, percent: currPercent },
    });
  }

  // 4. Nhiệt độ tăng quá nắng
  if (
    current.temperature !== null &&
    (previous.temperature === null ||
      previous.temperature < HIGH_TEMPERATURE_THRESHOLD) &&
    current.temperature >= HIGH_TEMPERATURE_THRESHOLD
  ) {
    notify(deviceId, "temperature_high", TEMPERATURE_ALERT_COOLDOWN_MS, {
      title: "Cảnh báo nắng gắt",
      body: `Nhiệt độ môi trường đạt ${current.temperature}°C, đất bốc hơi nhanh. Chú ý theo dõi các khu cây non.`,
      data: {
        type: "temperature_high",
        deviceId,
        temperature: current.temperature,
      },
    });
  }

  // 5. Cảnh báo từng khu vực (thiếu ẩm, bắt đầu tưới, tưới xong, khóa an toàn)
  const prevZones = new Map(previous.zones.map((z) => [z.id, z]));
  for (const zone of current.zones) {
    const prevZone = prevZones.get(zone.id);
    if (!prevZone) continue;
    const label = await getZoneLabel(deviceId, zone.id);

    // 5.1 Thiếu ẩm / bắt đầu tưới: gộp một thông báo vì firmware có thể bật
    // bơm ngay trong cùng chu kỳ telemetry với lúc độ ẩm tụt dưới ngưỡng.
    const moistureDropped =
      prevZone.moisture >= prevZone.threshold && zone.moisture < zone.threshold;
    const pumpStarted = !prevZone.pump && zone.pump;
    if (moistureDropped || pumpStarted) {
      notify(
        deviceId,
        `zone_needs_water:${zone.id}`,
        ZONE_WATER_ALERT_COOLDOWN_MS,
        {
          title: `${zone.pump ? "Bắt đầu tưới" : "Cây cần nước"} · ${label}`,
          body: zone.pump
            ? `Độ ẩm ${Math.round(zone.moisture)}% (ngưỡng ${zone.threshold}%), đang cấp nước cho ${label}.`
            : `Độ ẩm còn ${Math.round(zone.moisture)}% (dưới ngưỡng ${zone.threshold}%), chuẩn bị kích hoạt tưới.`,
          data: {
            type: "zone_needs_water",
            deviceId,
            zoneId: zone.id,
            started: zone.pump,
          },
        },
      );
    }

    // 5.2 Hoàn tất chu kỳ tưới
    if (prevZone.pump && !zone.pump) {
      notify(deviceId, `watering_done:${zone.id}`, WATERING_ALERT_COOLDOWN_MS, {
        title: `Đã tưới xong · ${label}`,
        body: `${label} đã đủ nước, độ ẩm đạt ${Math.round(zone.moisture)}%. Van đã đóng an toàn.`,
        data: { type: "watering_done", deviceId, zoneId: zone.id },
      });
    }

    // 5.3 Cảnh báo an toàn quá thời gian tối đa
    if (!prevZone.over && zone.over) {
      notify(
        deviceId,
        `safety_lockout:${zone.id}`,
        MOISTURE_ALERT_COOLDOWN_MS,
        {
          title: `Cảnh báo an toàn · ${label}`,
          body: `${label} đã tưới liên tục quá thời gian tối đa và được tự động ngắt để chống úng nước.`,
          data: { type: "safety_lockout", deviceId, zoneId: zone.id },
        },
      );
    }
  }
}

/**
 * Cảnh báo khi thiết bị ESP32 mất kết nối quá thời gian quy định.
 */
export function checkDeviceOfflineAlert(deviceId: string): void {
  notify(deviceId, "offline", OFFLINE_ALERT_COOLDOWN_MS, {
    title: "Vườn mất kết nối",
    body: "Không nhận dữ liệu từ thiết bị. Kiểm tra nguồn và Wi-Fi.",
    data: { type: "offline", deviceId },
  });
}

/**
 * Cảnh báo khi thiết bị ESP32 kết nối lại sau khi bị mất mạng.
 */
export function checkDeviceOnlineAlert(deviceId: string): void {
  notify(deviceId, "online", OFFLINE_ALERT_COOLDOWN_MS, {
    title: "Vườn đã kết nối lại",
    body: "Thiết bị ESP32 đã trực tuyến, dữ liệu cảm biến và điều khiển đã sẵn sàng.",
    data: { type: "online", deviceId },
  });
}
