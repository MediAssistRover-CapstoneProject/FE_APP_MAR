import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { Colors } from '../../constants/theme';
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
} from 'lucide-react-native';

interface StaffOnDutyPickerProps {
  mapId?: string;
  selectedStaff: OnDutyStaffResponse | null;
  onSelect: (staff: OnDutyStaffResponse) => void;
  onClear?: () => void;
}

export const StaffOnDutyPicker: React.FC<StaffOnDutyPickerProps> = ({
  mapId,
  selectedStaff,
  onSelect,
  onClear,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [staffList, setStaffList] = useState<OnDutyStaffResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');

  const loadStaff = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await staffApi.getOnDutyStaff({ mapId, page: 0, size: 100 });
      setStaffList(res.content || []);
    } catch (err: any) {
      setError(err?.message || 'Không tải được danh sách nhân viên trực.');
      setStaffList([]);
    } finally {
      setIsLoading(false);
    }
  }, [mapId]);

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
          (s.roomCode || '').toLowerCase().includes(searchText.toLowerCase()),
      )
    : staffList;

  return (
    <>
      {/* Selected staff display or trigger button */}
      {selectedStaff ? (
        <View style={styles.selectedBox}>
          <View style={styles.selectedInfo}>
            <View style={styles.avatar}>
              <User size={18} color="#fff" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.selectedName}>{selectedStaff.fullName}</Text>
              <Text style={styles.selectedDetail}>
                {selectedStaff.roomName || selectedStaff.roomCode || 'Không rõ phòng'}
                {' · '}
                {formatTime(selectedStaff.startsAt)} – {formatTime(selectedStaff.endsAt)}
              </Text>
              <Text style={styles.selectedId} selectable>
                {selectedStaff.accountId}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.changeBtn}
              onPress={() => setShowModal(true)}
            >
              <RefreshCw size={14} color={Colors.primary} />
              <Text style={styles.changeText}>Đổi</Text>
            </TouchableOpacity>
          </View>
          {onClear && (
            <TouchableOpacity onPress={onClear} style={styles.clearBtn}>
              <X size={14} color={Colors.textSecondary} />
              <Text style={styles.clearText}>Xóa chọn · nhập thủ công</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity style={styles.selectTrigger} onPress={() => setShowModal(true)}>
          <User size={18} color={Colors.primary} />
          <Text style={[styles.flex, styles.triggerText]}>Chọn nhân viên đang trực</Text>
          <ChevronDown size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Staff picker modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.heading, styles.flex]}>Nhân viên đang trực</Text>
              <TouchableOpacity
                onPress={loadStaff}
                disabled={isLoading}
                style={styles.refreshBtn}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <RefreshCw size={16} color={Colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                accessibilityLabel="Đóng"
              >
                <X size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchBox}>
              <Search size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm theo tên hoặc phòng..."
                placeholderTextColor={Colors.textMuted}
                value={searchText}
                onChangeText={setSearchText}
                autoCapitalize="none"
              />
            </View>

            {/* Staff list */}
            <ScrollView style={styles.listContainer} keyboardShouldPersistTaps="handled">
              {error ? (
                <Text style={styles.error}>{error}</Text>
              ) : filtered.length === 0 ? (
                <Text style={styles.emptyText}>
                  {isLoading
                    ? 'Đang tải...'
                    : searchText.trim()
                    ? 'Không tìm thấy nhân viên phù hợp.'
                    : 'Không có nhân viên nào đang trực.'}
                </Text>
              ) : (
                filtered.map((staff) => {
                  const isSelected = selectedStaff?.accountId === staff.accountId;
                  return (
                    <TouchableOpacity
                      key={staff.staffProfileId + staff.shiftId}
                      style={[styles.staffItem, isSelected && styles.staffItemSelected]}
                      onPress={() => {
                        onSelect(staff);
                        setShowModal(false);
                      }}
                    >
                      <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                        {isSelected ? (
                          <CheckCircle2 size={18} color="#fff" />
                        ) : (
                          <User size={18} color="#fff" />
                        )}
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.staffName}>{staff.fullName}</Text>
                        <View style={styles.metaRow}>
                          <MapPin size={12} color={Colors.textSecondary} />
                          <Text style={styles.staffMeta}>
                            {staff.roomName || staff.roomCode || 'Chưa rõ phòng'}
                          </Text>
                        </View>
                        <View style={styles.metaRow}>
                          <Clock size={12} color={Colors.textSecondary} />
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

            <Text style={styles.footerText}>
              {filtered.length} nhân viên{mapId ? ' trên bản đồ hiện tại' : ''}
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Trigger button
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: '#dbe5e8',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  triggerText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  // Selected staff display
  selectedBox: {
    backgroundColor: '#e6f4f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: 12,
    gap: 8,
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  selectedDetail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  selectedId: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  changeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  clearText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  modal: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '80%',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  refreshBtn: {
    padding: 6,
  },
  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#dbe5e8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    padding: 0,
  },
  // List
  listContainer: {
    maxHeight: 360,
  },
  staffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  staffItemSelected: {
    backgroundColor: '#e6f4f0',
    borderColor: Colors.primary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: {
    backgroundColor: '#059669',
  },
  staffName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  staffMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  deliverableBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deliverableText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
  },
  // Footer
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 32,
  },
  error: {
    color: '#b42318',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
});
