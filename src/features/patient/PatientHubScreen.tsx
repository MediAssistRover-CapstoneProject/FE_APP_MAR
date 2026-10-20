import React, { useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/navigation';
import { AppText } from '../../components/ui';
import { IndoorHospitalMap } from '../../components/IndoorHospitalMap';
import { AudioWaveform } from '../../components/AudioWaveform';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function PatientHubScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [currentTime, setCurrentTime] = useState('19:49');
  const [currentDate, setCurrentDate] = useState('THỨ 4, 19/08/2026');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 1. Header Bệnh viện */}
      <View style={styles.hospitalHeader}>
        <View style={styles.headerLeft}>
          <AppText style={styles.hospitalOrg}>BỆNH VIỆN ĐA KHOA TW</AppText>
          <AppText style={styles.hospitalAppTitle}>MediAssistRover</AppText>
        </View>
        <View style={styles.headerRight}>
          <AppText style={styles.timeText}>{currentTime}</AppText>
          <AppText style={styles.dateText}>{currentDate}</AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Thẻ Đang dẫn đường đến */}
        <View style={styles.navDestinationCard}>
          <View style={styles.navHeaderRow}>
            <View style={styles.robotAvatarBox}>
              <Ionicons name="hardware-chip" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.navDestInfo}>
              <AppText style={styles.navEyebrow}>ĐANG DẪN ĐƯỜNG ĐẾN</AppText>
              <AppText style={styles.navDestinationTitle}>Phòng Nội tổng hợp</AppText>
              <AppText style={styles.navDestinationSub}>Tầng 1 · Khu A · Phòng 102</AppText>
            </View>
          </View>

          {/* Metric 2 cột: Ước tính & Khoảng cách */}
          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <View style={styles.metricIconWrap}>
                <Ionicons name="time-outline" size={16} color="#0066CC" />
              </View>
              <View>
                <AppText style={styles.metricLabel}>ƯỚC TÍNH</AppText>
                <AppText style={styles.metricValue}>~2 phút</AppText>
              </View>
            </View>

            <View style={styles.metricPill}>
              <View style={styles.metricIconWrap}>
                <Ionicons name="navigate-outline" size={16} color="#0066CC" />
              </View>
              <View>
                <AppText style={styles.metricLabel}>KHOẢNG CÁCH</AppText>
                <AppText style={styles.metricValue}>~85m</AppText>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Sơ đồ định vị trong bệnh viện */}
        <IndoorHospitalMap targetRoom="Phòng 102" />

        {/* 4. Thẻ Số thứ tự khám & Hàng đợi */}
        <View style={styles.queueCard}>
          <View style={styles.queueMainRow}>
            <View style={styles.queueLeftCol}>
              <AppText style={styles.queueLabel}>SỐ THỨ TỰ</AppText>
              <AppText style={styles.queueBigNumber}>B047</AppText>
              <AppText style={styles.doctorText}>BS. Nguyễn Thị Lan - Phòng 102</AppText>
            </View>

            <View style={styles.queueRightCol}>
              <AppText style={styles.queueLabel}>GIỜ HẸN</AppText>
              <AppText style={styles.appointmentTime}>09:30</AppText>
              <AppText style={styles.timeRemaining}>Còn ~15 phút</AppText>
              <AppText style={styles.currentServing}>Đang khám: B044</AppText>
            </View>
          </View>

          {/* Hàng đợi tiến độ */}
          <View style={styles.queueProgressRow}>
            <View style={styles.dotsGroup}>
              <View style={[styles.queueDot, styles.queueDotDone]}>
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              </View>
              <View style={[styles.queueDot, styles.queueDotDone]}>
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              </View>
              <View style={[styles.queueDot, styles.queueDotDone]}>
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              </View>
              <View style={[styles.queueDot, styles.queueDotCurrent]}>
                <View style={styles.currentDotInner} />
              </View>
              <View style={[styles.queueDot, styles.queueDotPending]}>
                <Ionicons name="refresh-outline" size={10} color="#0284C7" />
              </View>
            </View>
            <AppText style={styles.aheadCountText}>Còn 3 người trước bạn</AppText>
          </View>
        </View>

        {/* 5. Thanh Trợ lý giọng nói (Voice Assistant) */}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Assistant')}
          style={({ pressed }) => [
            styles.voiceBanner,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={styles.micCircle}>
            <Ionicons name="mic" size={20} color="#009669" />
          </View>
          <View style={styles.voiceTextWrap}>
            <AppText style={styles.voiceTitle}>Đang lắng nghe...</AppText>
            <AppText style={styles.voicePrompt} numberOfLines={1}>
              "Dẫn tôi đến nhà thuốc" - "N..."
            </AppText>
          </View>
          <AudioWaveform color="#FFFFFF" count={12} height={24} />
        </Pressable>

        {/* 6. Hướng dẫn y tế */}
        <View style={styles.noticeCard}>
          <Ionicons name="information-circle" size={18} color="#D97706" style={styles.noticeIcon} />
          <AppText style={styles.noticeText}>
            <AppText style={styles.noticeHighlight}>Hướng dẫn: </AppText>
            Mang phiếu khám và CCCD vào phòng. Nếu cần hỗ trợ, nói chuyện với tôi.
          </AppText>
        </View>

        {/* 7. Nút Khẩn cấp - Gọi hỗ trợ ngay (SOS) */}
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Emergency')}
          style={({ pressed }) => [
            styles.sosButton,
            pressed && { backgroundColor: '#B91C1C', transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={styles.sosIconCircle}>
            <Ionicons name="megaphone" size={20} color="#DC2626" />
          </View>
          <View style={styles.sosTextWrap}>
            <AppText style={styles.sosTitle}>Khẩn cấp - Gọi hỗ trợ ngay</AppText>
            <AppText style={styles.sosSubtitle}>Nhấn để báo tình huống khẩn cấp</AppText>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" style={{ opacity: 0.8 }} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  hospitalHeader: {
    backgroundColor: colors.headerNavy,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  hospitalOrg: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  hospitalAppTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  dateText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 24,
  },
  // Destination Card
  navDestinationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  robotAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0066CC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0F2FE',
  },
  navDestInfo: {
    flex: 1,
  },
  navEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 0.6,
  },
  navDestinationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  navDestinationSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#D0E4FA',
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0066CC',
  },
  // Queue Card
  queueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  queueMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  queueLeftCol: {
    flex: 1,
  },
  queueRightCol: {
    alignItems: 'flex-end',
  },
  queueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  queueBigNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0052CC',
    letterSpacing: -1,
    lineHeight: 42,
  },
  doctorText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },
  appointmentTime: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  timeRemaining: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  currentServing: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  queueProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dotsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueDotDone: {
    backgroundColor: '#0066CC',
  },
  queueDotCurrent: {
    backgroundColor: '#BAE6FD',
  },
  currentDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0066CC',
  },
  queueDotPending: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  aheadCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  // Voice Banner
  voiceBanner: {
    backgroundColor: colors.voiceGreen,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#009669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  micCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTextWrap: {
    flex: 1,
  },
  voiceTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  voicePrompt: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '500',
  },
  // Notice
  noticeCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
  noticeHighlight: {
    fontWeight: '700',
    color: '#78350F',
  },
  // SOS
  sosButton: {
    backgroundColor: colors.danger,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  sosIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosTextWrap: {
    flex: 1,
  },
  sosTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  sosSubtitle: {
    color: '#FEE2E2',
    fontSize: 11,
  },
});
