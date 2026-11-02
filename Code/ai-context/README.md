# ai-context — hệ thống compact context cho AI

Giải quyết 4 vấn đề:

| Vấn đề | Cách folder này xử lý |
|---|---|
| AI phải đọc lại lịch sử cũ mỗi phiên | Đọc `RESUME.md` (một file ngắn) thay vì quét repo + chat cũ |
| Context window đầy nhanh, phiên ngắn | Toàn bộ file trong đây đều ≤ ~80 dòng, tổng < 1 trang |
| API tính phí theo token đầu vào | Input mỗi phiên = `RESUME.md` (~1-2k token) thay vì vài chục k |
| Chi phí token đã dùng trước đó | **Không** giảm được — đó là tiền đã mất, folder này chỉ giảm từ phiên sau |

Cảnh báo: compact quá mạnh → AI quên chi tiết code / yêu cầu cũ.
Xem `RULES.md` để biết **ngưỡng an toàn** và danh sách thứ gì tuyệt đối không được xóa.

## Cách dùng

**Đầu mỗi phiên** (mới mở AI / resume):

```
Đọc ai-context/RESUME.md rồi mới bắt đầu. Không quét .pio/ hay .vscode/.
```

**Trong phiên** (khi AI sửa code):

```
Khi sửa xong, cập nhật ai-context/STATE.md và ghi 1 mục vào ai-context/CHANGELOG.md (mới nhất ở trên).
```

**Cuối phiên** (trước khi tắt):

```powershell
pwsh -File ai-context/scripts/compact.ps1
```

Script sẽ: prune CHANGELOG cũ → `archive/`, rebuild `RESUME.md`, cảnh báo file nào phình to.

## Cấu trúc

```
ai-context/
├── README.md        ← bạn đang đọc
├── RESUME.md        ← TỰ ĐỘNG sinh lại. File DUY NHẤT AI đọc mỗi phiên
├── MEMORY.md        ← tri thức dài hạn: quy ước, quyết định, lỗi đã gặp
├── STATE.md         ← trạng thái code hiện tại theo file/module
├── REQUIREMENTS.md  ← yêu cầu gốc + yêu cầu cũ đã xử lý (chống quên)
├── CHANGELOG.md     ← nhật ký phiên, MỚI NHẤT Ở TRÊN, append xuống cuối
├── RULES.md         ← ngưỡng compact + blacklist (không được xóa)
├── archive/         ← CHANGELOG cũ đã prune. AI KHÔNG được đọc
└── scripts/
    └── compact.ps1  ← công cụ prune + sinh RESUME.md
```

## Quy tắc sinh/ghi

- `RESUME.md`: chỉ sinh bằng script. Tay sửa → lần chạy script sau sẽ ghi đè.
- `CHANGELOG.md`: ghi tay (hoặc AI ghi), 1 mục = 1 dòng mô tả + tối đa 3 dòng chi tiết.
- `archive/`: không đưa vào context. Cần tra cứu thì user tự mở tay.
