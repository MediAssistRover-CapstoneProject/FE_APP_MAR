import Ionicons from '@expo/vector-icons/Ionicons';
import { PropsWithChildren } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../theme';

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const insets = useSafeAreaInsets();
  const containerStyle = [
    styles.container,
    { paddingBottom: Math.max(24, insets.bottom + 16), paddingLeft: Math.max(20, insets.left), paddingRight: Math.max(20, insets.right) },
  ];
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={96}>
      {scroll ? (
        <ScrollView contentContainerStyle={containerStyle} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : <View style={[containerStyle, { flex: 1 }]}>{children}</View>}
    </KeyboardAvoidingView>
  );
}

export function AppText({
  variant = 'body', style, ...props
}: TextProps & { variant?: 'title' | 'heading' | 'body' | 'caption' }) {
  return <Text {...props} style={[styles.text, typeStyles[variant], style]} />;
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title, onPress, variant = 'primary', loading = false, disabled = false, icon,
}: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const foreground = variant === 'secondary' ? colors.primary : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: variant === 'secondary' ? colors.primarySoft : variant === 'danger' ? colors.danger : colors.primary }, (disabled || loading) && { opacity: 0.6 }, pressed && { opacity: 0.8 }]}
    >
      {loading ? <ActivityIndicator color={foreground} /> : icon ? <Ionicons name={icon} size={21} color={foreground} /> : null}
      <AppText style={{ color: foreground, fontWeight: '600', flexShrink: 1, textAlign: 'center' }}>{title}</AppText>
    </Pressable>
  );
}

export function Notice({ message, tone = 'info' }: { message: string; tone?: 'info' | 'error' | 'success' }) {
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: tone === 'error' ? colors.dangerSoft : colors.primarySoft }]}>
      <Ionicons name={tone === 'error' ? 'alert-circle-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline'} size={20} color={tone === 'error' ? colors.danger : colors.primary} />
      <AppText variant="caption" style={{ flex: 1, color: tone === 'error' ? colors.danger : colors.primary }}>{message}</AppText>
    </View>
  );
}

export function LoadingState({ message = 'Đang tải thông tin…' }: { message?: string }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.primary} /><AppText variant="caption">{message}</AppText></View>;
}

const typeStyles: Record<string, TextStyle> = {
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 25 },
  caption: { fontSize: 14, lineHeight: 21, color: colors.muted },
};
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingTop: 24, gap: 20, flexGrow: 1 },
  text: { color: colors.text },
  card: { padding: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radii.md, gap: 12 },
  button: { minHeight: 54, paddingHorizontal: 18, paddingVertical: 14, borderRadius: radii.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  notice: { padding: 14, borderRadius: radii.sm, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  loading: { paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
});
