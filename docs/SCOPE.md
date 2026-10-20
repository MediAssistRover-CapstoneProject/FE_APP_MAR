# Phạm vi giao diện robot

Nguồn nghiệp vụ: tài liệu đề tài “Autonomous Hospital Assistant Robot System for Outpatient Department” (FA26SE015, NhanDT35), phần 3.1 “Functional requirement”. Tài liệu là nguồn thông tin nghiệp vụ; yêu cầu React Native + Expo Go và định hướng giao diện tiếng Việt của người dùng được áp dụng cho project này.

## Tương tác với bệnh nhân

Robot hỗ trợ tìm phòng khám, phòng xét nghiệm, nhà thuốc, quầy thanh toán và các khu dịch vụ. Người dùng có thể xem chỉ đường từng bước hoặc yêu cầu robot dẫn đường. Robot trả lời thông tin và quy trình khám ngoại trú, tiếp nhận lệnh bắt đầu/dừng dẫn đường và yêu cầu SOS qua giao diện hoặc giọng nói.

Bộ khung đã có các luồng giao diện cho tìm địa điểm, chỉ đường, dẫn đường, hỏi đáp văn bản, thông tin quy trình và SOS. Tương tác giọng nói được ghi nhận là phần cần tích hợp tiếp.

## Tác vụ nền và các sản phẩm khác

Module robot còn có định vị/bản đồ, lập đường đi, tránh vật cản, vận chuyển tài liệu/mẫu xét nghiệm/thuốc/vật tư; giám sát mật độ người; phát hiện té ngã, xâm nhập vùng hạn chế và báo lỗi đường bị chặn. Tài liệu cũng nêu xác minh bằng QR hoặc khuôn mặt cho cấp quyền tác vụ.

Nhân viên phân công nhiệm vụ, quản lý giao nhận, theo dõi robot, xử lý cảnh báo và xác nhận hoàn thành. Quản trị viên quản lý bản đồ, vùng hoạt động, người dùng, phân quyền, cấu hình và báo cáo. Đây là các module/phần mềm riêng theo đề tài, chưa đưa vào giao diện bệnh nhân.

## Giới hạn thông tin nguồn

Tài liệu chưa có API, dữ liệu bệnh viện, sơ đồ phòng, thiết kế UI, quy tắc cấp quyền, cấu trúc lệnh điều khiển hay cơ chế SOS thật. Các địa điểm, quy trình và hội thoại trong code là dữ liệu mẫu, có nhãn minh họa.

Tài liệu không yêu cầu chẩn đoán hoặc kê đơn. Phần trợ lý trong project giới hạn ở thông tin vận hành bệnh viện. Yêu cầu theo dõi thao tác quan trọng được chuẩn bị bằng request ID ở lớp API; nhật ký và danh tính phiên phải được backend bổ sung.

## Khi nhận bản thiết kế

Ưu tiên giữ chữ tiếng Việt rõ, thao tác trực tiếp, vùng bấm lớn và trạng thái loading/lỗi/trống/thành công. Áp dụng màu, typography, icon và bố cục qua các thành phần dùng chung trước, sau đó điều chỉnh từng màn hình. Kiểm tra điện thoại nhỏ, chữ phóng to, tablet và cả hai hướng màn hình.
