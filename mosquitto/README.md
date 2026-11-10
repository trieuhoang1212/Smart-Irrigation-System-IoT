# Mosquitto Broker Setup & Security Guide

Thư mục này chứa cấu hình và hướng dẫn thiết lập Mosquitto MQTT Broker có bảo mật cho hệ thống Smart Irrigation System.

---

## 1. Cấu hình bảo mật

Tệp `mosquitto.conf` đã được thiết lập với các nguyên tắc bảo mật:
- **`listener 1883 127.0.0.1`**: Broker chỉ lắng nghe trên giao tiếp loopback `127.0.0.1`, ngăn các máy khác trong mạng LAN truy cập trái phép.
- **`allow_anonymous false`**: Bắt buộc mọi kết nối (ESP32 và Backend) phải có tài khoản xác thực hợp lệ.
- **`password_file mosquitto/password.txt`**: Tệp lưu trữ tài khoản và mật khẩu đã được mã hóa PBKDF2/SHA512.

---

## 2. Tạo tài khoản xác thực (`password.txt`)

Mosquitto sử dụng công cụ dòng lệnh `mosquitto_passwd` đi kèm khi cài đặt Mosquitto.

### Cách 1: Tự tạo bằng lệnh `mosquitto_passwd`

1. Tạo tệp mật khẩu mới và thêm tài khoản Backend:
   ```bash
   mosquitto_passwd -c password.txt garden_backend
   ```
   Nhập mật khẩu (ví dụ: `backend_secret_123`).

2. Thêm tiếp tài khoản cho ESP32 / Wokwi Firmware:
   ```bash
   mosquitto_passwd -b password.txt esp32_device esp32_secret_123
   ```

### Cách 2: Sử dụng mẫu nhanh cho môi trường phát triển cục bộ

Bạn có thể sao chép nhanh từ `password.example` thành `password.txt`:
```powershell
Copy-Item password.example password.txt
```
*(Tệp `password.txt` đã nằm trong `.gitignore` để không bị đẩy lên Git)*

---

## 3. Khởi chạy Mosquitto

Di chuyển vào thư mục `mosquitto/` và chạy lệnh:
```bash
mosquitto -c mosquitto.conf -v
```

Tham số `-v` (verbose) giúp bạn quan sát log kết nối, subscribe và publish của ESP32 cũng như Backend.

---

## 4. Ghi chú kết nối ESP32 / Wokwi Simulator

1. **Khi chạy mô phỏng Wokwi:**
   - Wokwi sử dụng địa chỉ `host.wokwi.internal` để kết nối vào máy chủ local của bạn.
   - Firmware đã được cấu hình sẵn tài khoản `esp32_device` / `esp32_secret_123`.
   - **Lưu ý mạng ảo Wokwi:** Nếu Wokwi Bridge hoặc gateway mạng ảo của Wokwi không thể định tuyến vào loopback `127.0.0.1`, bạn có thể:
     - Đổi `listener 1883 127.0.0.1` thành `listener 1883 0.0.0.0` trong `mosquitto.conf`.
     - Hoặc nếu gặp sự cố xác thực trong mô phỏng, firmware có cờ `USE_MQTT_AUTH = false` để tạm thời demo ở chế độ anonymous (`allow_anonymous true`).

