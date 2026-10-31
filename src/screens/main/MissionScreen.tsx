import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';
import { StaffHeader } from '../../components/common/StaffHeader';
import { deliveryApi } from '../../api/modules/delivery.api';
import {
  ScanLine,
  Camera,
  ChevronDown,
  ArrowRight,
  Check,
  ShieldAlert,
  AlertCircle,
  MapPin,
  CheckCircle2,
  X,
} from 'lucide-react-native';
import { QRScannerModal, QRItemInfo } from '../../components/scanning/QRScannerModal';
import { FaceScanModal } from '../../components/scanning/FaceScanModal';

// ===== Kiểu dữ liệu =====
type TaskType =
  | 'dan_benh_nhan'
  | 'ho_tro_chi_duong'
  | 'van_chuyen_tai_lieu'
  | 'van_chuyen_thuoc'
  | 'van_chuyen_mau'
  | 'van_chuyen_vat_tu'
  | 'dieu_robot_sos';

type SecurityLevel = 'none' | 'qr' | 'face';
type PriorityLevel = 'high' | 'normal' | 'low';

const TASK_TYPES: { id: TaskType; label: string }[] = [
  { id: 'dan_benh_nhan',       label: 'Dẫn bệnh nhân' },
  { id: 'ho_tro_chi_duong',    label: 'Hỗ trợ chỉ đường' },
  { id: 'van_chuyen_tai_lieu', label: 'Vận chuyển tài liệu' },
  { id: 'van_chuyen_thuoc',    label: 'Vận chuyển thuốc' },
  { id: 'van_chuyen_mau',      label: 'Vận chuyển máu xét nghiệm' },
  { id: 'van_chuyen_vat_tu',   label: 'Vận chuyển vật tư y tế' },
  { id: 'dieu_robot_sos',      label: 'Điều robot đến SOS' },
];

const ROOMS = [
  'Tiếp nhận', 'P. Nội TH', 'P. Tim mạch', 'P. Xét nghiệm',
  'P. Siêu âm', 'Nhà thuốc', 'P. Nhi khoa', 'Kho', 'ICU',
];

