# BÁO CÁO NGHIỆM THU — TINH CHỈNH FORM GIAO NHIỆM VỤ MOBILE
**Dự án:** MediAssist Staff App (`D:\UI app`)  
**Tài liệu tham chiếu:** `d:\MAR_Fall_AI\design-prompts-2026-11-14\PROMPT-STAFF-MOBILE-TASK-FORM.md`  
**Ngày thực hiện:** 14/11/2026  
**Trạng thái kiểm thử:** PASS 100% (TypeScript check + 17 delivery tests + 9 quantity tests + 4 robotPose tests)

---

## 1. Mục tiêu và các cải tiến đã thực hiện

Đợt tinh chỉnh này tập trung tối ưu hóa trải nghiệm thao tác một tay trên điện thoại (Mobile Ergonomics) cho phần **Nhiệm vụ → Tạo giao nhận mới** và các bộ chọn liên quan trong [MissionScreen.tsx](file:///d:/UI%20app/src/screens/main/MissionScreen.tsx) và [StaffOnDutyPicker.tsx](file:///d:/UI%20app/src/components/staff/StaffOnDutyPicker.tsx).

---

## 2. Chi tiết các thành phần và Control mới

### 2.1. Thay ô Số lượng bằng `QuantityStepper`
- **File mới:** [src/components/common/QuantityStepper.tsx](file:///d:/UI%20app/src/components/common/QuantityStepper.tsx) và [src/components/delivery/quantityHelper.ts](file:///d:/UI%20app/src/components/delivery/quantityHelper.ts).
- **Thiết kế:**
  - Bố cục một hàng gọn gàng: Nhãn **Số lượng** và badge **Đơn vị: Hộp / Ống nghiệm / Gói / Bộ** bên trái; Cụm **[-] [Số] [+]** bên phải.
  - Nút trừ/cộng: Vùng chạm tiêu chuẩn **48 × 48 dp**. Nút cộng nền đen than `#202022`, icon trắng; Nút trừ nền neutral `#F4F4F5`, viền `#E4E4E7`, icon tối.
  - Ô số ở giữa: Font 20, weight 700, căn giữa, khung minWidth 64dp, maxWidth 100dp, height 48dp.
  - Nhập trực tiếp bằng bàn phím số (`keyboardType="number-pad"`), cho phép xóa tạm để gõ lại mà không bị ép số 1 tức thì; chuẩn hóa số 0 đầu khi blur (ví dụ "05" -> "5").
  - Ràng buộc giá trị: Số nguyên từ 1 đến 2.147.483.647 (Int32 max). Ở 1, nút `-` bị vô hiệu hóa; ở 2.147.483.647, nút `+` bị vô hiệu hóa. Chặn triệt để số âm, số thập phân ("1.5"), ký tự chữ, số mũ ("1e3"), hex ("0x10").
  - Đơn vị tự động đồng bộ theo loại hàng:
    - Vận chuyển thuốc (`van_chuyen_thuoc`) → `Hộp`
    - Vận chuyển máu (`van_chuyen_mau`) → `Ống nghiệm`
    - Vận chuyển vật tư (`van_chuyen_vat_tu`) → `Gói`
    - Vận chuyển tài liệu (`van_chuyen_tai_lieu`) → `Bộ`

### 2.2. Nhóm lại Form theo cấu trúc Mobile (5 Nhóm rõ ràng)
- **Nhóm 1 — Phương thức bảo mật & xác thực:**
  - Thay thế 3 thẻ tab chật chội và banner dài bằng 1 hàng lựa chọn hiện đại (hiển thị icon, tên phương thức, mô tả ngắn và chevron).
  - Chạm vào mở [MobileBottomSheet.tsx](file:///d:/UI%20app/src/components/common/MobileBottomSheet.tsx) với 3 tùy chọn radio lớn:
    1. Giao mở tự do (Không cần xác nhận)
    2. Bảo mật quét mã QR (Khuyên dùng)
    3. Xác thực khuôn mặt (Face ID sinh trắc học)
  - Phần hướng dẫn dài được đưa vào accordion "▼ Xem chi tiết quy trình giao nhận" (thu gọn mặc định).
  - Khi chọn mode `face`, giữ nguyên luồng quét khuôn mặt người nhận [FaceScanModal.tsx](file:///d:/UI%20app/src/components/scanning/FaceScanModal.tsx).
- **Nhóm 2 — Thông tin hàng hóa & Số lượng:**
  - Loại hàng: Các chip dạng viên thuốc (pill), chiều cao 44dp, khi chọn có nền đen than `#202022` và icon tick trắng.
  - Tên hàng: TextInput font 15, chiều cao 52dp, bo góc 14dp.
  - Số lượng: Điều khiển bằng `QuantityStepper`.
- **Nhóm 3 — Lộ trình di chuyển & Nhân viên:**
  - Card lộ trình A → B trực quan với marker tròn A (đen) và B (xanh dương), nối bằng nét đứt thanh lịch và pill thông tin người gửi.
  - Bản đồ: Hàng chọn gọn mở `MobileBottomSheet` (nếu nhiều bản đồ) hoặc badge read-only (nếu chỉ 1 bản đồ).
  - Điểm lấy A: Tự điền từ ca trực của người gửi, chạm mở sheet chọn nếu có nhiều phòng trực.
  - Điểm giao B: Chạm mở sheet chọn phòng nhận hàng trên bản đồ đang dùng.
  - Người nhận: Nâng cấp [StaffOnDutyPicker.tsx](file:///d:/UI%20app/src/components/staff/StaffOnDutyPicker.tsx) với avatar, tên, phòng, giờ trực, nút Đổi/Bỏ chọn touch target >= 44dp. Không hiển thị UUID ở dòng chính. Prop `disabled` có hiệu lực ở mọi nhánh.
- **Nhóm 4 — Thông tin bổ sung:**
  - Mức độ ưu tiên: Segmented control 3 nút (Thấp / Bình thường / Cao), chiều cao 44dp, mặc định `high` (Cao = 80).
  - Ghi chú: Textarea multiline font 15, chiều cao linh hoạt, placeholder rõ ràng.
- **Nhóm 5 — Tóm tắt & Nút Tạo nhiệm vụ:**
  - Card tóm tắt 3 dòng: Vật phẩm (tên + số lượng + đơn vị), Lộ trình (A → B), Người nhận.
  - Dòng cảnh báo trạng thái nếu thiếu điều kiện (ví dụ: chưa chọn người nhận, chưa có ca trực).
  - Nút CTA chính: "Tạo nhiệm vụ giao hàng" (hoặc "Thử lại yêu cầu" khi retry attempt), minHeight 54dp, nền đen `#202022`, chữ trắng, bo góc 16dp.

### 2.3. Bottom Sheet dùng chung `MobileBottomSheet`
- Tạo component [MobileBottomSheet.tsx](file:///d:/UI%20app/src/components/common/MobileBottomSheet.tsx) dùng chung cho:
  - Chọn phương thức bảo mật (`showAuthModeSheet`)
  - Chọn bản đồ (`showMapSheet`)
  - Chọn phòng trực của người gửi A (`showPickupRoomModal`)
  - Chọn phòng giao hàng B (`showDeliveryRoomModal`)
  - Chọn nhân viên đang trực (`StaffOnDutyPicker`)
- Bo góc trên 24dp, nút đóng X touch target 48dp, chiều cao tối đa thích nghi 88% viewport, tránh cố định 360px gây che khuất khi bàn phím mở.

---

## 3. Bảo toàn 100% Nghiệp vụ Backend & Idempotency

1. **Khôi phục Pending Attempt:**
   - `handleSubmit` ưu tiên xử lý `attemptRef.current` trước validation form nháp mới.
   - Khi có request đang pending/reconcile, nút bấm hiển thị "Thử lại yêu cầu" và không bị chặn bởi form nháp.
   - Tách biệt hoàn toàn điều kiện khóa double-submit (`isSubmitting || submitInFlight.current`) khỏi validation của form nháp.
2. **Payload API giữ nguyên:**
   - Gửi đầy đủ `pickupRoomId`, `pickupEndpointId`, `deliveryRoomId`, `deliveryEndpointId`, `expectedSenderAccountId`, `expectedReceiverAccountId`, `receiverShiftId`, `items` (với `itemCategory`, `unit`, `quantity: number`, `sensitive`).
   - Ràng buộc QR `MARQR1`, xác nhận hàng, hủy nhiệm vụ tiếp tục hoạt động chính xác.

---

## 4. Kết quả kiểm thử thực tế

```powershell
> npm run check:delivery

> ui-app@1.0.0 typecheck
> tsc --noEmit
# Result: 0 errors

> ui-app@1.0.0 test:delivery
> node --test tests/delivery.test.cjs
✔ only the selected RUNNING, uninterrupted step enables scan
✔ cancel, other actor, conflicting assignment and unsupported workflow fail closed
✔ backend purpose works without hard-coded step names
✔ signed QR parser binds to job, phase and expiration; BE still verifies signature
✔ a verification for another actor/step is not success
✔ payload confirmation uses resolved items, close and lock are separate responses
✔ generic BE prompts work for the selected delivery leg but completed steps do not
✔ lost create response retries the same payload/key
✔ lost submit response recovers existing job and never creates twice
✔ switching account prevents submit after create resolves
✔ pending operation survives remount in its own server/account namespace
✔ cancellation is offered to creator or sender, not a receiver or unrelated account
✔ cancellation validates reason and submits the selected job ID with trimmed reason
✔ fresh ownership or terminal state wins over stale screen before cancellation
✔ pending cancellation is reconciled without sending a duplicate POST
✔ changing account during cancellation refresh prevents POST
✔ transport error remains an unknown result; retry reads pending intent before POST
ℹ tests 17 | pass 17 | fail 0 (433ms)

> ui-app@1.0.0 test:quantity
> node --test tests/quantity.test.cjs
✔ validateQuantity: valid positive integers from 1 up to 2147483647
✔ validateQuantity: rejects empty, null, or whitespace-only
✔ validateQuantity: rejects 0 and negative numbers
✔ validateQuantity: rejects decimals (1.5, 2,0)
✔ validateQuantity: rejects scientific notation (1e3), hex (0x10), and letters
✔ validateQuantity: rejects overflow beyond 2147483647
✔ incrementQuantity and decrementQuantity handle limits and rapid changes accurately
✔ normalizeQuantityOnCommit removes leading zeros for valid numbers
✔ getItemCategoryAndUnit correctly maps task types to category and Vietnamese unit
ℹ tests 9 | pass 9 | fail 0 (351ms)
```

```powershell
> node --test tests/robotPose.test.cjs
✔ HTTP 200 with null or missing coordinates must not create an origin position
✔ real zero and negative coordinates remain valid and can be formatted
✔ numeric JSON strings are normalized before rendering toFixed
✔ missing heading retains existing map fallback without admitting missing position
ℹ tests 4 | pass 4 | fail 0 (482ms)
```

---

## 5. Giới hạn và ghi nhận

1. **Phạm vi kiểm thử:** Toàn bộ typecheck, logic validation số lượng, quy trình hủy/reconcile giao nhận và SLAM robot pose đã được kiểm chứng tự động. Giao diện thực tế đã được tinh chỉnh cho các kích thước viewport phổ biến (360×640, 390×844, 430×932) với font sans hệ thống tiếng Việt rõ ràng.
2. **Không tác động backend/robot:** Đợt tinh chỉnh này chỉ can thiệp vào giao diện và tầng điều khiển client trong `D:\UI app`, không gửi yêu cầu giả vào cơ sở dữ liệu thật hay điều khiển phần cứng robot vật lý.
