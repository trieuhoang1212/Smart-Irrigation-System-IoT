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
- `GET /api/config`
- `GET /api/devices/:deviceId/telemetry/latest`
- `GET /api/devices/:deviceId/telemetry/history?from=&to=&zoneId=&limit=&bucketMs=`
  (`bucketMs` gộp mẫu theo khoảng thời gian để chart 1h/24h/7 ngày nhẹ hơn)
- `GET /api/devices/:deviceId/commands?limit=`
- `POST /api/devices/:deviceId/commands`
- `PUT /api/devices/:deviceId/config/zones/:zoneId` — lưu ngưỡng tưới (`{ "threshold": 55 }`)
- `GET /api/devices/:deviceId/config/changes?limit=` — lịch sử đổi ngưỡng
- WebSocket realtime tại `/realtime`

Backend subscribe `smart-irrigation/status` và publish lệnh lên
`smart-irrigation/cmd`. Firmware Wokwi hiện tại vẫn dùng được nguyên trạng.

## Database

Dùng SQLite qua `better-sqlite3`, file mặc định `data/smart-irrigation.db`
(cấu hình bằng `DB_PATH`). Database tự tạo bảng khi khởi động.

- `latest_telemetry`: snapshot mới nhất mỗi thiết bị, khôi phục lại sau restart.
- `telemetry_samples` + `telemetry_zone_samples`: lịch sử telemetry để vẽ chart.
- `command_log`: log lệnh đã gửi và trạng thái `pending/confirmed/timeout`.
- `zone_settings`: ngưỡng tưới đã lưu (nguồn cấu hình thật, ưu tiên hơn
  `garden-config.ts`).
- `zone_setting_changes`: lịch sử thay đổi ngưỡng (giá trị cũ → mới, thời gian).

Dữ liệu cũ hơn `DB_RETENTION_DAYS` (mặc định 30 ngày) được dọn tự động mỗi ngày.

## Ngưỡng tưới bền vững

- Khi đổi ngưỡng từ Web (`SET_THRESHOLD`), backend lưu ngay vào SQLite.
- `GET /api/config` trả ngưỡng từ DB, nên restart backend không mất cấu hình.
- Khi telemetry báo ngưỡng khác DB (ví dụ ESP32 vừa reboot), backend tự gửi lại
  `SET_THRESHOLD` (cooldown 10 giây/zone).
- Firmware cũng lưu ngưỡng vào NVS (`Preferences`) nên tự nhớ sau khi reboot.
