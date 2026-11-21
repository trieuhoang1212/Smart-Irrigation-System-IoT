# Smart Irrigation Backend

Backend trung gian giữa Web Dashboard, Mosquitto (MQTT) và ESP32/Wokwi.
Stack: **Node.js + TypeScript + Express 5 + PostgreSQL (`pg`) + WebSocket**.

## Luồng dữ liệu

```mermaid
flowchart LR
    ESP32["ESP32 / Wokwi"] -->|publish telemetry<br/>smart-irrigation/status| MQTT["Mosquitto"]
    MQTT -->|subscribe| BE["Backend"]
    BE -->|"lưu PostgreSQL + broadcast"| WS["WebSocket /realtime"]
    WS --> WEB["Web Dashboard"]
    WEB -->|"REST: điều khiển, đổi ngưỡng"| BE
    BE -->|publish lệnh<br/>smart-irrigation/cmd| MQTT
    MQTT -->|subscribe| ESP32
```

- Thiết bị gửi telemetry khoảng 2 giây/lần; backend chỉ ghi lịch sử 10 giây/lần để nhẹ DB.
- Mọi telemetry hợp lệ được push ngay cho Web qua WebSocket, không cần polling.

## Yêu cầu môi trường

- **Node.js 20+** (khuyến nghị 22) và npm.
- **PostgreSQL** đang chạy — mặc định `postgres://postgres@127.0.0.1:5432/smart_irrigation`.
  - Windows: cài PostgreSQL (pgAdmin kèm theo), tạo database `smart_irrigation`; bảng tự tạo khi khởi động.
  - Có thể dùng Postgres hosted (Neon, Supabase, Render) qua `DATABASE_URL`.
- **MQTT broker** (Mosquitto) đang chạy — mặc định `mqtt://127.0.0.1:1883`.
  - Windows: cài Mosquitto và chạy service, hoặc chạy `mosquitto -v` ở terminal riêng.
- Cổng mặc định: backend `3001`.

## Chạy local

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Kiểm tra nhanh sau khi chạy:

```powershell
curl http://localhost:3001/api/health
```

Kết quả `ok: true` nghĩa là cả database và MQTT đều sẵn sàng.

## Biến môi trường (`.env`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3001` | Cổng HTTP/WebSocket của backend. |
| `MQTT_URL` | `mqtt://127.0.0.1:1883` | Địa chỉ MQTT broker. |
| `MQTT_STATUS_TOPIC` | `smart-irrigation/status` | Topic nhận telemetry từ thiết bị. |
| `MQTT_COMMAND_TOPIC` | `smart-irrigation/cmd` | Topic gửi lệnh xuống thiết bị. |
| `WEB_ORIGIN` | `http://localhost:3000` | Origin được phép gọi API (CORS). |
| `DEFAULT_DEVICE_ID` | `esp32-garden-01` | Device ID mặc định của hệ thống. |
| `DATABASE_URL` | `postgres://postgres@127.0.0.1:5432/smart_irrigation` | Chuỗi kết nối PostgreSQL. |
| `DATABASE_SSL` | `false` | Đặt `true` khi dùng Postgres hosted cần SSL (Render, Neon, Supabase). |
| `DB_RETENTION_DAYS` | `30` | Số ngày giữ lịch sử trước khi tự dọn. |
| `UPLOAD_DIR` | `data/uploads` | Thư mục lưu ảnh khu vườn do Web upload. |
| `CLOUDINARY_CLOUD_NAME` | — | Cloud name Cloudinary; bật lưu ảnh bền vững khi đi cùng hai biến bên dưới. |
| `CLOUDINARY_API_KEY` | — | API key Cloudinary. |
| `CLOUDINARY_API_SECRET` | — | API secret Cloudinary, chỉ cấu hình trên Backend/Render. |

## Cấu trúc mã nguồn (`src/`)

