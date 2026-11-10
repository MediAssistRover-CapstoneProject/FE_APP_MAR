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
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'FirstLoginPasswordChange'>;
type ScreenRouteProp = RouteProp<RootStackParamList, 'FirstLoginPasswordChange'>;

export const FirstLoginPasswordChangeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ScreenRouteProp>();

  const { username = 'staff', currentPassword: initialCurrentPassword = '' } = route.params || {};
  const { changePassword, login, logout, isLoading, error: storeError, clearError } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState(initialCurrentPassword);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Kiểm tra các tiêu chuẩn bảo mật mật khẩu
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
      // 1. Gọi API đổi mật khẩu (PUT /api/v1/auth/change-password)
      const changed = await changePassword(currentPassword, newPassword);
      if (!changed) {
        setErrorMessage(storeError || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu cũ!');
        setIsSubmitting(false);
        return;
      }

      // 2. Đăng nhập lại với mật khẩu mới để lấy token hợp lệ không còn cờ mustChangePassword
      const loggedIn = await login(username, newPassword);
      if (loggedIn) {
        Alert.alert(
          'Kích hoạt tài khoản thành công',
          'Mật khẩu mới của bạn đã được cập nhật an toàn. Bạn có thể sử dụng đầy đủ các tính năng nhiệm vụ và bản đồ.',
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
        // Đã đổi mật khẩu thành công nhưng cần đăng nhập lại từ trang login
        Alert.alert(
          'Đổi mật khẩu thành công',
          'Vui lòng đăng nhập lại với mật khẩu mới vừa tạo.',
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
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi đổi mật khẩu. Vui lòng thử lại.');
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
            BẮT BUỘC ĐỔI MẬT KHẨU CHO LẦN ĐĂNG NHẬP ĐẦU TIÊN
          </Text>
        </View>

        {/* Header màn hình */}
        <View style={styles.headerBox}>
          <View style={styles.iconCircle}>
            <ShieldCheck size={36} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={styles.title}>Thiết lập mật khẩu mới</Text>
          <Text style={styles.subtitle}>
            Tài khoản y tế của bạn đang sử dụng mật khẩu khởi tạo tạm thời. Vì lý do an toàn thông tin bệnh viện, bạn cần cập nhật mật khẩu mới trước khi truy cập.
          </Text>
        </View>

        {/* Card thông tin tài khoản */}
        <View style={styles.accountCard}>
          <View style={styles.accountRow}>
            <View style={styles.accountAvatar}>
              <User size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountLabel}>Tài khoản nhân viên</Text>
              <Text style={styles.accountUsername}>{username}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>Chưa kích hoạt</Text>
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

        {/* Form nhập mật khẩu */}
        <View style={styles.formCard}>
          {/* Mật khẩu tạm thời */}
          <Text style={styles.label}>Mật khẩu tạm thời hiện tại</Text>
          <View style={styles.inputWrapper}>
            <Lock size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!showCurrentPassword}
              placeholder="Nhập mật khẩu tạm thời"
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

          {/* Mật khẩu mới */}
          <Text style={[styles.label, { marginTop: 14 }]}>Mật khẩu mới</Text>
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

          {/* Nhập lại mật khẩu mới */}
          <Text style={[styles.label, { marginTop: 14 }]}>Nhập lại mật khẩu mới</Text>
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
              {hasMinLength ? (
                <Check size={15} color="#059669" />
              ) : (
                <X size={15} color="#94A3B8" />
              )}
              <Text
                style={[
                  styles.criteriaText,
                  hasMinLength && styles.criteriaTextValid,
                ]}
              >
                Mật khẩu có từ 8 ký tự trở lên
              </Text>
            </View>

            <View style={styles.criteriaItem}>
              {isDifferentFromCurrent ? (
                <Check size={15} color="#059669" />
              ) : (
                <X size={15} color="#94A3B8" />
              )}
              <Text
                style={[
                  styles.criteriaText,
                  isDifferentFromCurrent && styles.criteriaTextValid,
                ]}
              >
                Khác với mật khẩu tạm thời ban đầu
              </Text>
            </View>

            <View style={styles.criteriaItem}>
              {isMatchingConfirm ? (
                <Check size={15} color="#059669" />
              ) : (
                <X size={15} color="#94A3B8" />
              )}
              <Text
                style={[
                  styles.criteriaText,
                  isMatchingConfirm && styles.criteriaTextValid,
                ]}
              >
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
              (!hasMinLength || !isDifferentFromCurrent || !isMatchingConfirm || isSubmitting || isLoading) &&
                styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!hasMinLength || !isDifferentFromCurrent || !isMatchingConfirm || isSubmitting || isLoading}
          >
            {isSubmitting || isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>Cập nhật mật khẩu & Kích hoạt</Text>
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
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  topNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  topNoticeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.4,
    flex: 1,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    ...Shadows.card,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  accountCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  accountUsername: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    lineHeight: 18,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
    ...Shadows.card,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 46,
    fontSize: 14,
    color: Colors.textPrimary,
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
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  criteriaText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  criteriaTextValid: {
    color: '#059669',
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
    backgroundColor: Colors.primary,
    height: 50,
    borderRadius: 12,
    ...Shadows.button,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
  },
  logoutBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
});
