import { targetSecondsFor, type Telemetry } from "../domain.js";
import { getGardenRainThreshold } from "../garden-settings-repository.js";
import type { MqttGateway } from "../mqtt-gateway.js";
import { type ZoneSetting } from "../zone-settings-repository.js";

const SYNC_COOLDOWN_MS = 10_000;

const lastThresholdSyncAt = new Map<string, number>();
const lastStopSyncAt = new Map<string, number>();
const lastTargetSyncAt = new Map<string, number>();
const lastFlowSyncAt = new Map<string, number>();
const lastRainThresholdSyncAt = new Map<string, number>();


export function resyncThresholds(
  telemetry: Telemetry,
  gateway: MqttGateway,
  settings: ZoneSetting[],
) {
  const byZone = new Map(
    settings.map((setting) => [setting.zoneId as string, setting]),
  );
  const now = Date.now();

  for (const zone of telemetry.zones) {
    const setting = byZone.get(zone.id);
    if (!setting || setting.threshold === zone.threshold) continue;

    const key = `${telemetry.deviceId}:${zone.id}`;
    if (now - (lastThresholdSyncAt.get(key) ?? 0) < SYNC_COOLDOWN_MS) continue;
    lastThresholdSyncAt.set(key, now);

    const command = `SET_THRESHOLD_${zone.id}_${Math.round(setting.threshold)}`;
    void gateway.publish(command).catch((error) => {
      console.error(
        `Threshold resync failed (${zone.id}):`,
        error instanceof Error ? error.message : error,
      );
    });
    console.log(`Threshold resync ${zone.id}: ${zone.threshold} -> ${setting.threshold}`);
  }
}

export function resyncStopThresholds(
  telemetry: Telemetry,
  gateway: MqttGateway,
  settings: ZoneSetting[],
) {
  const byZone = new Map(
    settings.map((setting) => [setting.zoneId as string, setting]),
  );
  const now = Date.now();

  for (const zone of telemetry.zones) {
    // Firmware cũ chưa gửi ngưỡng dừng; không đẩy lệnh để tránh đổi hành vi ngoài ý muốn.
    if (zone.stopThreshold === undefined) continue;
    const setting = byZone.get(zone.id);
    if (!setting || setting.stopThreshold === zone.stopThreshold) continue;

    const key = `${telemetry.deviceId}:${zone.id}`;
    if (now - (lastStopSyncAt.get(key) ?? 0) < SYNC_COOLDOWN_MS) continue;
    lastStopSyncAt.set(key, now);

    const command = `SET_STOP_${zone.id}_${Math.round(setting.stopThreshold)}`;
    void gateway.publish(command).catch((error) => {
      console.error(
        `Stop threshold resync failed (${zone.id}):`,
        error instanceof Error ? error.message : error,
      );
    });
    console.log(
      `Stop threshold resync ${zone.id}: ${zone.stopThreshold} -> ${setting.stopThreshold}`,
    );
  }
}

export function resyncTargets(
  telemetry: Telemetry,
  gateway: MqttGateway,
  settings: ZoneSetting[],
) {
  const byZone = new Map(
    settings.map((setting) => [setting.zoneId as string, setting]),
  );
  const now = Date.now();

  for (const zone of telemetry.zones) {
    // Firmware cũ chưa gửi mục tiêu; không đẩy lệnh lặp lại ngoài ý muốn.
    if (zone.targetSeconds === undefined) continue;
    const setting = byZone.get(zone.id);
    if (!setting) continue;

    const targetSeconds = targetSecondsFor(setting.flowLitersPerHour, setting.targetLiters);
    if (zone.targetSeconds === targetSeconds) continue;

    const key = `${telemetry.deviceId}:${zone.id}`;
    if (now - (lastTargetSyncAt.get(key) ?? 0) < SYNC_COOLDOWN_MS) continue;
    lastTargetSyncAt.set(key, now);

    const command = `SET_TARGET_${zone.id}_${targetSeconds}`;
    void gateway.publish(command).catch((error) => {
      console.error(
        `Target resync failed (${zone.id}):`,
        error instanceof Error ? error.message : error,
      );
    });
    console.log(`Target resync ${zone.id}: ${zone.targetSeconds ?? 0} -> ${targetSeconds}s`);
  }
}

export function resyncFlows(
  telemetry: Telemetry,
  gateway: MqttGateway,
  settings: ZoneSetting[],
) {
  const byZone = new Map(
    settings.map((setting) => [setting.zoneId as string, setting]),
  );
  const now = Date.now();

  for (const zone of telemetry.zones) {
    // Firmware cũ chưa gửi lưu lượng; không đẩy lệnh để tránh đổi hành vi ngoài ý muốn.
    if (zone.flowLph === undefined) continue;
    const setting = byZone.get(zone.id);
    if (!setting || setting.flowLitersPerHour === null) continue;
    if (setting.flowLitersPerHour === zone.flowLph) continue;

    const key = `${telemetry.deviceId}:${zone.id}`;
    if (now - (lastFlowSyncAt.get(key) ?? 0) < SYNC_COOLDOWN_MS) continue;
    lastFlowSyncAt.set(key, now);

    const command = `SET_FLOW_${zone.id}_${setting.flowLitersPerHour}`;
    void gateway.publish(command).catch((error) => {
      console.error(
        `Flow resync failed (${zone.id}):`,
        error instanceof Error ? error.message : error,
      );
    });
    console.log(`Flow resync ${zone.id}: ${zone.flowLph} -> ${setting.flowLitersPerHour} L/h`);
  }
}

export async function resyncRainThreshold(
  telemetry: Telemetry,
  gateway: MqttGateway,
) {
  // Firmware cũ chưa gửi ngưỡng mưa; không đẩy lệnh để tránh đổi hành vi ngoài ý muốn.
  if (telemetry.rainThreshold === undefined) return;

  const stored = await getGardenRainThreshold(telemetry.deviceId);
  if (stored === telemetry.rainThreshold) return;

  const now = Date.now();
  if (now - (lastRainThresholdSyncAt.get(telemetry.deviceId) ?? 0) < SYNC_COOLDOWN_MS) {
    return;
  }
  lastRainThresholdSyncAt.set(telemetry.deviceId, now);

  void gateway.publish(`SET_RAIN_THRESHOLD_${stored}`).catch((error) => {
    console.error(
      "Rain threshold resync failed:",
      error instanceof Error ? error.message : error,
    );
  });
  console.log(`Rain threshold resync: ${telemetry.rainThreshold} -> ${stored}`);
}
