# Smart Irrigation Backend

MVP backend trung gian giữa Web, Mosquitto và ESP32/Wokwi.

## Chạy local

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Backend cung cấp:

- `GET /api/health`
- `GET /api/devices/:deviceId/telemetry/latest`
- `POST /api/devices/:deviceId/commands`
- WebSocket realtime tại `/realtime`

Backend subscribe `smart-irrigation/status` và publish lệnh lên
`smart-irrigation/cmd`. Firmware Wokwi hiện tại vẫn dùng được nguyên trạng.
