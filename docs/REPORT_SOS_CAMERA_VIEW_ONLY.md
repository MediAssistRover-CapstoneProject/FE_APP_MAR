# Báo cáo triển khai — Phát hiện té ngã & Phát hiện SOS tự động (Camera chỉ xem, không âm thanh)

## 1. Phạm vi & File đã cập nhật trong `D:\UI app`

- `src/screens/main/sosDecision.ts`:
  - Thêm `EmergencyAlertKind` (`'AUTO_FALL' | 'AUTO_GESTURE_SOS' | 'BUTTON_SOS' | 'OTHER'`) và `classifyEmergencyAlertKind(...)`: phân biệt theo `incidentType`, `notificationType`, và metadata nguồn `dataJson` (`source: "VISION_AI"`, `source_event_type`, `event_type`, `detection_event_id`, `source_payload_hash`), bảo đảm các cảnh báo Vision AI dùng `notificationType: "SOS"` (như `AI_SUSPECTED_FALL`, `AI_GESTURE_SOS`, `GESTURE_SOS`) không đi nhầm vào nhánh đàm thoại hai chiều `ASSIST`.
  - Thêm `needsIncidentLookupForSosClassification(...)`, `isAutoGestureSosIncident(...)`, `isCameraViewOnlyEmergency(...)`, `getMediaViewerPolicyForMode(...)`, `getMediaViewerPolicyForAlertKind(...)`, `isNonVoluntaryEndReason(...)` và `classifyCameraMonitorOpenError(...)`.
  - Cập nhật `reconcileMediaSessionEnd(...)` kiểm tra khớp `robotId`, phân biệt rõ đóng cửa sổ (`MODAL_CLOSE`), lỗi/timeout/mất khung hình, và bị BE thu hồi/preempt (`SOS_PREEMPTED_MONITOR`) với hành động chủ động bấm **Kết thúc xem** (`UI_END_BUTTON`).
- `src/components/media/MediaCallModal.tsx`:
  - Khóa cứng lớp media cho chế độ chỉ xem (`mode === 'MONITOR'`, `isViewOnly = mode !== 'ASSIST'`):
    - Không render `<audio id="remote-audio">` trong HTML WebView.
    - Truyền `autoSubscribe: false` khi `room.connect(...)` ở chế độ `MONITOR`.
    - Chủ động lọc và đồng bộ `RoomEvent.Connected`, `ParticipantConnected`, `TrackPublished`, và `Reconnected`: chỉ `setSubscribed(true)` với track `Video` của đúng participant `robot-<robotId>`, luôn `setSubscribed(false)` và bỏ qua mọi track `Audio` hoặc track của robot khác; `video.muted = true`.
    - Không gọi `room.startAudio()`, không gọi `setMicrophoneEnabled(...)`, bỏ qua `toggleMic`/`toggleAudio`, và đặt `mediaCapturePermissionGrantType="deny"` trên `<WebView>`.
    - Ẩn hoàn toàn nút Mic và Loa khỏi thanh điều khiển ở `MONITOR`, đổi nhãn kết thúc thành **Kết thúc xem**.
    - Bổ sung `externalError`, `onRetryCamera`, `isRetrying` và nút **Thử lại** + **Đóng** trên overlay lỗi (`ERROR`, `TIMEOUT`, `CAMERA_LOST`, `EXPIRED`, `FAILED`).
- `src/components/map/BackendRobotMonitorModal.tsx`:
  - Đặt `mediaCapturePermissionGrantType="deny"` cho WebView chế độ `MONITOR` và bỏ nút bật/tắt loa khỏi hàng điều khiển `MONITOR` để đồng bộ với lớp LiveKit không audio.
- `src/components/sos/FallDetectionModal.tsx`:
  - Bỏ nút và logic gọi `incidentApi.startIncident()` tự động khi mở hoặc bấm tiếp nhận.
  - Đổi nhãn nút thành **Xem camera robot** (hỗ trợ cả `AUTO_FALL` và `AUTO_GESTURE_SOS`), đồng thời đồng bộ trạng thái thật từ `incident` và hiển thị cụm **Xác nhận sự cố** / **Báo nhầm** (sau khi đã **Kết thúc xem**) hoặc **Xem đường đến SOS** (khi `IN_PROGRESS`).
