import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Layers, Zap, Smartphone, ShieldCheck } from 'lucide-react-native';

const FEATURES = [
  {
    id: '1',
    title: 'FlashList Tối Ưu',
    desc: 'Tái sử dụng view cell thông minh, không giật lag khi cuộn hàng ngàn item.',
    icon: Zap,
    color: '#10B981',
  },
  {
    id: '2',
    title: 'Zustand State Store',
    desc: 'Quản lý state toàn cục siêu nhẹ, loại bỏ hoàn toàn render thừa.',
    icon: Layers,
    color: '#6366F1',
  },
  {
    id: '3',
    title: 'Giao Diện Figma Chuẩn',
    desc: 'Được ánh xạ chính xác từ bảng token Figma (Theme, Radius, Shadows).',
    icon: Smartphone,
    color: '#F59E0B',
  },
  {
    id: '4',
    title: 'TypeScript Type-Safe',
    desc: 'Đầy đủ kiểu dữ liệu, bảo đảm không gặp lỗi undefined runtime.',
    icon: ShieldCheck,
    color: '#0EA5E9',
  },
];

export const ExploreScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Header title="Khám phá" subtitle="Kiến trúc & Tính năng tối ưu" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Kiến Trúc Chuẩn 60 FPS 🚀</Text>
          <Text style={styles.bannerSubtitle}>
            Dự án này đã được cấu hình sẵn theo chuẩn Best Practices để sẵn sàng tiếp nhận bản vẽ từ Figma.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Tính năng nổi bật</Text>

        <View style={styles.grid}>
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <View key={feat.id} style={styles.featureCard}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: `${feat.color}15` },
                  ]}
                >
                  <Icon size={24} color={feat.color} />
                </View>
                <Text style={styles.cardTitle}>{feat.title}</Text>
                <Text style={styles.cardDesc}>{feat.desc}</Text>
              </View>
            );
          })}
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
  banner: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.floating,
  },
  bannerTitle: {
    ...Typography.h2,
    color: Colors.textInverse,
    marginBottom: Spacing.xs,
  },
  bannerSubtitle: {
    ...Typography.bodySecondary,
    color: '#E0E7FF',
    lineHeight: 20,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  grid: {
    gap: Spacing.md,
  },
  featureCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    ...Typography.h3,
    fontSize: 16,
    marginBottom: 4,
  },
  cardDesc: {
    ...Typography.bodySecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
