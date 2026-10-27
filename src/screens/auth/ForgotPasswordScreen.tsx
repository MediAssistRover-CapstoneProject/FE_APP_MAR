import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';
import { Stepper } from '../../components/common/Stepper';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from 'lucide-react-native';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  // Wizard Step: 1 -> 2 -> 3 -> 4
  const [step, setStep] = useState<number>(1);

  // Step 1: Email
  const [email, setEmail] = useState('trungntse184485@fpt.edu.vn');

  // Step 2: OTP (6 digits)
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(41);
  const otpInputs = useRef<Array<React.ElementRef<typeof TextInput> | null>>([]);

  // Step 3: Passwords
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Timer countdown for Step 2
  useEffect(() => {
    let interval: any;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handleBack = () => {
    if (step > 1 && step < 4) {
      setStep(step - 1);
    } else {
      navigation.navigate('Login');
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const updatedOtp = [...otp];
    updatedOtp[index] = text;
    setOtp(updatedOtp);

    // Tự động focus sang ô tiếp theo
    if (text && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  // Tính độ mạnh mật khẩu (4 mức)
  const getPasswordStrength = () => {
    if (newPassword.length === 0) return 0;
    if (newPassword.length < 6) return 1;
    if (newPassword.length < 8) return 2;
    if (newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword)) return 4;
    return 3;
  };

  const strengthLevel = getPasswordStrength();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={Colors.primary} strokeWidth={2.5} />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerMainTitle}>Quên mật khẩu</Text>
            <Text style={styles.headerSubtitle}>Đặt lại qua email</Text>
          </View>
        </View>

        {/* 4-Step Stepper */}
        <Stepper currentStep={step} />

        {/* STEP 1: NHẬP EMAIL */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nhập địa chỉ email</Text>
            <Text style={styles.cardSubtitle}>
              Chúng tôi sẽ gửi mã OTP đến email của bạn.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>EMAIL</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Nhập email của bạn"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.emeraldButton}
              onPress={() => {
                setStep(2);
                setTimer(41);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Gửi mã OTP</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: NHẬP MÃ OTP */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nhập mã OTP</Text>
            <Text style={styles.cardSubtitle}>
              Mã 6 chữ số gửi đến <Text style={styles.boldEmail}>{email}</Text>
            </Text>

            {/* 6 OTP Boxes */}
            <View style={styles.otpContainer}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    otpInputs.current[index] = ref;
                  }}
                  style={[
                    styles.otpBox,
                    otp[index] ? styles.otpBoxFilled : null,
                  ]}
                  value={otp[index]}
                  onChangeText={(text) => handleOtpChange(text, index)}
                  onKeyPress={(e) => handleOtpKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                />
              ))}
            </View>

            {/* Resend Timer Row */}
            <View style={styles.timerRow}>
              <Text style={styles.timerText}>
                {timer > 0 ? `Gửi lại sau ${timer}s` : 'Chưa nhận được mã?'}
              </Text>
              <TouchableOpacity
                disabled={timer > 0}
                onPress={() => setTimer(60)}
              >
                <Text
                  style={[
                    styles.resendLink,
                    timer > 0 && styles.resendLinkDisabled,
                  ]}
                >
                  Gửi lại OTP
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.emeraldButton,
                otp.join('').length === 6 ? null : styles.buttonDisabled,
              ]}
              onPress={() => setStep(3)}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Xác minh OTP</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: TẠO MẬT KHẨU MỚI */}
        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tạo mật khẩu mới</Text>
            <Text style={styles.cardSubtitle}>Tối thiểu 8 ký tự.</Text>

            {/* Mật khẩu mới */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>MẬT KHẨU MỚI</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Nhập mật khẩu mới"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showNewPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  style={styles.eyeButton}
                >
                  {showNewPassword ? (
                    <EyeOff size={20} color={Colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={Colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Xác nhận mật khẩu */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>XÁC NHẬN MẬT KHẨU</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Nhập lại mật khẩu mới"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} color={Colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={Colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* 4 Password Strength Bars */}
            <View style={styles.strengthBarContainer}>
              {[1, 2, 3, 4].map((barIndex) => (
                <View
                  key={barIndex}
                  style={[
                    styles.strengthBar,
                    barIndex <= strengthLevel && styles.strengthBarActive,
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity
              style={styles.emeraldButton}
              onPress={() => setStep(4)}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Đặt mật khẩu mới</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: HOÀN THÀNH */}
        {step === 4 && (
          <View style={[styles.card, styles.successCard]}>
            <View style={styles.successIconWrapper}>
              <Check size={40} color={Colors.emerald} strokeWidth={3} />
            </View>

            <Text style={styles.successTitle}>Đặt lại thành công!</Text>
            <Text style={styles.successSubtitle}>
              Mật khẩu mới đã được cập nhật. Vui lòng đăng nhập lại.
            </Text>

            <TouchableOpacity
              style={styles.tealButton}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Về đăng nhập</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        )}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  headerMainTitle: {
    ...Typography.h2,
    fontSize: 20,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
    ...Shadows.card,
  },
  cardTitle: {
    ...Typography.h2,
    fontSize: 18,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...Typography.body,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  boldEmail: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  fieldGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.label,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  textInput: {
    ...Typography.body,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    gap: 6,
  },
  otpBox: {
    flex: 1,
    height: 52,
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  otpBoxFilled: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  timerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  resendLink: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '700',
  },
  resendLinkDisabled: {
    color: Colors.textMuted,
  },
  strengthBarContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.stepInactive,
  },
  strengthBarActive: {
    backgroundColor: Colors.primary,
  },
  emeraldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.emerald,
    borderRadius: BorderRadius.md,
    height: 48,
    gap: Spacing.xs + 2,
    marginTop: Spacing.xs,
  },
  tealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.teal,
    borderRadius: BorderRadius.md,
    height: 48,
    width: '100%',
    gap: Spacing.xs + 2,
    marginTop: Spacing.lg,
  },
  buttonDisabled: {
    backgroundColor: Colors.primaryLight,
  },
  buttonText: {
    ...Typography.body,
    color: Colors.textInverse,
    fontWeight: '700',
    fontSize: 15,
  },
  successCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.emeraldLight,
    borderWidth: 2,
    borderColor: Colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: {
    ...Typography.h1,
    fontSize: 22,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  successSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
});
