Smart Irrigation System – Mobile App

Ứng dụng di động quản lý và giám sát hệ thống tưới cây thông minh, được xây dựng bằng React Native và Expo.

1. Chức năng chính

Dashboard

Hiển thị trạng thái hoạt động của hệ thống.

Theo dõi dữ liệu cảm biến: độ ẩm đất, nhiệt độ, độ ẩm không khí.

Hiển thị trạng thái máy bơm và chế độ hoạt động.

Chuyển đổi giữa chế độ AUTO và MANUAL.

Điều khiển bật/tắt máy bơm.

Quản lý vùng tưới

Hiển thị danh sách 6 vùng tưới: T001–T006.

Xem thông tin chi tiết từng vùng.

Theo dõi độ ẩm đất và trạng thái máy bơm.

Điều chỉnh ngưỡng độ ẩm bật/tắt tưới.

Settings

Xem cấu hình các vùng tưới.

Theo dõi lịch sử thay đổi cấu hình.

Real-time

Sử dụng WebSocket để nhận dữ liệu cảm biến theo thời gian thực.

Đồng bộ trạng thái thiết bị và kết quả thực hiện lệnh từ Backend.

2. Công nghệ sử dụng

React Native

Expo SDK 58

Expo Router

TypeScript

REST API

WebSocket

MQTT (thông qua Backend)


3. Yêu cầu môi trường

Node.js và npm.

Điện thoại Android/iOS hoặc thiết bị giả lập.

Backend đang hoạt động.

Máy chạy Mobile và Backend có thể kết nối với nhau qua mạng.

44. Cài đặt và chạy ứng dụng

Bước 1: Di chuyển vào thư mục Mobile

cd Code/Frontend/Mobile

Bước 2: Cài đặt dependencies

npm install

Bước 3: Cấu hình kết nối Backend

Tạo file .env trong thư mục Code/Frontend/Mobile.

Thêm cấu hình:

EXPO_PUBLIC_API_URL=http://IP_MAY_CHAY_BACKEND:3001

Ví dụ:

EXPO_PUBLIC_API_URL=http://192.168.110.2:3001

Lưu ý:

Thay 192.168.110.2 bằng địa chỉ IPv4 thực tế của máy chạy Backend.

Không sử dụng localhost khi chạy ứng dụng trên điện thoại thật vì localhost lúc này là chính điện thoại.

File .env chứa cấu hình riêng của từng thành viên, không đưa lên GitHub.

Có thể tham khảo .env.example để tạo file cấu hình.