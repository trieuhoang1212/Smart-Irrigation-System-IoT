// Chép giá trị đang chạy của Wokwi vào diagram.json, để lần Stop/Play sau Wokwi mở lại đúng chiết áp, nhiệt độ và mực nước vừa kéo

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiBase = (process.env.IOT_API ?? "https://smart-irrigation-system-iot.onrender.com")
  .replace(/\/$/, "");
const deviceId = process.env.IOT_DEVICE ?? "esp32-garden-01";
const diagramPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)), "..", "diagram.json",
);

const response = await fetch(`${apiBase}/api/devices/${deviceId}/telemetry/latest`);
if (!response.ok) {
  console.error(`Không lấy được telemetry: HTTP ${response.status}`);
  process.exit(1);
}
const telemetry = await response.json();

const ageSeconds = Math.round((Date.now() - Date.parse(telemetry.receivedAt)) / 1000);
if (!Number.isFinite(ageSeconds) || ageSeconds > 60) {
  console.error(`Số liệu đã cũ (${ageSeconds}s), hãy để Wokwi chạy rồi thử lại.`);
  process.exit(1);
}

let diagram = await readFile(diagramPath, "utf8");

function setAttrs(partId, attrs) {
  const body = Object.entries(attrs)
    .map(([key, value]) => `"${key}": "${value}"`)
    .join(", ");
  const pattern = new RegExp(`("id":\\s*"${partId}"[\\s\\S]*?"attrs":\\s*)\\{[^}]*\\}`);
  if (!pattern.test(diagram)) throw new Error(`Không tìm thấy ${partId} trong diagram.json`);
  diagram = diagram.replace(pattern, `$1{ ${body} }`);
}

const potValue = (moisture) => Math.round((moisture / 100) * 1023);

telemetry.zones.forEach((zone, index) => {
  setAttrs(`pot${index + 1}`, { value: potValue(zone.moisture) });
});

if (typeof telemetry.temperature === "number" && typeof telemetry.humidity === "number") {
  setAttrs("dht1", {
    temperature: telemetry.temperature.toFixed(1),
    humidity: telemetry.humidity.toFixed(1),
  });
}

if (typeof telemetry.tank?.distanceCm === "number") {
  setAttrs("ultrasonic1", { distance: Math.round(telemetry.tank.distanceCm) });
}

JSON.parse(diagram);
await writeFile(diagramPath, diagram, "utf8");

console.log("Đã lưu giá trị mới nhất vào diagram.json:");
for (const zone of telemetry.zones) {
  console.log(`  ${zone.id}: ${zone.moisture}% -> pot ${potValue(zone.moisture)}`);
}
if (typeof telemetry.temperature === "number") {
  console.log(`  Nhiệt độ ${telemetry.temperature}°C, độ ẩm ${telemetry.humidity}%`);
}
if (typeof telemetry.tank?.distanceCm === "number") {
  console.log(`  Bồn: ${telemetry.tank.distanceCm} cm`);
}
