import React, { useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/ui';
import { LogisticsStepper } from '../../components/LogisticsStepper';

type HandoverState = 1 | 2 | 3 | 4;

export function HandoverWorkflowScreen() {
  const insets = useSafeAreaInsets();
  const [handoverState, setHandoverState] = useState<HandoverState>(2);
  const [countdown, setCountdown] = useState(29);
  const [isCounting, setIsCounting] = useState(true);

  // Countdown timer for state 3 (Thùng sắp tự đóng)
  useEffect(() => {
    if (handoverState !== 3 || !isCounting) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setHandoverState(4); // Auto close when timeout
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [handoverState, isCounting]);

  // Stepper labels for Handover stage
  const stepperLabels = [
    'Nhận\nnhiệm vụ',
    'Nạp vật\nphẩm',
    'Vận\nchuyển',
    'Đến\nnơi',
    'Bàn\ngiao',
    'Hoàn\nthành',
  ];

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
          <AppText style={styles.headerTimeText}>20:00</AppText>
        </View>
      </View>

      {/* 2. Task Banner */}
      <View style={styles.taskBanner}>
        <View style={styles.taskBannerLeft}>
          <AppText style={styles.taskIdText}>#VT001</AppText>
          <View style={styles.priorityBadge}>
            <AppText style={styles.priorityText}>Bình thường</AppText>
          </View>
          <AppText style={styles.routeSummaryText}>Kho vật tư → P. Điều dưỡng</AppText>
        </View>
        <AppText style={styles.timeTag}>19:59</AppText>
      </View>

      {/* 3. Status Tags */}
      <View style={styles.tagRow}>
        <View style={[styles.tagItem, styles.tagItemOrange]}>
          <Ionicons
            name={handoverState === 4 ? 'lock-closed-outline' : 'lock-open-outline'}
            size={13}
            color="#D97706"
          />
          <AppText style={[styles.tagText, { color: '#B45309' }]}>
            {handoverState === 4 ? 'Thùng: Đang đóng' : 'Thùng: Đang mở'}
          </AppText>
        </View>

        <View style={[styles.tagItem, styles.tagItemGreen]}>
          <Ionicons name="shield-checkmark-outline" size={13} color="#059669" />
          <AppText style={[styles.tagText, { color: '#059669' }]}>Không cần quét</AppText>
        </View>
        <AppText style={styles.zoneText}>Zone A - Tầng 1</AppText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 4. Stepper Bước 5 */}
        <LogisticsStepper currentStep={5} steps={stepperLabels} />

        {/* 5. GIAI ĐOẠN 1 (Ảnh 4): ĐANG MỞ THÙNG... */}
        {handoverState === 1 && (
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
          </View>
        )}

        {/* 6. GIAI ĐOẠN 2 (Ảnh 3): VUI LÒNG LẤY VẬT PHẨM */}
        {handoverState === 2 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxHands}>
              <Ionicons name="hand-left-outline" size={38} color="#D97706" />
            </View>
            <View style={styles.statusPillOrange}>
              <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
              <AppText style={[styles.statusPillText, { color: '#B45309' }]}>
                ĐANG CHỜ NGƯỜI NHẬN LẤY VẬT PHẨM
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Vui lòng lấy vật phẩm</AppText>

            {/* Card vật tư & cảm biến */}
            <View style={styles.handoverCard}>
              <AppText style={styles.itemTitle}>Vật tư y tế thông thường</AppText>
              <View style={styles.sensorRow}>
                <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
                <AppText style={styles.sensorText}>Cảm biến: Vật phẩm vẫn còn trong thùng</AppText>
              </View>
              <AppText style={styles.autoCloseText}>Thùng tự đóng nếu không lấy trong 30s</AppText>
            </View>

            {/* 2 Nút thao tác */}
            <View style={styles.buttonsRow}>
              <Pressable
                onPress={() => setHandoverState(4)}
                style={styles.greenActionBtn}
              >
                <AppText style={styles.greenActionBtnText}>✓ Đã lấy vật phẩm</AppText>
              </Pressable>

              <Pressable
                onPress={() => {
                  setCountdown(29);
                  setIsCounting(true);
                  setHandoverState(3);
                }}
                style={styles.beigeActionBtn}
              >
                <AppText style={styles.beigeActionBtnText}>Chưa lấy được</AppText>
              </Pressable>
            </View>
          </View>
        )}

        {/* 7. GIAI ĐOẠN 3 (Ảnh 1): THÙNG SẮP TỰ ĐÓNG (ĐẾM NGƯỢC 29S) */}
        {handoverState === 3 && (
          <View style={styles.stateContainer}>
            <View style={styles.heroIconBoxWarning}>
              <Ionicons name="warning" size={42} color="#DC2626" />
            </View>
            <View style={styles.statusPillOrange}>
              <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
              <AppText style={[styles.statusPillText, { color: '#B45309' }]}>
                VẬT PHẨM CHƯA ĐƯỢC LẤY
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Thùng sắp tự đóng</AppText>
            <AppText style={styles.countdownBigNumber}>{countdown}s</AppText>

            {/* Card thông báo đếm ngược */}
            <View style={styles.warningCard}>
              <AppText style={styles.warningCardNotice}>
                Cảm biến xác nhận vật phẩm vẫn còn trong thùng. Robot sẽ đóng khóa thùng khi hết giờ.
              </AppText>
              {/* Progress Bar đếm ngược */}
              <View style={styles.countdownProgressTrack}>
                <View
                  style={[
                    styles.countdownProgressFill,
                    { width: `${Math.max(5, (countdown / 30) * 100)}%` },
                  ]}
                />
              </View>
            </View>

            {/* 2 Nút xử lý */}
            <View style={styles.fullButtonsColumn}>
              <Pressable
                onPress={() => setHandoverState(4)}
                style={styles.fullGreenBtn}
              >
                <AppText style={styles.greenActionBtnText}>✓ Đã lấy vật phẩm</AppText>
              </Pressable>

              <Pressable
                onPress={() => setHandoverState(4)}
                style={styles.fullRedOutlineBtn}
              >
                <AppText style={styles.redOutlineBtnText}>Đóng thùng và báo Staff</AppText>
              </Pressable>
            </View>
          </View>
        )}

        {/* 8. GIAI ĐOẠN 4 (Ảnh 2): ĐANG ĐÓNG THÙNG... */}
        {handoverState === 4 && (
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
            <AppText style={styles.heroTitle}>Đang đóng thùng...</AppText>
            <View style={styles.dotsRow}>
              <View style={[styles.animDot, { backgroundColor: '#0D9488' }]} />
              <View style={[styles.animDot, { backgroundColor: '#0D9488', opacity: 0.8 }]} />
              <View style={[styles.animDot, { backgroundColor: '#0D9488', opacity: 0.6 }]} />
            </View>
            <AppText style={styles.subNoteTeal}>Tự động chuyển sang 'Đã bàn giao'</AppText>
          </View>
        )}

        {/* 9. BẢNG ĐIỀU KHIỂN CHỌN TRẠNG THÁI */}
        <View style={styles.controlBox}>
          <AppText style={styles.controlTitle}>CHỌN XEM NHANH 4 TRẠNG THÁI BÀN GIAO:</AppText>
          <View style={styles.stepTabsRow}>
            {([1, 2, 3, 4] as HandoverState[]).map((step) => {
              const labels = [
                '1. Mở thùng',
                '2. Chờ lấy hàng',
                '3. Cảnh báo 29s',
                '4. Đóng thùng',
              ];
              const isSelected = handoverState === step;
              return (
                <Pressable
                  key={step}
                  onPress={() => {
                    if (step === 3) {
                      setCountdown(29);
                      setIsCounting(true);
                    }
                    setHandoverState(step);
                  }}
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
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
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
  tagItemOrange: {
    backgroundColor: '#FEF3C7',
  },
  tagItemGreen: {
    backgroundColor: '#ECFDF5',
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
  heroIconBoxHands: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    marginVertical: 4,
  },
  heroIconBoxWarning: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
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
  statusPillOrange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
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
  countdownBigNumber: {
    fontSize: 44,
    fontWeight: '900',
    color: '#F59E0B',
    lineHeight: 48,
    marginVertical: 2,
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
  subNoteTeal: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '500',
  },
  // Handover Card
  handoverCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFEDD5',
    width: '100%',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  sensorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  autoCloseText: {
    fontSize: 11,
    color: '#9A3412',
    opacity: 0.8,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 6,
  },
  greenActionBtn: {
    flex: 1.2,
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  greenActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  beigeActionBtn: {
    flex: 1,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  beigeActionBtnText: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '700',
  },
  // Warning Card
  warningCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    width: '100%',
    gap: 12,
  },
  warningCardNotice: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  countdownProgressTrack: {
    height: 8,
    backgroundColor: '#FDE68A',
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%',
  },
  countdownProgressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  fullButtonsColumn: {
    width: '100%',
    gap: 10,
    marginTop: 8,
  },
  fullGreenBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  fullRedOutlineBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  redOutlineBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
  // Control Box
  controlBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 8,
    marginTop: 10,
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
