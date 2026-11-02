# REQUIREMENTS.md — yêu cầu gốc & yêu cầu chức năng

> Chống "AI quên yêu cầu cũ". Giữ ≤ 80 dòng.
> Đánh dấu `DONE:` khi xong, chuyển xuống cuối. **Không xóa vĩnh viễn.**

## Yêu cầu gốc (không được quên)

- Dự án IoT môn học: **Smart Irrigation** — hệ thống tưới cây thông minh trên ESP32.
- Môi trường làm việc chính: **Wokwi simulator** (chưa có phần cứng thật).
- Toolchain: PlatformIO + AI coding (opencode).

## Chức năng bắt buộc (TODO)

| # | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | Tách `setup()`/`loop()` từ `wifi.cpp` sang `main.cpp` | TODO | `main.cpp` đang 0 byte |
| 2 | Đọc và cập nhật độ ẩm đất từ soil moisture sensor | TODO | Có thể mở rộng nhiều zone |
| 3 | Tự động bật bơm khi đất khô dưới ngưỡng cài đặt | TODO | Ngưỡng phải cấu hình được |
| 4 | Tự động tắt bơm khi đất đạt độ ẩm yêu cầu | TODO | Có hysteresis/chống bật tắt liên tục |
| 5 | Chuyển đổi chế độ Automatic/Manual | TODO | Manual cho phép người dùng điều khiển bơm |
| 6 | Thêm relay + water pump và cảm biến vào Wokwi | TODO | Cập nhật `diagram.json` và pinout |
| 7 | Web server/API đọc sensor và điều khiển bơm | TODO | Học theo `esp32-http-server.ino` |
| 8 | UI web hiển thị độ ẩm, bơm, mode, kết nối | TODO | UI chính ở `web/index.html` hoặc frontend Web |

## Chức năng mở rộng (ưu tiên sau chức năng bắt buộc)

| # | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| 9 | Biểu đồ lịch sử độ ẩm theo thời gian | TODO | Làm nếu còn thời gian triển khai |
| 10 | Nhật ký hoạt động tưới/bật tắt bơm | TODO | Làm nếu còn thời gian triển khai |
| 11 | Theo dõi trạng thái kết nối trên web | TODO | WiFi/Wokwi và thời điểm cập nhật cuối |
| 12 | Theo dõi thời tiết trước khi tưới | TODO | Mưa, nhiệt độ, độ ẩm không khí; cần nguồn dữ liệu |
| 13 | Phân tích tình hình đất theo khu vực | TODO | Độ ẩm và dữ liệu đất đang có |
| 14 | Đề xuất loại cây phù hợp với khu vực | TODO | Dựa trên đất, thời tiết và điều kiện môi trường |
| 15 | Tưới theo loại cây | TODO | Mỗi loại cây có ngưỡng, thời lượng và tần suất riêng |
| 16 | Đề xuất cách tưới phù hợp | TODO | Tưới nhỏ giọt/phun, thời điểm và lượng nước |
| 17 | Không tưới khi dự báo có mưa | TODO | Cần quy tắc an toàn và cho phép người dùng override |

## Quy tắc nghiệp vụ cần giữ

- Chế độ Automatic ưu tiên ngưỡng theo từng loại cây/zone; không dùng một ngưỡng chung nếu đã phân vùng.
- Trước khi bật bơm, kiểm tra thời tiết khi dữ liệu khả dụng; nếu mưa thì trì hoãn và ghi nhật ký.
- Chế độ Manual cho phép người dùng bật/tắt nhưng vẫn hiển thị cảnh báo và trạng thái an toàn.
- Mất kết nối web không được làm mất logic tự động cục bộ trên ESP32.
- Mọi lần bật/tắt bơm và thay đổi mode/ngưỡng cần có trạng thái rõ ràng trên web.

## Yêu cầu cũ đã xử lý

- `DONE:` Xác nhận nối WiFi Wokwi-GUEST thành công, in IP + RSSI ra Serial.
- `DONE:` Import project tham khảo `esp32-http-server-main` để làm mẫu WebServer + Wokwi forward.

## Yêu cầu bị huỷ / thay đổi

- *(ghi lại để AI không "hồi sinh" yêu cầu đã bỏ)*
