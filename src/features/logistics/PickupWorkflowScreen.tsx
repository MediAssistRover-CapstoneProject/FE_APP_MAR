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

type SubState = 1 | 2 | 3 | 4 | 5;

interface Props {
  onBackToOverview?: () => void;
}

export function PickupWorkflowScreen({ onBackToOverview }: Props) {
  const insets = useSafeAreaInsets();
  const [subState, setSubState] = useState<SubState>(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  // Auto transition simulation if enabled
  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setTimeout(() => {
      setSubState((prev) => (prev < 5 ? ((prev + 1) as SubState) : 1));
    }, 2800);
    return () => clearTimeout(timer);
  }, [subState, isAutoPlaying]);

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
          <AppText style={styles.headerTimeText}>20:06</AppText>
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
        <AppText style={styles.timeTag}>20:06</AppText>
      </View>

      {/* 3. Status Tags */}
      <View style={styles.tagRow}>
        <View
          style={[
            styles.tagItem,
            subState === 1 || subState === 2 ? styles.tagItemOrange : styles.tagItemTeal,
          ]}
        >
          <Ionicons
            name={
              subState === 1 || subState === 2
                ? 'lock-open-outline'
                : subState === 5
                ? 'lock-closed-outline'
                : 'cube-outline'
            }
            size={13}
            color={subState === 1 || subState === 2 ? '#D97706' : '#0F766E'}
          />
          <AppText
            style={[
              styles.tagText,
              { color: subState === 1 || subState === 2 ? '#B45309' : '#0F766E' },
            ]}
          >
            {subState === 1 || subState === 2
              ? 'Thùng: Đang mở'
              : subState === 5
              ? 'Thùng: Đang khóa'
              : 'Đã nạp vật phẩm'}
          </AppText>
        </View>

        <View style={[styles.tagItem, styles.tagItemHighlight]}>
          <Ionicons name="qr-code-outline" size={13} color="#0284C7" />
          <AppText style={[styles.tagText, { color: '#0284C7' }]}>Quét mã QR</AppText>
        </View>
        <AppText style={styles.zoneText}>Zone A - Tầng 1</AppText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 4. Stepper Bước 2 (Lấy vật phẩm) */}
        <LogisticsStepper currentStep={2} />

        {/* 5. NỘI DUNG TỪNG SUB-STATE */}

        {/* SUB-STATE 1 (Ảnh 5): ĐANG MỞ THÙNG... */}
        {subState === 1 && (
          <View style={styles.stateContainer}>
            <View style={[styles.heroIconBox, styles.heroIconBoxOrange]}>
              <Ionicons name="settings-outline" size={42} color="#D97706" />
            </View>
            <View style={[styles.statusPill, styles.statusPillOrange]}>
              <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
              <AppText style={[styles.statusPillText, { color: '#B45309' }]}>ĐANG MỞ THÙNG</AppText>
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

        {/* SUB-STATE 2 (Ảnh 4): ĐẶT VẬT PHẨM VÀO THÙNG */}
        {subState === 2 && (
          <View style={styles.stateContainer}>
            <View style={[styles.heroIconBox, styles.heroIconBoxOrange]}>
              <Ionicons name="mail-open-outline" size={42} color="#D97706" />
            </View>
            <View style={[styles.statusPill, styles.statusPillOrange]}>
              <View style={[styles.dot, { backgroundColor: '#D97706' }]} />
              <AppText style={[styles.statusPillText, { color: '#B45309' }]}>
                THÙNG ĐANG MỞ · CHỜ ĐẶT VẬT PHẨM
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Đặt vật phẩm vào thùng</AppText>

            {/* Card 2x2 Thông tin đơn */}
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
          </View>
        )}

        {/* SUB-STATE 3 (Ảnh 3): ĐANG XÁC NHẬN VẬT PHẨM */}
        {subState === 3 && (
          <View style={styles.stateContainer}>
            <View style={[styles.heroIconBox, styles.heroIconBoxBlue]}>
              <Ionicons name="search-outline" size={42} color="#0066CC" />
            </View>
            <View style={[styles.statusPill, styles.statusPillBlue]}>
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
          </View>
        )}

        {/* SUB-STATE 4 (Ảnh 2): VẬT PHẨM ĐÃ ĐƯỢC NHẬN */}
        {subState === 4 && (
          <View style={styles.stateContainer}>
            <View style={[styles.heroIconBox, styles.heroIconBoxGreen]}>
              <Ionicons name="checkmark-circle" size={46} color="#10B981" />
            </View>
            <View style={[styles.statusPill, styles.statusPillGreen]}>
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
              <AppText style={[styles.statusPillText, { color: '#047857' }]}>
                ĐÃ XÁC NHẬN VẬT PHẨM
              </AppText>
            </View>
            <AppText style={styles.heroTitle}>Vật phẩm đã được nhận</AppText>

            {/* Card 2x2 Thông tin xác nhận */}
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
          </View>
        )}

        {/* SUB-STATE 5 (Ảnh 1): ĐANG KHÓA THÙNG... */}
        {subState === 5 && (
          <View style={styles.stateContainer}>
            <View style={[styles.heroIconBox, styles.heroIconBoxTeal]}>
              <Ionicons name="settings-outline" size={42} color="#0D9488" />
            </View>
            <View style={[styles.statusPill, styles.statusPillTeal]}>
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
          </View>
        )}

        {/* 6. THANH ĐIỀU KHIỂN & CHỌN TRỰC TIẾP SUB-STATE */}
        <View style={styles.controlBox}>
          <View style={styles.controlHeaderRow}>
            <AppText style={styles.controlTitle}>CHỌN XEM NHANH 5 TRẠNG THÁI GIAO HÀNG:</AppText>
            <Pressable
              onPress={() => setIsAutoPlaying((v) => !v)}
              style={[styles.autoPlayBtn, isAutoPlaying && styles.autoPlayBtnActive]}
            >
              <Ionicons
                name={isAutoPlaying ? 'pause' : 'play'}
                size={12}
                color={isAutoPlaying ? '#FFFFFF' : '#0066CC'}
              />
              <AppText style={[styles.autoPlayText, isAutoPlaying && { color: '#FFFFFF' }]}>
                {isAutoPlaying ? 'Dừng tự động' : 'Tự động chạy'}
              </AppText>
            </Pressable>
          </View>

          <View style={styles.subStateTabsRow}>
            {([1, 2, 3, 4, 5] as SubState[]).map((step) => {
              const labels = [
                '1. Mở thùng',
                '2. Đặt hàng',
                '3. Kiểm tra',
                '4. Đã nhận',
                '5. Khóa thùng',
              ];
              const isSelected = subState === step;
              return (
                <Pressable
                  key={step}
                  onPress={() => setSubState(step)}
                  style={[styles.stepTab, isSelected && styles.stepTabActive]}
                >
                  <AppText style={[styles.stepTabLabel, isSelected && styles.stepTabLabelActive]}>
                    {labels[step - 1]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>

          {/* Action button tiến tới / lùi lại */}
          <View style={styles.flowActionsRow}>
            {subState > 1 && (
              <Pressable
                onPress={() => setSubState((prev) => (prev - 1) as SubState)}
                style={styles.backBtn}
              >
                <Ionicons name="arrow-back" size={16} color="#475569" />
                <AppText style={styles.backBtnText}>Bước trước</AppText>
              </Pressable>
            )}

            {subState < 5 ? (
              <Pressable
                onPress={() => setSubState((prev) => (prev + 1) as SubState)}
                style={styles.nextBtn}
              >
                <AppText style={styles.nextBtnText}>Tiếp tục bước tiếp</AppText>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setSubState(1)}
                style={[styles.nextBtn, { backgroundColor: '#0D9488' }]}
              >
                <AppText style={styles.nextBtnText}>Bắt đầu lại chu trình</AppText>
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
              </Pressable>
            )}
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
  tagItemOrange: {
    backgroundColor: '#FEF3C7',
  },
  tagItemTeal: {
    backgroundColor: '#CCFBF1',
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
  heroIconBox: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginVertical: 4,
  },
  heroIconBoxOrange: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  heroIconBoxBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  heroIconBoxGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  heroIconBoxTeal: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  statusPillOrange: {
    backgroundColor: '#FEF3C7',
  },
  statusPillBlue: {
    backgroundColor: '#E0F2FE',
  },
  statusPillGreen: {
    backgroundColor: '#DCFCE7',
  },
  statusPillTeal: {
    backgroundColor: '#CCFBF1',
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
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 6,
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
    marginTop: 2,
  },
  // Details Card Orange
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
  // Controls
  controlBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 12,
    marginTop: 10,
  },
  controlHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  autoPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  autoPlayBtnActive: {
    backgroundColor: '#0284C7',
  },
  autoPlayText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  subStateTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  stepTab: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
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
  flowActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  backBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  nextBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#0066CC',
    borderRadius: 12,
    shadowColor: '#0066CC',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  nextBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
