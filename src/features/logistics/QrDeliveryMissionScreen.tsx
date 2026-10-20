import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/ui';
import { LogisticsStepper } from '../../components/LogisticsStepper';

type QrStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export function QrDeliveryMissionScreen() {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<QrStage>(6); // Default to the newly added flow for fast preview
  const [staffNotified, setStaffNotified] = useState(false);

  const handleNotifyStaff = () => {
    setStaffNotified(true);
    Alert.alert(
      'Đã thông báo Staff',
      'Đã gửi chuông báo và tin nhắn đến điện thoại của Dược sĩ trực tại Nhà thuốc.',
      [{ text: 'Đóng', style: 'default' }]
    );
  };

  const handleWrongItem = () => {
    Alert.alert(
      'Cảnh báo sai vật phẩm',
      'Mã vật phẩm không khớp với đơn thuốc #BN2047. Vui lòng lấy ra và đặt đúng đơn thuốc.',
      [{ text: 'Kiểm tra lại', style: 'default' }]
    );
  };

  const stepperLabels = [
    'Nhận\nnhiệm vụ',
    'Nhận\nvật phẩm',
    'Vận\nchuyển',
    'Đến\nnơi',
    'Bàn\ngiao',
    'Hoàn\nthành',
  ];

  // Determine current active step on the 6-step Stepper
  const getCurrentStep = (): number => {
    if (stage === 1) return 1;
    if (stage >= 2 && stage <= 8) return 2;
    if (stage === 9) return 3; // Đang vận chuyển
    if (stage === 10) return 4; // Đến nơi
    return 2;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 1. Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="hardware-chip" size={16} color="#0284C7" />
          <AppText style={styles.robotNameText}>MediRover #001</AppText>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <AppText style={styles.onlineText}>Online</AppText>
          </View>
        </View>
        <View style={styles.topBarRight}>
          <Ionicons name="battery-charging" size={16} color="#10B981" />
          <AppText style={styles.batteryText}>79%</AppText>
          <AppText style={styles.headerTimeText}>20:07</AppText>
        </View>
      </View>

      {/* 2. Task Banner */}
      <View style={styles.taskBanner}>
        <View style={styles.taskBannerLeft}>
          <AppText style={styles.taskIdText}>#TH02</AppText>
          <View style={styles.priorityBadge}>
            <AppText style={styles.priorityText}>Ưu tiên cao</AppText>
          </View>
          <AppText style={styles.routeSummaryText}>Nhà thuốc → P. Tim mạch</AppText>
        </View>
        <AppText style={styles.timeTag}>20:05</AppText>
      </View>

      {/* 3. Status Tags */}
      <View style={styles.tagRow}>
        <View
          style={[
            styles.tagItem,
            stage >= 8
              ? styles.tagItemLocked
              : stage >= 4 && stage <= 5
              ? styles.tagItemOrange
              : styles.tagItemDefault,
          ]}
        >
          <Ionicons
            name={
              stage >= 8
                ? 'lock-closed-outline'
                : stage >= 4 && stage <= 5
                ? 'lock-open-outline'
                : 'cube-outline'
            }
            size={13}
            color={
              stage >= 8
                ? '#059669'
                : stage >= 4 && stage <= 5
                ? '#D97706'
                : '#475569'
            }
          />
          <AppText
            style={[
              styles.tagText,
              stage >= 8
                ? { color: '#059669' }
                : stage >= 4 && stage <= 5
                ? { color: '#B45309' }
                : undefined,
            ]}
          >
            {stage >= 8
              ? 'Thùng đã khóa'
              : stage >= 6
              ? 'Đã nạp vật phẩm'
              : stage >= 4
              ? 'Thùng: Đang mở'
              : 'Thùng: Trống'}
          </AppText>
        </View>

        <View style={[styles.tagItem, styles.tagItemHighlight]}>
          <Ionicons name="qr-code-outline" size={13} color="#0284C7" />
          <AppText style={[styles.tagText, { color: '#0284C7' }]}>Quét mã QR</AppText>
        </View>
        <AppText style={styles.zoneText}>Zone A - Tầng 1</AppText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 4. Stepper 6 bước */}
        <LogisticsStepper
          currentStep={getCurrentStep()}
          steps={stepperLabels}
        />

        {/* 5. GIAI ĐOẠN 1: NHIỆM VỤ ĐƯỢC GIAO */}
        {stage === 1 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxBlue}>
              <Ionicons name="clipboard-outline" size={40} color="#0066CC" />
            </View>
            <View style={styles.statusPillBlue}>
              <View style={[styles.dot, { backgroundColor: '#0284C7' }]} />
              <AppText style={[styles.statusPillText, { color: '#0284C7' }]}>
                ĐÃ NHẬN NHIỆM VỤ
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Nhiệm vụ được giao</AppText>

            <View style={styles.detailsCard}>
              <AppText style={styles.cardHeaderTitle}>CHI TIẾT NHIỆM VỤ</AppText>
              <View style={styles.grid2x3}>
                <View style={styles.gridCell}>
                  <AppText style={styles.cellLabel}>VẬT PHẨM</AppText>
                  <AppText style={styles.cellValue}>Đơn thuốc #BN2047</AppText>
                </View>
                <View style={styles.gridCell}>
                  <AppText style={styles.cellLabel}>MÃ VẬT PHẨM</AppText>
                  <AppText style={styles.cellValue}>MED-BN2047-0904</AppText>
                </View>
                <View style={styles.gridCell}>
                  <AppText style={styles.cellLabel}>SỐ LƯỢNG</AppText>
                  <AppText style={styles.cellValue}>1 đơn vị</AppText>
                </View>
                <View style={styles.gridCell}>
                  <AppText style={styles.cellLabel}>NƠI GỬI</AppText>
                  <AppText style={styles.cellValue}>Nhà thuốc</AppText>
                </View>
                <View style={styles.gridCell}>
                  <AppText style={styles.cellLabel}>NƠI NHẬN</AppText>
                  <AppText style={styles.cellValue}>P. Tim mạch</AppText>
                </View>
                <View style={styles.gridCell}>
                  <AppText style={styles.cellLabel}>NGƯỜI NHẬN</AppText>
                  <AppText style={styles.cellValue}>BS. Trần Thị Lan</AppText>
                </View>
              </View>
              <View style={styles.verifyQrBox}>
                <Ionicons name="phone-portrait-outline" size={18} color="#0066CC" />
                <View style={{ flex: 1 }}>
                  <AppText style={styles.verifyQrLabel}>PHƯƠNG THỨC XÁC MINH - ĐÃ THIẾT LẬP</AppText>
                  <AppText style={styles.verifyQrTitle}>Quét mã QR</AppText>
                </View>
              </View>
              <View style={styles.noteBox}>
                <AppText style={styles.noteLabel}>GHI CHÚ</AppText>
                <AppText style={styles.noteText}>Thuốc huyết áp — xác minh QR bắt buộc</AppText>
              </View>
            </View>

            <Pressable onPress={() => setStage(2)} style={styles.actionBtnBlue}>
              <AppText style={styles.actionBtnText}>Bắt đầu di chuyển đến Nhà thuốc →</AppText>
            </Pressable>
          </View>
        )}

        {/* 6. GIAI ĐOẠN 2: ĐANG ĐẾN NHÀ THUỐC */}
        {stage === 2 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxBlue}>
              <Ionicons name="map-outline" size={40} color="#0066CC" />
            </View>
            <View style={styles.statusPillBlue}>
              <View style={[styles.dot, { backgroundColor: '#0284C7' }]} />
              <AppText style={[styles.statusPillText, { color: '#0284C7' }]}>
                ĐANG DI CHUYỂN ĐẾN NƠI GỬI
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Đang đến Nhà thuốc</AppText>

            <View style={styles.journeyCard}>
              <View style={styles.routePointsRow}>
                <View style={styles.pointItem}>
                  <View style={styles.pointIconWrap}>
                    <Ionicons name="hardware-chip" size={18} color="#0066CC" />
                  </View>
                  <AppText style={styles.pointRole}>NƠI ĐI</AppText>
                  <AppText style={styles.pointName}>Zone A</AppText>
                </View>
                <View style={styles.dashLineWrap}>
                  <View style={styles.dashLine} />
                  <View style={styles.distanceBadge}>
                    <AppText style={styles.distanceBadgeText}>22m · ~40s</AppText>
                  </View>
                </View>
                <View style={styles.pointItem}>
                  <View style={[styles.pointIconWrap, styles.destIconWrap]}>
                    <Ionicons name="business" size={18} color="#0F4C81" />
                  </View>
                  <AppText style={styles.pointRole}>ĐIỂM ĐẾN</AppText>
                  <AppText style={styles.pointName}>Nhà thuốc</AppText>
                </View>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <AppText style={styles.progressTitle}>TIẾN ĐỘ HÀNH TRÌNH</AppText>
                  <AppText style={styles.progressPercent}>45%</AppText>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: '45%' }]} />
                </View>
              </View>

              <View style={styles.metricsGrid}>
                <View style={styles.metricTile}>
                  <AppText style={styles.metricTileLabel}>KHOẢNG CÁCH CÒN LẠI</AppText>
                  <AppText style={styles.metricTileValue}>9.8m</AppText>
                </View>
                <View style={styles.metricTile}>
                  <AppText style={styles.metricTileLabel}>DỰ KIẾN ĐẾN</AppText>
                  <AppText style={styles.metricTileValue}>~14s</AppText>
                </View>
                <View style={styles.metricTile}>
                  <AppText style={styles.metricTileLabel}>TỐC ĐỘ</AppText>
                  <AppText style={styles.metricTileValue}>0.8 m/s</AppText>
                </View>
                <View style={styles.metricTile}>
                  <AppText style={styles.metricTileLabel}>TRẠNG THÁI</AppText>
                  <AppText style={[styles.metricTileValue, { color: '#0284C7' }]}>Đang di chuyển</AppText>
                </View>
              </View>
            </View>

            <Pressable onPress={() => setStage(3)} style={styles.actionBtnBlue}>
              <AppText style={styles.actionBtnText}>Robot đã đến Nhà thuốc →</AppText>
            </Pressable>
          </View>
        )}

        {/* 7. GIAI ĐOẠN 3: ROBOT ĐÃ ĐẾN NHÀ THUỐC */}
        {stage === 3 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxRedPin}>
              <Ionicons name="location" size={40} color="#DC2626" />
            </View>
            <View style={styles.statusPillTeal}>
              <View style={[styles.dot, { backgroundColor: '#0F766E' }]} />
              <AppText style={[styles.statusPillText, { color: '#0F766E' }]}>
                ĐÃ ĐẾN NƠI GỬI
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Robot đã đến Nhà thuốc</AppText>

            <View style={styles.pickupCard}>
              <View style={styles.pickupHeader}>
                <View style={styles.boxIconWrap}>
                  <Ionicons name="cube" size={28} color="#D97706" />
                </View>
                <View style={styles.pickupInfo}>
                  <AppText style={styles.pickupTitle}>Đơn thuốc #BN2047</AppText>
                  <AppText style={styles.pickupSubtitle}>Mã: MED-BN2047-0904 · SL: 1</AppText>
                </View>
              </View>
              <View style={styles.divider} />
              <AppText style={styles.waitingStaffText}>
                Robot đang đợi Staff đặt vật phẩm vào thùng.
              </AppText>
            </View>

            <Pressable
              onPress={handleNotifyStaff}
              style={[styles.notifyStaffBtn, staffNotified && styles.notifyStaffBtnDone]}
            >
              <Ionicons
                name={staffNotified ? 'checkmark-circle' : 'megaphone-outline'}
                size={18}
                color="#0066CC"
              />
              <AppText style={styles.notifyStaffText}>
                {staffNotified ? 'Đã thông báo Staff thành công' : 'Thông báo Staff'}
              </AppText>
            </Pressable>

            <Pressable onPress={() => setStage(4)} style={styles.actionBtnBlue}>
              <AppText style={styles.actionBtnText}>Tiến hành mở thùng nạp thuốc →</AppText>
            </Pressable>
          </View>
        )}

        {/* 8. GIAI ĐOẠN 4: ĐANG MỞ THÙNG... */}
        {stage === 4 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxOrange}>
              <Ionicons name="settings-outline" size={42} color="#D97706" />
            </View>
            <View style={styles.statusPillOrange}>
              <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
              <AppText style={[styles.statusPillText, { color: '#B45309' }]}>
                ĐANG MỞ THÙNG
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Đang mở thùng...</AppText>
            <View style={styles.dotsRow}>
              <View style={[styles.animDot, { backgroundColor: '#D97706' }]} />
              <View style={[styles.animDot, { backgroundColor: '#D97706', opacity: 0.8 }]} />
              <View style={[styles.animDot, { backgroundColor: '#D97706', opacity: 0.6 }]} />
            </View>
            <AppText style={styles.subNote}>Tự động chuyển khi thùng đã mở</AppText>

            <Pressable onPress={() => setStage(5)} style={styles.actionBtnBlue}>
              <AppText style={styles.actionBtnText}>Thùng đã mở hoàn toàn →</AppText>
            </Pressable>
          </View>
        )}

        {/* 9. GIAI ĐOẠN 5: ĐẶT VẬT PHẨM VÀO THÙNG */}
        {stage === 5 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxOrange}>
              <Ionicons name="mail-open-outline" size={42} color="#D97706" />
            </View>
            <View style={styles.statusPillOrange}>
              <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
              <AppText style={[styles.statusPillText, { color: '#B45309' }]}>
                THÙNG ĐANG MỞ · CHỜ ĐẶT VẬT PHẨM
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Đặt vật phẩm vào thùng</AppText>

            <View style={styles.itemDetailsCardOrange}>
              <View style={styles.grid2x2}>
                <View style={styles.cell2x2}>
                  <AppText style={styles.cellLabel}>VẬT PHẨM</AppText>
                  <AppText style={styles.cellValue}>Đơn thuốc #BN2047</AppText>
                </View>
                <View style={styles.cell2x2}>
                  <AppText style={styles.cellLabel}>MÃ</AppText>
                  <AppText style={styles.cellValue}>MED-BN2047-0904</AppText>
                </View>
                <View style={styles.cell2x2}>
                  <AppText style={styles.cellLabel}>SỐ LƯỢNG</AppText>
                  <AppText style={styles.cellValue}>1 đơn vị</AppText>
                </View>
                <View style={styles.cell2x2}>
                  <AppText style={styles.cellLabel}>CẢM BIẾN</AppText>
                  <AppText style={[styles.cellValue, { color: '#D97706' }]}>⏳ Đang chờ...</AppText>
                </View>
              </View>
            </View>

            <View style={styles.sensorHintRow}>
              <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
              <AppText style={styles.sensorHintText}>Cảm biến tự động phát hiện vật phẩm</AppText>
            </View>

            <Pressable onPress={() => setStage(6)} style={styles.actionBtnBlue}>
              <AppText style={styles.actionBtnText}>Cảm biến phát hiện → Kiểm tra vật phẩm</AppText>
            </Pressable>
          </View>
        )}

        {/* 10. GIAI ĐOẠN 6 (Ảnh 5 mới): ĐANG XÁC NHẬN VẬT PHẨM + NÚT CHỌN */}
        {stage === 6 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxBlue}>
              <Ionicons name="search-outline" size={42} color="#0066CC" />
            </View>
            <View style={styles.statusPillBlue}>
              <View style={[styles.dot, { backgroundColor: '#0284C7' }]} />
              <AppText style={[styles.statusPillText, { color: '#0284C7' }]}>
                ĐANG KIỂM TRA VẬT PHẨM
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Đang xác nhận vật phẩm</AppText>

            {/* Checklist Card */}
            <View style={styles.checklistCard}>
              <View style={styles.checkItem}>
                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                <AppText style={styles.checkItemSuccessText}>
                  Cảm biến phát hiện vật phẩm
                </AppText>
              </View>
              <View style={styles.checkItem}>
                <Ionicons name="hourglass-outline" size={20} color="#D97706" />
                <AppText style={styles.checkItemPendingText}>
                  Đang kiểm tra mã vật phẩm...
                </AppText>
              </View>
              <View style={styles.checkItem}>
                <Ionicons name="hourglass-outline" size={20} color="#D97706" />
                <AppText style={styles.checkItemPendingText}>
                  Đang xác nhận số lượng...
                </AppText>
              </View>
            </View>

            {/* 2 Nút: Vật phẩm đúng / Sai vật phẩm */}
            <View style={styles.twoButtonsRow}>
              <Pressable
                onPress={() => setStage(7)}
                style={styles.greenHalfBtn}
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <AppText style={styles.greenHalfBtnText}>Vật phẩm đúng</AppText>
              </Pressable>

              <Pressable
                onPress={handleWrongItem}
                style={styles.redHalfBtn}
              >
                <Ionicons name="close" size={18} color="#DC2626" />
                <AppText style={styles.redHalfBtnText}>Sai vật phẩm</AppText>
              </Pressable>
            </View>
          </View>
        )}

        {/* 11. GIAI ĐOẠN 7 (Ảnh 4 mới): VẬT PHẨM ĐÃ ĐƯỢC NHẬN */}
        {stage === 7 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxGreen}>
              <Ionicons name="checkmark-circle" size={46} color="#10B981" />
            </View>
            <View style={styles.statusPillGreen}>
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
              <AppText style={[styles.statusPillText, { color: '#047857' }]}>
                ĐÃ NHẬN VẬT PHẨM
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Vật phẩm đã được nhận</AppText>

            <View style={styles.itemDetailsCardGreen}>
              <View style={styles.grid2x2}>
                <View style={styles.cell2x2}>
                  <AppText style={styles.cellLabel}>VẬT PHẨM</AppText>
                  <AppText style={styles.cellValue}>Đơn thuốc #BN2047</AppText>
                </View>
                <View style={styles.cell2x2}>
                  <AppText style={styles.cellLabel}>THỜI GIAN NHẬN</AppText>
                  <AppText style={styles.cellValue}>20:07</AppText>
                </View>
                <View style={styles.cell2x2}>
                  <AppText style={styles.cellLabel}>CẢM BIẾN</AppText>
                  <AppText style={[styles.cellValue, { color: '#10B981' }]}>
                    ✓ Xác nhận có vật...
                  </AppText>
                </View>
                <View style={styles.cell2x2}>
                  <AppText style={styles.cellLabel}>BƯỚC TIẾP</AppText>
                  <AppText style={[styles.cellValue, { color: '#0F172A' }]}>
                    Đóng và khóa thùng
                  </AppText>
                </View>
              </View>
            </View>

            <Pressable onPress={() => setStage(8)} style={styles.actionBtnBlue}>
              <AppText style={styles.actionBtnText}>Tiến hành đóng và khóa thùng →</AppText>
            </Pressable>
          </View>
        )}

        {/* 12. GIAI ĐOẠN 8 (Ảnh 3 mới): ĐANG KHÓA THÙNG... */}
        {stage === 8 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxTeal}>
              <Ionicons name="settings-outline" size={42} color="#0D9488" />
            </View>
            <View style={styles.statusPillTeal}>
              <View style={[styles.dot, { backgroundColor: '#0D9488' }]} />
              <AppText style={[styles.statusPillText, { color: '#0F766E' }]}>
                ĐANG ĐÓNG VÀ KHÓA THÙNG
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Đang khóa thùng...</AppText>
            <View style={styles.dotsRow}>
              <View style={[styles.animDot, { backgroundColor: '#0D9488' }]} />
              <View style={[styles.animDot, { backgroundColor: '#0D9488', opacity: 0.8 }]} />
              <View style={[styles.animDot, { backgroundColor: '#0D9488', opacity: 0.6 }]} />
            </View>

            <Pressable onPress={() => setStage(9)} style={styles.actionBtnBlue}>
              <AppText style={styles.actionBtnText}>Bắt đầu vận chuyển đến P. Tim mạch →</AppText>
            </Pressable>
          </View>
        )}

        {/* 13. GIAI ĐOẠN 9 (Ảnh 2 mới): ĐANG ĐẾN P. TIM MẠCH (XE ĐỎ VẬN CHUYỂN) */}
        {stage === 9 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxRedCar}>
              <Ionicons name="car-sport" size={46} color="#DC2626" />
            </View>
            <View style={styles.statusPillBlue}>
              <View style={[styles.dot, { backgroundColor: '#0284C7' }]} />
              <AppText style={[styles.statusPillText, { color: '#0284C7' }]}>
                ĐANG VẬN CHUYỂN
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Đang đến P. Tim mạch</AppText>

            {/* Red Car Transit Card */}
            <View style={styles.transitCard}>
              <View style={styles.transitHeaderRow}>
                <View style={styles.lockBoxWrap}>
                  <Ionicons name="lock-closed" size={20} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText style={styles.lockBoxTitle}>Thùng đang khóa</AppText>
                  <AppText style={styles.lockBoxSubtitle}>Vật phẩm được bảo vệ</AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText style={styles.distanceRemainingBig}>49m</AppText>
                  <AppText style={styles.percentSmall}>44%</AppText>
                </View>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: '44%' }]} />
                </View>
              </View>

              <View style={styles.metricsGrid}>
                <View style={styles.metricTile}>
                  <AppText style={styles.metricTileLabel}>DỰ KIẾN ĐẾN</AppText>
                  <AppText style={styles.metricTileValue}>~74s</AppText>
                </View>
                <View style={styles.metricTile}>
                  <AppText style={styles.metricTileLabel}>TỐC ĐỘ</AppText>
                  <AppText style={styles.metricTileValue}>0.9 m/s</AppText>
                </View>
                <View style={styles.metricTile}>
                  <AppText style={styles.metricTileLabel}>MỨC ƯU TIÊN</AppText>
                  <AppText style={[styles.metricTileValue, { color: '#DC2626' }]}>
                    Ưu tiên cao
                  </AppText>
                </View>
                <View style={styles.metricTile}>
                  <AppText style={styles.metricTileLabel}>TRẠNG THÁI</AppText>
                  <AppText style={[styles.metricTileValue, { color: '#0284C7' }]}>
                    Đang giao
                  </AppText>
                </View>
              </View>
            </View>

            <Pressable onPress={() => setStage(10)} style={styles.actionBtnBlue}>
              <AppText style={styles.actionBtnText}>Robot đã đến P. Tim mạch →</AppText>
            </Pressable>
          </View>
        )}

        {/* 14. GIAI ĐOẠN 10 (Ảnh 1 mới): ROBOT ĐÃ ĐẾN P. TIM MẠCH - CHỜ QUÉT QR */}
        {stage === 10 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxHospital}>
              <Ionicons name="business" size={42} color="#0F4C81" />
            </View>
            <View style={styles.statusPillTeal}>
              <View style={[styles.dot, { backgroundColor: '#0F766E' }]} />
              <AppText style={[styles.statusPillText, { color: '#0F766E' }]}>
                ĐÃ ĐẾN ĐIỂM GIAO
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Robot đã đến P. Tim mạch</AppText>
            <AppText style={styles.heroSubtitle}>
              Đang chờ người nhận · Thùng vẫn khóa
            </AppText>

            {/* Recipient & Locked Box Card */}
            <View style={styles.arrivalCard}>
              <View style={styles.infoCardRow}>
                <View style={styles.infoCell}>
                  <AppText style={styles.cellLabel}>NGƯỜI NHẬN</AppText>
                  <AppText style={styles.cellValue}>BS. Trần Thị Lan</AppText>
                </View>
                <View style={styles.infoCell}>
                  <AppText style={styles.cellLabel}>THÙNG</AppText>
                  <AppText style={[styles.cellValue, { color: '#059669' }]}>
                    🔒 Đang khóa
                  </AppText>
                </View>
              </View>

              <View style={styles.authMethodPill}>
                <Ionicons name="phone-portrait-outline" size={18} color="#0066CC" />
                <View>
                  <AppText style={styles.authMethodLabel}>
                    PHƯƠNG THỨC XÁC MINH BẮT BUỘC
                  </AppText>
                  <AppText style={styles.authMethodValue}>Quét mã QR</AppText>
                </View>
              </View>
            </View>

            {/* Warning Box */}
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={18} color="#D97706" />
              <AppText style={styles.warningText}>
                Thùng chỉ được mở sau khi xác minh đúng phương thức.
              </AppText>
            </View>

            <Pressable onPress={() => setStage(1)} style={styles.actionBtnBlue}>
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <AppText style={styles.actionBtnText}>Bắt đầu lại chu trình nhiệm vụ</AppText>
            </Pressable>
          </View>
        )}

        {/* 15. THANH ĐIỀU KHIỂN CHỌN XEM NHANH 10 GIAI ĐOẠN */}
        <View style={styles.controlBox}>
          <AppText style={styles.controlTitle}>CHỌN XEM NHANH TOÀN BỘ 10 GIAI ĐOẠN ĐƠN THUỐC:</AppText>
          <View style={styles.stepTabsRow}>
            {([1, 2, 3, 4, 5] as QrStage[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setStage(s)}
                style={[styles.stepTab, stage === s && styles.stepTabActive]}
              >
                <AppText style={[styles.stepTabLabel, stage === s && styles.stepTabLabelActive]}>
                  {['1. Nhận', '2. Đi', '3. Đến trạm', '4. Mở', '5. Nạp'][s - 1]}
                </AppText>
              </Pressable>
            ))}
          </View>

          <View style={[styles.stepTabsRow, { marginTop: 4 }]}>
            {([6, 7, 8, 9, 10] as QrStage[]).map((s) => (
              <Pressable
                key={s}
                onPress={() => setStage(s)}
                style={[styles.stepTab, stage === s && styles.stepTabActive]}
              >
                <AppText style={[styles.stepTabLabel, stage === s && styles.stepTabLabelActive]}>
                  {['6. Kiểm tra', '7. Đã nhận', '8. Khóa', '9. Xe chạy', '10. Đến đích'][s - 6]}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  robotNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batteryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  headerTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  taskBanner: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  taskBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  taskIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  priorityBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  routeSummaryText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  timeTag: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagItemDefault: {
    backgroundColor: '#F1F5F9',
  },
  tagItemOrange: {
    backgroundColor: '#FEF3C7',
  },
  tagItemLocked: {
    backgroundColor: '#ECFDF5',
  },
  tagItemHighlight: {
    backgroundColor: '#E0F2FE',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  zoneText: {
    fontSize: 10,
    color: '#94A3B8',
    marginLeft: 'auto',
    fontWeight: '500',
  },
  scrollContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 40,
  },
  stateContainer: {
    alignItems: 'center',
    marginVertical: 4,
    gap: 8,
  },
  heroIconBoxBlue: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginVertical: 4,
  },
  heroIconBoxGreen: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginVertical: 4,
  },
  heroIconBoxTeal: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginVertical: 4,
  },
  heroIconBoxRedCar: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginVertical: 4,
  },
  heroIconBoxHospital: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginVertical: 4,
  },
  heroIconBoxRedPin: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginVertical: 4,
  },
  heroIconBoxOrange: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginVertical: 4,
  },
  statusPillBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusPillTeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusPillGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusPillOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  animDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subNote: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '500',
  },
  // Details Card
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  grid2x3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCell: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cellLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  cellValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  verifyQrBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D0E4FA',
    padding: 12,
  },
  verifyQrLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#0066CC',
    letterSpacing: 0.5,
  },
  verifyQrTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00478F',
  },
  noteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  noteLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  noteText: {
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
    fontWeight: '500',
  },
  // Journey Card
  journeyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    gap: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  routePointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointItem: {
    alignItems: 'center',
    width: 90,
  },
  pointIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  destIconWrap: {
    backgroundColor: '#EFF6FF',
  },
  pointRole: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  pointName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  dashLineWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: 8,
  },
  dashLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#0284C7',
    borderRadius: 1,
  },
  distanceBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  distanceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0284C7',
  },
  progressSection: {
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricTileLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricTileValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  // Pickup Card
  pickupCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    width: '100%',
    gap: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pickupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  boxIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pickupInfo: {
    flex: 1,
  },
  pickupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickupSubtitle: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#D1FAE5',
  },
  waitingStaffText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    lineHeight: 18,
  },
  notifyStaffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    width: '100%',
  },
  notifyStaffBtnDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  notifyStaffText: {
    color: '#0066CC',
    fontSize: 13,
    fontWeight: '700',
  },
  // Item details card orange
  itemDetailsCardOrange: {
    backgroundColor: '#FFFDFB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
    width: '100%',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  itemDetailsCardGreen: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    width: '100%',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  cell2x2: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sensorHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  sensorHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
  },
  // Checklist Card
  checklistCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkItemSuccessText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  checkItemPendingText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  twoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  greenHalfBtn: {
    flex: 1.2,
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  greenHalfBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  redHalfBtn: {
    flex: 1,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  redHalfBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '700',
  },
  // Transit Card
  transitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  transitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lockBoxWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  lockBoxSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  distanceRemainingBig: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0066CC',
  },
  percentSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  // Arrival Card
  arrivalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  infoCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoCell: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  authMethodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D0E4FA',
  },
  authMethodLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#0066CC',
    letterSpacing: 0.5,
  },
  authMethodValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00478F',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    width: '100%',
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
    fontWeight: '500',
  },
  // Action Buttons
  actionBtnBlue: {
    backgroundColor: '#0066CC',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    shadowColor: '#0066CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  // Control Box
  controlBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
    marginTop: 10,
  },
  controlTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  stepTab: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    alignItems: 'center',
  },
  stepTabActive: {
    backgroundColor: '#0066CC',
  },
  stepTabLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
  },
  stepTabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
