# MEMORY.md — tri thức dài hạn

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