| File | Công dụng |
|---|---|
| `server.ts` | Điểm khởi chạy: Express app, middleware, `/api/health`, mount REST router, khởi động realtime, dọn dữ liệu cũ định kỳ, graceful shutdown. |
| `http/router.ts` | Ghép các nhóm route REST: config, telemetry, lệnh, khu vực, push. |
| `http/routes/*` | Route theo nhóm: `config`, `telemetry`, `commands`, `zones`, `push`; validate input và publish lệnh MQTT. |
| `http/config-view.ts` | Dựng cấu hình thiết bị (ngưỡng, hồ sơ cây, đất, mưa) và dữ liệu cho gợi ý tưới. |
| `realtime/live-service.ts` | Nhận telemetry MQTT: ghi lịch sử (10 giây/lần), broadcast WebSocket, watchdog online/offline, timeout lệnh, resync cấu hình. |
| `realtime/state.ts` | Cache telemetry mới nhất và thống kê realtime. |
| `realtime/sync.ts` | Đồng bộ ngưỡng/lưu lượng/mục tiêu nước xuống thiết bị khi lệch DB. |
| `realtime/commands.ts` | Theo dõi lệnh: xác nhận qua telemetry hoặc chuyển `timeout` sau 12 giây. |
| `live.ts` | Re-export các hàm realtime để giữ import cũ. |
| `config.ts` | Đọc và kiểm tra biến môi trường (port, MQTT URL, topic, chuỗi kết nối DB, retention). |
| `db.ts` | Pool `pg`, helper transaction, tạo schema/index PostgreSQL khi khởi động. |
| `domain.ts` | Định nghĩa type dùng chung, kiểm tra hợp lệ telemetry (6 khu `T001`–`T006`), sinh chuỗi lệnh MQTT. |
| `garden-config.ts` | Cấu hình mặc định 6 khu vực (tên cây, phương pháp tưới, ngưỡng, lưu lượng) — chỉ dùng để seed, DB là nguồn cấu hình thật. |
| `mqtt-gateway.ts` | Kết nối Mosquitto: subscribe topic status, publish lệnh điều khiển, broadcast dữ liệu cho các listener. |
| `telemetry-repository.ts` | Lưu/truy vấn telemetry (transaction 1 sample + 6 zone), gộp mẫu theo bucket cho chart, tính lượt tưới từ trạng thái bơm, log lệnh, dọn dữ liệu theo retention. |
| `zone-settings-repository.ts` | Đọc/ghi ngưỡng tưới từng khu vực, derive ngưỡng dừng (`threshold + 20`), ghi lịch sử thay đổi. |
| `zone-profile-repository.ts` | Đọc/ghi hồ sơ cây của từng khu (tên, nhóm, ngày trồng, ghi chú, ảnh). |
| `zone-advice.ts` | Gợi ý ngưỡng tưới theo nhóm cây, loại đất, mưa, nhiệt độ và mùa — chỉ để tham khảo, không tự đổi cấu hình. |
| `alerts.ts` | Phát hiện bất thường từ telemetry (khô kéo dài, bồn cạn, mưa…) và cảnh báo thiết bị online/offline. |
| `push.ts` | Gửi thông báo qua Expo Push tới các token đã đăng ký. |
| `push-repository.ts` | Đọc/ghi/xoá token thiết bị trong bảng `push_tokens`. |
| `garden-settings-repository.ts` | Lưu loại đất và ngưỡng mưa chung của khu vườn; kiểm tra khoảng hợp lệ. |
| `uploads.ts` | Nhận ảnh khu vườn (giới hạn dung lượng/định dạng) và phục vụ qua `/uploads`. |

