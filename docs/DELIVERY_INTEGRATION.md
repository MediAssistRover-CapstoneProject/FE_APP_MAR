# Staff Delivery — tích hợp BE DuckDNS

Cập nhật 10/11/2026. Màn hình Nhiệm vụ dùng server hiện có để tạo giao hàng, theo dõi Job, quét QR hiển thị trên robot và xác nhận hàng/cửa/khóa theo đúng bước. Robot interface chạy trên tablet/điện thoại riêng.

## 1. Chạy Staff app

```powershell
cd 'D:\UI app'
npm ci
npm start -- --port 8081
```

Mở trên Android/iOS bằng Expo Go/build tương thích SDK của repo. Ở màn hình đăng nhập chọn server `https://mediassistrover.duckdns.org/api/v1`. Kiểm tra đúng server nếu trước đó đã lưu BE local. Hai app và Pi phải cùng hệ thống BE, robot, bản đồ; không chỉ đổi riêng một API tạo nhiệm vụ sang database khác.

Màn hình Robot cần bridge đọc trạng thái vì API Device hiện chưa cung cấp đủ discovery/snapshot cho tablet. Xem `docs/DELIVERY_INTEGRATION.md` trong **Robot app** để điền cấu hình và chạy `npm run delivery:bridge`; không nhập mật khẩu/Device secret vào giao diện Staff hoặc mã QR.

## 2. Tạo giao hàng và chỉ định người gửi/nhận

1. Đăng nhập bằng tài khoản Staff. Màn hình Nhiệm vụ hiển thị username và **Account ID** hiện tại.
2. Chọn loại hàng, tên hàng, số lượng, bản đồ ACTIVE, điểm lấy A và điểm giao B trên cùng bản đồ.
3. Nhập Account ID người gửi (mặc định tài khoản hiện tại), tên hiển thị và Account ID người nhận. Account ID là UUID tài khoản trên BE này, không phải username/số điện thoại. Người nhận lấy ID trên màn hình của mình hoặc từ người quản lý tài khoản.
4. Bấm **Tạo và gửi nhiệm vụ**. App gọi create, sau đó submit và tìm Job theo requestId. BE chịu trách nhiệm điều phối robot/workflow; ứng dụng không giả định robot đã nhận lệnh khi mới tạo request.
5. Chia sẻ Job ID cho người gửi/nhận; họ nhập vào ô **Job ID được chia sẻ** rồi bấm Theo dõi. Có thể chọn Job gần đây thuộc phạm vi tài khoản. Job không phải delivery bị từ chối khi tải chi tiết.

Nếu mạng gián đoạn, app giữ nội dung yêu cầu và `Idempotency-Key` trong bộ nhớ lưu trữ cục bộ, theo server + tài khoản. Dùng **Thử lại yêu cầu / Gửi lại yêu cầu đã tạo / Tìm lại Job** để khôi phục. Không tạo yêu cầu mới chỉ vì chưa nhận được phản hồi. Bản chờ chỉ chứa nội dung yêu cầu, không lưu token đăng nhập. Form không có danh bạ Staff vì chưa xác minh API directory có quyền đọc phù hợp; hiện nhập UUID rõ ràng.

## 3. Chuỗi giao nhận thực tế

1. **Robot đi đến A:** chờ trạng thái MOVE từ BE/Pi; Staff không bấm xác thực trước thời điểm được phân công.
2. **Người gửi xác thực:** selected step AUTHENTICATE + QR_CODE, đúng tài khoản người gửi. Robot hiển thị QR từ BE. Người gửi mở camera trong Staff app và quét mã đó.
3. **BE kiểm tra QR:** proof phải đúng Job, auth step, purpose DELIVERY_SENDER và chưa hết hạn. Chữ ký, quyền và trạng thái cuối cùng do BE kiểm tra. App chặn scan lặp trong lúc request đang chạy.
4. **Pi mở khóa:** sau xác thực, BE điều phối bước mở khóa và đợi kết quả Pi. Quét QR thành công không tự chứng minh nắp đã mở.
5. **Đặt hàng:** khi HANDLE_PAYLOAD/LOAD đang chạy, Staff kiểm tra đúng danh sách hàng do BE trả rồi xác nhận đã đặt hàng.
6. **Đóng và khóa:** Staff xác nhận đã đóng cửa khi có bước CLOSE; Pi thực thi LOCK; Staff kiểm tra khóa thực tế rồi xác nhận VERIFY. Ba việc này không gộp thành một nút.
7. **Robot đến B:** BE/Pi chuyển MOVE tới người nhận. Robot tablet hiển thị đang vận chuyển khi BE đã có mốc pickedUpAt.
8. **Người nhận xác thực:** tài khoản nhận được chỉ định quét QR DELIVERY_RECEIVER mới trên robot, chờ Pi mở, lấy hàng, xác nhận UNLOAD, đóng cửa rồi kiểm tra khóa tương tự.
9. **Hoàn tất:** giao diện theo kết quả server. Robot chỉ ghi giao hàng thành công khi Job SUCCEEDED, request COMPLETED và có deliveredAt. Không tự set COMPLETED sau khi quét mã.

App không gọi thay Pi vào hàng đợi lệnh, callback phần cứng, heartbeat hay endpoint mở khóa trực tiếp. Những tab demo xác nhận giả trong Robot Home đã được bỏ khỏi luồng giao nhận chính.

## 4. Hợp đồng API đã nối

