import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Button } from '../components/common/Button';
import { useAppStore } from '../store/useAppStore';
import { User, Bell, Palette, Info, ChevronRight } from 'lucide-react-native';

export const ProfileScreen: React.FC = () => {
  const { userName, userEmail } = useAppStore();

  const MENU_ITEMS = [
    { id: '1', title: 'Thông tin tài khoản', icon: User },
    { id: '2', title: 'Cài đặt thông báo', icon: Bell },
    { id: '3', title: 'Giao diện & Theme Figma', icon: Palette },
    { id: '4', title: 'Giới thiệu về App', icon: Info },
  ];

  return (
    <View style={styles.container}>
      <Header title="Tài khoản" subtitle="Quản lý thông tin & cài đặt" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </View>
        </View>

        {/* Menu list */}
        <View style={styles.menuContainer}>
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === MENU_ITEMS.length - 1;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, !isLast && styles.menuItemBorder]}
                activeOpacity={0.7}
              >
                <View style={styles.menuLeft}>
                  <Icon size={20} color={Colors.textSecondary} />
                  <Text style={styles.menuText}>{item.title}</Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.buttonWrapper}>
          <Button
            title="Đăng xuất"
            variant="outline"
            onPress={() => console.log('Đăng xuất')}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    ...Typography.h3,
  },
  userEmail: {
    ...Typography.bodySecondary,
    fontSize: 13,
    marginTop: 2,
  },
  menuContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 4,
  },
  menuText: {
    ...Typography.body,
    fontSize: 15,
  },
  buttonWrapper: {
    marginTop: Spacing.sm,
  },
});
