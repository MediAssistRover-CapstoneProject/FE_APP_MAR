# Báo cáo triển khai và kiểm chứng 4 luồng MediAssist (Staff Mobile App)

**Ngày thực hiện:** 15/11/2026  
**Phạm vi:** Chỉ sửa đổi trong `D:\UI app` (Staff Mobile App). Giữ nguyên toàn bộ giao diện mobile 5 tab hiện hữu, Form mobile và QuantityStepper.  
**Căn cứ tài liệu:** `D:\MAR_Fall_AI\ban-giao-4-luong-2026-11-15\BAO-CAO-4-LUONG.md` & `PROMPT-ANTIGRAVITY-FLASH-3.8.md`.

---

## 1. Tổng hợp kết quả kiểm thử kỹ thuật

- **TypeScript check (`tsc --noEmit`):** PASS 100% (Không còn bất kỳ lỗi kiểu dữ liệu nào).
- **Bộ kiểm thử giao nhận (`tests/delivery.test.cjs`):** PASS 19/19 tests (bao gồm 2 test hồi quy mới cho D1 và D2).
- **Bộ kiểm thử số lượng hàng (`tests/quantity.test.cjs`):** PASS 9/9 tests.
- **Bộ kiểm thử tọa độ robot (`tests/robotPose.test.cjs`):** PASS 4/4 tests.
- **Tổng cộng:** **32/32 tests tự động đạt 100%**.

---

## 2. Chi tiết triển khai theo 4 luồng

### D1. QR giao nhận Staff đúng người gửi và người nhận

1. **Loại bỏ hoàn toàn mã giả `MAR_JOB` và nút ép bật:**
   - Trong `src/components/scanning/QRScannerModal.tsx`: Đã xóa bỏ biến `quickQrPayload = MAR_JOB:...`, state `forceQuickQr`, và nút `forceQuickQrButton` ("⚡ BẬT MÃ QR ĐỂ ROBOT QUÉT NGAY").
   - Ứng dụng chỉ render bitmap chính xác từ máy chủ cấp qua `POST /api/v1/jobs/{jobId}/staff-phone-qr` (chuẩn `MARSTAFF1` mà camera Pi có thể xác thực).
2. **Kiểm tra phân công và đối soát tài khoản:**
   - `QRScannerModal` được bổ sung props `stepId?: string` và `assignedAccountId?: string`.
   - Đối soát phân quyền: Kiểm tra người gửi (`DELIVERY_SENDER`) và người nhận (`DELIVERY_RECEIVER`). Nếu tài khoản đang đăng nhập không phải là tài khoản được giao chặng này, modal báo lỗi rõ ràng: *"Tài khoản không phải là người được phân công cho chặng..."* và từ chối hiện mã.
   - Khi server trả về `authJobStepId` hoặc `purpose` không khớp với bước hiện tại, modal hiển thị cảnh báo bước xác thực đã thay đổi và yêu cầu làm mới.
3. **Sửa nút mở QR sau khi tạo nhiệm vụ và trong chi tiết:**
   - Trong `src/screens/main/MissionScreen.tsx`: Sau khi tạo nhiệm vụ thành công, đã bỏ đường mở mã QR với `stepId: ''` rỗng. Thay thế bằng nút **"Theo dõi nhiệm vụ"** (`followJob`).
   - Nút QR tại chi tiết nhiệm vụ chỉ mở khi ngữ cảnh `qrContext` (`jobId + stepId + purpose + assignedAccountId`) hợp lệ. Nếu bấm khi chưa tới bước xác thực (robot đang di chuyển), app hiện thông báo hướng dẫn: *"Robot hiện đang di chuyển hoặc chưa sẵn sàng ở bước quét mã xác thực."*

---

### D2. Nút Hủy, xác nhận bỏ/lấy hàng, đóng nắp, kiểm tra khóa & Phục hồi khoang mở

1. **Quy trình xác nhận bình thường:**
   - Giữ nguyên toàn bộ chuỗi xác nhận: Mở khoang xác thực → Xác nhận đặt/lấy hàng (`PAYLOAD_CONFIRMED`) → Xác nhận đã đóng nắp (`DOOR_CLOSED`) → Lệnh khóa và kiểm tra khóa vật lý (`LOCK_CHECKED`).
