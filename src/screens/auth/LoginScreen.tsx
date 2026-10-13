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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';
import { Eye, EyeOff, Check, ArrowRight, Bot } from 'lucide-react-native';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const [username, setUsername] = useState('ytanv001');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleLogin = () => {
    navigation.navigate('MainTabs', { screen: 'Home' });
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
      >
        {/* Logo & Tiêu đề hệ thống */}
        <View style={styles.logoSection}>
          <View style={styles.iconWrapper}>
            <Bot size={44} color="#FFFFFF" />
          </View>
          <Text style={styles.brandTitle}>MediAssistRover</Text>
          <Text style={styles.brandSubtitle}>HỆ THỐNG ROBOT TRỢ LÝ BỆNH VIỆN</Text>
        </View>

        {/* Card Đăng nhập */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Đăng nhập nhân viên</Text>
          <Text style={styles.cardSubtitle}>Dành cho nhân viên y tế đang trực</Text>

          {/* Input Email / Mã nhân viên */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>EMAIL HOẶC MÃ NHÂN VIÊN</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={username}
                onChangeText={setUsername}
                placeholder="Nhập email hoặc mã nhân viên"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Input Mật khẩu */}
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>MẬT KHẨU</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Nhập mật khẩu"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={Colors.textSecondary} />
                ) : (
                  <Eye size={20} color={Colors.textSecondary} />
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
            >
              <View
                style={[
                  styles.checkbox,
                  rememberMe && styles.checkboxChecked,
                ]}
              >
                {rememberMe && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleForgotPassword}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>
          </View>

          {/* Nút Đăng nhập */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.loginButtonText}>Đăng nhập</Text>
            <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Banner Gợi ý tài khoản demo */}
        <View style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>
            Thử: nhập <Text style={styles.boldText}>locked</Text>,{' '}
            <Text style={styles.boldText}>norole</Text>, hoặc{' '}
            <Text style={styles.boldText}>noshift</Text>
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          Bệnh viện Đa khoa Trung ương · Hệ thống nội bộ
        </Text>
      </ScrollView>
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
    paddingTop: Spacing.xxl + 10,
    paddingBottom: Spacing.xl,
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  brandTitle: {
    ...Typography.h1,
    fontSize: 26,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.primary,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  cardTitle: {
    ...Typography.h2,
    fontSize: 19,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
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
    fontSize: 15,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: Spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: Spacing.md,
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
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  forgotPasswordText: {
    ...Typography.caption,
    color: Colors.tealDark,
    fontWeight: '600',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.teal,
    borderRadius: BorderRadius.md,
    height: 48,
    gap: Spacing.xs + 2,
    marginTop: Spacing.xs,
  },
  loginButtonText: {
    ...Typography.body,
    color: Colors.textInverse,
    fontWeight: '700',
    fontSize: 15,
  },
  demoBanner: {
    width: '100%',
    backgroundColor: Colors.inputBackground,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  demoBannerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  boldText: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  footerText: {
    ...Typography.caption,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
});
