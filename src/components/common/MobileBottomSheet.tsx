/**
 * MobileBottomSheet.tsx
 * Container Bottom Sheet chuẩn phong cách Mobile:
 * - Trượt từ đáy màn hình lên, bo tròn góc trên 24dp.
 * - Header gồm tiêu đề (font 18/26), phụ đề và nút đóng (touch target 48dp).
 * - Chiều cao tự thích nghi tối đa 88% viewport, cuộn mượt mà.
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { Colors, BorderRadius, Shadows } from '../../constants/theme';

export interface MobileBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: string | number;
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = '88%',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop chạm vào để đóng */}
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Nội dung Sheet */}
        <View style={[styles.sheetContainer, { maxHeight: maxHeight as any }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleCol}>
              <Text style={styles.title}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Đóng"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <X size={20} color={Colors.hero} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: BorderRadius.hero, // 24dp
    borderTopRightRadius: BorderRadius.hero, // 24dp
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
    ...Shadows.floating,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F4F5',
  },
  titleCol: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#71717A',
    marginTop: 2,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F4F4F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    marginTop: 12,
  },
});
