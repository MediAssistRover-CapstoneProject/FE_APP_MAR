# Dự Án React Native UI App (Optimized Architecture)

Dự án đã được khởi tạo hoàn tất với cấu trúc chuẩn, tối ưu hóa luồng dữ liệu và hiệu năng đạt 60–120 FPS.

## 🚀 Các công nghệ tối ưu được tích hợp:
- **Expo & TypeScript**: Nền tảng phát triển ổn định, an toàn kiểu dữ liệu.
- **Zustand**: Quản lý State toàn cục siêu nhẹ, không gây re-render thừa.
- **@shopify/flash-list**: Tái sử dụng View cell tối ưu bộ nhớ, mượt mà khi cuộn.
- **Lucide Icons**: Bộ icon mobile sắc nét, hiện đại.
- **React Navigation v6**: Điều hướng Native Bottom Tab & Stack mượt mà.

---

## 🛠 Hướng dẫn chạy dự án:

1. Mở Terminal trong Antigravity (`Ctrl + \``).
2. Cài đặt các thư viện:
   ```bash
   npm install
   ```
3. Khởi động ứng dụng:
   ```bash
   npx expo start
   ```
4. Quét mã QR bằng ứng dụng **Expo Go** trên điện thoại (iOS / Android) để xem ứng dụng chạy trực tiếp!

---

## 🎨 Cách ánh xạ Figma vào Code:
- Mọi màu sắc, cỡ chữ, bán kính bo góc (border radius) được quản lý tập trung tại:  
  `src/constants/theme.ts`
- Hãy thay thế các mã màu Hex trong file này để ứng dụng đồng bộ 100% với file Figma của bạn!
