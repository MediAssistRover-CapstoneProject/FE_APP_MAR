import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { useAppStore, ItemData } from '../store/useAppStore';
import { Search, Bell } from 'lucide-react-native';

const CATEGORIES = ['Tất cả', 'UI/UX', 'Design System', 'Performance', 'Mobile'];

export const HomeScreen: React.FC = () => {
  const {
    userName,
    items,
    searchQuery,
    selectedCategory,
    setSearchQuery,
    setSelectedCategory,
    toggleFavorite,
  } = useAppStore();

  // Lọc dữ liệu mượt mà với useMemo để tránh tính toán thừa
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchCat =
        selectedCategory === 'Tất cả' || item.category === selectedCategory;
      const matchSearch = item.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  const renderItem = useCallback(
    ({ item }: { item: ItemData }) => (
      <Card
        id={item.id}
        title={item.title}
        category={item.category}
        description={item.description}
        price={item.price}
        isFavorite={item.isFavorite}
        onToggleFavorite={toggleFavorite}
      />
    ),
    [toggleFavorite]
  );

  return (
    <View style={styles.container}>
      <Header
        title={`Chào ${userName}! 👋`}
        subtitle="Khám phá giao diện & linh kiện mới"
        rightAction={
          <TouchableOpacity style={styles.bellButton}>
            <Bell size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        }
      />

      {/* Ô tìm kiếm */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Tìm kiếm mẫu giao diện..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Bộ lọc danh mục (Pills) */}
      <View style={styles.categoriesSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  isSelected && styles.categoryPillActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Danh sách cuộn hiệu năng cao FlashList */}
      <View style={styles.listContainer}>
        <FlashList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.flashListContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Không tìm thấy mục nào.</Text>
            </View>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bellButton: {
    padding: Spacing.xs,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.full,
  },
  searchSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: Spacing.md,
    height: 46,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: 0,
  },
  categoriesSection: {
    backgroundColor: Colors.surface,
    paddingBottom: Spacing.sm,
  },
  categoryList: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  categoryPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSubtle,
  },
  categoryPillActive: {
    backgroundColor: Colors.primary,
  },
  categoryText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: Colors.textInverse,
  },
  listContainer: {
    flex: 1,
  },
  flashListContent: {
    padding: Spacing.md,
  },
  emptyContainer: {
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.bodySecondary,
  },
});