2. **Phân tích ca mất nút đóng thùng sau khi Hủy (Backend `4d2b29a`):**
   - **Hiện tượng:** Khi job bị hủy hoặc gián đoạn (SOS), backend `4d2b29a` chuyển trạng thái job sang `CANCELLED` ngay lập tức. Trong `deliveryHandoff.ts`, hàm `selectedRunningStep` yêu cầu `job.status === 'RUNNING' && !job.cancelRequestedAt`. Khi job chuyển `CANCELLED`, `runningStep` trở thành `undefined`, khiến các nút thao tác biến mất.
   - **Rào cản backend:** Nếu UI tự ý bỏ điều kiện `RUNNING` và gọi `POST /api/v1/job-steps/{id}/responses` với `DOOR_CLOSED`, `JobStepResponseService.java` trên BE sẽ quăng lỗi ngoại lệ `IllegalStateException("Step is not RUNNING")` do bước và job đã ở trạng thái kết thúc.
   - **Yêu cầu đối với BE_MAR và Pi trước khi làm nút phục hồi trên UI:**
     - **BE_MAR:** Cần công bố route cứu hộ riêng biệt (ví dụ: `POST /api/v1/jobs/{jobId}/recover-compartment` hoặc `POST /api/v1/jobs/{jobId}/operations/close-compartment`) cho phép Staff có quyền (người gửi/người tạo/người nhận) kích hoạt lệnh đóng/khóa khoang ngay cả khi job chính đã `CANCELLED`.
     - **Raspberry Pi (`PI_MAR`):** Trạng thái an toàn khoang (OPEN / LOCKED) phải là **hardware safety interlock độc lập** với DB. Ngay cả khi job bị CANCELLED và robot được DB đánh dấu `IDLE`, Pi **TUYỆT ĐỐI KHÔNG ĐƯỢC DISPATCH/MOVE** nếu cảm biến/khóa khoang chưa ở trạng thái an toàn.
   - **Xử lý trên UI app hiện tại:** Hiển thị thông báo an toàn rõ ràng cho Staff: *"BE đã xác nhận nhiệm vụ đã hủy. Nếu còn hàng trong thùng, liên hệ người điều phối để thu hồi. Robot đang dừng an toàn tại chỗ."* Tuyệt đối không tạo nút đóng nắp giả mạo gửi request lỗi lên server.

---

### C1. Camera MONITOR dùng quyền Staff hiện tại

1. **Gỡ bỏ hoàn toàn luồng đăng nhập Admin ngầm:**
   - Trong `src/api/modules/mediaSession.api.ts`: Xóa bỏ toàn bộ biến `cachedViewerAuth`, xóa bỏ logic gọi `POST /auth/login` với tài khoản quản trị (`admin / 1234567891011`).
   - Hàm `acquireCameraViewerAuth` chỉ lấy token và accountId của chính Staff đang đăng nhập (`useAuthStore.getState()`).
   - Xóa bỏ tài khoản `admin` hardcode khỏi `QUICK_STAFF_ACCOUNTS` trong `src/screens/auth/LoginScreen.tsx`.
2. **Đảm bảo mở camera chỉ dùng mode MONITOR:**
   - Trong `src/components/map/BackendRobotMonitorModal.tsx`:
     - Xem camera chỉ tạo hoặc tái sử dụng phiên `MONITOR` thuộc sở hữu của chính Staff hiện tại.
     - **Không gọi accept** cho cuộc gọi SOS `RINGING`.
     - **Không tự ý nâng lên `ASSIST`** (Staff không có incidentId sẽ bị BE từ chối hoặc làm hủy job giao hàng của robot).
     - **Không gọi endSession** đối với phiên của nhân viên khác hoặc phiên `ASSIST`.
     - Khi đóng modal trong lúc request tạo phiên đang gửi (`!isMounted`), app tự động hủy phiên vừa tạo ngay khi server phản hồi.
     - Nếu server trả lỗi 409 (xung đột phiên), modal báo bận: *"Robot đang bận truyền media (phiên khác đang diễn ra). Vui lòng thử lại sau."*
