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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';
import { Eye, EyeOff, Check, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { API_CONFIG } from '../../api/config';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [username, setUsername] = useState('dieuduong01');
  const [password, setPassword] = useState('12345678');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validate = (): boolean => {
    let valid = true;
    if (!username.trim()) {
      setUsernameError('Vui lòng nhập tên tài khoản hoặc mã nhân viên');
      valid = false;
    } else {
      setUsernameError('');
    }

    if (!password) {
      setPasswordError('Vui lòng nhập mật khẩu');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('Mật khẩu tối thiểu 6 ký tự');
      valid = false;
    } else {
      setPasswordError('');
    }

    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    clearError();

    const success = await login(username, password);
    if (success) {
      navigation.replace('MainTabs', { screen: 'Home' });
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo & Tiêu đề hệ thống */}
        <View style={styles.logoSection}>
          <View style={styles.iconWrapper}>
            <ShieldCheck size={36} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={styles.brandTitle}>MediAssistRover</Text>
          <Text style={styles.brandSubtitle}>HỆ THỐNG ROBOT HỖ TRỢ BỆNH VIỆN</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>CỔNG DÀNH CHO NHÂN VIÊN Y TẾ</Text>
          </View>
        </View>

        {/* Card Đăng nhập */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Đăng nhập ca trực</Text>
          <Text style={styles.cardSubtitle}>
            Xác thực tài khoản nhân viên để điều hành robot và nhận cảnh báo
          </Text>

          {/* Banner Thông báo Lỗi từ API nếu có */}
          {error ? (
            <View style={styles.errorBanner} accessible accessibilityRole="alert">
              <AlertCircle size={18} color="#B91C1C" />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          {/* Input Tài khoản / Mã nhân viên */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>TÀI KHOẢN / MÃ NHÂN VIÊN</Text>
              {usernameError ? <Text style={styles.inlineErrorText}>{usernameError}</Text> : null}
            </View>
            <View style={[styles.inputContainer, !!usernameError && styles.inputContainerError]}>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (usernameError) setUsernameError('');
                }}
                placeholder="Ví dụ: staff01"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                accessible
                accessibilityLabel="Tài khoản hoặc mã nhân viên"
              />
            </View>
          </View>

          {/* Input Mật khẩu */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>MẬT KHẨU</Text>
              {passwordError ? <Text style={styles.inlineErrorText}>{passwordError}</Text> : null}
            </View>
            <View style={[styles.inputContainer, !!passwordError && styles.inputContainerError]}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                placeholder="Nhập mật khẩu"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                accessible
                accessibilityLabel="Mật khẩu"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? (
                  <EyeOff size={18} color={Colors.textSecondary} />
                ) : (
                  <Eye size={18} color={Colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Checkbox Ghi nhớ & Quên mật khẩu */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.rememberMe}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
              accessible
              accessibilityRole="checkbox"
              accessibilityState={{ checked: rememberMe }}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.rememberText}>Ghi nhớ phiên trực</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>
          </View>

          {/* Nút Đăng nhập */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Đăng nhập"
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.loginButtonText}>Vào ca trực</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Thông tin kết nối Backend thực tế */}
        <View style={styles.connectionBadge}>
          <View style={styles.connectionDot} />
          <Text style={styles.connectionText}>
            Máy chủ: <Text style={styles.connectionHost}>{API_CONFIG.BASE_URL}</Text>
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          MediAssistRover · Bệnh viện Đa khoa Trung ương · Hệ thống điều hành nội bộ
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + 10,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  brandTitle: {
    ...Typography.h1,
    fontSize: 24,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.primary,
    marginBottom: 6,
  },
  roleTag: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h2,
    fontSize: 18,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '500',
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: Colors.textSecondary,
  },
  inlineErrorText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 46,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  inputContainerError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  textInput: {
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
    width: '100%',
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  rememberText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 48,
    gap: Spacing.xs + 2,
    marginTop: Spacing.sm,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: Spacing.md,
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  connectionText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  connectionHost: {
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
