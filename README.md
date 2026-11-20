<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:2E8B57,100:9CD68F&height=100&section=header" width="100%" alt="" />

<img src="images/favicon.svg" width="84" alt="Smart Irrigation System" />

# Smart Irrigation System

**Tưới cây tự động, tự chủ ngay tại thiết bị.**
ESP32 đọc cảm biến và quyết định tưới; Web Dashboard và Mobile App giám sát, cấu hình và điều khiển từ xa.

<br/>

[![ESP32](https://img.shields.io/badge/ESP32-DevKit_C_V4-E7352C?style=flat-square&logo=espressif&logoColor=white)](https://www.espressif.com/)
[![PlatformIO](https://img.shields.io/badge/PlatformIO-Firmware-F5822A?style=flat-square&logo=platformio&logoColor=white)](https://platformio.org/)
[![MQTT](https://img.shields.io/badge/MQTT-Mosquitto-3C5280?style=flat-square&logo=eclipsemosquitto&logoColor=white)](https://mosquitto.org/)
[![Node.js](https://img.shields.io/badge/Node.js_22-Backend-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-Web-000000?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Expo](https://img.shields.io/badge/Expo-Mobile-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FCM-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-Zone_photos-3448C5?style=flat-square&logo=cloudinary&logoColor=white)](https://cloudinary.com/)

<a href="#giao-diện">Giao diện</a> ·
<a href="#kiến-trúc">Kiến trúc</a> ·
<a href="#tính-năng">Tính năng</a> ·
<a href="#phần-cứng">Phần cứng</a> ·
<a href="#khởi-chạy">Khởi chạy</a> ·
<a href="#dịch-vụ-ngoài">Dịch vụ ngoài</a> ·
<a href="#triển-khai">Triển khai</a> ·
<a href="#nhóm-thực-hiện">Nhóm thực hiện</a> ·
<a href="#hạn-chế">Hạn chế</a> ·
<a href="#hướng-phát-triển">Hướng phát triển</a>

<br/>

| **06** khu vực | **2 giây** / mẫu | **Realtime** | **Offline-first** |
|:---:|:---:|:---:|:---:|
| T001 – T006 | MQTT + WebSocket | Tự động & thủ công | Mất mạng vẫn tưới |

</div>

---

## Giao diện

<div align="center">

**Web Dashboard**

<img src="images/web-light.png" alt="Web Dashboard - sáng" width="49%" /> <img src="images/web-dark.png" alt="Web Dashboard - tối" width="49%" />

<br/><br/>

**Mobile App**

<img src="images/mobile-light.png" alt="Mobile App - sáng" width="24%" /> <img src="images/mobile-dark.png" alt="Mobile App - tối" width="24%" />

</div>

---

## Kiến trúc

<div align="center">

```mermaid
flowchart LR
    ESP["ESP32 / Wokwi<br/>6 cảm biến · DHT22 · mưa<br/>relay · servo · LCD"]
    MQTT(["MQTT broker<br/>Mosquitto"])
    API["Backend<br/>Express · SQLite · WebSocket"]
    WEB["Web Dashboard<br/>Next.js"]
    APP["Mobile App<br/>Expo"]
    CLD[("Cloudinary<br/>ảnh khu vườn")]
    FCM["Firebase FCM<br/>Expo Push"]

    ESP <-->|"status / cmd"| MQTT
    MQTT <--> API
    API <-->|"REST + WS"| WEB
    API <-->|"REST + WS"| APP
    API -->|"upload ảnh"| CLD
    API -->|"thông báo đẩy"| FCM
    FCM -.-> APP
```

</div>

**Dữ liệu** — ESP32 đọc cảm biến mỗi 2 giây, publish retained; backend lưu SQLite và broadcast WebSocket tới Web/Mobile.

**Lệnh** — REST → MQTT → ESP32 thực thi → telemetry xác nhận; quá 12 giây không phản hồi thì lệnh chuyển `timeout`.

**Mất mạng** — vòng điều khiển cục bộ vẫn chạy theo ngưỡng lưu trong NVS; khi kết nối lại, retained telemetry cập nhật trạng thái mới nhất.

**Dịch vụ ngoài** — ảnh khu vườn lưu trên Cloudinary, thông báo đẩy đi qua Firebase FCM / Expo Push. Cả hai đều tùy chọn: thiếu cấu hình thì ảnh lưu local và push bị bỏ qua, phần còn lại vẫn chạy.

### Luồng lệnh

```mermaid
sequenceDiagram
    autonumber
    actor U as Người dùng
    participant W as Web / Mobile
    participant A as Backend
    participant M as MQTT
    participant E as ESP32

    U->>W: Đổi ngưỡng hoặc bật bơm
    W->>A: POST /api/devices/:id/commands
    A->>A: Lưu SQLite, đặt hạn 12 giây
    A->>M: SET_THRESHOLD_T001_51
    M->>E: chuyển tiếp xuống thiết bị
    E->>E: Ghi NVS và áp dụng ngay
    E->>M: telemetry retained
    M->>A: status topic
    A->>A: Đối chiếu giá trị
    A-->>W: WebSocket command-result
    Note over A,W: Khớp thì confirmed, quá 12 giây thì timeout
```

### Vòng điều khiển tại thiết bị

```mermaid
stateDiagram-v2
    direction TB
    [*] --> Auto
    state "Chờ · AUTO" as Auto
    state "Đang tưới" as Watering
    state "Nghỉ 2 phút" as Cooldown
    state "Hoãn do mưa" as RainHold
    state "Thủ công" as Manual

    Auto --> Watering: độ ẩm ≤ ngưỡng bật
    Watering --> Cooldown: đạt ngưỡng dừng hoặc quá 10 phút
    Cooldown --> Auto: hết 2 phút
    Auto --> RainHold: cảm biến mưa báo mưa
    RainHold --> Auto: tạm ngưng mưa
    Auto --> Manual: người dùng chuyển
    Manual --> Auto: hết 10 phút
    Manual --> Manual: đạt mục tiêu lít

    classDef watering fill:#E8F5E9,stroke:#2E8B57,stroke-width:2px,color:#1B5E20
    classDef idle fill:#F5F8F5,stroke:#9E9E9E,color:#37474F
    classDef hold fill:#FFF3E0,stroke:#EF6C00,color:#E65100
    class Watering watering
    class Auto,Cooldown idle
    class RainHold,Manual hold
```

---

## Tính năng

### Giám sát

- Độ ẩm 6 khu vực, nhiệt độ/độ ẩm không khí và tình trạng mưa theo thời gian thực.
- Mực nước bồn qua HC-SR04, trạng thái bơm, chế độ AUTO/MANUAL, online/offline.
- Biểu đồ lịch sử, nhật ký lệnh, lượng nước đã tưới và ước tính thời gian tới ngưỡng.

### Điều khiển

- Ngưỡng bật/dừng riêng từng khu vực, chỉnh từ Web và Mobile, đồng bộ lại khi thiết bị khởi động.
- Weather Gate tự hoãn tưới khi mưa, chặn bơm ở cả AUTO lẫn MANUAL.
- Bơm toàn hệ thống hoặc từng vùng; MANUAL đặt mục tiêu lít; nút vật lý dự phòng.

### An toàn

- Mất Internet vẫn tưới; tối đa 10 phút/vùng rồi nghỉ và tự tiếp tục khi đất chưa đủ ẩm.
- Tự thoát MANUAL sau 10 phút, chống chạy khô khi bồn cạn, cảnh báo bằng LCD và còi.

### Dữ liệu

- SQLite WAL, tự dọn dữ liệu cũ sau 30 ngày.
- Hồ sơ cây theo khu vực: tên, nhóm, ghi chú, ảnh (Cloudinary, hoặc lưu local nếu chưa cấu hình); gợi ý ngưỡng theo loại đất và nhóm cây.
- Thông báo đẩy tới điện thoại khi khu vực cần tưới hoặc có sự kiện bất thường.

---

## Phần cứng

<div align="center">
<img src="images/hardware.jpg" alt="Mô hình phần cứng ESP32" width="90%">
</div>

ESP32 DevKit C V4 · 6 cảm biến độ ẩm qua MUX 74HC4067 · DHT22 · cảm biến mưa · 6 relay · servo van tổng · 6 LCD 1602 I2C · HC-SR04 · LED, còi và 2 nút nhấn.

Chạy thật hoặc mô phỏng trên Wokwi với 6 biến trở, chip mưa tùy chỉnh và mô phỏng động học đất.

---

## Cấu trúc thư mục

```text
.
├─ Code/
│  ├─ Backend/                 Express + SQLite + MQTT + WebSocket
│  └─ Frontend/
│     ├─ Web/                  Next.js dashboard
│     └─ Mobile/               Expo (React Native)
└─ Wokwi/
   └─ Smart-Irrigation/        Firmware PlatformIO (ESP32)
```

---

## Khởi chạy

Cần Node.js 22 và PlatformIO. MQTT broker là bắt buộc; Cloudinary và Firebase là tùy chọn.

### 1. MQTT broker

Dùng broker công khai có sẵn cho demo:

```text
test.mosquitto.org:1883
```

Hoặc chạy Mosquitto local ở cổng `1883`. Địa chỉ broker và topic phải khớp ở **hai nơi**:

- `Code/Backend/.env` → `MQTT_URL`, `MQTT_STATUS_TOPIC`, `MQTT_COMMAND_TOPIC`
- `Wokwi/Smart-Irrigation/src/config.h` → `MQTT_SERVER`, `MQTT_PORT`, `TOPIC_STATUS`, `TOPIC_CMD`

### 2. Backend — http://localhost:3001

```powershell
cd Code\Backend
Copy-Item .env.example .env
npm install
npm run dev
```

Mở `.env` và điền `MQTT_URL`, topic, cùng `CLOUDINARY_*` nếu muốn lưu ảnh trên Cloudinary.

### 3. Web Dashboard — http://localhost:3000

```powershell
cd Code\Frontend\Web
npm install
npm run dev
```

Tạo `Code/Frontend/Web/.env.local`:

```dotenv
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 4. Mobile App

```powershell
cd Code\Frontend\Mobile
Copy-Item .env.example .env
npm install
npm start
```

Trỏ `EXPO_PUBLIC_API_URL` về IP LAN của máy tính khi chạy trên điện thoại thật, và mở firewall cổng 3001.

### 5. Firmware (Wokwi)

```powershell
cd Wokwi\Smart-Irrigation
pio run
```

Extension Wokwi trên VS Code **không tự build**, nên mỗi lần sửa `config.h` phải chạy `pio run` rồi mới Start Simulation.

---

## Dịch vụ ngoài

| Dịch vụ | Dùng cho | Cấu hình | Thiếu cấu hình thì sao |
|---|---|---|---|
| **MQTT broker** | Telemetry và lệnh giữa ESP32 ↔ backend | `MQTT_URL` + topic trong `.env` và `config.h` | Không chạy được, đây là dịch vụ bắt buộc |
| **Cloudinary** | Lưu ảnh khu vườn | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Ảnh lưu vào `Code/Backend/data/uploads`, phục vụ qua `/uploads/...` |
| **Firebase (FCM)** | Thông báo đẩy trên Android | `Code/Frontend/Mobile/google-services.json` + `expo-notifications` | App vẫn chạy, chỉ không nhận thông báo |
| **Expo Push** | Backend gửi thông báo tới thiết bị | `expo-server-sdk`; `EXPO_ACCESS_TOKEN` chỉ cần khi bật Enhanced Security | Push bị bỏ qua |

Ảnh Cloudinary được đặt tại `smart-irrigation/<deviceId>/<zoneId>`, upload ghi đè nên mỗi khu vực chỉ có một ảnh.

> `google-services.json` là cấu hình client, commit được. File service account `*firebase-adminsdk*.json` chứa private key nên **không được commit** — repo đã chặn bằng `.gitignore`.

---

## Triển khai

Backend chạy trên Render, deploy trực tiếp từ nhánh `main`:

| Thiết lập | Giá trị |
|---|---|
| Branch | `main` |
| Root Directory | `Code/Backend` |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |

Biến môi trường cần khai báo trong Render: `MQTT_URL`, `MQTT_STATUS_TOPIC`, `MQTT_COMMAND_TOPIC`, `WEB_ORIGIN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (và `EXPO_ACCESS_TOKEN` nếu dùng).

Kiểm tra sau khi deploy: `GET /api/health` trả `ok`, `mqtt: true`, `database.ok: true`.

> Ổ đĩa của Render là tạm: mỗi lần deploy/restart, SQLite trong `data/` bị tạo lại. Ảnh đã đẩy lên Cloudinary nên không mất.

---

## Nhóm thực hiện

| Thành viên | Vai trò | Phụ trách |
|:---:|:---:|:---:|
| <img src="https://github.com/trieuhoang1212.png?size=80" width="56" alt="@trieuhoang1212" /><br/>**@trieuhoang1212** | ![Leader](https://img.shields.io/badge/Leader-2E8B57?style=flat-square&logo=github&logoColor=white) | Trưởng nhóm |
| <img src="https://github.com/huylm8848-code.png?size=80" width="56" alt="@huylm8848-code" /><br/>**@huylm8848-code** | ![Design](https://img.shields.io/badge/Design-7E57C2?style=flat-square&logo=figma&logoColor=white) | Thiết kế & Giao diện |
| <img src="https://github.com/phuongttt7928-cpu.png?size=80" width="56" alt="@phuongttt7928-cpu" /><br/>**@phuongttt7928-cpu** | ![Developer](https://img.shields.io/badge/Developer-1565C0?style=flat-square&logo=github&logoColor=white) | Phát triển phần mềm |
| <img src="https://github.com/buithanhnguyen257-cmyk.png?size=80" width="56" alt="@buithanhnguyen257-cmyk" /><br/>**@buithanhnguyen257-cmyk** | ![Hardware](https://img.shields.io/badge/Hardware-EF6C00?style=flat-square&logo=espressif&logoColor=white) | Phần cứng & Vi điều khiển |

<div align="center">

<img height="150" src="https://github-readme-stats.vercel.app/api?username=trieuhoang1212&show_icons=true&include_all_commits=true&hide_border=true&bg_color=F5F8F5&title_color=2E8B57&icon_color=2E8B57&text_color=1F2937&locale=vi" alt="GitHub stats @trieuhoang1212" />
<img height="150" src="https://github-readme-stats.vercel.app/api?username=huylm8848-code&show_icons=true&include_all_commits=true&hide_border=true&bg_color=F5F8F5&title_color=7E57C2&icon_color=7E57C2&text_color=1F2937&locale=vi" alt="GitHub stats @huylm8848-code" />
<img height="150" src="https://github-readme-stats.vercel.app/api?username=phuongttt7928-cpu&show_icons=true&include_all_commits=true&hide_border=true&bg_color=F5F8F5&title_color=1565C0&icon_color=1565C0&text_color=1F2937&locale=vi" alt="GitHub stats @phuongttt7928-cpu" />
<img height="150" src="https://github-readme-stats.vercel.app/api?username=buithanhnguyen257-cmyk&show_icons=true&include_all_commits=true&hide_border=true&bg_color=F5F8F5&title_color=EF6C00&icon_color=EF6C00&text_color=1F2937&locale=vi" alt="GitHub stats @buithanhnguyen257-cmyk" />

</div>

---

## Hạn chế

Đây là prototype phục vụ đồ án, chưa triển khai thực địa.

### An toàn và bảo mật

- Bản demo dùng MQTT broker công khai (`test.mosquitto.org`) không TLS, chưa có user/password: ai biết topic đều publish được telemetry hoặc lệnh giả.
- REST API và WebSocket chưa có auth: ai gọi được URL đều điều khiển được bơm.
- Chưa phân quyền nhiều người dùng; Web và Mobile dùng chung một `deviceId`.

### Vận hành

- Chỉ hỗ trợ một khu vườn / một thiết bị (`esp32-garden-01`).
- Mất mạng không buffer telemetry: lịch sử bị hở đoạn offline và lệnh gửi trong lúc đó bị mất.
- Mỗi lượt tưới tối đa 10 phút/vùng rồi nghỉ 2 phút — lưu lượng nhỏ có thể cần nhiều lượt mới đạt ngưỡng dừng.
- Mất điện lưới là dừng hoạt động, chưa có UPS hoặc pin mặt trời.
- Render dùng ổ đĩa tạm: deploy/restart là mất lịch sử SQLite. Ảnh trên Cloudinary không mất.
- Chưa có OTA: nạp firmware phải qua USB hoặc Wokwi.

### Đo lường và thuật toán

- Lưu lượng nước là số cấu hình (L/h), chưa đo bằng cảm biến lưu lượng thật — lượng lít đã tưới và tốc độ ẩm lên chỉ là ước tính.
- Ngưỡng độ ẩm tính theo % cảm biến điện trở, chưa hiệu chuẩn theo từng loại đất.
- Gợi ý tưới là rule-based, chưa kiểm chứng nông học; Weather Gate chỉ dựa cảm biến mưa, chưa dùng dự báo thời tiết.
- Mô phỏng Wokwi dùng biến trở và động học đất giả lập, không thay thế thử nghiệm ngoài vườn.

### Kỹ thuật

- Chưa có test tự động và CI; hiện kiểm tra bằng typecheck và smoke test thủ công.

---

## Hướng phát triển

### Ngắn hạn

- **Auth và phân quyền**: JWT hoặc API key cho REST, token cho WebSocket, tách dữ liệu theo từng người dùng.
- **Bảo mật MQTT**: TLS cổng 8883, user/password, broker riêng; topic gắn token thiết bị thay vì tên cố định.
- **Giữ dữ liệu**: gắn Render Disk hoặc chuyển sang Postgres để không mất lịch sử sau mỗi deploy.
- **Buffer khi offline**: xếp telemetry vào LittleFS trên ESP32 rồi replay khi có mạng.
- **Test và CI**: `node:test` hoặc Vitest cho domain/repository, GitHub Actions chạy typecheck + test.
- **OTA firmware**: cập nhật qua Wi-Fi thay vì cắm USB.

### Dài hạn

- Đa thiết bị, đa khu vườn, nhiều người dùng cùng lúc.
- Lịch tưới theo giờ và theo mùa; kết hợp dự báo thời tiết thật và chỉ số bốc thoát hơi (ET).
- Cảm biến lưu lượng thật để đo lít chính xác và phát hiện rò rỉ hoặc tắc đầu tưới.
- Hiệu chuẩn cảm biến theo loại đất hoặc chuyển sang cảm biến độ ẩm đất dung lượng.
- Học từ dữ liệu: dự đoán độ ẩm, tối ưu lượng nước theo lịch sử tưới.
- Phần cứng thực địa: van điện tử, tủ chống nước, pin mặt trời và UPS.
- Ứng dụng iOS, cache offline và widget thao tác nhanh.

---

<div align="center">
<sub>Smart Irrigation System · IoT Project · 2026</sub>
</div>
