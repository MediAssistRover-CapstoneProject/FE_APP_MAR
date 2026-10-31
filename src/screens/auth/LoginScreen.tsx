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
  Modal,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';
import {
  Eye,
  EyeOff,
  Check,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Settings,
  Server,
  Wifi,
  RefreshCw,
  X,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { API_CONFIG } from '../../api/config';
import { apiClient } from '../../api/client';

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

  // Modal đổi cấu hình máy chủ
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState(apiClient.getBaseUrl());
  const [currentBaseUrl, setCurrentBaseUrl] = useState(apiClient.getBaseUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  const SERVER_PRESETS = [
    {
      label: 'Wi-Fi Máy tính (Khuyên dùng)',
      url: 'http://10.3.90.174:8080/api/v1',
      desc: 'Local Docker trên máy cùng mạng Wi-Fi',
    },
    {
      label: 'Localhost (Simulator/Web)',
      url: 'http://localhost:8080/api/v1',
      desc: 'Dành cho máy ảo hoặc trình duyệt Web',
    },
    {
      label: 'Railway Cloud (Production)',
      url: 'https://bemar-production.up.railway.app/api/v1',
      desc: 'Máy chủ Cloud đã deploy trên Railway',
    },
  ];

  const handleTestConnection = async (urlToTest: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const cleanUrl = urlToTest.trim().replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${cleanUrl}/public/hospital-information`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok || res.status === 200 || res.status === 401 || res.status === 403) {
        setTestResult({ success: true, msg: 'Kết nối máy chủ thành công! (HTTP ' + res.status + ')' });
      } else {
        setTestResult({ success: false, msg: `Máy chủ phản hồi mã: HTTP ${res.status}` });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        msg:
          err.name === 'AbortError'
            ? 'Hết thời gian chờ (Timeout) - Máy chủ không phản hồi!'
            : 'Không thể kết nối! Vui lòng kiểm tra lại IP hoặc cùng mạng Wi-Fi.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleApplyServer = (urlToApply: string) => {
    const cleanUrl = urlToApply.trim().replace(/\/+$/, '');
    apiClient.setBaseUrl(cleanUrl);
    setCurrentBaseUrl(cleanUrl);
    setServerUrlInput(cleanUrl);
    setShowServerModal(false);
    Alert.alert('Thành công', `Đã chuyển máy chủ kết nối sang:\n${cleanUrl}`);
  };

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
        <View style={styles.loginCard}>
          <Text style={styles.cardHeader}>Đăng nhập ca trực</Text>
          <Text style={styles.cardSubHeader}>
            Sử dụng tài khoản nội bộ bệnh viện được cấp
          </Text>

          {/* Thông báo lỗi tổng nếu đăng nhập thất bại */}
          {error && (
            <View style={styles.errorAlertBox}>
              <AlertCircle size={16} color="#DC2626" />
              <Text style={styles.errorAlertText}>{error}</Text>
            </View>
          )}

          {/* Ô nhập Tài khoản */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tên tài khoản / Mã nhân viên</Text>
            <View
              style={[
                styles.inputWrapper,
                usernameError ? styles.inputWrapperError : null,
              ]}
            >
              <TextInput
                style={styles.textInput}
                placeholder="VD: dieuduong01 hoặc STF-01"
                placeholderTextColor={Colors.textMuted}
                value={username}
                onChangeText={(text) => {
                  setUsername(text);
                  if (usernameError) setUsernameError('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {usernameError ? (
              <Text style={styles.fieldErrorText}>{usernameError}</Text>
            ) : null}
          </View>

          {/* Ô nhập Mật khẩu */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mật khẩu</Text>
            <View
              style={[
                styles.inputWrapper,
                passwordError ? styles.inputWrapperError : null,
              ]}
            >
              <TextInput
                style={styles.textInput}
                placeholder="Nhập mật khẩu ca trực"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (passwordError) setPasswordError('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
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
            {passwordError ? (
              <Text style={styles.fieldErrorText}>{passwordError}</Text>
            ) : null}
          </View>

          {/* Tùy chọn Ghi nhớ & Quên mật khẩu */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.rememberMe}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  rememberMe && styles.checkboxActive,
                ]}
              >
                {rememberMe && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.rememberText}>Ghi nhớ ca trực</Text>
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
            activeOpacity={0.8}
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

        {/* Thông tin kết nối Backend thực tế (Chạm vào để đổi IP máy chủ) */}
        <TouchableOpacity
          style={styles.connectionBadge}
          onPress={() => {
            setServerUrlInput(currentBaseUrl);
            setTestResult(null);
            setShowServerModal(true);
          }}
          activeOpacity={0.75}
        >
          <View style={styles.connectionDot} />
          <Text style={styles.connectionText}>
            Máy chủ: <Text style={styles.connectionHost}>{currentBaseUrl}</Text>
          </Text>
          <Settings size={12} color={Colors.primary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footerText}>
          MediAssistRover · Bệnh viện Đa khoa Trung ương · Hệ thống điều hành nội bộ
        </Text>
      </ScrollView>

      {/* ========================================================
          MODAL CẤU HÌNH ĐỊA CHỈ MÁY CHỦ (SERVER SWITCHER)
      ======================================================== */}
      <Modal visible={showServerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.serverModalContent}>
            <View style={styles.serverModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Server size={20} color={Colors.primary} />
                <Text style={styles.serverModalTitle}>Cấu hình máy chủ Backend</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowServerModal(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.serverModalSubtitle}>
              Khi chuyển mạng Wi-Fi khác, bạn có thể nhập IP máy tính hoặc chọn cài đặt sẵn bên dưới:
            </Text>

            {/* Input URL */}
            <View style={styles.serverInputBox}>
              <TextInput
                style={styles.serverTextInput}
                value={serverUrlInput}
                onChangeText={setServerUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://10.3.90.174:8080/api/v1"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Test connection result */}
            {testResult && (
              <View
                style={[
                  styles.testResultBox,
                  testResult.success ? styles.testSuccessBox : styles.testFailBox,
                ]}
              >
                <Text
                  style={[
                    styles.testResultText,
                    testResult.success ? styles.testSuccessText : styles.testFailText,
                  ]}
                >
                  {testResult.success ? '✅ ' : '❌ '}
                  {testResult.msg}
                </Text>
              </View>
            )}

            {/* Presets */}
            <Text style={styles.presetsHeader}>GỢI Ý MÁY CHỦ SẴN CÓ:</Text>
            {SERVER_PRESETS.map((preset, idx) => {
              const isSelected = serverUrlInput === preset.url;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.presetItem, isSelected && styles.presetItemActive]}
                  onPress={() => {
                    setServerUrlInput(preset.url);
                    setTestResult(null);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.presetLabel, isSelected && styles.presetLabelActive]}>
                      {preset.label}
                    </Text>
                    <Text style={styles.presetUrl}>{preset.url}</Text>
                    <Text style={styles.presetDesc}>{preset.desc}</Text>
                  </View>
                  {isSelected && <Check size={16} color={Colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })}

            {/* Action buttons */}
            <View style={styles.serverModalActions}>
              <TouchableOpacity
                style={styles.testBtn}
                onPress={() => handleTestConnection(serverUrlInput)}
                disabled={isTesting}
                activeOpacity={0.8}
              >
                {isTesting ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <RefreshCw size={14} color={Colors.primary} />
                    <Text style={styles.testBtnText}>Thử kết nối</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => handleApplyServer(serverUrlInput)}
                activeOpacity={0.8}
              >
                <Text style={styles.applyBtnText}>Lưu & Sử dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderRadius: 32,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0A2540',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  roleTag: {
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  loginCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A2540',
    marginBottom: 4,
  },
  cardSubHeader: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  errorAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  errorAlertText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    height: '100%',
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  fieldErrorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    marginLeft: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    marginTop: 2,
  },
  rememberMe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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

  // Modal Cấu hình Server
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  serverModalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    maxWidth: 440,
    ...Shadows.card,
  },
  serverModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  serverModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A2540',
  },
  serverModalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 17,
  },
  serverInputBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
    marginBottom: 10,
  },
  serverTextInput: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  testResultBox: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  testSuccessBox: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  testFailBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  testResultText: {
    fontSize: 11,
    fontWeight: '600',
  },
  testSuccessText: {
    color: '#15803D',
  },
  testFailText: {
    color: '#DC2626',
  },
  presetsHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    marginBottom: 6,
  },
  presetItemActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  presetLabelActive: {
    color: Colors.primary,
  },
  presetUrl: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  presetDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  serverModalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  applyBtn: {
    flex: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
