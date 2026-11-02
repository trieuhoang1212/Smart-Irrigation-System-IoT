<!-- TU DONG SINH BOI ai-context/scripts/compact.ps1 - KHONG EDIT TAY -->

# RESUME.md - context compact dau moi phien

AI: doc het file nay truoc khi bat dau. Khong quet .pio/ hay .vscode/.
Can chi tiet hon? Mo file nguon tuong ung duoc link duoi day.

---

## [MEMORY.md]

> Giữ ≤ 120 dòng. Mục đích: AI không phạm lại lỗi cũ, không quên quyết định đã chốt.

## Quy ước project

- Board: `esp32dev`, framework `arduino`, toolchain **PlatformIO** (không dùng Arduino IDE).
- Chia file theo module: `wifi.cpp`, `main.cpp`, `sensor.cpp`, ... — **không** gom mọi thứ vào 1 file `.ino`.
- HTML để trong `web/`, không hardcode chuỗi HTML dài trong C++ (khác với demo tham khảo).
- Serial baud: `115200`.
- WiFi simulator: SSID `Wokwi-GUEST`, password `""`.

## Thư mục AI không được đọc (token vô nghĩa)

- `.pio/build/**` — object file hàng MB
- `.vscode/**` — settings sinh tự động
- `*.zip`
- `ai-context/archive/**`

## Lỗi đã gặp & cách fix

> (chưa có — ghi lại mỗi khi build fail để không phải debug lại từ đầu)

- *Chưa có bản ghi.*

## Quyết định đã chốt

| Ngày | Quyết định | Lý do |
|---|---|---|
| 2026-10-18 | Dùng PlatformIO thay Arduino IDE | Build CLI, dễ integrate CI/AI |
| 2026-10-18 | Bắt đầu từ `esp32-http-server-main` làm mẫu | Có WebServer + Wokwi forward sẵn |
| 2026-10-18 | Tạo folder `ai-context/` compact context | Tiết kiệm token mỗi phiên làm việc |

## Thư viện đang dùng

- `WiFi.h`, `WiFiClient.h`, `WebServer.h`, `uri/UriBraces.h` (Arduino-ESP32 builtin, không cần `lib_deps`)

## Pinout & Cấu hình phần cứng
- LED1: pin 26
- LED2: pin 27
- WiFi Simulator: SSID `Wokwi-GUEST`, password `""`

---

## [STATE.md]

> Giữ ≤ 100 dòng. Chỉ mô tả file thật sự tồn tại. Khi sửa file → cập nhật ngay.

## Smart-Irrigation/ (project chính)

| File | Dòng | Trạng thái | Ghi chú |
|---|---|---|---|
| `platformio.ini` | 4 | OK | env `esp32dev`, espressif32, arduino |
| `src/main.cpp` | 0 | **TRỐNG** | Chưa có nội dung — chưa có logic tưới cây |
| `src/wifi.cpp` | 34 | OK | Chứa cả `setup()` + `loop()` + `initWiFi()` |
| `web/index.html` | 0 | **TRỐNG** | Chưa có UI |
| `wokwi.toml` | - | OK | Wokwi simulator config |
| `diagram.json` | - | OK | Sơ đồ mạch Wokwi |

### Chi tiết `src/wifi.cpp`

- `const char* ssid = "Wokwi-GUEST"`, `password = ""`
- `initWiFi()`: `WIFI_STA`, retry 20 lần × 500ms, in IP + RSSI ra Serial
- `setup()`: `Serial.begin(115200)` → `initWiFi()`
- `loop()`: rỗng

### Việc phải làm tiếp

- [ ] Tách `setup()`/`loop()` ra `main.cpp`, `wifi.cpp` chỉ giữ hàm WiFi
- [ ] Thêm sensor soil moisture + relay pump
- [ ] Thêm `WebServer` route đọc giá trị + điều khiển tưới
- [ ] Đổ UI vào `web/index.html`

## esp32-http-server-main/ (project tham khảo — KHÔNG sửa)

| File | Dòng | Trạng thái | Ghi chú |
|---|---|---|---|
| `src/esp32-http-server.ino` | 109 | OK | Demo hoàn chỉnh, dùng làm mẫu |
| `platformio.ini` | 14 | OK | env `esp32` |
| `wokwi.toml` | - | OK | Forward `http://localhost:8180` |

### API mẫu từ file tham khảo

- `GET /` → trả HTML inline (2 LED buttons)
- `GET /toggle/{}` → `UriBraces`, `server.pathArg(0)` → 1 hoặc 2
- LED1 = pin **26**, LED2 = pin **27**
- `loop()` gọi `server.handleClient()` + `delay(2)`

## Cap nhat compact
- scripts/compact.ps1 gio gioi han RESUME 200 dong, chi rut gon changelog; context nguon qua dai se bao loi de tranh mat thong tin.

- COMPACT.md — reusable /compact workflow; model-agnostic token-budget guidance and repo script usage.

---

## [REQUIREMENTS.md]

> Chống "AI quên yêu cầu cũ". Giữ ≤ 80 dòng.
> Đánh dấu `DONE:` khi xong, chuyển xuống cuối. **Không xóa vĩnh viễn.**

