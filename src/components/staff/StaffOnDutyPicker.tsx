/**
 * StaffOnDutyPicker.tsx
 * Bộ chọn nhân viên đang trực cho việc giao nhận y tế:
 * - Giao diện mobile chuẩn: Card người nhận đã chọn gọn gàng, nút Đổi/Bỏ chọn touch target >= 44dp.
 * - Danh sách mở dưới dạng MobileBottomSheet thích nghi màn hình.
 * - Tôn trọng prop disabled ở mọi nhánh (trigger, Đổi, Bỏ chọn, chọn trong sheet).
 * - Không hiển thị UUID trực tiếp làm subtitle chính.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import { Colors, BorderRadius, Shadows } from '../../constants/theme';
import { staffApi } from '../../api/modules/staff.api';
import { OnDutyStaffResponse } from '../../api/types';
import {
  User,
  CheckCircle2,
  RefreshCw,
  X,
  Search,
  ChevronDown,
  Clock,
  MapPin,
  Check,
} from 'lucide-react-native';
import { MobileBottomSheet } from '../common/MobileBottomSheet';

interface StaffOnDutyPickerProps {
  mapId?: string;
  roomId?: string;
  roomName?: string;
  selectedStaff: OnDutyStaffResponse | null;
  onSelect: (staff: OnDutyStaffResponse) => void;
  onClear?: () => void;
  disabled?: boolean;
}

export const StaffOnDutyPicker: React.FC<StaffOnDutyPickerProps> = ({
  mapId,
  roomId,
  roomName,
  selectedStaff,
  onSelect,
  onClear,
  disabled = false,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [staffList, setStaffList] = useState<OnDutyStaffResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filterByRoom, setFilterByRoom] = useState(true);

  useEffect(() => {
    setFilterByRoom(true);
  }, [roomId]);

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const activeRoomFilter = filterByRoom ? roomId : undefined;
      const res = await staffApi.getOnDutyStaff({
        mapId,
        roomId: activeRoomFilter,
        page: 0,
        size: 100,
      });
      setStaffList(res.content || []);
    } catch (err: any) {
      setError(err?.message || 'Không tải được danh sách nhân viên trực.');
      setStaffList([]);
    } finally {
      setIsLoading(false);
    }
  }, [mapId, roomId, filterByRoom]);

  useEffect(() => {
    if (showModal) {
      void loadStaff();
    }
  }, [showModal, loadStaff]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const filtered = searchText.trim()
    ? staffList.filter(
        (s) =>
          s.fullName.toLowerCase().includes(searchText.toLowerCase()) ||
          (s.roomName || '').toLowerCase().includes(searchText.toLowerCase()) ||
          (s.roomCode || '').toLowerCase().includes(searchText.toLowerCase())
      )
    : staffList;

  return (
    <>
      {/* Hiển thị nhân viên đã chọn hoặc nút bấm mở danh sách */}
      {selectedStaff ? (
        <View style={[styles.selectedBox, disabled && styles.boxDisabled]}>
          <View style={styles.selectedInfo}>
            <View style={styles.avatar}>
              <User size={20} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.selectedName}>{selectedStaff.fullName}</Text>
              <Text style={styles.selectedDetail}>
                {selectedStaff.roomName || selectedStaff.roomCode || 'Phòng trực'}
                {' · '}
                {formatTime(selectedStaff.startsAt)} – {formatTime(selectedStaff.endsAt)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.changeBtn, disabled && styles.btnDisabled]}
              onPress={() => {
                if (!disabled) setShowModal(true);
              }}
              disabled={disabled}
              accessibilityLabel="Đổi người nhận"
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <RefreshCw size={14} color={disabled ? '#A1A1AA' : Colors.hero} />
              <Text style={[styles.changeText, disabled && { color: '#A1A1AA' }]}>Đổi</Text>
            </TouchableOpacity>
          </View>
          {onClear && (
            <TouchableOpacity
              onPress={() => {
                if (!disabled) onClear();
              }}
              disabled={disabled}
              style={[styles.clearBtn, disabled && styles.btnDisabled]}
              accessibilityLabel="Bỏ chọn người nhận"
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <X size={14} color={disabled ? '#A1A1AA' : '#71717A'} />
              <Text style={[styles.clearText, disabled && { color: '#A1A1AA' }]}>
                Bỏ chọn người nhận
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.selectTrigger, disabled && styles.triggerDisabled]}
          onPress={() => {
            if (!disabled) setShowModal(true);
          }}
          disabled={disabled}
          accessibilityLabel="Chọn nhân viên đang trực"
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <User size={18} color={disabled ? Colors.textMuted : Colors.hero} />
          <Text
            style={[
              styles.flex,
              styles.triggerText,
              disabled && { color: Colors.textMuted },
            ]}
          >
            {roomId
              ? `Chọn nhân viên trực tại ${roomName || 'phòng đã chọn'}`
              : 'Chọn nhân viên đang trực'}
          </Text>
          <ChevronDown size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Staff picker Bottom Sheet */}
      <MobileBottomSheet
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={
          roomId && filterByRoom
            ? `Nhân viên trực · ${roomName || 'Phòng'}`
            : 'Nhân viên đang trực'
        }
        subtitle="Chọn nhân viên y tế đang nhận ca trực để giao hàng"
      >
        <View style={styles.sheetContent}>
          {/* Lọc theo phòng */}
          {roomId && (
            <View style={styles.filterBar}>
              <Text style={styles.filterBarText} numberOfLines={1}>
                {filterByRoom
                  ? `Đang lọc: ${roomName || 'Phòng đã chọn'}`
                  : 'Đang xem tất cả phòng'}
              </Text>
              <TouchableOpacity
                onPress={() => setFilterByRoom(!filterByRoom)}
                style={styles.filterToggleBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.filterBarToggle}>
                  {filterByRoom ? 'Xem tất cả' : `Chỉ xem ${roomName || 'phòng'}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Ô tìm kiếm & nút tải lại */}
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Search size={16} color="#71717A" />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm theo tên hoặc phòng trực..."
                placeholderTextColor="#A1A1AA"
                value={searchText}
                onChangeText={setSearchText}
                autoCapitalize="none"
              />
            </View>
            <TouchableOpacity
              onPress={loadStaff}
              disabled={isLoading}
              style={styles.refreshBtn}
              accessibilityLabel="Tải lại danh sách"
              activeOpacity={0.7}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={Colors.hero} />
              ) : (
                <RefreshCw size={18} color={Colors.hero} />
              )}
            </TouchableOpacity>
          </View>

          {/* Danh sách nhân viên */}
          <ScrollView
            style={styles.listContainer}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : filtered.length === 0 ? (
              <Text style={styles.emptyText}>
                {isLoading
                  ? 'Đang tải danh sách nhân viên trực...'
                  : searchText.trim()
                  ? 'Không tìm thấy nhân viên phù hợp.'
                  : roomId && filterByRoom
                  ? 'Phòng này chưa có nhân viên đang trực.'
                  : 'Không có nhân viên nào đang trực.'}
              </Text>
            ) : (
              filtered.map((staff) => {
                const isSelected = selectedStaff?.accountId === staff.accountId;
                return (
                  <TouchableOpacity
                    key={staff.staffProfileId + staff.shiftId}
                    style={[
                      styles.staffItem,
                      isSelected && styles.staffItemSelected,
                      disabled && { opacity: 0.6 },
                    ]}
                    onPress={() => {
                      if (!disabled) {
                        onSelect(staff);
                        setShowModal(false);
                      }
                    }}
                    disabled={disabled}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.itemAvatar,
                        isSelected && styles.itemAvatarSelected,
                      ]}
                    >
                      {isSelected ? (
                        <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                      ) : (
                        <User size={18} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.staffName}>{staff.fullName}</Text>
                      <View style={styles.metaRow}>
                        <MapPin size={12} color="#71717A" />
                        <Text style={styles.staffMeta}>
                          {staff.roomName || staff.roomCode || 'Chưa rõ phòng'}
                        </Text>
                        <Text style={styles.metaDot}>•</Text>
                        <Clock size={12} color="#71717A" />
                        <Text style={styles.staffMeta}>
                          {formatTime(staff.startsAt)} – {formatTime(staff.endsAt)}
                        </Text>
                      </View>
                    </View>
                    {staff.deliverable && (
                      <View style={styles.deliverableBadge}>
                        <Text style={styles.deliverableText}>Nhận hàng</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer tóm tắt */}
          <Text style={styles.footerText}>
            {filtered.length} nhân viên
            {roomId && filterByRoom
              ? ` tại ${roomName || 'phòng này'}`
              : mapId
              ? ' trên bản đồ hiện tại'
              : ''}
          </Text>
        </View>
      </MobileBottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    ...Shadows.sm,
  },
  triggerDisabled: {
    backgroundColor: '#F4F4F5',
    opacity: 0.6,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#71717A',
  },
  selectedBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 14,
    gap: 10,
    ...Shadows.card,
  },
  boxDisabled: {
    backgroundColor: '#F4F4F5',
    opacity: 0.6,
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  selectedDetail: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 2,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    justifyContent: 'center',
  },
  changeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.hero,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
    paddingTop: 8,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  sheetContent: {
    gap: 12,
    maxHeight: 520,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F4F4F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  filterBarText: {
    fontSize: 12,
    color: '#3F3F46',
    fontWeight: '600',
    flex: 1,
  },
  filterToggleBtn: {
    minHeight: 32,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  filterBarToggle: {
    fontSize: 12,
    color: Colors.hero,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
    backgroundColor: '#F4F4F5',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContainer: {
    maxHeight: 320,
  },
  listContent: {
    gap: 8,
    paddingVertical: 4,
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    minHeight: 64,
  },
  staffItemSelected: {
    backgroundColor: '#F7F7F5',
    borderColor: Colors.hero,
    borderWidth: 1.5,
  },
  itemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#71717A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemAvatarSelected: {
    backgroundColor: Colors.hero,
  },
  staffName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  staffMeta: {
    fontSize: 12,
    color: '#71717A',
  },
  metaDot: {
    fontSize: 10,
    color: '#D4D4D8',
  },
  deliverableBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  deliverableText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  footerText: {
    fontSize: 12,
    color: '#A1A1AA',
    textAlign: 'center',
    paddingTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    paddingVertical: 32,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
