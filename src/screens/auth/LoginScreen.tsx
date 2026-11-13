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
  RefreshCw,
  X,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { API_CONFIG, REMOTE_BACKEND_URL, getLocalBackendUrl } from '../../api/config';
import { apiClient } from '../../api/client';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const QUICK_STAFF_ACCOUNTS = [
  {
    username: 'staff1',
    password: '12345678',
    label: 'staff1 · Giao hàng',
    desc: 'Nhân viên gửi hàng (Điểm A)',
  },
  {
    username: 'staff2',
    password: '12345678',
    label: 'staff2 · Nhận hàng',
    desc: 'Nhân viên nhận hàng & quét QR mở Servo (Điểm B)',
  },
];

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    login,
    logout,
    changePassword,
    mustChangePassword,
    isLoading,
    error,
    clearError,
  } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');

  const localLanUrl = getLocalBackendUrl();
  const SERVER_PRESETS = [
    {
      label: 'MediAssistRover (API Server chính · Có mã QR & Robot)',
      url: REMOTE_BACKEND_URL,
      desc: 'Mặc định: https://mediassistrover.duckdns.org/api/v1 (Tạo nhiệm vụ, Hiện/Quét QR mở Servo)',
    },
    {
      label: 'BE Local (AI_VOic22222 · Qua HTTPS Tunnel xuyên Wi-Fi)',
      url: 'https://b15d6554d671c9.lhr.life/api/v1',
      desc: 'Kết nối vào BE Local cổng 8080 ngay cả khi Wi-Fi trường chặn LAN',
    },
    {
      label: 'BE Local (AI_VOic22222 · Mạng LAN 8080)',
      url: localLanUrl,
      desc: 'Backend local trong folder AI_VOic22222 (Đã mở 0.0.0.0:8080)',
    },
    ...(localLanUrl !== 'http://localhost:8080/api/v1'
      ? [
          {
            label: 'BE Local (Localhost 8080)',
            url: 'http://localhost:8080/api/v1',
            desc: 'Dùng khi chạy Web hoặc Simulator trên cùng máy tính',
          },
        ]
      : []),
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
            : 'Không thể kết nối! Kiểm tra địa chỉ máy chủ hoặc mạng.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleApplyServer = () => {
    const cleanUrl = (serverUrlInput || API_CONFIG.BASE_URL).trim().replace(/\/+$/, '');
    apiClient.setBaseUrl(cleanUrl);
    setCurrentBaseUrl(cleanUrl);
    setServerUrlInput(cleanUrl);
    setShowServerModal(false);
    Alert.alert('Thành công', `Đã chuyển máy chủ API sang:\n${cleanUrl}`);
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
      if (useAuthStore.getState().mustChangePassword) {
        navigation.navigate('FirstLoginPasswordChange', {
          username: username.trim(),
          staffCode: username.trim().toUpperCase(),
          currentPassword: password,
        });
      } else {
        navigation.replace('MainTabs', { screen: 'Home' });
      }
    }
  };

  const handleRequiredPasswordChange = async () => {
    setPasswordChangeError('');
    if (newPassword.length < 8) {
      setPasswordChangeError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('Hai lần nhập mật khẩu mới không khớp.');
      return;
    }
    if (newPassword === password) {
      setPasswordChangeError('Mật khẩu mới phải khác mật khẩu tạm thời.');
      return;
    }

    const changed = await changePassword(password, newPassword);
    if (!changed) return;

    const loggedIn = await login(username, newPassword);
    if (loggedIn && !useAuthStore.getState().mustChangePassword) {
      setShowPasswordChangeModal(false);
      setPassword(newPassword);
      navigation.replace('MainTabs', { screen: 'Home' });
    }
  };

  const handleCancelPasswordChange = async () => {
    await logout();
    setShowPasswordChangeModal(false);
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordChangeError('');
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
            <ShieldCheck size={32} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={styles.brandTitle}>MediAssist</Text>
          <Text style={styles.brandSubtitle}>HỆ THỐNG ROBOT HỖ TRỢ Y TẾ</Text>
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>CỔNG DÀNH CHO NHÂN VIÊN TRỰC</Text>
          </View>
        </View>

        {/* Card Đăng nhập */}
        <View style={styles.loginCard}>
          <Text style={styles.cardHeader}>Đăng nhập ca trực</Text>
          <Text style={styles.cardSubHeader}>
            Chọn nhanh ca trực giao hàng hoặc nhận hàng để bắt đầu làm việc
          </Text>

          {/* Chọn nhanh tài khoản Staff 1 / Staff 2 */}
          <View style={styles.quickAccountsRow}>
            {QUICK_STAFF_ACCOUNTS.map((acc) => {
              const active = username === acc.username;
              return (
                <TouchableOpacity
                  key={acc.username}
                  style={[styles.quickAccountChip, active && styles.quickAccountChipActive]}
                  onPress={() => {
                    setUsername(acc.username);
                    setPassword(acc.password);
                    setUsernameError('');
                    setPasswordError('');
                    clearError();
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.quickAccountLabel, active && styles.quickAccountLabelActive]}>
                    {acc.label}
                  </Text>
                  <Text style={styles.quickAccountDesc} numberOfLines={1}>
                    {acc.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Thông báo lỗi tổng nếu đăng nhập thất bại */}
          {error && (
            <View style={styles.errorAlertBox}>
              <AlertCircle size={16} color={Colors.danger} />
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
                placeholder="VD: staff1 hoặc staff2"
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
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
              <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
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

          {/* Lần đầu đăng nhập: Kích hoạt tài khoản & Đổi mật khẩu */}
          <TouchableOpacity
            style={styles.firstLoginBtn}
            onPress={() => {
              navigation.navigate('FirstLoginPasswordChange', {
                username: username.trim() || 'staff1',
                staffCode: username.trim() ? username.trim().toUpperCase() : 'STF-001',
                currentPassword: password || '12345678',
              });
            }}
            activeOpacity={0.75}
          >
            <ShieldCheck size={16} color={Colors.textSecondary} />
            <Text style={styles.firstLoginBtnText}>
              Lần đầu đăng nhập? Đổi mật khẩu để kích hoạt
            </Text>
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
          <Settings size={13} color={Colors.textSecondary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footerText}>
          MediAssist · Bệnh viện Đa khoa Trung ương · Phiên bản trực ban
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
              Chọn Production DuckDNS hoặc BE Local (AI_VOic22222):
            </Text>

            {/* Input URL */}
            <View style={styles.serverInputBox}>
              <TextInput
                style={styles.serverTextInput}
                value={serverUrlInput}
                onChangeText={(val) => {
                  setServerUrlInput(val);
                  setTestResult(null);
                }}
                editable={true}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://mediassistrover.duckdns.org/api/v1"
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
            <Text style={styles.presetsHeader}>MÁY CHỦ SẴN CÓ:</Text>
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
                onPress={handleApplyServer}
                activeOpacity={0.8}
              >
                <Text style={styles.applyBtnText}>Lưu & Sử dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPasswordChangeModal && mustChangePassword}
        transparent
        animationType="fade"
        onRequestClose={handleCancelPasswordChange}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passwordChangeModal}>
            <View style={styles.passwordChangeIcon}>
              <ShieldCheck size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.passwordChangeTitle}>Đổi mật khẩu lần đầu</Text>
            <Text style={styles.passwordChangeSubtitle}>
              Tài khoản đang dùng mật khẩu tạm thời. Bạn phải đổi mật khẩu trước khi truy cập dữ liệu bệnh viện và bản đồ.
            </Text>

            {passwordChangeError ? (
              <View style={styles.errorAlertBox}>
                <AlertCircle size={16} color="#DC2626" />
                <Text style={styles.errorAlertText}>{passwordChangeError}</Text>
              </View>
            ) : null}

            <Text style={styles.inputLabel}>Mật khẩu mới</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Tối thiểu 8 ký tự"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Nhập lại mật khẩu mới</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Nhập lại mật khẩu mới"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.passwordChangeActions}>
              <TouchableOpacity
                style={styles.passwordChangeCancelBtn}
                onPress={handleCancelPasswordChange}
                disabled={isLoading}
              >
                <Text style={styles.passwordChangeCancelText}>Đăng xuất</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.passwordChangeSubmitBtn}
                onPress={handleRequiredPasswordChange}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.passwordChangeSubmitText}>Đổi và tiếp tục</Text>
                )}
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
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + 16,
    paddingBottom: Spacing.xl + 20,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.hero,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    ...Shadows.hero,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.2,
    marginTop: 3,
  },
  roleTag: {
    backgroundColor: '#EBEBEA',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  loginCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 22,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  cardHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  cardSubHeader: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  quickAccountsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: Spacing.md,
  },
  quickAccountChip: {
    flex: 1,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quickAccountChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.hero,
    borderWidth: 1.5,
  },
  quickAccountLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  quickAccountLabelActive: {
    color: Colors.textPrimary,
  },
  quickAccountDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  errorAlertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerSurface,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: Spacing.md,
  },
  errorAlertText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    height: 50,
  },
  inputWrapperError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerSurface,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    height: '100%',
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  fieldErrorText: {
    fontSize: 11,
    color: Colors.danger,
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
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: Colors.hero,
    borderColor: Colors.hero,
  },
  rememberText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.hero,
    borderRadius: 16,
    height: 52,
    gap: Spacing.xs + 2,
    marginTop: Spacing.xs,
    ...Shadows.button,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  firstLoginBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  firstLoginBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  connectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#24A148',
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  serverModalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    maxWidth: 440,
    ...Shadows.hero,
  },
  serverModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  serverModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  serverModalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 17,
  },
  serverInputBox: {
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    justifyContent: 'center',
    marginBottom: 10,
  },
  serverTextInput: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  testResultBox: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  testSuccessBox: {
    backgroundColor: Colors.successSurface,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  testFailBox: {
    backgroundColor: Colors.dangerSurface,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  testResultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  testSuccessText: {
    color: Colors.successText,
  },
  testFailText: {
    color: Colors.danger,
  },
  presetsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
    marginBottom: 8,
  },
  presetItemActive: {
    borderColor: Colors.hero,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  presetLabelActive: {
    color: Colors.textPrimary,
  },
  presetUrl: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  presetDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  serverModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
  },
  testBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  applyBtn: {
    flex: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.hero,
    ...Shadows.button,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal Đổi Mật Khẩu Lần Đầu
  passwordChangeModal: {
    width: '92%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#FFFFFF',
    ...Shadows.hero,
  },
  passwordChangeIcon: {
    alignSelf: 'center',
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: Colors.hero,
  },
  passwordChangeTitle: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  passwordChangeSubtitle: {
    marginTop: 8,
    marginBottom: 18,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
  },
  passwordChangeActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  passwordChangeCancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passwordChangeCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  passwordChangeSubmitBtn: {
    flex: 1.5,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.hero,
  },
  passwordChangeSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
