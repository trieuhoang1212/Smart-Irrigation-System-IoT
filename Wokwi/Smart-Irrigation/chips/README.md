# Chip cảm biến mưa

- `rain-sensor.chip.c` và `rain-sensor.chip.json` là mã nguồn của chip.
- `rain-sensor.chip.wasm` mới là file Wokwi chạy. Sửa `.c` xong phải build lại wasm
  theo hướng dẫn Wokwi Chip API, nếu không Wokwi vẫn chạy bản wasm cũ.
- Chip xuất DO dạng PWM 90/100 ms (90 mẫu HIGH tương ứng 100% mưa).
  Chân AO chỉ để dự phòng, mạch hiện không nối và firmware không đọc.
