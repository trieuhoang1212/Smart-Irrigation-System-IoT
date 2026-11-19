import { Router } from "express";
import { gardenConfig } from "../garden-config.js";
import type { MqttGateway } from "../mqtt-gateway.js";
import { registerCommandRoutes } from "./routes/commands.js";
import { registerConfigRoutes } from "./routes/config.js";
import { registerPushRoutes } from "./routes/push.js";
import { registerTelemetryRoutes } from "./routes/telemetry.js";
import { registerZoneRoutes } from "./routes/zones.js";

export function createApiRouter(gateway: MqttGateway) {
  const router = Router();

  // Một nguồn device ID duy nhất; route nào có :deviceId đều trả 404 như nhau.
  router.param("deviceId", (_request, response, next, value: string) => {
    if (value !== gardenConfig.deviceId) {
      response.status(404).json({ error: "Device not found" });
      return;
    }
    next();
  });

  registerConfigRoutes(router, gateway);
  registerZoneRoutes(router, gateway);
  registerTelemetryRoutes(router);
  registerCommandRoutes(router, gateway);
  registerPushRoutes(router);

  return router;
}
