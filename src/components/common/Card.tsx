import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';
import { Heart } from 'lucide-react-native';

interface CardProps {
  id: string;
  title: string;
  category: string;
  description: string;
  price?: string;
  isFavorite?: boolean;
  onPress?: () => void;
  onToggleFavorite?: (id: string) => void;
}

export const Card: React.FC<CardProps> = memo(({
  id,
  title,
  category,
  description,
  price,
  isFavorite = false,
  onPress,
  onToggleFavorite,
}) => {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{category}</Text>
        </View>
        {onToggleFavorite && (
          <TouchableOpacity
            onPress={() => onToggleFavorite(id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Heart
              size={20}
              color={isFavorite ? Colors.error : Colors.textMuted}
              fill={isFavorite ? Colors.error : 'transparent'}
            />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.description} numberOfLines={2}>
        {description}
      </Text>

      {price && (
        <View style={styles.bottomRow}>
          <Text style={styles.priceLabel}>Giá:</Text>
          <Text style={styles.priceValue}>{price}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs + 2,
  },
  badge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
  title: {
    ...Typography.h3,
    marginBottom: 4,
  },
  description: {
    ...Typography.bodySecondary,
    marginBottom: Spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.xs,
  },
  priceLabel: {
    ...Typography.caption,
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
});
