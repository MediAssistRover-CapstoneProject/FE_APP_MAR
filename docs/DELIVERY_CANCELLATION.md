# Hủy nhiệm vụ giao hàng từ Staff app

Cập nhật 11/11/2026. Chức năng dùng API đã có trên server; không cần deploy thêm endpoint BE.

## Cách dùng

1. Đăng nhập Staff và vào Nhiệm vụ, chọn delivery cần hủy.
2. Người tạo yêu cầu hoặc người gửi được phân công thấy nút **Hủy nhiệm vụ giao hàng** khi Job đang QUEUED, ACCEPTED hoặc RUNNING.
3. Nhập lý do (1–1.000 ký tự) rồi chọn **Xác nhận gửi yêu cầu hủy**.
4. App đọc lại nhiệm vụ/assignment và gửi `POST /api/v1/jobs/{jobId}/cancel` với bearer tài khoản hiện tại, body `{"reason":"Lý do hủy"}`.
5. Theo dõi trạng thái BE. Nhận HTTP 200 chỉ có nghĩa BE nhận yêu cầu; robot có thể vẫn đang xử lý dừng. Màn hình vẫn dùng polling hiện có để cập nhật.

Nếu Job đã CANCELLED, đã kết thúc hoặc cần RECOVERY_REQUIRED, không gửi yêu cầu hủy mới. Nếu mất phản hồi mạng, app đọc lại trạng thái để tìm `cancelRequestedAt` trước khi cho lần thử tiếp theo gửi lệnh. Thao tác hủy không tự mở khóa, lấy hàng hay đưa hàng về nơi gửi; khi đã đặt hàng lên robot cần phối hợp điều phối để thu hồi.

## Phạm vi tích hợp

- Áp dụng nhiệm vụ đã có Job đang hiển thị trong MissionScreen; không bổ sung hủy draft chưa có Job trong thay đổi này.
- Dùng Job cancellation để BE điều phối dừng robot. Không dùng Device API hoặc giả lập callback đã dừng.
- Nút hiển thị cho requester / expected sender / actual sender theo delivery đang chọn. Đây là điều kiện giao diện; quyền cuối cùng do BE xác thực. Code BE hiện có cấp phạm vi rộng hơn (có thể gồm người nhận và nhân viên trực), không được coi việc ẩn nút là chính sách bảo mật sender-only trên server.
- Component tách riêng `src/components/delivery/DeliveryCancelAction.tsx`, logic tại `src/screens/main/deliveryCancellation.ts`. MissionScreen chỉ thêm import và mount component. Không sửa logic QR hoặc Robot app đang được xử lý riêng.

## Kiểm tra

`npm run check:delivery`: TypeScript và 17 test qua, gồm 6 test mới kiểm tra người gửi/người nhận, trạng thái kết thúc, lý do, đổi tài khoản, mất phản hồi và gửi lại.

OpenAPI server được đọc ngày 11/11/2026 để xác nhận route/body. Không gửi lệnh hủy vào nhiệm vụ thật trong quá trình kiểm tra. Cần kiểm thử có robot để xác nhận đường truyền dừng, phản hồi phần cứng và trường hợp RECOVERY_REQUIRED.