export const MissionScreen: React.FC = () => {
  // ===== State =====
  const [selectedTasks, setSelectedTasks] = useState<TaskType[]>(['van_chuyen_tai_lieu']);
  const [itemName, setItemName] = useState('Hồ sơ bệnh án #BN2047');
  const [quantity, setQuantity] = useState('1');
  const [fromRoom, setFromRoom] = useState('Tiếp nhận');
  const [toRoom, setToRoom] = useState('P. Nội TH');
  const [sender, setSender] = useState('KTV. Nguyễn Minh Tuấn');
  const [receiver, setReceiver] = useState('BS. Trần Thị Lan');
  const [securityLevel, setSecurityLevel] = useState<SecurityLevel>('qr');
  const [priority, setPriority] = useState<PriorityLevel>('high');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  // Modal states
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showFaceScan, setShowFaceScan] = useState(false);
  const [scannedItem, setScannedItem] = useState<QRItemInfo | null>(null);
  const [faceVerified, setFaceVerified] = useState(false);

  // Danh mục y tế đặc biệt bắt buộc có bảo mật (Thuốc, Máu, Vật tư y tế)
  const isHighSecurityItem = selectedTasks.some((t) =>
    ['van_chuyen_thuoc', 'van_chuyen_mau', 'van_chuyen_vat_tu'].includes(t)
  );

  // ===== Handlers =====
  const toggleTask = useCallback(
    (id: TaskType) => {
      setSelectedTasks((prev) => {
        const next = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id];
        const hasStrict = next.some((t) =>
          ['van_chuyen_thuoc', 'van_chuyen_mau', 'van_chuyen_vat_tu'].includes(t)
        );
        if (hasStrict && securityLevel === 'none') {
          setSecurityLevel('qr');
        }
        return next;
      });
    },
    [securityLevel]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    // ⚠️ Validate bảo mật y tế: Thuốc, Máu, Vật tư bắt buộc phải có QR hoặc Face ID
    if (isHighSecurityItem && securityLevel === 'none') {
      Alert.alert(
        'Yêu cầu mức bảo mật y tế ⚠️',
        'Vận chuyển Thuốc, Máu xét nghiệm và Vật tư y tế là danh mục y tế đặc biệt nguy cấp.\n\nQuy chế bệnh viện yêu cầu bắt buộc phải chọn "Quét QR" hoặc "Xác nhận khuôn mặt" để robot xác thực người nhận trước khi mở ngăn tủ!'
      );
      return;
    }

    Alert.alert(
      'Xác nhận tạo nhiệm vụ giao hàng',
      `Robot sẽ được giao nhiệm vụ:\n${selectedTasks.map(
        (t) => TASK_TYPES.find((x) => x.id === t)?.label
      ).join(', ')}\nVận chuyển: ${itemName} (SL: ${quantity})\nTừ: ${fromRoom} → ${toRoom}\nNgười nhận: ${receiver}`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Tạo ngay',
          style: 'default',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              // Phân loại vật phẩm dựa trên loại nhiệm vụ được chọn
              let itemCategory = 'DOCUMENT';
              let unit = 'Bộ';
              let itemCode = 'DOC-BN2047';

              if (selectedTasks.includes('van_chuyen_thuoc')) {
                itemCategory = 'MEDICATION';
                unit = 'Hộp';
                itemCode = 'MED-001';
              } else if (selectedTasks.includes('van_chuyen_mau')) {
                itemCategory = 'LAB_SAMPLE';
                unit = 'Ống nghiệm';
                itemCode = 'LAB-SAM-001';
              } else if (selectedTasks.includes('van_chuyen_vat_tu')) {
                itemCategory = 'SUPPLIES';
                unit = 'Gói';
                itemCode = 'SUP-001';
              }

              // Gọi API Staff Delivery thật lên server với đầy đủ các trường bắt buộc
              const res = await deliveryApi.createDeliveryRequest({
                mapId: '28ea152c-aeb2-4d91-ae73-9cdae9ca592f',
                targetMode: 'ENDPOINT',
                pickupEndpointId: 'ee457a34-86dc-4233-8ed1-236dfd8d00ff',
                deliveryEndpointId: 'ee457a34-86dc-4233-8ed1-236dfd8d00ff',
                recipientName: receiver || 'BS. Trần Thị Lan',
                deliveryNote: `${selectedTasks.map((t) => TASK_TYPES.find((x) => x.id === t)?.label || t).join(', ')}: ${itemName} (SL: ${quantity}) - Tuyến: ${fromRoom} -> ${toRoom}. Ghi chú: ${notes || 'Không'}`,
                requiresConfirmation: true,
                items: [
                  {
                    itemCode,
                    itemName: itemName.trim() || 'Hồ sơ bệnh án #BN2047',
                    itemCategory,
                    unit,
                    quantity: parseInt(quantity, 10) || 1,
                    itemNote: notes || 'Vận chuyển y tế an toàn',
                  },
                ],
              });

              Alert.alert(
                'Thành công 🎉',
                `Đã tạo yêu cầu giao hàng thành công lên hệ thống robot!\nMã yêu cầu: ${res?.request?.requestCode || 'REQ-DELIVERY'}\nTrạng thái: DRAFT / QUEUED`
              );
            } catch (err: any) {
              console.log('Phản hồi từ server:', err);
              Alert.alert(
                'Lỗi tạo nhiệm vụ',
                err?.message || 'Không thể gửi yêu cầu giao hàng đến máy chủ. Vui lòng thử lại!'
              );
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  }, [selectedTasks, itemName, quantity, fromRoom, toRoom, receiver, notes, securityLevel]);

  return (
    <KeyboardAvoidingView
      style={styles.outerContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ===== REUSABLE STAFF HEADER ===== */}
      <StaffHeader />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== PAGE TITLE ===== */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderSub}>TẠO NHIỆM VỤ MỚI</Text>
          <Text style={styles.pageHeaderTitle}>Giao nhiệm vụ cho Robot</Text>
        </View>

        {/* ===== LOẠI NHIỆM VỤ ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOẠI NHIỆM VỤ</Text>
          <View style={styles.pillGrid}>
            {TASK_TYPES.map((task) => {
              const isActive = selectedTasks.includes(task.id);
              return (
                <TouchableOpacity
                  key={task.id}
                  style={[styles.taskPill, isActive && styles.taskPillActive]}
                  onPress={() => toggleTask(task.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.taskPillText, isActive && styles.taskPillTextActive]}>
                    {task.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ===== QUÉT QR VẬT PHẨM ===== */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionLabel}>QUÉT QR VẬT PHẨM</Text>
              <Text style={styles.sectionCaption}>Quét mã để đăng ký vào đơn vận chuyển robot</Text>
            </View>
            <TouchableOpacity
              style={[styles.outlineBtn, scannedItem && styles.outlineBtnSuccess]}
              onPress={() => setShowQRScanner(true)}
              activeOpacity={0.8}
            >
              {scannedItem ? (
                <>
                  <Check size={14} color="#10B981" />
                  <Text style={[styles.outlineBtnText, { color: '#10B981' }]}>Đã quét</Text>
                </>
              ) : (
                <>
                  <ScanLine size={14} color={Colors.teal} />
                  <Text style={styles.outlineBtnText}>Quét</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Hiển thị thông tin vật phẩm đã quét */}
          {scannedItem && (
            <View style={styles.scannedItemBox}>
              <View style={styles.scannedItemRow}>
                <Text style={styles.scannedItemLabel}>Vật phẩm:</Text>
                <Text style={styles.scannedItemValue}>{scannedItem.code}</Text>
              </View>
              <View style={styles.scannedItemRow}>
                <Text style={styles.scannedItemLabel}>Serial:</Text>
                <Text style={styles.scannedItemValue}>{scannedItem.serialNumber}</Text>
              </View>
              <View style={styles.scannedItemRow}>
                <Text style={styles.scannedItemLabel}>Số lượng:</Text>
                <Text style={styles.scannedItemValue}>{scannedItem.quantity}</Text>
              </View>
            </View>
          )}

          <View style={styles.twoCol}>
            <View style={[styles.fieldGroup, { flex: 2 }]}>
              <Text style={styles.inputLabel}>TÊN / MÃ VẬT PHẨM</Text>
              <TextInput
                style={styles.textInput}
                value={itemName}
                onChangeText={setItemName}
                placeholder="Tên hoặc mã vật phẩm"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>SỐ LƯỢNG</Text>
              <TextInput
                style={styles.textInput}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
        </View>
        {/* ===== ĐIỂM GIAO ĐẾN (PHÒNG NHẬN VẬT TƯ) ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PHÒNG ĐÍCH ĐẾN (ĐIỂM GIAO VẬT TƯ)</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>CHỌN PHÒNG ĐẾN</Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => setShowRoomModal(true)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <MapPin size={18} color={Colors.primary} />
                <Text style={[styles.selectInputText, { fontSize: 15, fontWeight: '700', color: Colors.textPrimary }]}>
                  {toRoom}
                </Text>
              </View>
              <ChevronDown size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Badge thông báo điểm đi tự động ngầm */}
          <View style={styles.autoOriginBadge}>
            <CheckCircle2 size={13} color="#059669" />
            <Text style={styles.autoOriginText}>
              Điểm lấy hàng: Tự động xuất phát từ Quầy tiếp nhận / Kho trực
            </Text>
          </View>
        </View>

        {/* ===== NGƯỜI GỬI / NGƯỜI NHẬN ===== */}
        <View style={styles.section}>
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>NGƯỜI GỬI</Text>
            <TextInput
              style={styles.textInput}
              value={sender}
              onChangeText={setSender}
              placeholder="Tên người gửi"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>NGƯỜI NHẬN</Text>
            <TextInput
              style={styles.textInput}
              value={receiver}
              onChangeText={setReceiver}
              placeholder="Tên người nhận"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        {/* ===== MỨC BẢO MẬT ===== */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
            <Text style={styles.sectionLabel}>MỨC BẢO MẬT XÁC THỰC MỞ TỦ</Text>
            {isHighSecurityItem && (
              <View style={styles.strictBadge}>
                <ShieldAlert size={11} color="#D97706" />
                <Text style={styles.strictBadgeText}>BẮT BUỘC BẢO MẬT</Text>
              </View>
            )}
          </View>

          {isHighSecurityItem && (
            <View style={styles.securityRequirementNotice}>
              <AlertCircle size={15} color="#D97706" />
              <Text style={styles.securityRequirementText}>
                Danh mục Thuốc, Máu, Vật tư y tế: Bắt buộc chọn Quét QR hoặc Khuôn mặt để bảo đảm an toàn khi robot mở ngăn tủ.
              </Text>
            </View>
          )}

          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[
                styles.segmentItem,
                securityLevel === 'none' && styles.segmentItemActive,
                isHighSecurityItem && styles.segmentItemDisabled,
              ]}
              onPress={() => {
                if (isHighSecurityItem) {
                  Alert.alert(
                    'Quy định bảo mật y tế ⚠️',
                    'Vận chuyển Thuốc, Máu xét nghiệm và Vật tư y tế bắt buộc phải có mức bảo mật (Quét QR hoặc Khuôn mặt) để robot xác thực người nhận, tránh nhầm lẫn hoặc thất thoát.'
                  );
                } else {
                  setSecurityLevel('none');
                }
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentText,
                  securityLevel === 'none' && styles.segmentTextActive,
                  isHighSecurityItem && { color: '#94A3B8' },
                ]}
              >
                Không quét
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentItem, securityLevel === 'qr' && styles.segmentItemActive]}
              onPress={() => setSecurityLevel('qr')}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentText, securityLevel === 'qr' && styles.segmentTextActive]}>
                Quét QR
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentItem,
                securityLevel === 'face' && styles.segmentItemFace,
              ]}
              onPress={() => setSecurityLevel('face')}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.segmentText,
                securityLevel === 'face' && styles.segmentTextFace,
              ]}>
                Xác nhận khuôn mặt
              </Text>
            </TouchableOpacity>
          </View>

          {/* Face Recognition Extra UI */}
          {securityLevel === 'face' && (
            <View style={styles.faceRegisterBox}>
              <Text style={styles.faceRegisterTitle}>
                Đăng ký khuôn mặt người nhận:{' '}
                <Text style={{ color: Colors.primary }}>{receiver}</Text>
              </Text>
              {faceVerified ? (
                <View style={styles.faceVerifiedRow}>
                  <View style={styles.faceVerifiedBadge}>
                    <Check size={14} color="#10B981" strokeWidth={3} />
                    <Text style={styles.faceVerifiedText}>Đã xác minh khuôn mặt</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setFaceVerified(false);
                      setShowFaceScan(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.retakeFaceText}>Chụp lại</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.photoBtn}
                  onPress={() => setShowFaceScan(true)}
                  activeOpacity={0.85}
                >
                  <Camera size={20} color={Colors.textInverse} />
                  <Text style={styles.photoBtnText}>Chụp ảnh đăng ký khuôn mặt</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ===== MỨC ƯU TIÊN ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MỨC ƯU TIÊN</Text>
          <View style={styles.segmentRow}>
            <TouchableOpacity
              style={[styles.priorityItem, priority === 'high' && styles.priorityHigh]}
              onPress={() => setPriority('high')}
              activeOpacity={0.8}
            >
              <Text style={[styles.priorityText, priority === 'high' && styles.priorityHighText]}>
                Ưu tiên cao
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priorityItem, priority === 'normal' && styles.priorityNormal]}
              onPress={() => setPriority('normal')}
              activeOpacity={0.8}
            >
              <Text style={[styles.priorityText, priority === 'normal' && styles.priorityNormalText]}>
                Bình thường
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priorityItem, priority === 'low' && styles.priorityLow]}
              onPress={() => setPriority('low')}
              activeOpacity={0.8}
            >
              <Text style={[styles.priorityText, priority === 'low' && styles.priorityLowText]}>
                Ưu tiên thấp
              </Text>
            </TouchableOpacity>
          </View>

          {priority === 'high' && (
            <View style={styles.priorityWarning}>
              <Text style={styles.priorityWarningText}>
                ⚠ Nhiệm vụ ưu tiên cao được thực hiện trước các nhiệm vụ chờ khởi đầu.
              </Text>
            </View>
          )}
        </View>

        {/* ===== THỜI HẠN ===== */}
        <View style={styles.section}>
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>THỜI HẠN (GIỜ:PHÚT)</Text>
            <TextInput
              style={styles.textInput}
              value={deadline}
              onChangeText={setDeadline}
              placeholder="(giờ:phút)"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </View>

        {/* ===== GHI CHÚ ===== */}
        <View style={styles.section}>
          <View style={styles.fieldGroup}>
            <Text style={styles.inputLabel}>GHI CHÚ</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ghi chú thêm..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* ===== NÚT TẠO NHIỆM VỤ ===== */}
        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.85}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Tạo nhiệm vụ giao hàng</Text>
              <ArrowRight size={18} color="#FFF" strokeWidth={2.5} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ===== QR SCANNER MODAL ===== */}
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onConfirm={(item) => {
          setScannedItem(item);
          setItemName(item.code);
          setShowQRScanner(false);
        }}
      />

      {/* ===== FACE SCAN MODAL ===== */}
      <FaceScanModal
        visible={showFaceScan}
        receiverName={receiver}
        onClose={() => setShowFaceScan(false)}
        onConfirm={() => {
          setFaceVerified(true);
          setShowFaceScan(false);
        }}
      />
      {/* ===== ROOM PICKER MODAL ===== */}
      <Modal visible={showRoomModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MapPin size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Chọn phòng đích đến</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowRoomModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {ROOMS.filter((r) => r !== 'Tiếp nhận').map((room) => {
                const isSelected = toRoom === room;
                return (
                  <TouchableOpacity
                    key={room}
                    style={[styles.roomSelectItem, isSelected && styles.roomSelectItemActive]}
                    onPress={() => {
                      setToRoom(room);
                      setShowRoomModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={[styles.roomSelectRadio, isSelected && styles.roomSelectRadioActive]}>
                        {isSelected && <View style={styles.roomSelectRadioInner} />}
                      </View>
                      <Text style={[styles.roomSelectText, isSelected && styles.roomSelectTextActive]}>
                        {room}
                      </Text>
                    </View>
                    {isSelected && <Check size={18} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  autoOriginBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: Spacing.xs,
  },
  autoOriginText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.floating,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  roomSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: 4,
  },
  roomSelectItemActive: {
    backgroundColor: '#F0F9FF',
  },
  roomSelectRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomSelectRadioActive: {
    borderColor: Colors.primary,
  },
  roomSelectRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  roomSelectText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  roomSelectTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  outerContainer: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 32 },
  // Page Header
  pageHeader: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  pageHeaderSub: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1, color: Colors.textSecondary,
    textTransform: 'uppercase', marginBottom: 2,
  },
  pageHeaderTitle: { ...Typography.h2, fontSize: 20 },
  // Sections
  section: {
    backgroundColor: Colors.surface, marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
    ...Shadows.card,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase',
    color: Colors.textSecondary, marginBottom: 4,
  },
  sectionCaption: { fontSize: 12, color: Colors.textMuted, marginBottom: Spacing.md },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  twoCol: { flexDirection: 'row', gap: Spacing.sm },
  fieldGroup: { marginBottom: Spacing.sm },
  inputLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase',
    color: Colors.textSecondary, marginBottom: 5,
  },
  textInput: {
    backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 44,
    borderWidth: 1, borderColor: Colors.inputBorder,
    fontSize: 14, color: Colors.textPrimary,
  },
  textArea: {
    height: 80, paddingTop: 10,
  },
  selectInput: {
    backgroundColor: Colors.inputBackground, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 44,
    borderWidth: 1, borderColor: Colors.inputBorder,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectInputText: { fontSize: 14, color: Colors.textPrimary },
  // Task Pills
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
  taskPill: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  taskPillActive: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  taskPillText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  taskPillTextActive: { color: '#FFF', fontWeight: '600' },
  // Outline Button
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderColor: Colors.teal, borderRadius: BorderRadius.sm,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  outlineBtnText: { fontSize: 13, fontWeight: '600', color: Colors.teal },
  // Segment Control - Security
  segmentRow: {
    flexDirection: 'row', gap: 8, marginTop: Spacing.sm, flexWrap: 'wrap',
  },
  segmentItem: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
  },
  segmentItemActive: {
    backgroundColor: Colors.teal, borderColor: Colors.teal,
  },
  segmentItemFace: {
    backgroundColor: '#F59E0B', borderColor: '#F59E0B',
  },
  segmentText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  segmentTextActive: { color: '#FFF', fontWeight: '700' },
  segmentTextFace: { color: '#FFF', fontWeight: '700' },
  // Face Register Box
  faceRegisterBox: {
    marginTop: Spacing.md, borderWidth: 1.5, borderColor: '#F59E0B',
    borderRadius: BorderRadius.md, backgroundColor: '#FFFBEB', padding: Spacing.md,
  },
  faceRegisterTitle: {
    fontSize: 13, fontWeight: '600', color: '#92400E', marginBottom: Spacing.sm,
  },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F59E0B', borderRadius: BorderRadius.md, height: 46,
  },
  photoBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  // Face verified
  faceVerifiedRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4,
  },
  faceVerifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  faceVerifiedText: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  retakeFaceText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  // QR scanned item box
  scannedItemBox: {
    backgroundColor: '#F0FDF4', borderRadius: BorderRadius.md, padding: 12,
    marginTop: 10, borderWidth: 1, borderColor: '#BBF7D0',
  },
  scannedItemRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3,
  },
  scannedItemLabel: { fontSize: 12, color: Colors.textSecondary },
  scannedItemValue: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary },
  // QR outline button success state
  outlineBtnSuccess: {
    borderColor: '#10B981', backgroundColor: '#F0FDF4',
  },
  // Priority
  priorityItem: {
    flex: 1, paddingVertical: 9, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle, alignItems: 'center',
  },
  priorityHigh: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  priorityNormal: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  priorityLow: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  priorityText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  priorityHighText: { color: '#FFF', fontWeight: '700' },
  priorityNormalText: { color: '#FFF', fontWeight: '700' },
  priorityLowText: { color: '#FFF', fontWeight: '700' },
  priorityWarning: {
    backgroundColor: '#FEF2F2', borderRadius: BorderRadius.sm,
    padding: 10, marginTop: Spacing.sm,
  },
  priorityWarningText: { fontSize: 12, color: '#B91C1C', lineHeight: 18 },
  // Submit
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.teal, borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.md, marginTop: Spacing.md, height: 52, gap: 8,
    ...Shadows.button,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // Strict Security Requirement Styles
  strictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  strictBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#D97706',
    letterSpacing: 0.4,
  },
  securityRequirementNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    marginBottom: 10,
  },
  securityRequirementText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 16,
  },
  segmentItemDisabled: {
    opacity: 0.5,
    backgroundColor: '#F1F5F9',
  },
});
