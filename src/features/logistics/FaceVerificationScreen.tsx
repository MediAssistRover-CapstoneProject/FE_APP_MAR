import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { AppText } from '../../components/ui';
import { LogisticsStepper } from '../../components/LogisticsStepper';

type FaceStep = 1 | 2 | 3 | 4 | 5;

export function FaceVerificationScreen() {
  const insets = useSafeAreaInsets();
  const [faceStep, setFaceStep] = useState<FaceStep>(1);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanProgress, setScanProgress] = useState(78);

  // Animated laser scan line
  const laserAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (faceStep === 3 || faceStep === 4) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      laserAnim.setValue(0);
    }
  }, [faceStep, laserAnim]);

  // Auto progression from scanning -> comparing -> success
  useEffect(() => {
    if (faceStep === 3) {
      const interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setFaceStep(4);
            return 100;
          }
          return prev + 6;
        });
      }, 300);
      return () => clearInterval(interval);
    }
    if (faceStep === 4) {
      const timer = setTimeout(() => {
        setFaceStep(5);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [faceStep]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 1. Header Trạng thái Robot */}
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
          <AppText style={styles.headerTimeText}>21:28</AppText>
        </View>
      </View>

      {/* 2. Banner Thông tin nhiệm vụ */}
      <View style={styles.taskBanner}>
        <View style={styles.taskBannerLeft}>
          <AppText style={styles.taskIdText}>#TH02</AppText>
          <View style={styles.priorityBadge}>
            <AppText style={styles.priorityText}>Ưu tiên cao</AppText>
          </View>
          <AppText style={styles.routeSummaryText}>Nhà thuốc → P. Tim mạch</AppText>
        </View>
        <AppText style={styles.timeTag}>21:28</AppText>
      </View>

      {/* 3. Status Tags */}
      <View style={styles.tagRow}>
        <View style={styles.tagItem}>
          <Ionicons
            name={faceStep === 5 ? 'lock-open-outline' : 'lock-closed-outline'}
            size={13}
            color={faceStep === 5 ? '#10B981' : '#475569'}
          />
          <AppText style={[styles.tagText, faceStep === 5 && { color: '#059669' }]}>
            {faceStep === 5 ? 'Thùng: Mở khóa' : 'Thùng: Đã khóa'}
          </AppText>
        </View>

        <View style={[styles.tagItem, styles.tagItemHighlight]}>
          <Ionicons name="person-circle-outline" size={13} color="#0284C7" />
          <AppText style={[styles.tagText, { color: '#0284C7' }]}>Xác minh khuôn mặt</AppText>
        </View>
        <AppText style={styles.zoneText}>Zone A - Tầng 1</AppText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 4. Stepper */}
        <LogisticsStepper currentStep={faceStep === 5 ? 5 : 4} />

        {/* 5. GIAI ĐOẠN 1 (Ảnh 5): ROBOT ĐÃ ĐẾN P. TIM MẠCH */}
        {faceStep === 1 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxBlue}>
              <Ionicons name="business" size={42} color="#0066CC" />
            </View>
            <View style={styles.statusPillTeal}>
              <View style={[styles.dot, { backgroundColor: '#0F766E' }]} />
              <AppText style={[styles.statusPillText, { color: '#0F766E' }]}>
                ĐÃ ĐẾN NƠI GIAO
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Robot đã đến P. Tim mạch</AppText>
            <AppText style={styles.heroSubtitle}>Đang chờ người nhận · Thùng đã khóa</AppText>

            {/* Card người nhận & thùng */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardRow}>
                <View style={styles.infoCell}>
                  <AppText style={styles.cellLabel}>NGƯỜI NHẬN</AppText>
                  <AppText style={styles.cellValue}>BS. Trần Thị Lan</AppText>
                </View>
                <View style={styles.infoCell}>
                  <AppText style={styles.cellLabel}>THÙNG</AppText>
                  <AppText style={[styles.cellValue, { color: '#D97706' }]}>
                    🔒 Đang khóa
                  </AppText>
                </View>
              </View>

              <View style={styles.authMethodPill}>
                <Ionicons name="scan-outline" size={16} color="#0066CC" />
                <View>
                  <AppText style={styles.authMethodLabel}>PHƯƠNG THỨC XÁC MINH BẮT BUỘC</AppText>
                  <AppText style={styles.authMethodValue}>Quét nhận diện khuôn mặt</AppText>
                </View>
              </View>
            </View>

            {/* Warning Box */}
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={18} color="#D97706" />
              <AppText style={styles.warningText}>
                Thùng chỉ được mở sau khi người nhận đã được xác minh.
              </AppText>
            </View>

            <Pressable
              onPress={() => setFaceStep(2)}
              style={styles.actionBtnOrange}
            >
              <AppText style={styles.actionBtnText}>Bắt đầu quét khuôn mặt</AppText>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {/* 6. GIAI ĐOẠN 2 (Ảnh 4): CHỜ XÁC MINH KHUÔN MẶT - CAMERA MỞ */}
        {faceStep === 2 && (
          <View style={styles.stateContainer}>
            <View style={styles.statusPillOrange}>
              <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
              <AppText style={[styles.statusPillText, { color: '#B45309' }]}>
                CHỜ XÁC MINH KHUÔN MẶT
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Xác minh khuôn mặt</AppText>

            {/* Warning Top Box */}
            <View style={styles.instructionBanner}>
              <Ionicons name="person" size={16} color="#D97706" />
              <AppText style={styles.instructionBannerText}>
                Nhìn thẳng vào camera · Không đeo khẩu trang · Đứng cách 50–80 cm
              </AppText>
            </View>

            {/* Khung Camera Quét Thật */}
            <View style={styles.cameraFrameWrapper}>
              {permission?.granted ? (
                <CameraView facing="front" style={styles.cameraView} />
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <Ionicons name="person" size={80} color="#CBD5E1" />
                  <Pressable
                    onPress={requestPermission}
                    style={styles.grantCameraBtn}
                  >
                    <Ionicons name="camera" size={16} color="#FFFFFF" />
                    <AppText style={styles.grantCameraText}>Bấm cấp quyền Camera</AppText>
                  </Pressable>
                </View>
              )}

              {/* 4 Corner Brackets */}
              <View style={[styles.cornerBracket, styles.bracketTL]} />
              <View style={[styles.cornerBracket, styles.bracketTR]} />
              <View style={[styles.cornerBracket, styles.bracketBL]} />
              <View style={[styles.cornerBracket, styles.bracketBR]} />

              {/* Center Silhouette Overlay */}
              <View style={styles.silhouetteOverlay} pointerEvents="none">
                <Ionicons name="person-outline" size={110} color="rgba(245, 158, 11, 0.35)" />
              </View>
            </View>

            {/* Hướng dẫn chi tiết */}
            <View style={styles.guideCard}>
              <AppText style={styles.guideHeader}>HƯỚNG DẪN</AppText>
              <AppText style={styles.guideItem}>• Đứng cách camera 50–80 cm</AppText>
              <AppText style={styles.guideItem}>• Không đeo khẩu trang, kính râm</AppText>
              <AppText style={styles.guideItem}>• Hướng mặt thẳng vào camera</AppText>
              <AppText style={styles.guideItem}>• Đảm bảo đủ ánh sáng</AppText>
            </View>

            {/* 2 Cells */}
            <View style={styles.grid2x2}>
              <View style={styles.cell2x2}>
                <AppText style={styles.cellLabel}>SỐ LẦN THỬ CÒN LẠI</AppText>
                <AppText style={styles.cellValue}>3/3</AppText>
              </View>
              <View style={styles.cell2x2}>
                <AppText style={styles.cellLabel}>THÙNG</AppText>
                <AppText style={[styles.cellValue, { color: '#D97706' }]}>🔒 Đang khóa</AppText>
              </View>
            </View>

            <Pressable
              onPress={() => {
                setScanProgress(30);
                setFaceStep(3);
              }}
              style={styles.actionBtnOrange}
            >
              <AppText style={styles.actionBtnText}>Bắt đầu xác minh →</AppText>
            </Pressable>
          </View>
        )}

        {/* 7. GIAI ĐOẠN 3 (Ảnh 3): GIỮ NGUYÊN — ĐANG QUÉT KHUÔN MẶT */}
        {faceStep === 3 && (
          <View style={styles.stateContainer}>
            <View style={styles.statusPillOrange}>
              <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
              <AppText style={[styles.statusPillText, { color: '#B45309' }]}>
                ĐANG PHÁT HIỆN KHUÔN MẶT
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Giữ nguyên — Đang quét</AppText>

            {/* Khung Camera với Laser Quét Chuyển Động */}
            <View style={styles.cameraFrameWrapper}>
              {permission?.granted ? (
                <CameraView facing="front" style={styles.cameraView} />
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <Ionicons name="person" size={80} color="#FDE68A" />
                </View>
              )}

              {/* 4 Corner Brackets */}
              <View style={[styles.cornerBracket, styles.bracketTL]} />
              <View style={[styles.cornerBracket, styles.bracketTR]} />
              <View style={[styles.cornerBracket, styles.bracketBL]} />
              <View style={[styles.cornerBracket, styles.bracketBR]} />

              {/* Animated Laser Beam */}
              <Animated.View
                style={[
                  styles.laserBeam,
                  {
                    transform: [
                      {
                        translateY: laserAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 210],
                        }),
                      },
                    ],
                  },
                ]}
              />

              {/* Face Guide Silhouette */}
              <View style={styles.silhouetteOverlay} pointerEvents="none">
                <Ionicons name="person" size={100} color="rgba(245, 158, 11, 0.2)" />
              </View>
            </View>

            {/* Thanh tiến độ quét */}
            <View style={styles.scanProgressWrap}>
              <View style={styles.scanLabelRow}>
                <AppText style={styles.scanProgressLabel}>ĐANG PHÁT HIỆN KHUÔN MẶT</AppText>
                <AppText style={styles.scanPercentText}>{scanProgress}%</AppText>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${scanProgress}%` }]} />
              </View>
            </View>

            <Pressable
              onPress={() => setFaceStep(4)}
              style={styles.actionBtnOrange}
            >
              <AppText style={styles.actionBtnText}>Xác minh người nhận →</AppText>
            </Pressable>
          </View>
        )}

        {/* 8. GIAI ĐOẠN 4 (Ảnh 2): ĐANG SO SÁNH KHUÔN MẶT... */}
        {faceStep === 4 && (
          <View style={styles.stateContainer}>
            <View style={styles.statusPillOrange}>
              <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
              <AppText style={[styles.statusPillText, { color: '#B45309' }]}>
                ĐANG XÁC MINH NGƯỜI NHẬN
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Đang so sánh khuôn mặt...</AppText>

            {/* Khung Camera Quét Khớp */}
            <View style={styles.cameraFrameWrapper}>
              {permission?.granted ? (
                <CameraView facing="front" style={styles.cameraView} />
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <Ionicons name="person" size={80} color="#FDE68A" />
                </View>
              )}

              {/* 4 Corner Brackets */}
              <View style={[styles.cornerBracket, styles.bracketTL]} />
              <View style={[styles.cornerBracket, styles.bracketTR]} />
              <View style={[styles.cornerBracket, styles.bracketBL]} />
              <View style={[styles.cornerBracket, styles.bracketBR]} />

              {/* Orange Horizontal Scan line stationary */}
              <View style={styles.stationaryScanLine} />
            </View>

            {/* 3 Animated Dots */}
            <View style={styles.dotsRow}>
              <View style={[styles.animDot, { backgroundColor: '#D97706' }]} />
              <View style={[styles.animDot, { backgroundColor: '#D97706', opacity: 0.8 }]} />
              <View style={[styles.animDot, { backgroundColor: '#D97706', opacity: 0.6 }]} />
            </View>

            <AppText style={styles.dbComparingText}>Đang so sánh với cơ sở dữ liệu...</AppText>
          </View>
        )}

        {/* 9. GIAI ĐOẠN 5 (Ảnh 1): XÁC MINH THÀNH CÔNG! */}
        {faceStep === 5 && (
          <View style={styles.stateContainer}>
            <View style={styles.statusPillGreen}>
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
              <AppText style={[styles.statusPillText, { color: '#047857' }]}>
                XÁC MINH KHUÔN MẶT THÀNH CÔNG
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Xác minh thành công!</AppText>

            {/* Khung Camera Xanh Lá với Dấu Tích [✓] */}
            <View style={[styles.cameraFrameWrapper, styles.cameraFrameSuccess]}>
              <View style={styles.successCheckCircle}>
                <Ionicons name="checkmark" size={54} color="#FFFFFF" />
              </View>

              {/* 4 Green Corner Brackets */}
              <View style={[styles.cornerBracket, styles.bracketTL, styles.bracketGreen]} />
              <View style={[styles.cornerBracket, styles.bracketTR, styles.bracketGreen]} />
              <View style={[styles.cornerBracket, styles.bracketBL, styles.bracketGreen]} />
              <View style={[styles.cornerBracket, styles.bracketBR, styles.bracketGreen]} />
            </View>

            {/* Card Kết quả */}
            <View style={styles.resultCard}>
              <View style={styles.infoCardRow}>
                <View style={styles.infoCell}>
                  <AppText style={styles.cellLabel}>NGƯỜI NHẬN</AppText>
                  <AppText style={styles.cellValue}>BS. Nguyễn Văn An</AppText>
                </View>
                <View style={styles.infoCell}>
                  <AppText style={styles.cellLabel}>KẾT QUẢ</AppText>
                  <AppText style={[styles.cellValue, { color: '#10B981' }]}>
                    ✓ Khuôn mặt khớp
                  </AppText>
                </View>
              </View>
            </View>

            {/* Unlock Button */}
            <Pressable
              onPress={() => setFaceStep(1)}
              style={styles.actionBtnGreen}
            >
              <Ionicons name="lock-open-outline" size={20} color="#FFFFFF" />
              <AppText style={styles.actionBtnText}>Mở khóa thùng và hoàn tất</AppText>
            </Pressable>
          </View>
        )}

        {/* 10. THANH ĐIỀU KHIỂN XEM TỪNG BƯỚC */}
        <View style={styles.controlBox}>
          <AppText style={styles.controlTitle}>CHỌN XEM NHANH 5 TRẠNG THÁI XÁC MINH:</AppText>
          <View style={styles.stepTabsRow}>
            {([1, 2, 3, 4, 5] as FaceStep[]).map((step) => {
              const labels = [
                '1. Đến nơi',
                '2. Bật camera',
                '3. Đang quét',
                '4. So sánh',
                '5. Thành công',
              ];
              const isSelected = faceStep === step;
              return (
                <Pressable
                  key={step}
                  onPress={() => setFaceStep(step)}
                  style={[styles.stepTab, isSelected && styles.stepTabActive]}
                >
                  <AppText style={[styles.stepTabLabel, isSelected && styles.stepTabLabelActive]}>
                    {labels[step - 1]}
                  </AppText>
                </Pressable>
              );
            })}
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
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagItemHighlight: {
    backgroundColor: '#E0F2FE',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
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
  statusPillTeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CCFBF1',
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
  statusPillGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
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
  // Info Card
  infoCard: {
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
  cellLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  cellValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
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
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 10,
    width: '100%',
  },
  instructionBannerText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  // Camera Frame
  cameraFrameWrapper: {
    width: 230,
    height: 270,
    borderRadius: 24,
    backgroundColor: '#FFFBEB',
    borderWidth: 2,
    borderColor: '#F59E0B',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cameraFrameSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
    shadowColor: '#10B981',
  },
  cameraView: {
    ...StyleSheet.absoluteFill,
  },
  cameraPlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF5',
    gap: 12,
  },
  grantCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  grantCameraText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cornerBracket: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#F59E0B',
  },
  bracketGreen: {
    borderColor: '#10B981',
  },
  bracketTL: {
    top: 6,
    left: 6,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  bracketTR: {
    top: 6,
    right: 6,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bracketBL: {
    bottom: 6,
    left: 6,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bracketBR: {
    bottom: 6,
    right: 6,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  silhouetteOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laserBeam: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 3,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  stationaryScanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 3,
    backgroundColor: '#F59E0B',
    borderRadius: 2,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  successCheckCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  // Guide Card
  guideCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    width: '100%',
    gap: 4,
  },
  guideHeader: {
    fontSize: 9,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  guideItem: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500',
  },
  grid2x2: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cell2x2: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scanProgressWrap: {
    width: '100%',
    gap: 6,
    marginVertical: 4,
  },
  scanLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanProgressLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  scanPercentText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
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
  dbComparingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  resultCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    width: '100%',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  // Buttons
  actionBtnOrange: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnGreen: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    gap: 8,
    marginTop: 8,
  },
  controlTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
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
    backgroundColor: '#F59E0B',
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