## REST API

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/health` | Trạng thái server: `mqtt`, `database`, số thiết bị online, số client realtime. |
| GET | `/api/config` | Cấu hình hệ thống + ngưỡng 6 khu (lấy từ DB) + object `limits` chứa mọi khoảng hợp lệ để frontend kiểm tra trước khi gửi. |
| GET | `/api/devices/:deviceId/config` | Cấu hình theo thiết bị (ngưỡng, lưu lượng, mục tiêu nước, loại đất, ngưỡng mưa). |
| GET | `/api/devices/:deviceId/config/changes?limit=` | Lịch sử thay đổi ngưỡng. |
| GET | `/api/devices/:deviceId/config/advice` | Gợi ý ngưỡng tưới cho cả 6 khu (chỉ tham khảo). |
| GET | `/api/devices/:deviceId/config/zones/:zoneId/advice` | Gợi ý ngưỡng cho một khu. |
| PUT | `/api/devices/:deviceId/config/zones/:zoneId` | Lưu ngưỡng và thông số tưới (body bên dưới). |
| PUT | `/api/devices/:deviceId/config/soil` | Đổi loại đất chung của khu vườn (body `{ "soil": "Đất cát" }`). |
| PUT | `/api/devices/:deviceId/config/rain` | Đổi ngưỡng mưa (body `{ "threshold": 80 }`, 40–100). Đồng bộ xuống thiết bị qua MQTT. |
| GET | `/api/devices/:deviceId/telemetry/latest` | Snapshot telemetry mới nhất (404 nếu chưa có). |
| GET | `/api/devices/:deviceId/telemetry/history?from=&to=&zoneId=&limit=&bucketMs=` | Lịch sử telemetry; `limit` là số điểm **mỗi zone** (tối đa 10000), `bucketMs` gộp mẫu để chart nhẹ hơn. |
| GET | `/api/devices/:deviceId/watering` | Lượt tưới gần nhất và tổng nước hôm nay của từng khu. |
| GET | `/api/devices/:deviceId/commands?limit=` | Nhật ký lệnh (mặc định 50, tối đa 500). |
| POST | `/api/devices/:deviceId/commands` | Gửi lệnh điều khiển (xem bên dưới). |
| WS | `/realtime` | Push telemetry và trạng thái thiết bị theo thời gian thực. |

### Ví dụ gọi API

Đổi ngưỡng khu T001 về 55%:

```powershell
curl -X PUT http://localhost:3001/api/devices/esp32-garden-01/config/zones/T001 `
  -H "Content-Type: application/json" -d '{"threshold":55}'
```

Bật bơm khu T002 (chế độ thủ công):

```powershell
curl -X POST http://localhost:3001/api/devices/esp32-garden-01/commands `
  -H "Content-Type: application/json" -d '{"action":"PUMP_ON","zoneId":"T002"}'
