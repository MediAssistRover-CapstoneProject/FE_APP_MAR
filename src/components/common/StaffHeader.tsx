import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { LogOut, ArrowLeft, User, Briefcase, Clock, MapPin, X, RefreshCw } from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigation } from '@react-navigation/native';
import { staffApi } from '../../api/modules/staff.api';
import { StaffMeResponse, ShiftResponse } from '../../api/types';

interface StaffHeaderProps {
  /** Tên nhân viên tùy chọn (mặc định lấy từ authStore hoặc staffApi) */
  staffName?: string;
  /** Callback khi bấm đăng xuất */
  onLogout?: () => void;
  /** Nút quay lại (nếu có) */
  onBack?: () => void;
  /** Tiêu đề phụ (mặc định 'MEDIASSISTROVER · NHÂN VIÊN') */
  subtitle?: string;
}

export const StaffHeader: React.FC<StaffHeaderProps> = ({
  staffName,
  onLogout,
  onBack,
  subtitle = 'MEDIASSISTROVER · NHÂN VIÊN',
}) => {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuthStore();
  const [staffData, setStaffData] = useState<StaffMeResponse | null>(null);
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const fetchStaffProfile = async () => {
    try {
      setIsLoadingProfile(true);
      const res = await staffApi.getStaffMe();
      if (res) {
        setStaffData(res);
      }
      const shiftRes = await staffApi.getStaffShifts({ size: 10 });
      if (shiftRes?.content) {
        setShifts(shiftRes.content);
      }
    } catch {
      // Giữ dữ liệu hiện tại nếu offline hoặc lỗi mạng nhẹ
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchStaffProfile();
  }, []);

  const displayName =
    staffName || staffData?.account?.fullName || user?.fullName || 'Nguyễn Thành Trung';
  const departmentName =
    staffData?.staffProfile?.departmentCode === 'KHO_DUOC'
      ? 'Kho Dược'
      : (staffData?.staffProfile?.departmentCode || 'Khoa Dược');
  const jobTitle = staffData?.staffProfile?.jobTitle || 'Nhân viên kho thuốc';
  const activeShift = staffData?.activeShifts?.[0] || shifts?.[0];

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await logout();
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } catch {
        navigation.navigate('Login');
      }
    }
  };

  return (
    <>
      <View style={styles.header} accessible accessibilityRole="header">
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => setShowProfileModal(true)}
          activeOpacity={0.8}
        >
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Quay lại"
              accessibilityRole="button"
            >
              <ArrowLeft size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={styles.avatarCircle} accessibilityLabel="Ảnh đại diện">
            <User size={18} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.brandSmall}>{subtitle}</Text>
              <View style={styles.badgeOnDuty} accessibilityLabel="Trạng thái trực">
                <Text style={styles.badgeOnDutyText}>ĐANG TRỰC</Text>
              </View>
            </View>
            <Text style={styles.staffName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.staffSubtitle} numberOfLines={1}>
              {departmentName} · {jobTitle}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutBtn}
          accessibilityLabel="Đăng xuất"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <LogOut size={13} color={Colors.primary} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================
          MODAL: HỒ SƠ NHÂN VIÊN & CA TRỰC Y TẾ (GET /staff/me)
      ======================================================== */}
      <Modal visible={showProfileModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.profileSheetContainer}>
            <View style={styles.sheetHandle} />

            <View style={styles.profileHeaderRow}>
              <View>
                <Text style={styles.profileCategoryLabel}>HỆ THỐNG Y TẾ · STAFF PROFILE</Text>
                <Text style={styles.profileModalTitle}>Hồ sơ nhân viên & Ca trực</Text>
              </View>
              <TouchableOpacity
                onPress={fetchStaffProfile}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isLoadingProfile ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <RefreshCw size={16} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {/* Account Card */}
              <View style={styles.profileCard}>
                <View style={styles.profileAvatarBox}>
                  <Text style={{ fontSize: 26 }}>👨‍⚕️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileFullName}>{displayName}</Text>
                  <Text style={styles.profileAccountCode}>
                    Tài khoản: {staffData?.account?.username || 'staff01'} ·{' '}
                    {staffData?.account?.role || 'STAFF'}
                  </Text>
                  <Text style={styles.profileContact}>
                    📧 {staffData?.account?.email || 'staff@gmail.com'} · 📱{' '}
                    {staffData?.account?.phone || '0827898981'}
                  </Text>
                </View>
              </View>

              {/* Department & Role Details */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionHeaderTitle}>VỊ TRÍ CÔNG TÁC TẠI BỆNH VIỆN</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoGridItem}>
                    <Briefcase size={14} color={Colors.primary} />
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.infoGridLabel}>KHOA / PHÒNG</Text>
                      <Text style={styles.infoGridValue}>{departmentName}</Text>
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <User size={14} color={Colors.tealDark} />
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.infoGridLabel}>CHỨC DANH</Text>
                      <Text style={styles.infoGridValue}>{jobTitle}</Text>
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <MapPin size={14} color="#D97706" />
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.infoGridLabel}>MÃ NHÂN VIÊN</Text>
                      <Text style={styles.infoGridValue}>
                        {staffData?.staffProfile?.staffCode || 'STF-TEST-001'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <Clock size={14} color={Colors.emerald} />
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.infoGridLabel}>TRẠNG THÁI</Text>
                      <Text style={[styles.infoGridValue, { color: Colors.emerald }]}>
                        Đang làm việc
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Active Shifts */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionHeaderTitle}>CA TRỰC ĐANG HIỆU LỰC (SHIFTS)</Text>
                {activeShift ? (
                  <View style={styles.shiftCard}>
                    <View style={styles.shiftCardTop}>
                      <View style={styles.shiftBadgeActive}>
                        <Text style={styles.shiftBadgeActiveText}>ĐANG TRỰC</Text>
                      </View>
                      <Text style={styles.shiftTime}>
                        {activeShift.startsAt
                          ? new Date(activeShift.startsAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '07:00'}{' '}
                        -{' '}
                        {activeShift.endsAt
                          ? new Date(activeShift.endsAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '17:00'}
                      </Text>
                    </View>
                    <Text style={styles.shiftTitle}>
                      {activeShift.shiftName || 'Ca trực Kho Dược & Vận chuyển'}
                    </Text>
                    <Text style={styles.shiftSubtext}>
                      Mã ca: {activeShift.shiftCode || 'CA_NGAY_01'} · Phòng:{' '}
                      {activeShift.roomCode || 'Kho Dược F1'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.shiftCard}>
                    <View style={styles.shiftCardTop}>
                      <View style={styles.shiftBadgeActive}>
                        <Text style={styles.shiftBadgeActiveText}>CA HÀNH CHÍNH</Text>
                      </View>
                      <Text style={styles.shiftTime}>07:00 - 17:00 (Hôm nay)</Text>
                    </View>
                    <Text style={styles.shiftTitle}>Ca tiếp nhận và cấp phát thuốc</Text>
                    <Text style={styles.shiftSubtext}>
                      Kho Dược bệnh viện · Phụ trách điều phối robot MAR-GAZEBO-01
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.sheetCloseButton}
              onPress={() => setShowProfileModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  backBtn: {
    marginRight: Spacing.sm,
    padding: 4,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandSmall: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  badgeOnDuty: {
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeOnDutyText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16A34A',
  },
  staffName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  staffSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Modal Profile & Shifts
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  profileSheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.md,
    paddingBottom: 32,
    maxHeight: '85%',
    ...Shadows.floating,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profileCategoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  profileModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 14,
    gap: 12,
  },
  profileAvatarBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileFullName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  profileAccountCode: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  profileContact: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },

  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoGridItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  infoGridLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  infoGridValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 1,
  },

  shiftCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  shiftCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  shiftBadgeActive: {
    backgroundColor: '#16A34A',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  shiftBadgeActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shiftTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  shiftTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  shiftSubtext: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },

  sheetCloseButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  sheetCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
