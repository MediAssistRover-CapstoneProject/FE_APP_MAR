import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  LogOut,
  AlertTriangle,
  Phone,
  ChevronRight,
  ShieldAlert,
  Ban,
  Construction,
  Check,
  Bot,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { SOSCallModal } from '../../components/sos/SOSCallModal';
import { SOSStreamModal } from '../../components/sos/SOSStreamModal';
import { FallDetectionModal } from '../../components/sos/FallDetectionModal';

export const AlertScreen: React.FC = () => {
  // Modal states
  const [showSOSCall, setShowSOSCall] = useState(false);
  const [showSOSStream, setShowSOSStream] = useState(false);
  const [showFallDetail, setShowFallDetail] = useState(false);
  const [resolvedSOS, setResolvedSOS] = useState(false);

  return (
    <View style={styles.container}>
      {/* ===== TOP HEADER ===== */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <Text style={{ fontSize: 18 }}>🤖</Text>
          </View>
          <View>
            <View style={styles.headerTitleRow}>
              <Text style={styles.brandSmall}>MEDIASSISTROVER · STAFF</Text>
              <View style={styles.badgeOnDuty}>
                <Text style={styles.badgeOnDutyText}>ĐANG TRỰC</Text>
              </View>
            </View>
            <Text style={styles.staffName}>Y tá Nguyễn Văn An</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7}>
          <LogOut size={13} color={Colors.primary} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ===== SUBHEADER ===== */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderSub}>STAFF · Y TÁ NGUYỄN VĂN AN</Text>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Cảnh báo khẩn cấp</Text>
            <View style={styles.activeAlertBadge}>
              <View style={styles.alertDot} />
              <Text style={styles.activeAlertText}>2 ĐANG XẢY RA</Text>
            </View>
          </View>
        </View>

        {/* ===== DEMO BANNER: MỞ MÀN HÌNH CUỘC GỌI SOS ===== */}
        <TouchableOpacity
          style={styles.demoBanner}
          onPress={() => setShowSOSCall(true)}
          activeOpacity={0.85}
        >
          <View style={styles.demoBannerIcon}>
            <Phone size={18} color="#FFFFFF" />
          </View>
          <View style={styles.demoBannerText}>
            <Text style={styles.demoBannerTitle}>Demo - Mở màn hình cuộc gọi SOS</Text>
            <Text style={styles.demoBannerSubtitle}>Nhấn để xem luồng nhận cuộc gọi khẩn cấp</Text>
          </View>
          <ChevronRight size={18} color="#FECACA" />
        </TouchableOpacity>

        {/* ===== ALERT CARDS ===== */}

        {/* CARD 1: PHÁT HIỆN BỆNH NHÂN NGÃ */}
        <TouchableOpacity
          style={styles.cardAlert}
          onPress={() => setShowFallDetail(true)}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBoxOrange}>
              <AlertTriangle size={20} color="#D97706" />
            </View>
            <View style={styles.cardTitleBox}>
              <Text style={styles.cardTitle}>Phát hiện bệnh nhân ngã</Text>
            </View>
            <View style={styles.statusTagOrange}>
              <Text style={styles.statusTagOrangeText}>Đang xảy ra</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>ĐỊA ĐIỂM</Text>
              <Text style={styles.metaVal}>Khu chờ</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>ROBOT TẠI</Text>
              <Text style={styles.metaVal}>Khu chờ</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>GIỜ</Text>
              <Text style={styles.metaVal}>09:14</Text>
            </View>
          </View>

          <Text style={styles.cardDesc}>
            Cảm biến gia tốc và camera phát hiện va chạm mạnh.
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.blueBtn}
              onPress={() => setShowFallDetail(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.blueBtnText}>Điều phối nhân viên</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tealBtn}
              onPress={() => setShowFallDetail(true)}
              activeOpacity={0.8}
            >
              <Bot size={15} color={Colors.tealDark} />
              <Text style={styles.tealBtnText}>Gửi robot</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* CARD 2: TÍN HIỆU SOS TỪ BỆNH NHÂN */}
        <View style={styles.cardNormal}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBoxRed}>
              <Text style={{ fontSize: 14 }}>🆘</Text>
            </View>
            <View style={styles.cardTitleBox}>
              <Text style={styles.cardTitle}>Tín hiệu SOS từ bệnh nhân</Text>
            </View>
            <View style={[styles.statusTagOrange, resolvedSOS && styles.statusTagGray]}>
              <Text
                style={[
                  styles.statusTagOrangeText,
                  resolvedSOS && styles.statusTagGrayText,
                ]}
              >
                {resolvedSOS ? 'Đã giải quyết' : 'Đang xử lý'}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>ĐỊA ĐIỂM</Text>
              <Text style={styles.metaVal}>Hành lang chính</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>ROBOT TẠI</Text>
              <Text style={styles.metaVal}>Hành lang chính</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>GIỜ</Text>
              <Text style={styles.metaVal}>08:52</Text>
            </View>
          </View>

          <Text style={styles.cardDesc}>
            Bệnh nhân kích hoạt SOS. Nhân viên đã được thông báo.
          </Text>

          <TouchableOpacity
            style={[styles.outlineResolveBtn, resolvedSOS && styles.outlineResolveBtnDone]}
            onPress={() => setResolvedSOS(!resolvedSOS)}
            activeOpacity={0.8}
          >
            <Check size={14} color={resolvedSOS ? '#059669' : Colors.primary} />
            <Text
              style={[
                styles.outlineResolveBtnText,
                resolvedSOS && { color: '#059669' },
              ]}
            >
              {resolvedSOS ? 'Đã giải quyết xong' : 'Đánh dấu đã giải quyết ✓'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* CARD 3: XÂM NHẬP KHU VỰC HẠN CHẾ */}
        <View style={[styles.cardNormal, { opacity: 0.85 }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBoxGray}>
              <Ban size={18} color="#64748B" />
            </View>
            <View style={styles.cardTitleBox}>
              <Text style={styles.cardTitle}>Xâm nhập khu vực hạn chế</Text>
            </View>
            <View style={styles.statusTagGray}>
              <Text style={styles.statusTagGrayText}>Đã giải quyết</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>ĐỊA ĐIỂM</Text>
              <Text style={styles.metaVal}>P. Xét nghiệm</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>ROBOT TẠI</Text>
              <Text style={styles.metaVal}>P. Xét nghiệm</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>GIỜ</Text>
              <Text style={styles.metaVal}>08:30</Text>
            </View>
          </View>

          <Text style={styles.cardDesc}>
            Camera phát hiện người không có thẩm quyền. Đã thông báo bảo vệ.
          </Text>
        </View>

        {/* CARD 4: ĐƯỜNG BỊ CHẶN — HÀNH LANG A */}
        <View style={styles.cardAlert}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIconBoxOrange}>
              <Construction size={20} color="#D97706" />
            </View>
            <View style={styles.cardTitleBox}>
              <Text style={styles.cardTitle}>Đường bị chặn — Hành lang A</Text>
            </View>
            <View style={styles.statusTagOrange}>
              <Text style={styles.statusTagOrangeText}>Đang xảy ra</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>ĐỊA ĐIỂM</Text>
              <Text style={styles.metaVal}>Hành lang A</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>ROBOT TẠI</Text>
              <Text style={styles.metaVal}>Hành lang A</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>GIỜ</Text>
              <Text style={styles.metaVal}>09:22</Text>
            </View>
          </View>

          <Text style={styles.cardDesc}>
            Vật cản cố định tại hành lang A. Robot dừng và chờ lệnh.
          </Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.blueBtn} activeOpacity={0.8}>
              <Text style={styles.blueBtnText}>Điều phối nhân viên</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tealBtn} activeOpacity={0.8}>
              <Bot size={15} color={Colors.tealDark} />
              <Text style={styles.tealBtnText}>Gửi robot</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ===== SOS CALL OVERLAY MODAL ===== */}
      <SOSCallModal
        visible={showSOSCall}
        onAccept={() => {
          setShowSOSCall(false);
          setShowSOSStream(true);
        }}
        onDecline={() => setShowSOSCall(false)}
      />

      {/* ===== SOS STREAM & DISPATCH MODAL ===== */}
      <SOSStreamModal
        visible={showSOSStream}
        onClose={() => setShowSOSStream(false)}
        onDispatch={() => {
          setShowSOSStream(false);
          setShowFallDetail(true);
        }}
      />

      {/* ===== FALL DETECTION DETAIL MODAL ===== */}
      <FallDetectionModal
        visible={showFallDetail}
        onClose={() => setShowFallDetail(false)}
        onAcknowledge={() => {
          // Acknowledged
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandSmall: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5 },
  badgeOnDuty: {
    backgroundColor: '#D1FAE5',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeOnDutyText: { fontSize: 9, fontWeight: '700', color: Colors.emerald },
  staffName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  pageHeader: {
    marginBottom: Spacing.sm,
  },
  pageHeaderSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A2540',
  },
  activeAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  activeAlertText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },

  // Demo Banner
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#991B1B',
    borderRadius: 14,
    padding: 12,
    marginBottom: Spacing.md,
    shadowColor: '#991B1B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  demoBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  demoBannerText: {
    flex: 1,
  },
  demoBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  demoBannerSubtitle: {
    fontSize: 10,
    color: '#FECACA',
    marginTop: 1,
  },

  // Alert Cards
  cardAlert: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    ...Shadows.card,
  },
  cardNormal: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardIconBoxOrange: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxRed: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxGray: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBox: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A2540',
  },
  statusTagOrange: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagOrangeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusTagGray: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagGrayText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A2540',
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },

  // Buttons in card
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  blueBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#0284C7',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tealBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tealBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.tealDark,
  },
  outlineResolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  outlineResolveBtnDone: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  outlineResolveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
