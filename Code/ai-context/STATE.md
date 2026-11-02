# STATE.md — trạng thái code hiện tại theo file

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

## Cap nhat yeu cau
- REQUIREMENTS.md da mo rong thanh bo chuc nang day du: do am, tu dong/thu cong, relay/bom, web monitoring, lich su, thoi tiet, phan tich dat, goi y cay va quy tac tuoi theo loai cay.

- COMPACT.md — reusable /compact workflow; model-agnostic token-budget guidance and repo script usage.
