# Báo cáo bàn giao — Xác nhận SOS sau cuộc gọi & Tuyến đi bộ hỗ trợ SOS (Staff App)

## 1. Phạm vi & File thay đổi trong `D:\UI app`

- `src/api/endpoints.ts`: Thêm `INCIDENTS.CONFIRM` (`POST /emergency-incidents/{id}/confirm`) và `INCIDENTS.RESPONSE_ROUTE` (`GET /emergency-incidents/{id}/response-route`).
- `src/api/types.ts`: Bổ sung `sosResponderAccountId`, `sosRoutingStatus`, `sourceEvidenceRef`, `resolutionNote`, `resolutionEvidence`, tùy chọn `confirmedByAccountId`, `confirmedAt` vào `IncidentResponse`; thêm `SosResponseRoutePoint`, `SosResponseRouteEndpoint`, `SosResponseRouteStatus`, `SosResponseRouteResponse`.
- `src/api/modules/incident.api.ts`: Thêm `confirmIncident(id)` và `getSosResponseRoute(id)`.
- `src/types/navigation.ts`: Mở rộng `MainTabParamList['Home']` nhận `{ focusSosIncidentId?: string; sosRequestNonce?: number } | undefined`.
- `src/store/useSosContextStore.ts` (mới): Lưu ngữ cảnh cuộc gọi `ASSIST` đã kết thúc và bộ đếm hủy tuyến theo phạm vi `(serverUrl, accountId, incidentId)`.
- `src/screens/main/sosDecision.ts` (mới): Logic phân biệt SOS bấm nút vs té ngã, đối soát & khử lặp trạng thái kết thúc phiên `ASSIST` (`reconcileMediaSessionEnd`), kiểm tra quyền `ADMIN` hoặc `sosResponderAccountId`, khóa gửi trùng, xử lý lỗi `403`/`408`/`409` kèm làm mới sự cố, validate `resolutionNote` và xóa tuyến khi báo nhầm.
- `src/components/map/sosResponseRoute.ts` (mới): Parser `/response-route`, chuyển đổi `cm -> m` một lần (`xCm / 100`, `yCm / 100`), hỗ trợ tọa độ `0` / âm và `distanceCm = 0`, đối chiếu `mapId` & `mapAssetHash`, quản lý trạng thái không vẽ đường thẳng thay thế khi không có đường, và `SosRouteRequestGuard` hủy phản hồi đến muộn khi đổi ngữ cảnh.
- `src/components/media/MediaCallModal.tsx`: Phát `onSessionEnd` kèm metadata một lần duy nhất mỗi phiên kết thúc thật; phân biệt LiveKit `DISCONNECTED`, `TIMEOUT`, `CAMERA_LOST`, `ERROR`, `FAILED`, `EXPIRED` và đối soát lại `GET /media-sessions/{id}` trước khi coi là `ENDED`; gác máy chỉ kết thúc phiên media, không tự xác nhận SOS.
- `src/screens/main/AlertScreen.tsx`: Gỡ `startIncident()` tự động khỏi luồng tiếp nhận SOS ở cả `handleAcceptSosCall` và `handleAcknowledgeAlert` (giữ nguyên nghiệp vụ té ngã); hiển thị cụm nút **Xác nhận SOS thật** / **Báo nhầm** (có modal nhập `resolutionNote`) sau khi phiên `ASSIST` thật sự `ENDED`; hiển thị nút **Xem đường đến SOS** khi sự cố ở `IN_PROGRESS`; ẩn hành động xác nhận khi `RESOLVED` / `CLOSED` / `FALSE_ALARM`.
- `src/components/map/BackendHospitalMap.tsx`: Thêm prop `sosRoute` dùng chung phép chiếu `geometry.toViewPixel` (kể cả khi bản đồ xoay/căn chỉnh SLAM), mở rộng bounding box theo tuyến SOS, vẽ lớp tuyến đi bộ (`#EA580C` nét đứt có viền trắng) tách biệt hoàn toàn với đường dẫn Nav2 (`#0EA5E9`), gắn nhãn **Phòng trực SOS** và **Vị trí SOS đã ghi nhận**.
- `src/screens/main/MapScreen.tsx`: Nhận `focusSosIncidentId` từ tab navigation, tải `/response-route` bằng `apiClient`, tự chuyển `mapId` hoặc làm mới map/presentation khi lệch `mapAssetHash`, tách rõ 4 trạng thái (Đang tải / Có tuyến / Chưa có tuyến / Lỗi tải tuyến), không điều phối robot khi xem đường và xóa tuyến ngay khi đổi tài khoản, đổi server hoặc báo nhầm.
- `tests/sosFlow.test.cjs` & `package.json`: Thêm script `test:sos` kiểm chứng các ca nghiệp vụ, quyền, tọa độ và race condition.

## 2. Kịch bản demo trên Staff App

