import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  ArrowRight,
  LogOut,
  User,
  KeyRound,
  BadgeCheck,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../api/client';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'FirstLoginPasswordChange'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'FirstLoginPasswordChange'>;

export const FirstLoginPasswordChangeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();

  const {
    username: initialUsername = '',
    currentPassword: initialCurrentPassword = '',
    staffCode: initialStaffCode = '',
  } = route.params || {};

  const { changePassword, login, logout, isLoading, error: storeError, clearError } = useAuthStore();

  // Bắt buộc nhập Mã nhân viên (Staff Code) để xác định đúng tài khoản y tế
  const [staffCode, setStaffCode] = useState(
    initialStaffCode || (initialUsername ? initialUsername.toUpperCase() : 'STF-001')
  );
  const [accountUsername, setAccountUsername] = useState(initialUsername || 'staff1');
  const [currentPassword, setCurrentPassword] = useState(initialCurrentPassword || '12345678');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tiêu chuẩn kiểm tra
  const hasStaffCode = staffCode.trim().length > 0;
  const hasMinLength = newPassword.length >= 8;
  const isDifferentFromCurrent = newPassword.length > 0 && newPassword !== currentPassword;
  const isMatchingConfirm = confirmPassword.length > 0 && newPassword === confirmPassword;
  const hasMixedChars = /[0-9]/.test(newPassword) && /[a-zA-Z]/.test(newPassword);

  // Đánh giá mức độ bảo mật
  const getPasswordStrength = () => {
    if (!newPassword) return { score: 0, text: 'Chưa nhập', color: '#94A3B8' };
    if (newPassword.length < 8) return { score: 1, text: 'Quá ngắn', color: '#EF4444' };
    if (!hasMixedChars) return { score: 2, text: 'Trung bình', color: '#F59E0B' };
    if (newPassword.length >= 10 && /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return { score: 4, text: 'Rất mạnh', color: '#059669' };
    }
    return { score: 3, text: 'Mạnh', color: '#10B981' };
  };

  const strength = getPasswordStrength();

  const handleLogout = async () => {
    Alert.alert(
      'Hủy kích hoạt tài khoản?',
      'Bạn chưa hoàn thành đổi mật khẩu lần đầu. Bạn sẽ không thể sử dụng ứng dụng cho đến khi cập nhật mật khẩu mới.',
      [
        { text: 'Tiếp tục đổi', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]
    );
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    clearError();

    const cleanStaffCode = staffCode.trim();
    const cleanUsername = accountUsername.trim() || 'staff1';

    if (!cleanStaffCode) {
      setErrorMessage('Vui lòng nhập Mã nhân viên (Staff Code) để xác định tài khoản cần đổi mật khẩu.');
      return;
    }
    if (!currentPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu tạm thời hiện tại.');
      return;
    }
    if (!hasMinLength) {
      setErrorMessage('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (!isDifferentFromCurrent) {
      setErrorMessage('Mật khẩu mới phải khác với mật khẩu tạm thời ban đầu.');
      return;
    }
    if (!isMatchingConfirm) {
      setErrorMessage('Xác nhận mật khẩu mới không trùng khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Kiểm tra phiên xác thực (ưu tiên token đã có sẵn trong apiClient hoặc useAuthStore)
      const existingToken = apiClient.getToken() || useAuthStore.getState().token;
      if (!existingToken) {
        // Chỉ đăng nhập nếu chưa có session
        const loggedIn = await login(cleanUsername, currentPassword);
        if (!loggedIn) {
          const authError = useAuthStore.getState().error;
          if (authError?.includes('khóa tạm thời')) {
            setErrorMessage('Tài khoản ' + cleanUsername + ' đang bị khóa tạm thời do nhập sai mật khẩu quá 5 lần. Vui lòng đợi 15 phút hoặc thử tài khoản khác (ví dụ: staff2).');
          } else {
            setErrorMessage(authError || 'Tên đăng nhập hoặc mật khẩu tạm thời không đúng. Vui lòng kiểm tra lại!');
          }
          setIsSubmitting(false);
          return;
        }
      }

      // 2. Gọi API đổi mật khẩu (PUT /api/v1/auth/change-password)
      const changed = await changePassword(currentPassword, newPassword);
      if (!changed) {
        const authError = storeError || useAuthStore.getState().error;
        if (authError?.includes('khóa tạm thời')) {
          setErrorMessage('Tài khoản đang bị khóa tạm thời. Vui lòng đợi 15 phút để hệ thống tự động mở khóa.');
        } else {
          setErrorMessage(authError || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu tạm thời hiện tại!');
        }
        setIsSubmitting(false);
        return;
      }

      // 3. Đăng nhập lại với mật khẩu mới để cấp token hoàn chỉnh không còn cờ mustChangePassword
      const reLoggedIn = await login(cleanUsername, newPassword);
      if (reLoggedIn) {
        Alert.alert(
          'Kích hoạt tài khoản thành công',
          `Tài khoản nhân viên [${cleanStaffCode}] (${cleanUsername}) đã được cập nhật mật khẩu mới và kích hoạt thành công trên hệ thống MediAssistRover.`,
          [
            {
              text: 'Bắt đầu sử dụng',
              onPress: () => {
                navigation.replace('MainTabs', { screen: 'Home' });
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Đổi mật khẩu thành công',
          'Mật khẩu mới đã được cập nhật. Vui lòng đăng nhập lại.',
          [
            {
              text: 'Đăng nhập',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Login' }],
                });
              },
            },
          ]
        );
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('khóa tạm thời')) {
        setErrorMessage('Tài khoản đang bị khóa tạm thời trong 15 phút do nhập sai mật khẩu 5 lần. Vui lòng chờ mở khóa.');
      } else {
        setErrorMessage(msg || 'Có lỗi xảy ra khi đổi mật khẩu. Vui lòng thử lại.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Banner cảnh báo bắt buộc */}
        <View style={styles.topNotice}>
          <ShieldAlert size={20} color="#B45309" />
          <Text style={styles.topNoticeText}>
            YÊU CẦU MÃ NHÂN VIÊN ĐỂ XÁC THỰC ĐỔI MẬT KHẨU LẦN ĐẦU
          </Text>
        </View>

        {/* Header màn hình */}
        <View style={styles.headerBox}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={36} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>Kích hoạt & Đổi mật khẩu</Text>
          <Text style={styles.subtitle}>
            Nhập chính xác Mã nhân viên y tế được cấp để hệ thống nhận diện đúng tài khoản và cập nhật mật khẩu mới.
          </Text>
        </View>

        {/* Thẻ hiển thị tài khoản nhận diện */}
        <View style={styles.accountCard}>
          <View style={styles.accountRow}>
            <View style={styles.accountAvatar}>
              <BadgeCheck size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountLabel}>ĐỊNH DANH NHÂN VIÊN</Text>
              <Text style={styles.accountUsername}>
                {staffCode.trim() ? staffCode.trim().toUpperCase() : 'Chưa nhập mã nhân viên'}
              </Text>
              <Text style={styles.accountSubUsername}>
                Tài khoản: {accountUsername.trim() || 'staff1'}
              </Text>
            </View>
            <View style={[styles.statusBadge, hasStaffCode && styles.statusBadgeActive]}>
              <Text style={[styles.statusBadgeText, hasStaffCode && styles.statusBadgeTextActive]}>
                {hasStaffCode ? 'Đã nhận diện' : 'Cần nhập mã'}
              </Text>
            </View>
          </View>
        </View>

        {/* Hộp thông báo lỗi nếu có */}
        {(errorMessage || storeError) ? (
          <View style={styles.errorBox}>
            <AlertCircle size={18} color="#DC2626" />
            <Text style={styles.errorText}>{errorMessage || storeError}</Text>
          </View>
        ) : null}

        {/* Form nhập liệu */}
        <View style={styles.formCard}>
          {/* 1. MÃ NHÂN VIÊN (STAFF CODE) - BẮT BUỘC */}
          <Text style={styles.label}>
            Mã nhân viên (Staff Code) <Text style={styles.requiredMark}>*</Text>
          </Text>
          <View style={[styles.inputWrapper, !hasStaffCode && styles.inputWrapperHighlight]}>
            <BadgeCheck size={18} color={hasStaffCode ? Colors.primary : Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={staffCode}
              onChangeText={(text) => {
                setStaffCode(text);
                if (!accountUsername) {
                  setAccountUsername(text.toLowerCase());
                }
              }}
              placeholder="VD: STF-001 hoặc staff1"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="characters"
            />
          </View>
          <Text style={styles.inputHelperText}>
            Mã nhân viên y tế do điều phối bệnh viện hoặc phòng CNTT cấp.
          </Text>

          {/* 2. TÊN TÀI KHOẢN (USERNAME) */}
          <Text style={[styles.label, { marginTop: 14 }]}>
            Tên đăng nhập (Username)
          </Text>
          <View style={styles.inputWrapper}>
            <User size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={accountUsername}
              onChangeText={setAccountUsername}
              placeholder="VD: staff1 hoặc staff2"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
          </View>

          {/* 3. MẬT KHẨU TẠM THỜI HIỆN TẠI */}
          <Text style={[styles.label, { marginTop: 14 }]}>
            Mật khẩu tạm thời hiện tại <Text style={styles.requiredMark}>*</Text>
          </Text>
          <View style={styles.inputWrapper}>
            <KeyRound size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrentPassword}
              placeholder="Nhập mật khẩu tạm thời ban đầu"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              style={styles.eyeBtn}
            >
              {showCurrentPassword ? (
                <EyeOff size={18} color={Colors.textSecondary} />
              ) : (
                <Eye size={18} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          {/* 4. MẬT KHẨU MỚI */}
          <Text style={[styles.label, { marginTop: 14 }]}>
            Mật khẩu mới <Text style={styles.requiredMark}>*</Text>
          </Text>
          <View style={styles.inputWrapper}>
            <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
              placeholder="Tối thiểu 8 ký tự"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              style={styles.eyeBtn}
            >
              {showNewPassword ? (
                <EyeOff size={18} color={Colors.textSecondary} />
              ) : (
                <Eye size={18} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Thanh hiển thị độ mạnh mật khẩu */}
          {newPassword.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4].map((level) => (
                  <View
                    key={level}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          strength.score >= level ? strength.color : '#E2E8F0',
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthText, { color: strength.color }]}>
                {strength.text}
              </Text>
            </View>
          )}

          {/* 5. NHẬP LẠI MẬT KHẨU MỚI */}
          <Text style={[styles.label, { marginTop: 14 }]}>
            Nhập lại mật khẩu mới <Text style={styles.requiredMark}>*</Text>
          </Text>
          <View style={styles.inputWrapper}>
            <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              placeholder="Nhập lại mật khẩu mới vừa tạo"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeBtn}
            >
              {showConfirmPassword ? (
                <EyeOff size={18} color={Colors.textSecondary} />
              ) : (
                <Eye size={18} color={Colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Danh sách tiêu chuẩn mật khẩu */}
          <View style={styles.criteriaList}>
            <View style={styles.criteriaItem}>
              {hasStaffCode ? (
                <Check size={15} color="#059669" />
              ) : (
                <X size={15} color="#94A3B8" />
              )}
              <Text style={[styles.criteriaText, hasStaffCode && styles.criteriaTextValid]}>
                Đã cung cấp Mã nhân viên hợp lệ
              </Text>
            </View>

            <View style={styles.criteriaItem}>
              {hasMinLength ? (
                <Check size={15} color="#059669" />
              ) : (
                <X size={15} color="#94A3B8" />
              )}
              <Text style={[styles.criteriaText, hasMinLength && styles.criteriaTextValid]}>
                Mật khẩu có từ 8 ký tự trở lên
              </Text>
            </View>

            <View style={styles.criteriaItem}>
              {isDifferentFromCurrent ? (
                <Check size={15} color="#059669" />
              ) : (
                <X size={15} color="#94A3B8" />
              )}
              <Text style={[styles.criteriaText, isDifferentFromCurrent && styles.criteriaTextValid]}>
                Khác với mật khẩu tạm thời ban đầu
              </Text>
            </View>

            <View style={styles.criteriaItem}>
              {isMatchingConfirm ? (
                <Check size={15} color="#059669" />
              ) : (
                <X size={15} color="#94A3B8" />
              )}
              <Text style={[styles.criteriaText, isMatchingConfirm && styles.criteriaTextValid]}>
                Hai lần nhập mật khẩu mới phải khớp nhau
              </Text>
            </View>
          </View>
        </View>

        {/* Nút hành động */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!hasStaffCode || !hasMinLength || !isDifferentFromCurrent || !isMatchingConfirm || isSubmitting || isLoading) &&
                styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!hasStaffCode || !hasMinLength || !isDifferentFromCurrent || !isMatchingConfirm || isSubmitting || isLoading}
          >
            {isSubmitting || isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Xác thực mã nhân viên & Kích hoạt</Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            disabled={isSubmitting || isLoading}
          >
            <LogOut size={16} color="#64748B" />
            <Text style={styles.logoutBtnText}>Hủy & Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 44,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  topNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warningSurface,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  topNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.warningText,
    letterSpacing: 0.3,
    flex: 1,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.hero,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...Shadows.hero,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  accountCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 14,
    ...Shadows.card,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  accountUsername: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  accountSubUsername: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: Colors.warningSurface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeActive: {
    backgroundColor: Colors.successSurface,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.warningText,
  },
  statusBadgeTextActive: {
    color: Colors.successText,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerSurface,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '600',
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 20,
    ...Shadows.card,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  requiredMark: {
    color: Colors.danger,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    height: 50,
  },
  inputWrapperHighlight: {
    borderColor: Colors.hero,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  inputHelperText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  eyeBtn: {
    padding: 8,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  strengthBars: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '700',
  },
  criteriaList: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  criteriaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  criteriaTextValid: {
    color: Colors.successText,
    fontWeight: '600',
  },
  actionSection: {
    gap: 12,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.hero,
    height: 52,
    borderRadius: 16,
    ...Shadows.button,
  },
  submitBtnDisabled: {
    backgroundColor: '#A1A1AA',
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
