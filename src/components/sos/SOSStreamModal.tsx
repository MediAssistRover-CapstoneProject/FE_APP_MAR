import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  X,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  MapPin,
  ChevronRight,
  Wifi,
  Battery,
  Bot,
  CheckCircle,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { alertApi } from '../../api/modules/alert.api';
import { incidentApi } from '../../api/modules/incident.api';

const { width: SCREEN_W } = Dimensions.get('window');
const VIDEO_H = SCREEN_W * 0.65;

interface SOSStreamModalProps {
  visible: boolean;
  onClose: () => void;
  onDispatch?: () => void;
  alertId?: string;
  incidentId?: string;
  robotName?: string;
  location?: string;
  onResolve?: (alertId: string) => void;
}

export const SOSStreamModal: React.FC<SOSStreamModalProps> = ({
  visible,
  onClose,
  onDispatch,
  alertId,
  incidentId,
  robotName = 'Robot MAR-GAZEBO-01',
  location = 'Tầng 4 · Khu Hành lang chính',
  onResolve,
}) => {
  const [seconds, setSeconds] = useState(6);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isDispatching, setIsDispatching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  // Timer đếm giây cuộc gọi
  useEffect(() => {
    let interval: any;
    if (visible) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSeconds(6);
    }
    return () => clearInterval(interval);
  }, [visible]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* ===== TOP BAR ===== */}
        <View style={styles.topBar}>
          <View style={styles.connectionStatus}>
            <View style={styles.greenLiveDot} />
            <Text style={styles.connectionText}>Đang kết nối · {formatTimer(seconds)}</Text>
          </View>

          <View style={styles.topRight}>
            <View style={styles.staffPill}>
              <View style={styles.staffAvatarCircle}>
                <Text style={{ fontSize: 13 }}>👨‍⚕️</Text>
              </View>
              <View>
                <Text style={styles.staffPillName}>Nhân viên y tế</Text>
                <Text style={styles.staffPillDept}>P. Nội TH</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== VIDEO STREAM FRAME ===== */}
        <View style={styles.streamWrapper}>
          <View style={styles.streamFrame}>
            {/* 4 góc màu xanh của khung camera */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* LIVE Tag */}
            <View style={styles.liveTag}>
              <View style={styles.redLiveDot} />
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>

            {/* Robot Center Graphic */}
            <View style={styles.robotGraphicBox}>
              <View style={styles.robotAvatarContainer}>
                <Bot size={76} color="#0284C7" strokeWidth={1.5} />
              </View>
              <Text style={styles.robotStreamingText}>
                {cameraEnabled ? `Đang truyền hình ảnh từ ${robotName}...` : 'Camera đã tắt'}
              </Text>
            </View>
          </View>
        </View>

        {/* ===== INFO METRICS CARDS ===== */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Wifi size={14} color="#0284C7" />
              <Text style={styles.metricLabel}>KẾT NỐI</Text>
            </View>
            <Text style={[styles.metricValue, { color: '#10B981' }]}>Kết nối ổn định</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Battery size={14} color="#10B981" />
              <Text style={styles.metricLabel}>PIN</Text>
            </View>
            <Text style={[styles.metricValue, { color: '#10B981' }]}>78%</Text>
          </View>
        </View>

        {/* ===== LOCATION CARD ===== */}
        <TouchableOpacity style={styles.locationCard} activeOpacity={0.8}>
          <View style={styles.locationLeft}>
            <MapPin size={18} color="#EF4444" />
            <View>
              <Text style={styles.locationCardLabel}>VỊ TRÍ HIỆN TẠI</Text>
              <Text style={styles.locationCardValue}>{location}</Text>
            </View>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* ===== DISPATCH BUTTON ===== */}
        <TouchableOpacity
          style={styles.dispatchBtn}
          onPress={async () => {
            if (incidentId) {
              setIsDispatching(true);
              try {
                await incidentApi.startIncident(incidentId);
              } catch (err) {
                console.log('Error dispatching robot to incident:', err);
              } finally {
                setIsDispatching(false);
              }
            }
            if (onDispatch) {
              onDispatch();
            } else {
              onClose();
            }
          }}
          activeOpacity={0.85}
          disabled={isDispatching}
        >
          <View style={styles.dispatchIconBox}>
            {isDispatching ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: 20 }}>🤖</Text>
            )}
          </View>
          <View style={styles.dispatchTextBox}>
            <Text style={styles.dispatchTitle}>
              {isDispatching ? 'Đang gửi lệnh điều phối...' : 'Gửi lệnh điều phối'}
            </Text>
            <Text style={styles.dispatchSubtitle}>Robot di chuyển đến vị trí yêu cầu</Text>
          </View>
          <ChevronRight size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* ===== BOTTOM CALL CONTROLS ===== */}
        <View style={styles.controlsRow}>
          <View style={styles.controlItem}>
            <TouchableOpacity
              style={[styles.controlCircleBtn, !cameraEnabled && styles.controlCircleBtnOff]}
              onPress={() => setCameraEnabled(!cameraEnabled)}
              activeOpacity={0.8}
            >
              {cameraEnabled ? (
                <Video size={24} color="#FFFFFF" />
              ) : (
                <VideoOff size={24} color="#EF4444" />
              )}
            </TouchableOpacity>
            <Text style={styles.controlLabel}>{cameraEnabled ? 'Tắt camera' : 'Bật camera'}</Text>
          </View>

          <View style={styles.controlItem}>
            <TouchableOpacity
              style={[styles.controlCircleBtn, !micEnabled && styles.controlCircleBtnOff]}
              onPress={() => setMicEnabled(!micEnabled)}
              activeOpacity={0.8}
            >
              {micEnabled ? (
                <Mic size={24} color="#FFFFFF" />
              ) : (
                <MicOff size={24} color="#EF4444" />
              )}
            </TouchableOpacity>
            <Text style={styles.controlLabel}>{micEnabled ? 'Tắt mic' : 'Bật mic'}</Text>
          </View>

          <View style={styles.controlItem}>
            <TouchableOpacity
              style={styles.endCallBtn}
              onPress={() => {
                if (alertId) {
                  Alert.alert(
                    'Kết thúc cuộc gọi',
                    'Bạn có muốn đánh dấu giải quyết cảnh báo SOS này luôn không?',
                    [
                      {
                        text: 'Chỉ đóng cuộc gọi',
                        style: 'cancel',
                        onPress: onClose,
                      },
                      {
                        text: 'Đã giải quyết ✓',
                        onPress: async () => {
                          setIsResolving(true);
                          try {
                            await alertApi.resolveAlert(alertId);
                            if (onResolve) onResolve(alertId);
                          } catch (err) {
                            console.log('Error resolving alert:', err);
                          } finally {
                            setIsResolving(false);
                            onClose();
                          }
                        },
                      },
                    ]
                  );
                } else {
                  onClose();
                }
              }}
              activeOpacity={0.8}
            >
              {isResolving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <PhoneOff size={26} color="#FFFFFF" />
              )}
            </TouchableOpacity>
            <Text style={[styles.controlLabel, { color: '#EF4444', fontWeight: '700' }]}>
              {isResolving ? 'Đang lưu...' : 'Kết thúc'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
    paddingHorizontal: Spacing.md,
    paddingTop: 52,
    paddingBottom: Spacing.lg,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  staffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  staffAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffPillName: { fontSize: 11, fontWeight: '700', color: '#0A2540' },
  staffPillDept: { fontSize: 9, color: '#64748B' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stream frame
  streamWrapper: {
    width: '100%',
    height: VIDEO_H,
    marginBottom: Spacing.md,
  },
  streamFrame: {
    flex: 1,
    backgroundColor: '#E6F4FE',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#0284C7',
    borderWidth: 2.5,
  },
  cornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  liveTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  redLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  robotGraphicBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  robotAvatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  robotStreamingText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Location card
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  locationCardValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A2540',
    marginTop: 2,
  },

  // Dispatch button
  dispatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EA580C',
    borderRadius: 16,
    padding: 14,
    marginBottom: Spacing.xl,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  dispatchIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dispatchTextBox: {
    flex: 1,
  },
  dispatchTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dispatchSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // Bottom call controls
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 'auto',
    paddingBottom: Spacing.sm,
  },
  controlItem: {
    alignItems: 'center',
    gap: 8,
  },
  controlCircleBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  controlCircleBtnOff: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  endCallBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
});
