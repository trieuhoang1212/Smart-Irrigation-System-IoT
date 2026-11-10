# BÁO CÁO TỔNG KẾT NÂNG CẤP VÀ TỐI ƯU BẢO MẬT HỆ THỐNG
**Dự án:** Smart Irrigation System (Hệ thống giám sát và tưới tự động IoT)  
**Thời gian thực hiện:** 09/11/2026  
**Trạng thái:** Hoàn thành toàn diện 100% các yêu cầu  

---

## 1. Kết quả kiểm tra hiện trạng ban đầu (Trước khi nâng cấp)

Qua việc rà soát toàn bộ dự án từ firmware ESP32, backend Node.js, frontend Web/Mobile đến cấu hình môi trường, ghi nhận các điểm thiếu sót ban đầu:

| Hạng mục | Trạng thái ban đầu | Nhận xét chi tiết |
|---|---|---|
| **Mosquitto Broker** | ❌ Chưa có | Hoàn toàn chưa có tệp cấu hình `mosquitto.conf`, chưa tắt anonymous, chưa có file mật khẩu và chưa bind `127.0.0.1`. |
| **Backend MQTT Auth** | ❌ Chưa có | `config.ts` và `.env.example` chưa có `MQTT_USERNAME` / `MQTT_PASSWORD`. `mqtt-gateway.ts` chỉ kết nối ẩn danh. |
| **Firmware Wokwi Auth** | ❌ Chưa có | `main.cpp` kết nối anonymous qua `client.connect(clientId.c_str())`, không có mật khẩu hay hướng dẫn fallback. |
| **Input Validation API** | ⚠️ Sơ sài | Chỉ kiểm tra kiểu sơ khai; `threshold` bị clamp âm thầm thay vì trả lỗi khi sai phạm vi; `limit`, `bucketMs`, `from/to` không kiểm tra số nguyên hoặc kiểu dữ liệu. |
| **Rate Limiting** | ❌ Chưa có | Không có cơ chế giới hạn tần suất gọi API, có nguy cơ bị spam lệnh làm cháy rơ-le hoặc tràn cơ sở dữ liệu. |
| **Chống rò rỉ Stack/SQL** | ⚠️ Một phần | Handler lỗi có trả về JSON nhưng chưa bao quát các ngoại lệ sâu hoặc lỗi cú pháp; chưa chuẩn hóa mã lỗi. |
| **CORS & Security Headers**| ⚠️ Thiếu sót | Có `cors({ origin })` cơ bản nhưng thiếu hoàn toàn các Security Headers (`nosniff`, `DENY` framing, CSP, Referrer). |
| **WebSocket Origin** | ❌ Chưa có | `WebSocketServer` mở tự do cho mọi domain kết nối, có nguy cơ bị Cross-Site WebSocket Hijacking (CSWSH). |
| **Hệ thống .gitignore** | ❌ Thiếu hụt | Không có `.gitignore` ở thư mục gốc và thư mục Backend/Web; nguy cơ cao vô tình commit file `.env`, CSDL SQLite `smart-irrigation.db` và mật khẩu vào Git. |
| **docs/SECURITY.md** | ❌ Chưa có | Chưa có thư mục `docs/` và tài liệu mô tả mô hình đe dọa, checklist bảo mật và phạm vi hệ thống. |

---

## 2. Chi tiết các nội dung đã thêm và nâng cấp trong dự án

### 2.1. Mosquitto Broker & Xác thực MQTT
1. **Tạo cấu hình Mosquitto chuẩn (`mosquitto/mosquitto.conf`)**:
   - `listener 1883 127.0.0.1`: Ràng buộc broker chỉ lắng nghe trên giao diện cục bộ (localhost), ngăn các thiết bị lạ trong mạng LAN quét cổng hoặc truy cập trực tiếp.
   - `allow_anonymous false`: Vô hiệu hóa kết nối ẩn danh.
   - `password_file mosquitto/password.txt`: Yêu cầu xác thực tài khoản qua file mật khẩu mã hóa PBKDF2.
2. **Tạo file mẫu và tài liệu hướng dẫn (`mosquitto/password.example`, `mosquitto/README.md`)**:
   - Cung cấp sẵn tài khoản mẫu: `garden_backend` (cho Backend) và `esp32_device` (cho Firmware).
   - Hướng dẫn chi tiết cách tạo mật khẩu bằng lệnh `mosquitto_passwd` và cách khởi chạy.
3. **Cập nhật Backend (`Code/Backend`)**:
   - Thêm `MQTT_USERNAME` và `MQTT_PASSWORD` vào `src/config.ts` và `.env.example`.
   - Cập nhật `src/mqtt-gateway.ts` tự động gửi thông tin xác thực khi kết nối vào Mosquitto.
