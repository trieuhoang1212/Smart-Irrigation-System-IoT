import { ZONE_IDS, type Telemetry } from "../domain.js";
import { resolveCommand } from "../command-log-repository.js";
import { broadcast } from "./broadcaster.js";

const DEVICE_TIMEOUT_MS = 6000;

type PendingCommand = {
  id: string;
  deviceId: string;
  command: string;
  expiresAt: number;
};

const pendingCommands = new Map<string, PendingCommand>();

export function trackCommand(
  commandId: string,
  deviceId: string,
  command: string,
) {
  pendingCommands.set(commandId, {
    id: commandId,
    deviceId,
    command,
    expiresAt: Date.now() + DEVICE_TIMEOUT_MS * 2,
  });
}

function commandMatchesTelemetry(
  command: string,
  telemetry: Telemetry,
): boolean {
  if (command === "MODE_AUTO") return telemetry.mode === "auto";
  if (command === "MODE_MANUAL") return telemetry.mode === "manual";
  if (command === "WEATHER_GATE_ON") return telemetry.weatherGate;
  if (command === "WEATHER_GATE_OFF") return !telemetry.weatherGate;
  // Firmware chỉ nhận lệnh bơm ở chế độ manual; hết nước/khoá 10 phút có thể chặn bơm
  // nên chỉ xác nhận thiết bị đã nhận lệnh, không đòi hỏi mọi vùng phải chạy.
  if (command === "PUMP_ON" || command === "PUMP_OFF")
    return telemetry.mode === "manual";

  const zonePattern = ZONE_IDS.join("|");
  const pump = command.match(
    new RegExp(`^(PUMP_ON|PUMP_OFF)_(${zonePattern})$`),
  );
  if (pump) return telemetry.mode === "manual";

  const threshold = command.match(
    new RegExp(`^SET_THRESHOLD_(${zonePattern})_(\\d{1,3})$`),
  );
  if (threshold)
    return (
      telemetry.zones.find((zone) => zone.id === threshold[1])?.threshold ===
      Number(threshold[2])
    );

  const stop = command.match(
    new RegExp(`^SET_STOP_(${zonePattern})_(\\d{1,3})$`),
  );
  if (stop)
    return (
      telemetry.zones.find((zone) => zone.id === stop[1])?.stopThreshold ===
      Number(stop[2])
    );

  const target = command.match(
    new RegExp(`^SET_TARGET_(${zonePattern})_(\\d{1,3})$`),
  );
  if (target)
    return (
      telemetry.zones.find((zone) => zone.id === target[1])?.targetSeconds ===
      Number(target[2])
    );

  const flow = command.match(
    new RegExp(`^SET_FLOW_(${zonePattern})_(\\d{1,3})$`),
  );
  if (flow)
    return (
      telemetry.zones.find((zone) => zone.id === flow[1])?.flowLph ===
      Number(flow[2])
    );

  const rainThreshold = command.match(/^SET_RAIN_THRESHOLD_(\d{1,3})$/);
  if (rainThreshold)
    return telemetry.rainThreshold === Number(rainThreshold[1]);

  return false;
}

/** Xác nhận các lệnh vừa gửi khi telemetry live đã phản ánh đúng giá trị. */
export function confirmPendingCommands(telemetry: Telemetry) {
  pendingCommands.forEach((pending, commandId) => {
    if (
      pending.deviceId !== telemetry.deviceId ||
      !commandMatchesTelemetry(pending.command, telemetry)
    )
      return;
    pendingCommands.delete(commandId);
    void resolveCommand(commandId, "confirmed").catch((error) => {
      console.error(
        "Failed to resolve command:",
        error instanceof Error ? error.message : error,
      );
    });
    broadcast({
      type: "command-result",
      commandId,
      deviceId: pending.deviceId,
      status: "confirmed",
    });
  });
}

/** Đánh dấu timeout cho lệnh không được thiết bị xác nhận kịp. */
export function expirePendingCommands() {
  const now = Date.now();
  pendingCommands.forEach((pending, commandId) => {
    if (pending.expiresAt > now) return;
    pendingCommands.delete(commandId);
    void resolveCommand(commandId, "timeout").catch((error) => {
      console.error(
        "Failed to resolve command:",
        error instanceof Error ? error.message : error,
      );
    });
    broadcast({
      type: "command-result",
      commandId,
      deviceId: pending.deviceId,
      status: "timeout",
    });
  });
}