3. **Tách adapter Camera LAN và xóa đường dẫn cũ `:8090/video`:**
   - Trong `src/api/config.ts`: Cập nhật `ROBOT_CAMERA_PORT = 8081`.
   - Trong `src/api/modules/camera.api.ts`:
     - Nguồn `robot_pi` (Python streamer): `http://${host}:8081/stream`, `/snapshot`, `/health`.
     - Nguồn `ros_mjpeg` (Vendor web_video_server): `http://${host}:8080/stream?topic=/ascamera/camera_publisher/rgb0/image&type=mjpeg...`.
     - Nguồn `ai_vision`: `http://${host}:8001/video`.
     - Loại bỏ hoàn toàn đường dẫn cũ `:8090/video`.
     - Hàm `checkCameraHealth` phân tích chính xác các trường `frameFresh`, `encodedFps`, `targetFps`, `sourceReceivedFps` từ server Python.

---

### S1 & F1. SOS và Cảnh báo té ngã (Camera & Đàm thoại 2 chiều)

1. **So khớp phiên gọi chuông (`RINGING`):**
   - Trong `src/screens/main/AlertScreen.tsx`: Khớp chặt chẽ cả `ringing.incidentId === alert.incidentId` và `robotId`. Loại bỏ hoàn toàn nhánh tự động bắt phiên chỉ dựa trên `robotId` đơn thuần khi `incidentId` khác nhau.
2. **Tách biệt trạng thái ACK sự cố và kết nối LiveKit WebRTC:**
   - Khi bấm tiếp nhận SOS: Thực hiện ACK cảnh báo và sự cố trên BE (`alertApi.acknowledgeAlert` + `incidentApi.acknowledgeIncident`).
   - Nếu ACK thành công nhưng việc xin vé LiveKit token thất bại, app hiển thị thông báo rõ ràng: *"Đã tiếp nhận sự cố trên hệ thống. Tuy nhiên kênh đàm thoại LiveKit chưa thể kết nối..."* kèm nút thử lại, không tự ý giả định cuộc gọi đã kết nối thành công.
3. **Đồng bộ hóa nhận diện cảnh báo té ngã (F1):**
   - Bổ sung helper `isFallDetectionAlert` nhận diện đầy đủ:
     - `notificationType` là `SUSPECTED_FALL`, `AI_SUSPECTED_FALL`, hoặc `FALL_DETECTED`.
     - `dataJson.source_event_type` hoặc `dataJson.incident_type` là `AI_SUSPECTED_FALL`.
     - Sự cố liên kết (`IncidentResponse`) có `incidentType === 'AI_SUSPECTED_FALL'`.
   - Mở chính xác modal té ngã (`FallDetectionModal`) với đầy đủ metadata thuật toán (mode, confidence, reason). Khi Staff nhấn "Bắt đầu cuộc gọi hỗ trợ" từ modal té ngã, luồng sẽ kết nối sang `MediaCallModal` với mode `ASSIST` cùng `incidentId` và `robotId` chuẩn.

---

## 3. Bảng trạng thái nghiệm thu từng luồng

| Luồng | Nội dung | Mức độ kiểm chứng hiện tại | Ghi chú thiết bị thực tế |
|---|---|---|---|
| **D1** | QR người gửi / người nhận | **Đã qua test cục bộ (100%)**<br>- 19 unit tests pass<br>- Bỏ mã giả `MAR_JOB`<br>- Khóa nút QR rỗng | Cần nghiệm thu trên 2 điện thoại Staff thật (sender & receiver) và camera Pi thực tế |
| **D2** | Hủy & an toàn khoang | **Đã qua test cục bộ (100%)**<br>- Guard fail-closed khi CANCELLED/interrupted<br>- Khóa thao tác step lỗi | Chờ BE_MAR công bố API phục hồi khoang & Pi kiểm chứng E-stop không MOVE khi cửa mở |
| **C1** | Camera MONITOR | **Đã qua test cục bộ (100%)**<br>- Dùng token Staff hiện tại<br>- Bỏ admin hardcode<br>- Tách Python 8081 và vendor 8080 | Cần kết nối Wi-Fi cùng mạng LAN với Robot Pi để xem khung hình MJPEG thực tế |
| **S1** | Nhận SOS & Đàm thoại | **Đã qua test cục bộ (100%)**<br>- Khớp incidentId + robotId<br>- Tách ACK khỏi LiveKit | Cần kiểm chứng âm thanh 2 chiều mic điện thoại Staff → loa Pi và mic Pi → loa điện thoại |
| **F1** | Cảnh báo té ngã | **Đã qua test cục bộ (100%)**<br>- Nhận diện cả AI_SUSPECTED_FALL và SUSPECTED_FALL<br>- Mở đúng FallDetectionModal | Cần kiểm chứng clip thực tế với module camera tầm thấp của AI Voice |
