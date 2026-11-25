import type { Telemetry } from "../domain.js";
import type { MqttGateway } from "../mqtt-gateway.js";
import { getZoneSettings } from "../zone-settings-repository.js";
import { resyncThresholds, resyncStopThresholds, resyncTargets, resyncFlows, resyncRainThreshold } from "./sync.js";

// Đồng bộ cấu hình trong DB xuống thiết bị sau mỗi telemetry live

export async function resyncDeviceConfig(
    telemetry: Telemetry,
    gateway: MqttGateway
): Promise<void> {
    const settings = await getZoneSettings(telemetry.deviceId);
    if (settings.length === 0) return;

    // Ngưỡng dừng chạy sau ngưỡng bật để giá trị cuối cùng khớp với DB
    resyncThresholds(telemetry, gateway, settings);
    resyncStopThresholds(telemetry, gateway, settings);
    resyncTargets(telemetry, gateway, settings);
    resyncFlows(telemetry, gateway, settings);
    await resyncRainThreshold(telemetry, gateway);
}
