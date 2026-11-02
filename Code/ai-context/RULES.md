# RULES.md — Ngưỡng Compact & Blacklist Chung Cho Mọi Dự Án

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