4. **Cập nhật Firmware Wokwi ESP32 (`Wokwi/Smart-Irrigation/src/main.cpp`)**:
   - Khai báo tài khoản `mqtt_user` và `mqtt_password`.
   - Tích hợp cờ `USE_MQTT_AUTH` và hàm `reconnectMQTT()` gửi credentials.
   - **Ghi chú Fallback cho Wokwi**: Nếu mô phỏng qua cổng mạng ảo Wokwi Gateway gặp sự cố không thể xác thực với Mosquitto, người dùng có thể đổi cờ `USE_MQTT_AUTH = false` để demo tạm ở chế độ anonymous một cách dễ dàng.

---

### 2.2. Kiểm tra dữ liệu đầu vào toàn diện (API Input Validation)
Tạo mới module `Code/Backend/src/validation.ts` và áp dụng vào tất cả các route của `Code/Backend/src/server.ts`:
- **`threshold`**: Bắt buộc là số nguyên trong khoảng `[10, 90]`. Trả về mã lỗi HTTP 400 nếu nằm ngoài phạm vi hoặc sai kiểu.
- **`limit`**: Bắt buộc là số nguyên dương hợp lệ (giới hạn từ 1 đến 500 đối với nhật ký lệnh/thay đổi cấu hình; từ 1 đến 10000 đối với lịch sử dữ liệu).
- **`bucketMs`**: Bắt buộc là số nguyên >= 1000 ms (tối đa 24 giờ).
- **`from` & `to`**: Kiểm tra timestamp hợp lệ và bắt buộc thỏa mãn điều kiện logic `from < to`.
- **`zoneId`**: Kiểm tra nghiêm ngặt chỉ chấp nhận các mã luống hợp lệ (`T001` đến `T006`).
- **`POST /commands`**: Kiểm tra tính hợp lệ của action, giá trị tham số đi kèm và chế độ hoạt động (chặn lệnh bật bơm toàn vườn khi đang ở chế độ tự động `auto`).

---

### 2.3. Tích hợp Rate Limiting (Giới hạn tần suất)
Tạo module `Code/Backend/src/rate-limiter.ts` thuần TypeScript (zero external dependencies):
- Sử dụng thuật toán trượt thời gian (Sliding Window) theo IP máy trạm (`X-Forwarded-For` / `req.ip`).
- Áp dụng trực tiếp vào 2 endpoint tác động trực tiếp tới phần cứng và CSDL:
  - `POST /api/devices/:deviceId/commands`: Tối đa **30 requests / phút / IP**.
  - `PUT /api/devices/:deviceId/config/zones/:zoneId`: Tối đa **30 requests / phút / IP**.
- Tự động phản hồi mã HTTP `429 Too Many Requests` kèm theo các header chuẩn: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
- Cơ chế tự dọn dẹp bộ nhớ (garbage collection) định kỳ chống rò rỉ RAM.

---

### 2.4. Triệt tiêu rò rỉ thông tin nội bộ (Zero Stack / SQL Leakage)
- Đảm bảo 100% các câu truy vấn cơ sở dữ liệu trong `db.ts`, `telemetry-repository.ts`, `zone-settings-repository.ts` đều sử dụng Prepared Statements có tham số hóa (`?` và `:param`), loại bỏ triệt để nguy cơ SQL Injection.
- Cập nhật middleware xử lý lỗi toàn cục trong Express 5: Bắt mọi lỗi ngoại lệ bất thường, chỉ ghi log chi tiết phía console máy chủ, phản hồi client với thông báo JSON chuẩn hóa (`Invalid request format or JSON body` hoặc `Internal server error`), tuyệt đối không gửi stack trace, tên bảng, cấu trúc CSDL hay thông tin file hệ thống ra bên ngoài.

---

