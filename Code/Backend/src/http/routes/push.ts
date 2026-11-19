import type { Router } from "express";
import { isExpoPushToken, sendPushToDevice } from "../../push.js";
import {
  deletePushToken,
  isPushPlatform,
  listPushTokens,
  savePushToken,
} from "../../push-repository.js";

export function registerPushRoutes(router: Router) {
  router.get("/api/devices/:deviceId/push-tokens", (request, response) => {
    const tokens = listPushTokens(request.params.deviceId);
    response.json({
      deviceId: request.params.deviceId,
      count: tokens.length,
      platforms: Array.from(new Set(tokens.map((token) => token.platform))),
    });
  });

  router.post("/api/devices/:deviceId/push-tokens", (request, response) => {
    const body = request.body as { token?: unknown; platform?: unknown } | undefined;
    if (typeof body?.token !== "string" || !isExpoPushToken(body.token)) {
      response.status(400).json({ error: "token must be a valid Expo push token" });
      return;
    }
    if (!isPushPlatform(body.platform)) {
      response.status(400).json({ error: "platform must be ios or android" });
      return;
    }

    const saved = savePushToken(request.params.deviceId, body.token, body.platform);
    response.status(201).json({
      deviceId: request.params.deviceId,
      token: saved.token,
      platform: saved.platform,
      count: listPushTokens(request.params.deviceId).length,
    });
  });

  router.delete("/api/devices/:deviceId/push-tokens", (request, response) => {
    const body = request.body as { token?: unknown } | undefined;
    const token =
      typeof request.query.token === "string"
        ? request.query.token
        : typeof body?.token === "string"
          ? body.token
          : null;

    if (!token) {
      response.status(400).json({ error: "token is required" });
      return;
    }

    response.json({
      deviceId: request.params.deviceId,
      removed: deletePushToken(request.params.deviceId, token),
      count: listPushTokens(request.params.deviceId).length,
    });
  });

  // Gửi thử một thông báo để người dùng kiểm tra quyền và kênh trên máy.
  router.post("/api/devices/:deviceId/notifications/test", async (request, response) => {
    const result = await sendPushToDevice(request.params.deviceId, {
      title: "Greenflow",
      body: "Thông báo thử từ hệ thống tưới thông minh.",
      data: { type: "test", deviceId: request.params.deviceId },
    });

    if (result.targeted === 0) {
      response.status(409).json({ error: "No push tokens registered", ...result });
      return;
    }

    response.json({ deviceId: request.params.deviceId, ...result });
  });
}