```

Xem lịch sử 24h của khu T001:

```powershell
curl "http://localhost:3001/api/devices/esp32-garden-01/telemetry/history?zoneId=T001"
```

### Các lệnh hỗ trợ

| Body gửi lên | Lệnh MQTT sinh ra |
|---|---|
| `{"action":"SET_THRESHOLD","zoneId":"T001","value":55}` | `SET_THRESHOLD_T001_55` (tự clamp 10–90) |
| `{"action":"PUMP_ON","zoneId":"T002"}` | `PUMP_ON_T002` — chỉ khi thiết bị ở `manual`, nếu không trả `409`. |
| `{"action":"PUMP_OFF","zoneId":"T002"}` | `PUMP_OFF_T002` — chỉ khi thiết bị ở `manual`, nếu không trả `409`. |
| `{"action":"MODE_AUTO"}` | `MODE_AUTO` |
| `{"action":"MODE_MANUAL"}` | `MODE_MANUAL` |
| `{"action":"WEATHER_GATE_ON"}` / `OFF` | `WEATHER_GATE_ON` / `OFF` |
| `{"action":"PUMP_ON"}` (không zone) | `PUMP_ON` — chỉ khi đang ở chế độ manual, nếu không trả `409`. |

Lệnh gửi thành công trả `202` kèm `commandId`; trạng thái chuyển `confirmed` khi telemetry tiếp theo cho thấy lệnh đã có hiệu lực, hoặc `timeout` nếu thiết bị không phản hồi.

### Cấu hình khu vực

`PUT /api/devices/:deviceId/config/zones/:zoneId` nhận một hoặc nhiều trường:

| Trường | Kiểu / khoảng | Ghi chú |
|---|---|---|
| `threshold` | số, tự clamp 10–90 | Ngưỡng bắt đầu tưới; ngưỡng dừng = `threshold + 20`. |
| `flowLitersPerHour` | **số nguyên** 1–200 | Firmware đọc bằng `%d` nên backend từ chối số lẻ. |
| `targetLiters` | số 0.1–20 | Lượng nước mỗi lần tưới. |
| `name`, `crop`, `group`, `plantedAt`, `harvestDays`, `notes` | hồ sơ cây | Dùng cho gợi ý tưới, không ảnh hưởng logic bơm. |

- Thời gian chạy được tính `target / flow * 3600` giây và phải nằm trong **10–600 giây** (firmware dừng bơm tối đa 10 phút). Cấu hình sai trả `400` **trước khi** ghi DB.
- Lưu thành công nghĩa là đã ghi PostgreSQL; lưu lượng và mục tiêu nước chỉ được đánh dấu đã đồng bộ (`targetSynced`) khi publish MQTT thành công.

## Định dạng telemetry (MQTT)

Thiết bị publish JSON lên `smart-irrigation/status`; backend validate nghiêm ngặt:

```json
{
  "deviceId": "esp32-garden-01",
  "mode": "auto",
  "temperature": 28.5,
  "humidity": 62,
  "rain": 12,
  "raining": false,
  "weatherGate": true,
  "pump": false,
  "zones": [
    { "id": "T001", "moisture": 48, "threshold": 55, "stopThreshold": 75, "pump": false, "targetSeconds": 60 },
    { "id": "T002", "moisture": 51, "threshold": 55, "stopThreshold": 75, "pump": false, "targetSeconds": 90 }
  ]
}
```

- Phải đủ **cả 6 khu** `T001`–`T006`, không trùng, không thừa.
- `temperature`/`humidity` được phép `null` khi DHT22 đọc lỗi (không bị biến thành 0).
- `moisture`, `threshold`, `stopThreshold` nằm trong 0–100; `rain` trong 0–100.
- `targetSeconds` (tùy chọn, 0–3600) là thời gian tưới mục tiêu; backend dùng để xác nhận lệnh `SET_TARGET_*`.

## WebSocket `/realtime`

Server push các message dạng JSON:

| `type` | Nội dung |
|---|---|
| `telemetry` | `{ type, data: <telemetry>, online }` — mỗi telemetry mới. |
| `device-status` | `{ type, deviceId, online }` — khi thiết bị online/offline. |
| `command-result` | `{ type, commandId, deviceId, status }` — lệnh được xác nhận. |

Client mới kết nối sẽ nhận ngay snapshot telemetry + trạng thái của tất cả thiết bị. Server ping mỗi 30 giây và tự ngắt client không phản hồi.

## Database

Dùng PostgreSQL qua driver `pg` (pool tối đa 10 kết nối, cấu hình bằng `DATABASE_URL`).
Database và bảng phải tồn tại trước (`CREATE DATABASE smart_irrigation;`); schema tự tạo khi khởi động.

- Khóa chính dạng `BIGINT GENERATED BY DEFAULT AS IDENTITY`, timestamp lưu dạng `BIGINT` (epoch ms) như SQLite cũ.
- Index theo `(device_id, recorded_at)`, `(device_id, zone_id, recorded_at)` cho truy vấn lịch sử, và index `sample_id` cho JOIN/cascade xóa.
- Mỗi lần ghi telemetry chạy trong một transaction (1 sample + 6 zone samples + cập nhật lượt tưới).
- Script `scripts/copy-sqlite-to-postgres.mjs` chép dữ liệu từ file SQLite cũ (`DB_PATH`) sang Postgres. Bảng có khóa tự nhiên (như `zone_settings`, `latest_telemetry`) được upsert theo khóa; bảng chỉ có `id` tự tăng phải trống, nếu không script dừng để tránh trùng id.
- Với Neon: dán connection string có `-pooler` vào `DATABASE_URL`, đặt `DATABASE_SSL=true`; database `neondb` có sẵn nên không cần `CREATE DATABASE`.

Các bảng:

| Bảng | Nội dung |
|---|---|
| `latest_telemetry` | Snapshot JSON mới nhất mỗi thiết bị, khôi phục lại sau restart. |
| `telemetry_samples` | Mỗi mẫu lịch sử: mode, nhiệt độ, độ ẩm, mưa, đang mưa. |
| `telemetry_zone_samples` | Trạng thái 6 khu của từng mẫu (khóa ngoại tới `telemetry_samples`, xóa cascade). |
| `command_log` | Lệnh đã gửi và trạng thái `pending/confirmed/timeout`. |
| `zone_settings` | Ngưỡng, ngưỡng dừng, lưu lượng, mục tiêu nước — nguồn cấu hình thật, ưu tiên hơn `garden-config.ts`. |
| `zone_profiles` | Hồ sơ cây từng khu: tên, mô tả, nhóm, ngày trồng, số ngày thu hoạch, ghi chú, ảnh. |
| `garden_settings` | Loại đất và ngưỡng mưa dùng chung cho cả khu vườn. |
| `zone_setting_changes` | Lịch sử đổi ngưỡng (giá trị cũ → mới, thời gian). |
| `watering_runs` | Từng lượt bơm: thời điểm bắt đầu/kết thúc, số giây, số lít, lưu lượng lúc chạy. |

Dữ liệu cũ hơn `DB_RETENTION_DAYS` (mặc định 30 ngày) được dọn tự động mỗi ngày
— gồm `telemetry_samples` (cascade xóa zone samples), `command_log`,
`zone_setting_changes` và `watering_runs`.

## Lượt tưới và lượng nước

- Mỗi lần bơm bật, backend mở một dòng `watering_runs`; các mẫu tiếp theo chỉ cập nhật `last_seen_at`.
- Khi bơm tắt, run được đóng ở điểm giữa hai mẫu (nếu hai mẫu sát nhau) để không cộng dư nước.
- Lượng nước = `giây × lưu lượng lúc bắt đầu / 3600`; lưu lượng được chốt lúc mở run nên đổi cấu hình giữa chừng không làm sai số cũ.
- Run đang mở được trả về dạng tạm tính ở `GET /watering`; run không cập nhật quá 15 phút bị coi là bỏ dở và không hiển thị.
- Lịch sử tưới cũ được dựng lại một lần từ telemetry đã lưu (`backfillWateringRuns`, 24 giờ gần nhất).

## Ngưỡng tưới bền vững

- Khi đổi ngưỡng từ Web (`SET_THRESHOLD`), backend lưu ngay vào PostgreSQL.
- `GET /api/config` trả ngưỡng từ DB, nên restart backend không mất cấu hình.
- Khi telemetry báo ngưỡng khác DB (ví dụ ESP32 vừa reboot), backend tự gửi lại
  `SET_THRESHOLD` (cooldown 10 giây/zone).
- Firmware cũng lưu ngưỡng vào NVS (`Preferences`) nên tự nhớ sau khi reboot.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| `/api/health` trả `503`, `mqtt: false` | Mosquitto chưa chạy hoặc sai `MQTT_URL`. Bật broker rồi thử lại. |
| Web báo không kết nối realtime | Sai `NEXT_PUBLIC_BACKEND_URL` ở Web, hoặc backend chưa chạy cổng 3001. |
| `409 Pump control requires manual mode` | Lệnh bật/tắt bơm (toàn vườn hoặc từng khu) chỉ hợp lệ khi thiết bị ở chế độ `manual`. |
| `400 ... must produce a run time between 10 and 600 seconds` | `targetLiters` quá lớn so với `flowLitersPerHour`; hạ lượng nước hoặc tăng lưu lượng. Backend từ chối trước khi ghi DB. |
| `400 flowLitersPerHour must be an integer` | Firmware đọc lưu lượng bằng `%d`, nên Web/Mobile chỉ được gửi số nguyên. |
| `400 Telemetry must include every zone` | Firmware gửi thiếu khu — phải đủ `T001`–`T006`. |
| `/api/health` trả `503`, `database.ok: false` | PostgreSQL chưa chạy, sai `DATABASE_URL`, hoặc chưa tạo database `smart_irrigation`. |
| `ECONNREFUSED 127.0.0.1:5432` | Service PostgreSQL chưa bật; mở Services và start `postgresql-x64-*`. |
| Telemetry không vào history | Xem log backend: retained message không được ghi history, và tần suất ghi tối thiểu 10 giây/lần. |