## Yêu cầu gốc (không được quên)

- Dự án IoT môn học: **Smart Irrigation** — hệ thống tưới cây thông minh trên ESP32.
- Môi trường làm việc chính: **Wokwi simulator** (chưa có phần cứng thật).
- Toolchain: PlatformIO + AI coding (opencode).

## Yêu cầu đang mở (TODO)

| # | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Tách `setup()`/`loop()` từ `wifi.cpp` sang `main.cpp` | TODO | `main.cpp` đang 0 byte |
| 2 | Thêm web server đọc cảm biến + điều khiển tưới | TODO | Học theo `esp32-http-server.ino` |
| 3 | UI trong `web/index.html` | TODO | File đang trống |
| 4 | Hạ tầng cảm biến đất + bơm (Wokwi parts) | TODO | Cần sửa `diagram.json` |

## Yêu cầu cũ đã xử lý

- `DONE:` Xác nhận nối WiFi Wokwi-GUEST thành công, in IP + RSSI ra Serial.
- `DONE:` Import project tham khảo `esp32-http-server-main` để làm mẫu WebServer.

## Yêu cầu bị huỷ / thay đổi

- *(ghi lại để AI không "hồi sinh" yêu cầu đã bỏ)*

---

## [RULES.md]

> Đây là bộ luật cốt lõi (Core Guardrails) nhằm đảm bảo AI luôn tiết kiệm token, không bịa đặt và không phá vỡ logic dự án.

---

## 1. Ngưỡng an toàn chống phình Token (Safe Limits)

| File | Tối đa | Hành động khi vượt ngưỡng |
|---|---|---|
| `RESUME.md` | ≤ 200 dòng | Script tự động lọc bớt changelog cũ, nén các mục |
| `STATE.md` | ≤ 100 dòng | Chỉ giữ chi tiết các file đang active; file đã ổn định chỉ ghi 1 dòng tóm tắt |
| `MEMORY.md` | ≤ 120 dòng | Chuyển quyết định và ghi chú quá cũ sang `archive/memory-YYYYMM.md` |
| `REQUIREMENTS.md` | ≤ 80 dòng | Yêu cầu đã hoàn thành đánh dấu `DONE:` và dồn xuống cuối |
| `CHANGELOG.md` | ≤ 15 mục | Script tự động lưu trữ (archive) các mục cũ hơn vào `archive/` |

---

## 2. BLACKLIST VĨNH VIỄN — Tuyệt đối cấm AI tự ý xóa

Bất kỳ AI nào khi thực hiện compact hoặc refactor **KHÔNG ĐƯỢC PHÉP** xóa hay biến đổi các nội dung sau:

1. **Cấu hình nhạy cảm / Kết nối / Định danh**:
   - Biến môi trường (`.env`), secret key, token, connection string, credentials.
   - Địa chỉ IP, port mạng, SSID/password WiFi, chân pin phần cứng (GPIO).
2. **Ký hiệu mã nguồn hiện hữu**:
   - Tên biến, tên hàm, tên class, endpoint API mà user hoặc dự án đã định nghĩa.
   - Đường dẫn các file thực tế đang tồn tại trong `STATE.md`.
3. **Yêu cầu chưa hoàn thành**:
   - Mọi mục mang trạng thái `TODO` hoặc `Đang làm` trong `REQUIREMENTS.md`.
4. **Tri thức sự cố (Failure Knowledge Base)**:
   - Mục *Lỗi đã gặp & cách fix* trong `MEMORY.md` (xóa mục này chắc chắn AI sẽ tái phạm lỗi cũ).
5. **Định danh dự án & Nền tảng**:
   - Tên package/board, phiên bản runtime, platform, target device.

---

## 3. Quy tắc Anti-Over-Compact (Chống nén ẩu làm mất context)

- **Nguyên tắc tồn tại:** Không xóa bất kỳ thông tin nào chỉ vì "nó dài" — chỉ xóa khi thông tin đó **đã được thay thế** hoặc **không còn đúng với hiện trạng code**.
- **Kiểm tra trước khi xóa:** Trước khi gỡ bỏ dòng mô tả file trong `STATE.md`, phải kiểm tra chắc chắn file đó đã bị xóa khỏi repo.
- **Bảo toàn yêu cầu cũ:** Khi user nhắc lại một yêu cầu mà AI trước đó bỏ quên, bổ sung ngay lại vào `REQUIREMENTS.md`.
- **Nguyên tắc an toàn:** Trong trường hợp phân vân giữa giữ lại hay xóa bớt -> **BẮT BUỘC GIỮ LẠI**.

---

## 4. Quy chuẩn can thiệp Code (Code Intervention Rules)

- Không tự ý cài đặt thêm thư viện/package mới khi chưa xin ý kiến user.
- Giữ nguyên các chú thích (comments), docstring sẵn có trong code không liên quan đến thay đổi.
- Khi một file quá lớn (> 200 dòng), dùng search/grep trước, không đọc toàn bộ file vào ngữ cảnh nếu không cần thiết.

---

## [CHANGELOG - 1 muc moi nhat]

## [2026-10-19] Add reusable compact workflow
- Added `ai-context/COMPACT.md` with model-agnostic compaction steps and the repo command.

