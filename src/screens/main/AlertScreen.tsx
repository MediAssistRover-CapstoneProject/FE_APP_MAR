import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  LogOut,
  AlertTriangle,
  Phone,
  ChevronRight,
  ShieldAlert,
  Ban,
  Construction,
  Check,
  Bot,
  RefreshCw,
  Siren,
  Eye,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { StaffHeader } from '../../components/common/StaffHeader';
import { incidentApi } from '../../api/modules/incident.api';
import { alertApi } from '../../api/modules/alert.api';
import { IncidentResponse, AlertResponse } from '../../api/types';
import { SOSCallModal } from '../../components/sos/SOSCallModal';
import { SOSStreamModal } from '../../components/sos/SOSStreamModal';
import { FallDetectionModal } from '../../components/sos/FallDetectionModal';

export const AlertScreen: React.FC = () => {
  // Modal states
  const [showSOSCall, setShowSOSCall] = useState(false);
  const [showSOSStream, setShowSOSStream] = useState(false);
  const [showFallDetail, setShowFallDetail] = useState(false);
  const [resolvedSOS, setResolvedSOS] = useState(false);
  const [liveIncidents, setLiveIncidents] = useState<IncidentResponse[]>([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState<AlertResponse[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertResponse | null>(null);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);

  const fetchIncidents = React.useCallback(async () => {
    setIsLoadingIncidents(true);
    try {
      const res = await incidentApi.getIncidents({ page: 0, size: 5 });
      if (res?.content) {
        setLiveIncidents(res.content);
      }
    } catch (err) {
      console.log('Error fetching live incidents:', err);
    } finally {
      setIsLoadingIncidents(false);
    }
  }, []);

  const fetchAlerts = React.useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const res = await alertApi.getAlerts({ page: 0, size: 10 });
      if (res?.content) {
        setLiveAlerts(res.content);
      }
    } catch (err) {
      console.log('Error fetching live alerts:', err);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  const lastAlertIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    fetchIncidents();
    fetchAlerts();
    // Auto-polling mỗi 4 giây để bắt tín hiệu SOS từ robot ngay lập tức
    const timer = setInterval(() => {
      fetchIncidents();
      fetchAlerts();
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchIncidents, fetchAlerts]);

  // Tự động mở màn hình nhận cuộc gọi SOS nếu có sự cố khẩn cấp mới phát sinh
  React.useEffect(() => {
    const openCritical = liveAlerts.find((a) => a.status === 'OPEN' && a.severity === 'CRITICAL');
    if (openCritical && openCritical.alertId !== lastAlertIdRef.current) {
      lastAlertIdRef.current = openCritical.alertId;
      setSelectedAlert(openCritical);
      setShowSOSCall(true);
    }
  }, [liveAlerts]);

  const handleResolveAlert = async (alertId: string) => {
    setResolvingAlertId(alertId);
    try {
      await alertApi.resolveAlert(alertId);
      Alert.alert('Thành công', 'Đã đánh dấu giải quyết cảnh báo SOS.');
      await fetchAlerts();
    } catch (err: any) {
      console.log('Error resolving alert:', err);
      Alert.alert('Lỗi', err?.message || 'Không thể cập nhật trạng thái cảnh báo');
    } finally {
      setResolvingAlertId(null);
    }
  };

  const handleAcknowledgeAlert = async (alertItem: AlertResponse) => {
    setSelectedAlert(alertItem);
    try {
      await alertApi.acknowledgeAlert(alertItem.alertId);
      await fetchAlerts();
      setShowSOSStream(true);
    } catch (err: any) {
      console.log('Error acknowledging alert:', err);
      Alert.alert('Lỗi', err?.message || 'Không thể tiếp nhận cảnh báo');
    }
  };

  const handleCloseAlert = async (alertId: string) => {
    try {
      await alertApi.closeAlert(alertId);
      Alert.alert('Thành công', 'Đã đóng hoàn tất cảnh báo.');
      await fetchAlerts();
    } catch (err: any) {
      console.log('Error closing alert:', err);
      Alert.alert('Lỗi', err?.message || 'Không thể đóng cảnh báo');
    }
  };

  const activeAlertCount = React.useMemo(() => {
    const unacknowledgedAlerts = liveAlerts.filter((a) => a.status === 'OPEN').length;
    const unacknowledgedIncidents = liveIncidents.filter((i) => i.status === 'OPEN').length;
    return Math.max(unacknowledgedAlerts, unacknowledgedIncidents);
  }, [liveAlerts, liveIncidents]);

  return (
    <View style={styles.container}>
      {/* ===== REUSABLE STAFF HEADER ===== */}
      <StaffHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ===== SUBHEADER ===== */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderSub}>HỆ THỐNG · TRUNG TÂM CẢNH BÁO</Text>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Cảnh báo khẩn cấp</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isLoadingAlerts || isLoadingIncidents ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    fetchIncidents();
                    fetchAlerts();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <RefreshCw size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
              <View style={styles.activeAlertBadge}>
                <View style={styles.alertDot} />
                <Text style={styles.activeAlertText}>{activeAlertCount} ĐANG XẢY RA</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ===== REAL ALERTS & INCIDENTS LIST ===== */}
        {liveAlerts.length > 0 ? (
          liveAlerts.map((alertItem) => {
            const isResolved = alertItem.status === 'RESOLVED';
            const isClosed = alertItem.status === 'CLOSED';
            const isAcknowledged = alertItem.status === 'ACKNOWLEDGED';
            const isOpen = alertItem.status === 'OPEN';
            const isCritical = alertItem.severity === 'CRITICAL';
            const isResolvingThis = resolvingAlertId === alertItem.alertId;

            return (
              <View
                key={alertItem.alertId}
                style={[
                  isCritical && isOpen ? styles.cardAlertRed : styles.cardNormal,
                  (isResolved || isClosed) && { opacity: 0.85 },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={isCritical ? styles.cardIconBoxRed : styles.cardIconBoxOrange}>
                    <Text style={{ fontSize: 16 }}>{isCritical ? '🆘' : '⚠️'}</Text>
                  </View>
                  <View style={styles.cardTitleBox}>
                    <Text style={styles.cardTitle}>
                      {alertItem.notificationType === 'SOS'
                        ? 'Tín hiệu SOS từ Robot'
                        : alertItem.notificationType || 'Cảnh báo khẩn cấp'}
                    </Text>
                  </View>
                  <View
                    style={
                      isOpen
                        ? styles.statusTagRed
                        : isAcknowledged
                        ? styles.statusTagBlue
                        : isResolved
                        ? styles.statusTagGreen
                        : styles.statusTagGray
                    }
                  >
                    <Text style={styles.statusTagText}>
                      {isOpen
                        ? 'Đang xảy ra'
                        : isAcknowledged
                        ? 'Đang xử lý'
                        : isResolved
                        ? 'Đã giải quyết'
                        : 'Đã đóng'}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>ĐỊA ĐIỂM</Text>
                    <Text style={styles.metaVal} numberOfLines={1}>
                      {alertItem.dataJson?.endpoint_id ? 'Gazebo North 04' : alertItem.zoneId ? `Zone ${alertItem.zoneId.substring(0, 6)}` : 'Vị trí Robot'}
                    </Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>ROBOT TẠI</Text>
                    <Text style={styles.metaVal}>MAR-GAZEBO-01</Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>GIỜ</Text>
                    <Text style={styles.metaVal}>
                      {alertItem.createdAt
                        ? new Date(alertItem.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Vừa xong'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardDesc}>
                  {alertItem.message || 'Bệnh nhân kích hoạt nút SOS trên robot. Cần hỗ trợ ngay.'}
                </Text>

                {/* NÚT THAO TÁC THEO TRẠNG THÁI */}
                {isOpen && (
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={styles.blueBtn}
                      onPress={() => handleAcknowledgeAlert(alertItem)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.blueBtnText}>Tiếp nhận SOS & Xem camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.tealBtn}
                      onPress={() => {
                        setSelectedAlert(alertItem);
                        setShowSOSCall(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Phone size={15} color={Colors.tealDark} />
                      <Text style={styles.tealBtnText}>Mở cuộc gọi</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isAcknowledged && (
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.outlineResolveBtn, { flex: 1 }]}
                      onPress={() => handleResolveAlert(alertItem.alertId)}
                      activeOpacity={0.8}
                      disabled={isResolvingThis}
                    >
                      {isResolvingThis ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : (
                        <>
                          <Check size={14} color={Colors.primary} />
                          <Text style={styles.outlineResolveBtnText}>Đánh dấu đã giải quyết ✓</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.blueBtn, { flex: 0.8 }]}
                      onPress={() => {
                        setSelectedAlert(alertItem);
                        setShowSOSStream(true);
                      }}
                      activeOpacity={0.8}
                    >
                      <Eye size={15} color="#FFFFFF" />
                      <Text style={styles.blueBtnText}>Camera Stream</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isResolved && (
                  <TouchableOpacity
                    style={[styles.outlineResolveBtn, styles.outlineResolveBtnDone]}
                    onPress={() => handleCloseAlert(alertItem.alertId)}
                    activeOpacity={0.8}
                  >
                    <Check size={14} color="#059669" />
                    <Text style={[styles.outlineResolveBtnText, { color: '#059669' }]}>
                      Đóng cảnh báo hoàn tất ✓
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        ) : (
          /* TRẠNG THÁI AN TOÀN - KHÔNG CÓ CẢNH BÁO */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <ShieldAlert size={36} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>Khu vực an toàn</Text>
            <Text style={styles.emptySubtitle}>
              Hiện không có cảnh báo khẩn cấp hoặc sự cố SOS nào. Hệ thống sẵn sàng tiếp nhận khi có tín hiệu từ robot.
            </Text>
            <TouchableOpacity
              style={styles.emptyRefreshBtn}
              onPress={() => {
                fetchIncidents();
                fetchAlerts();
              }}
              activeOpacity={0.8}
            >
              <RefreshCw size={14} color={Colors.primary} />
              <Text style={styles.emptyRefreshText}>Cập nhật lại</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ===== SOS CALL OVERLAY MODAL ===== */}
      <SOSCallModal
        visible={showSOSCall}
        alertId={selectedAlert?.alertId || liveAlerts?.[0]?.alertId}
        robotName="Robot MAR-GAZEBO-01"
        location={
          selectedAlert?.zoneId
            ? `Zone ${selectedAlert.zoneId.substring(0, 8)}`
            : 'Hành lang chính'
        }
        timestamp={
          selectedAlert?.createdAt
            ? new Date(selectedAlert.createdAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : undefined
        }
        onAccept={() => {
          setShowSOSCall(false);
          setShowSOSStream(true);
          fetchAlerts();
        }}
        onDecline={() => setShowSOSCall(false)}
      />

      {/* ===== SOS STREAM & DISPATCH MODAL ===== */}
      <SOSStreamModal
        visible={showSOSStream}
        alertId={selectedAlert?.alertId || liveAlerts?.[0]?.alertId}
        incidentId={selectedAlert?.incidentId || liveIncidents?.[0]?.incidentId}
        robotName="Robot MAR-GAZEBO-01"
        location={
          selectedAlert?.zoneId
            ? `Zone ${selectedAlert.zoneId.substring(0, 8)}`
            : 'Hành lang chính'
        }
        onClose={() => {
          setShowSOSStream(false);
          fetchAlerts();
        }}
        onResolve={() => {
          fetchAlerts();
        }}
        onDispatch={() => {
          setShowSOSStream(false);
          setShowFallDetail(true);
        }}
      />

      {/* ===== FALL DETECTION DETAIL MODAL ===== */}
      <FallDetectionModal
        visible={showFallDetail}
        onClose={() => setShowFallDetail(false)}
        incidentId={liveIncidents?.[0]?.incidentId}
        location={liveIncidents?.[0]?.description || 'Khu: 3B · Hành lang Tim mạch'}
        robotName="Robot MAR-01"
        onAcknowledge={() => {
          fetchIncidents();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandSmall: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5 },
  badgeOnDuty: {
    backgroundColor: '#D1FAE5',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeOnDutyText: { fontSize: 9, fontWeight: '700', color: Colors.emerald },
  staffName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  pageHeader: {
    marginBottom: Spacing.sm,
  },
  pageHeaderSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A2540',
  },
  activeAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  activeAlertText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },

  // Alert Cards
  cardAlert: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    ...Shadows.card,
  },
  cardNormal: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardIconBoxOrange: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxRed: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxGray: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBox: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A2540',
  },
  statusTagOrange: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagOrangeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusTagGray: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagGrayText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A2540',
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 12,
  },

  // Buttons in card
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  blueBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#0284C7',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blueBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tealBtn: {
    flex: 1,
    height: 40,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tealBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.tealDark,
  },
  outlineResolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  outlineResolveBtnDone: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  outlineResolveBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  statusTagRed: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagBlue: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagGreen: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sampleAlertBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  sampleAlertText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#DC2626',
  },
  cardAlertRed: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    ...Shadows.card,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  emptyRefreshText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