- `src/screens/main/AlertScreen.tsx`:
  - Bổ sung `openViewOnlyCameraForAlert(...)` dùng tài khoản Staff hiện tại mở phiên `MONITOR` gắn chặt `(robotId, incidentId)` (tuyệt đối không dùng tài khoản quản trị làm đường vòng và không `acceptSession` lên phiên `ASSIST` BE tự tạo).
  - Rà toàn bộ điểm vào: popup `openUrgent` tự động, polling `RINGING` trong `fetchMediaSessions`, nút trên thẻ, `FallDetectionModal`, `SOSCallModal.onAccept`, và nút **Xem lại camera robot**.
  - Đưa Staff về đúng thẻ sự cố (`scrollViewRef` + viền focus) và gọi `refreshSingleIncident` sau **Kết thúc xem** để hiện **Xác nhận sự cố** (`POST /emergency-incidents/{id}/confirm`) hoặc **Báo nhầm** (`POST /emergency-incidents/{id}/false-alarm` kèm `resolutionNote`), và mở **Xem đường đến SOS** khi `IN_PROGRESS`.
  - Nghiệm thu giữ nguyên luồng **bệnh nhân bấm nút SOS trên Robot → đàm thoại hai chiều `ASSIST` → Xác nhận SOS thật → Bản đồ**.
- `tests/sosFlow.test.cjs`: Bổ sung kiểm thử phân loại đa nguồn `notificationType: "SOS"`, thực thi script LiveKit `buildMediaCallHtml` (`MONITOR` vs `ASSIST`) trên sandbox `vm`, rào lỗi `409`/mất kết nối/thử lại, và luồng post-view `/confirm` + `/false-alarm` + tuyến bản đồ cho cả `AUTO_FALL` và `AUTO_GESTURE_SOS`.

## 2. Phụ thuộc Backend / Pi đã kiểm chứng trong `D:\BE_MAR\BE_MAR`

1. **Xung đột `409 ROBOT_MEDIA_SESSION_ALREADY_OPEN` khi BE tự mở phiên `ASSIST`:**
   - Trong `EmergencyFlowService.java` (dòng 79), `create(...)` hiện gọi `mediaSessions.openSos(incident)` cho mọi sự cố đi qua `EmergencyFlowService` (bao gồm `VisionDetectionIngestionService` tạo `AI_SUSPECTED_FALL` và `AI_GESTURE_SOS`), sinh sẵn một phiên `RINGING` ở chế độ **`ASSIST`** (`staff = null`) nếu robot đang kết nối SSE.
   - Trong `MediaSessionService.java` (dòng 65-70), khi Staff gọi `POST /api/v1/media-sessions` với `mode: "MONITOR"`, BE kiểm tra `sessions.findByActiveRobotId(robotId)` và trả về **`409 ConflictException("ROBOT_MEDIA_SESSION_ALREADY_OPEN")`** vì phiên `RINGING` đang là `ASSIST`; đồng thời Staff thường không có quyền gọi `/end` lên phiên chưa được nhận (`s.getStaff() == null`, dòng 172 -> `403`).
   - **Cần BE/Pi hỗ trợ để thông suốt end-to-end cho `MONITOR`:**
     - `EmergencyFlowService` không tự gọi `openSos` chế độ `ASSIST` cho sự cố phát hiện tự động (`AI_SUSPECTED_FALL`, `AI_GESTURE_SOS`), hoặc mở sẵn ở chế độ `MONITOR` / cho phép `create(..., MONITOR, ...)` của đúng `sosResponder` thay thế phiên `RINGING` chưa ai nhận của cùng `incidentId`.
   - Khi LiveKit `MONITOR` hoạt động (`LiveKitGateway.java` dòng 62-64), BE cấp grant `canSubscribe: true, canPublish: false, canPublishSources: []` cho Staff và `canPublishSources: ["camera"]` cho device (không cấp quyền microphone hai chiều). Staff App không chấp nhận phiên `ASSIST` cho 2 loại cảnh báo tự động và hiển thị thông báo rõ kèm nút **Thử lại** nếu gặp `409` hoặc lỗi camera.

## 3. Kết quả kiểm tra thực tế

- `npm run typecheck` (`tsc --noEmit`): Đạt (exit code 0).
- `npm run test:sos` (`node --test tests/sosFlow.test.cjs`): 7/7 test passed.
- `npm run check:delivery` (`tsc --noEmit` + `tests/delivery.test.cjs` + `tests/quantity.test.cjs`): Đạt (19/19 `delivery.test.cjs` + 9/9 `quantity.test.cjs` passed).
- `node --test tests/robotPose.test.cjs`: 4/4 test passed.
- **Chưa kiểm tra trực tiếp trên thiết bị thật / production:** Chưa chạy kiểm thử phát video LiveKit thực tế từ Raspberry Pi hoặc tạo sự cố `AI_SUSPECTED_FALL` / `AI_GESTURE_SOS` trên server production (theo ràng buộc giữ môi trường an toàn và không push/deploy).