1. Bệnh nhân bấm nút SOS trên Robot -> xuất hiện cảnh báo khẩn cấp trên `AlertScreen`.
2. Staff được phân công bấm tiếp nhận & đàm thoại -> mở `MediaCallModal` chế độ `ASSIST`; sự cố không tự nhảy `IN_PROGRESS` trong lúc nhận hay nếu chỉ đóng/thu nhỏ/mất mạng tạm thời.
3. Kết thúc cuộc gọi (bấm gác máy hoặc BE chuyển phiên `ASSIST` sang `ENDED`) -> thẻ SOS giữ ngữ cảnh `(incidentId, robotId, sessionId)` và mở ra **Xác nhận SOS thật** + **Báo nhầm** cho `ADMIN` hoặc đúng `sosResponderAccountId`.
4. Chọn **Báo nhầm** -> bắt buộc nhập lý do (`resolutionNote`) -> gọi `POST /api/v1/emergency-incidents/{id}/false-alarm`, thẻ cập nhật `FALSE_ALARM`, ẩn nút xác nhận và xóa tuyến nếu đang lưu.
5. Chọn **Xác nhận SOS thật** -> gọi `POST /api/v1/emergency-incidents/{id}/confirm` -> cập nhật `IN_PROGRESS` và hiển thị nút **Xem đường đến SOS**.
6. Bấm **Xem đường đến SOS** -> chuyển sang tab **Bản đồ** đúng sự cố, gọi `GET /api/v1/emergency-incidents/{id}/response-route`, đối chiếu `mapId` + `mapAssetHash`, vẽ tuyến đi bộ từ **Phòng trực SOS** tới **Vị trí SOS đã ghi nhận** mà không điều phối robot.

## 3. Đối chiếu Backend thật vs Fixture Test

- **Đã đối chiếu OpenAPI live (`https://mediassistrover.duckdns.org/v3/api-docs`):**
  - Endpoint `POST /api/v1/emergency-incidents/{id}/confirm` (no requestBody -> `200 IncidentResponse`, errors `400/401/403/404/409/422`).
  - Endpoint `GET /api/v1/emergency-incidents/{id}/response-route` (`200 Response`, errors `400/401/403/404/422`).
  - Trường phân công `sosResponderAccountId` và `sosRoutingStatus` trên `IncidentResponse`.
- **Đã kiểm tra bằng fixture trong `tests/sosFlow.test.cjs` (do không tạo SOS test lên production và bản `D:\BE_MAR\BE_MAR` local ở commit `b4c98d3` chưa có 2 endpoint mới):**
  - Toàn bộ chuyển đổi trạng thái post-call `ASSIST`, lặp/đồng thời `/confirm`, lỗi `403/408/409` làm mới sự cố, `false-alarm` bắt buộc `resolutionNote` + xóa tuyến, chuyển đổi `cm -> m`, tọa độ `0` / âm, hash mismatch, trạng thái không có đường đi (`NO_PATH`, `UNWALKABLE`, `NO_COORDINATES`) và hủy response đến muộn.

## 4. Ví dụ response `/response-route` theo dữ liệu test

```json
{
  "status": "AVAILABLE",
  "mapId": "map-1",
  "mapAssetHash": "hash-v2",
  "unit": "cm",
  "origin": { "xCm": 0, "yCm": -250, "label": "Phòng trực SOS 1" },
  "destination": { "xCm": 450, "yCm": 120, "label": "Vị trí SOS hành lang B" },
  "points": [
    { "xCm": 0, "yCm": -250 },
    { "xCm": 200, "yCm": -250 },
    { "xCm": 450, "yCm": 120 }
  ],
  "distanceCm": 620
}
```

## 5. Các điểm hợp đồng còn cần Backend chốt rõ trong Swagger/DTO

1. **Va chạm schema `Point` trong OpenAPI live:** `Response.points` đang tham chiếu `#/components/schemas/Point` của `MapPresentation` (`{ x, y, minimum: 0 }`) thay vì `{ xCm, yCm }` (và có thể chứa số âm). Staff App hiện đọc `xCm ?? x` và `yCm ?? y`, đồng thời chấp nhận `0` và số âm.
2. **Trường người/giờ xác nhận trên `IncidentResponse`:** Swagger live hiện có `acknowledgedByAccountId`, `acknowledgedAt`, `sosResponderAccountId`, `sosRoutingStatus`, chưa liệt kê riêng `confirmedByAccountId` / `confirmedAt`. Staff App hỗ trợ cả 2 trường mới nếu BE trả về và fallback trung thực sang `acknowledgedByAccountId`/`acknowledgedAt` khi chưa có.
3. **Bảng hằng số `Response.status` & `Response.reason`:** Hiện Swagger khai báo `status` dạng `string` chung, chưa gắn enum cụ thể cho các ca thành công (`AVAILABLE`/`OK`) và thất bại (`NO_COORDINATES`, `MAP_MISMATCH`, `UNWALKABLE`, `NO_PATH`, ...).
4. **Đồng bộ mã nguồn local `D:\BE_MAR\BE_MAR`:** Bản local tham chiếu hiện vẫn ở commit cũ chưa merge 2 endpoint `/confirm` và `/response-route` như bản đang deploy trên DuckDNS.

## 6. Kết quả chạy kiểm tra thực tế

- `npm run typecheck` (`tsc --noEmit`): Đạt (exit code 0).
- `npm run test:sos` (`node --test tests/sosFlow.test.cjs`): 5/5 test passed.
- `npm run check:delivery` (`npm run typecheck && npm run test:delivery && npm run test:quantity`): typecheck đạt + 19/19 `delivery.test.cjs` + 9/9 `quantity.test.cjs` passed.
- `node --test tests/robotPose.test.cjs`: 4/4 test passed.
- Đóng gói Expo cục bộ (`npx expo export --platform android --output-dir "C:\Users\Trung\.gemini\antigravity\brain\9220006d-40ab-462d-95f2-ee73bddb9bab\scratch\expo-export" --clear`): Thành công (exit code 0, Android Bundled 2952 modules, `_expo/static/js/android/AppEntry-736f066c1ab14ecfd2752fe2eef8c94a.hbc` 5MB).