### 2.5. CORS, Security Headers & Bảo vệ WebSocket
- **CORS**: Ràng buộc chặt chẽ với biến `WEB_ORIGIN`, chỉ định rõ ràng các HTTP methods (`GET`, `POST`, `PUT`, `OPTIONS`) và headers được phép.
- **Security Headers cơ bản**: Bổ sung bộ header phòng vệ:
  - `X-Content-Type-Options: nosniff`: Ngăn chặn trình duyệt đoán sai kiểu file.
  - `X-Frame-Options: DENY`: Chống tấn công Clickjacking.
  - `Referrer-Policy: no-referrer`: Bảo vệ thông tin điều hướng URL.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Khóa các quyền phần cứng trình duyệt không cần thiết.
  - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`: Chính sách bảo mật nội dung chặt chẽ.
- **Bảo vệ WebSocket chống CSWSH (Cross-Site WebSocket Hijacking)**:
  - Tích hợp hook `verifyClient` trong `WebSocketServer` tại đường dẫn `/realtime`.
  - Kiểm tra header `Origin` của mọi kết nối từ trình duyệt: Nếu không khớp với `WEB_ORIGIN`, kết nối sẽ bị từ chối ngay lập tức với mã HTTP `403 Forbidden`.
  - Vẫn cho phép các ứng dụng native (Mobile App, curl, script backend) kết nối bình thường khi không có header Origin.

---

### 2.6. Hoàn thiện chính sách loại trừ tệp nhạy cảm (.gitignore)
- **Tạo `.gitignore` tại thư mục gốc**:
  - Chặn toàn bộ các file biến môi trường: `.env`, `.env.local`, `.env.*.local` (chỉ cho phép `.env.example`).
  - Chặn các file cơ sở dữ liệu SQLite: `*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`, `data/*.db`.
  - Chặn file mật khẩu Mosquitto: `mosquitto/password.txt`, `mosquitto/data/`.
  - Chặn thư mục phụ thuộc và file build: `node_modules/`, `dist/`, `.next/`, `.pio/`, build caches.
- **Bổ sung `.gitignore` cho `Code/Backend` và `Code/Frontend/Web`** nhằm đảm bảo an toàn khi làm việc độc lập trong từng thư mục con.
- **Cập nhật `.gitignore` cho `Code/Frontend/Mobile`** để chặn file `.env`.

---

### 2.7. Tài liệu bảo mật `docs/SECURITY.md`
Tạo mới file `docs/SECURITY.md` trình bày chuyên nghiệp và đầy đủ:
1. **Mô hình đe dọa trong mạng LAN (LAN Threat Model)**: Phân tích bề mặt tấn công của Mosquitto broker, REST API, WebSocket realtime và SQLite.
2. **Checklist bảo mật**: Bảng danh mục các giải pháp bảo vệ đã được kích hoạt.
3. **Phạm vi ngoài lề (Out of Scope)**: Nêu rõ hệ thống chưa bao gồm xác thực tài khoản người dùng (User Login/JWT), phân quyền (RBAC), và triển khai chứng chỉ public TLS/HTTPS.
4. **Khuyến nghị nâng cấp tương lai**: Lộ trình bảo mật cho môi trường sản xuất thực tế.

---

## 3. Danh mục các tệp tin đã tác động

| Tệp tin | Hành động | Nội dung thực hiện |
|---|:---:|---|
| `mosquitto/mosquitto.conf` | **Tạo mới** | Cấu hình Mosquitto: `allow_anonymous false`, password file, bind `127.0.0.1`. |
| `mosquitto/password.example` | **Tạo mới** | File mật khẩu mẫu với hash PBKDF2 cho `garden_backend` và `esp32_device`. |
| `mosquitto/README.md` | **Tạo mới** | Hướng dẫn sử dụng `mosquitto_passwd`, khởi chạy broker và xử lý sự cố. |
| `Code/Backend/src/config.ts` | **Cập nhật** | Thêm cấu hình đọc `MQTT_USERNAME` và `MQTT_PASSWORD` từ môi trường. |
| `Code/Backend/.env.example` | **Cập nhật** | Thêm mẫu `MQTT_USERNAME` và `MQTT_PASSWORD`. |
| `Code/Backend/src/mqtt-gateway.ts` | **Cập nhật** | Truyền username/password vào options kết nối MQTT client. |
| `Code/Backend/src/rate-limiter.ts` | **Tạo mới** | Module Rate Limiting sliding-window thuần TypeScript không phụ thuộc gói ngoài. |
| `Code/Backend/src/validation.ts` | **Tạo mới** | Module kiểm tra và validate toàn bộ đầu vào (`threshold`, `limit`, `bucketMs`, `from/to`, `zoneId`). |
| `Code/Backend/src/server.ts` | **Cập nhật** | Tích hợp Rate Limiting, validation trên mọi route, security headers, CORS chặt chẽ, WebSocket Origin check, triệt tiêu leak stack/SQL. |
| `Code/Backend/README.md` | **Cập nhật** | Bổ sung tài liệu về tính năng bảo mật, endpoint rate limits và MQTT credentials. |
| `Wokwi/Smart-Irrigation/src/main.cpp` | **Cập nhật** | Khai báo tài khoản MQTT, kết nối có mật khẩu, cờ `USE_MQTT_AUTH` và hướng dẫn fallback Wokwi. |
| `.gitignore` (Root) | **Tạo mới** | Bỏ qua `.env`, `data/*.db`, `mosquitto/password.txt`, build outputs, cache. |
| `Code/Backend/.gitignore` | **Tạo mới** | Bỏ qua file môi trường, CSDL và build của backend. |
| `Code/Frontend/Web/.gitignore` | **Tạo mới** | Bỏ qua dependencies, build `.next` và môi trường web. |
| `Code/Frontend/Mobile/.gitignore` | **Cập nhật** | Bổ sung loại trừ `.env`. |
| `docs/SECURITY.md` | **Tạo mới** | Tài liệu mô hình đe dọa LAN, checklist bảo mật, phạm vi ngoài lề và khuyến nghị. |
| `REPORT_SECURITY_IMPROVEMENTS.md` | **Tạo mới** | Báo cáo chi tiết toàn bộ quá trình nâng cấp hệ thống. |

---

## 4. Những gì hệ thống đã làm được sau nâng cấp

1. **Kháng nghe trộm & giả mạo trong LAN**: Các thiết bị lạ hoặc client không có tài khoản trên mạng LAN không thể tự ý kết nối vào Mosquitto để đọc telemetry hay gửi lệnh điều khiển phần cứng.
2. **Kháng phá hoại phần cứng & Spam request**: Kẻ xấu không thể gửi hàng trăm request mỗi giây để kích hoạt rơ-le hoặc van nước, nhờ có bộ giới hạn tần suất 30 req/phút trên từng IP.
3. **Ngăn chặn triệt để dữ liệu bất thường (Invalid Data)**: Mọi giá trị tham số gửi lên API đều được kiểm tra nghiêm ngặt; loại bỏ hoàn toàn các lỗi tràn số, số âm hoặc định dạng rác có thể làm treo backend hoặc firmware.
4. **Bảo vệ người dùng trình duyệt (CSWSH & Clickjacking)**: Trang web độc hại không thể âm thầm kết nối WebSocket tới backend của người dùng để nghe lén telemetry.
5. **Không để lộ lỗ hổng máy chủ**: Mọi lỗi xảy ra chỉ được ghi nội bộ ở log server; phản hồi trả về client hoàn toàn sạch sẽ, không có stack trace hay câu truy vấn CSDL.
6. **Bảo vệ mã nguồn an toàn tuyệt đối**: File cơ sở dữ liệu SQLite chứa dữ liệu thật và các file bí mật `.env`, mật khẩu không bao giờ bị đưa lên kho lưu trữ mã nguồn Git.

---

## 5. Những việc nên cập nhật tiếp theo (Khuyến nghị cho giai đoạn sau)

Khi dự án chuyển từ môi trường thử nghiệm/nội bộ sang triển khai vận hành thực tế tại nông trại hoặc điều khiển từ xa qua Internet:

1. **Mã hóa TLS trên đường truyền (MQTTS & HTTPS)**:
   - Cấu hình Mosquitto chạy trên cổng 8883 có mã hóa TLS (hoặc mutual TLS x509 certs) để bảo vệ toàn diện dữ liệu truyền qua sóng Wi-Fi.
   - Sử dụng Reverse Proxy (như Nginx hoặc Caddy) để tự động cấp phát chứng chỉ HTTPS Let's Encrypt cho Backend API và Web Dashboard.
2. **Hệ thống Đăng nhập & Xác thực người dùng (User Authentication)**:
   - Xây dựng màn hình đăng nhập trên Web Dashboard và Mobile App.
   - Sử dụng JWT (JSON Web Token) hoặc Session Cookie an toàn cho các API điều khiển.
3. **Phân quyền truy cập (RBAC)**:
   - Phân chia vai trò người dùng (ví dụ: `Admin` được chỉnh ngưỡng và điều khiển bơm; `Viewer` hoặc `Guest` chỉ được xem biểu đồ telemetry).
4. **Bảo mật vật lý & Firmware ESP32**:
   - Kích hoạt tính năng **NVS Encryption** trên ESP32 để mã hóa mật khẩu Wi-Fi và MQTT lưu trong chip.
   - Kích hoạt **Secure Boot V2** và **Flash Encryption** của chip ESP32 nhằm chống trích xuất mã nguồn khi có ai đó tiếp cận trực tiếp bo mạch phần cứng.
5. **Phân đoạn mạng (IoT Network Segmentation)**:
   - Cài đặt hệ thống trên một mạng Wi-Fi riêng biệt (VLAN IoT / Guest Network), tách biệt hoàn toàn với mạng máy tính làm việc và thiết bị cá nhân trong gia đình.