| Thao tác | API | Dữ liệu chính |
|---|---|---|
| Danh mục | API maps/endpoints/rooms đang có | Lọc ACTIVE, endpoint thuộc bản đồ |
| Tạo delivery | `POST /api/v1/delivery-requests` | Idempotency-Key; mapId, pickup/deliveryEndpointId, expectedSender/ReceiverAccountId, items |
| Đưa vào điều phối | `POST /api/v1/service-requests/{requestId}/submit` | Sau khi create thành công; có khôi phục nếu mất response |
| Khôi phục trạng thái request | `GET /api/v1/service-requests/{requestId}` | Tránh submit/tạo lại không cần thiết |
| Tìm/theo dõi Job | `GET /api/v1/jobs?requestId=…`, `GET /api/v1/jobs/{jobId}` | Response detail gồm job/tasks/steps; chọn selectedJobStepId |
| Thông tin giao nhận | `GET /api/v1/delivery-requests/{requestId}` | Assignment và dữ liệu delivery thật |
| Xác thực Staff | `POST /api/v1/jobs/{jobId}/qr-verifications` | `{ "proof": "<qrPayload>" }`, bearer của Staff đang quét |
| Xác nhận hàng | `POST /api/v1/job-steps/{stepId}/responses` | PAYLOAD_CONFIRMED + confirmed:true + đúng items từ resolvedInputs |
| Xác nhận cửa | Cùng API responses | DOOR_CLOSED + closed:true |
| Kiểm tra khóa | Cùng API responses | LOCK_CHECKED + locked:true |

Responses dùng key ổn định theo step + account + responseType. Nút chỉ mở cho đúng người được giao, selected RUNNING step của Job schemaVersion 3 / beOrchestrated, không bị hủy/interruption. Trước khi gửi, app đọc lại Job để kiểm tra bước chưa đổi. Poll trạng thái khoảng 3 giây, lỗi đọc khóa thao tác đến khi cập nhật lại.

QR hỗ trợ định dạng robot proof `MARQR1` theo code BE đã đối chiếu. Các QR loại khác, URL, UUID thuần, QR Job khác, sai chặng hoặc hết hạn đều bị từ chối. Chưa lấy được challenge thật có xác thực từ server trong lần kiểm tra này; nếu BE deploy dùng format khác cần đối chiếu response/chữ ký với người triển khai, không bỏ kiểm tra chỉ để quét được.

`POST /jobs/{id}/qr-challenges` được Swagger đánh dấu phục vụ kiểm tra/deprecated; app không dùng để tạo lại QR. Trang demo `delivery-qr.html` có chiều Staff-hiển-thị/Pi-quét; luồng này là **Robot-hiển-thị/Staff-quét**, vì vậy không lấy QR từ trang demo thay cho challenge hiện hành trên robot.

## 5. Checklist nghiệm thu có Pi

Chuẩn bị: hai tài khoản Staff ACTIVE đúng assignment; map/endpoints hợp lệ; robot online có workflow delivery schema 3 đã publish/điều phối; Pi executor hỗ trợ quy trình auth và hardware receipt của BE; bridge đúng robot và viewer có quyền đọc.

- Tạo delivery, kiểm tra chỉ một request/job khi bấm lại hoặc mạng mất phản hồi.
- Ở A, chỉ người gửi quét được; người khác/sai Job/sai chặng/hết hạn phải bị từ chối.
- Quét thành công chỉ chuyển bước xác thực; kiểm tra thực tế mở khóa và kết quả Pi trước xác nhận hàng.
- Đặt hàng → đóng → Pi khóa → kiểm tra khóa; xác minh pickedUpAt được server ghi nhận.
- Đi đến B, chỉ người nhận quét được; lấy hàng → đóng → khóa → kiểm tra; xác minh deliveredAt/request COMPLETED.
- Mất mạng, chuyển app nền, hủy Job, timeout hoặc RECOVERY_REQUIRED: QR/nút xác nhận không tiếp tục dựa trên dữ liệu cũ.
- Khởi động lại Staff giữa create/submit: yêu cầu chờ khôi phục bằng cùng key; đổi tài khoản không dùng lại quyền người trước.
- Kiểm tra camera trên điện thoại thật, quyền camera, mã đủ sáng và khoảng cách quét. Nếu BE từ chối bằng chứng phần cứng thì kiểm tra Pi/cảm biến, không thay bằng trạng thái thành công giả.

## 6. Kiểm tra đã thực hiện

```powershell
cd 'D:\UI app'
npm run check:delivery
```

TypeScript và test helper/QR/retry/lưu request chờ đã qua. Đã export bundle Android và iOS thành công. Robot có kiểm thử trạng thái/reader/bridge và bản web đã kiểm tra bằng fixture HTTP riêng. Server public health UP và OpenAPI truy cập được ngày 10/11/2026.

Chưa test có đăng nhập với nhiệm vụ thật, scan trên hai thiết bị thật, di chuyển hoặc servo/cảm biến vì chưa có phiên tài khoản/robot thực. Thành công build/test không thay thế nghiệm thu phần cứng và quyền truy cập BE.

Các file chính: `MissionScreen.tsx`, `deliveryHandoff.ts`, `robotDeliveryProof.ts`, `deliveryAttemptStorage.ts`, `QRScannerModal.tsx`, `delivery.api.ts`, `dispatch.api.ts`; test tại `tests/delivery.test.cjs`.
