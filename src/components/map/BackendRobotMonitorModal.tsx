import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Bot, LogOut, Map as MapIcon, Video } from 'lucide-react-native';
import { EndpointResponse, JobResponse, MapResponse, RobotDto, ZoneDto } from '../../api/types';
import { RobotCameraStreamView } from '../camera/RobotCameraStreamView';
import { BackendHospitalMap, MapPlanPoint, MapRobotPose } from './BackendHospitalMap';

interface Props {
  visible: boolean;
  onClose: () => void;
  robot: RobotDto | null;
  map: MapResponse | null;
  metadata: Record<string, any> | null;
  endpoints: EndpointResponse[];
  zones: ZoneDto[];
  token: string | null;
  activeJob: JobResponse | null;
  robotPose?: MapRobotPose | null;
  isPoseLive?: boolean;
  plannedPath?: MapPlanPoint[] | null;
}

export const BackendRobotMonitorModal: React.FC<Props> = ({
  visible,
  onClose,
  robot,
  map,
  metadata,
  endpoints,
  zones,
  token,
  activeJob,
  robotPose,
  isPoseLive,
  plannedPath,
}) => {
  const [view, setView] = useState<'camera' | 'map'>('camera');
  const battery = robot?.batteryPercent ?? robot?.batteryRaw;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.identity}>
            <Bot size={22} color="#38BDF8" />
            <View style={styles.identityText}>
              <Text style={styles.title} numberOfLines={1}>
                {robot?.robotName || 'Chưa có dữ liệu robot'}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {robot
                  ? `${robot.robotCode} · ${robot.model} · ${robot.status}`
                  : 'Dữ liệu được lấy trực tiếp từ Backend'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.headerExitButton}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityLabel="Thoát màn hình Robot"
          >
            <LogOut size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.headerExitButtonText}>Thoát (Out)</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>PIN</Text>
              <Text style={styles.statValue}>{battery == null ? '--' : `${battery}%`}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TỌA ĐỘ NAV2</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {robotPose
                  ? `${robotPose.xM.toFixed(2)}, ${robotPose.yM.toFixed(2)}`
                  : 'Chưa định vị'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>MAP</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {map?.mapName || 'Không có'}
              </Text>
            </View>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, view === 'camera' && styles.activeTab]}
              onPress={() => setView('camera')}
            >
              <Video size={16} color={view === 'camera' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.tabText, view === 'camera' && styles.activeTabText]}>
                Camera thiết bị
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, view === 'map' && styles.activeTab]}
              onPress={() => setView('map')}
            >
              <MapIcon size={16} color={view === 'map' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.tabText, view === 'map' && styles.activeTabText]}>
                Map Backend
              </Text>
            </TouchableOpacity>
          </View>

          {view === 'camera' ? (
            <RobotCameraStreamView height={360} showControls robot={robot} />
          ) : map ? (
            <BackendHospitalMap
              map={map}
              metadata={metadata}
              endpoints={endpoints}
              zones={zones}
              token={token}
              onSelectEndpoint={() => undefined}
              robotPose={robotPose}
              isPoseLive={isPoseLive}
              plannedPath={plannedPath}
            />
          ) : (
            <View style={styles.emptyState}>
              <ActivityIndicator color="#0284C7" />
              <Text style={styles.emptyText}>Backend chưa trả về map cho robot.</Text>
            </View>
          )}

          {activeJob && (
            <View style={styles.jobCard}>
              <Text style={styles.jobTitle}>NHIỆM VỤ TỪ BACKEND</Text>
              <Text style={styles.jobText}>
                {activeJob.jobCode} · {activeJob.status}
              </Text>
              <Text style={styles.jobSubText}>
                Ưu tiên {activeJob.priority} · Job ID: {activeJob.jobId}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.bottomExitButton}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityLabel="Thoát về Staff App"
          >
            <LogOut size={16} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.bottomExitButtonText}>
              THOÁT MÀN HÌNH ROBOT · VỀ STAFF APP (OUT)
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: {
    backgroundColor: '#0F172A',
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  identityText: { flex: 1, marginLeft: 10 },
  title: { color: '#FFFFFF', fontWeight: '800', fontSize: 17 },
  subtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  headerExitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EF4444',
  },
  headerExitButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  content: { padding: 16, paddingBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    minHeight: 74,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    justifyContent: 'center',
  },
  statLabel: { color: '#64748B', fontWeight: '700', fontSize: 10 },
  statValue: { color: '#0F172A', fontWeight: '800', fontSize: 14, marginTop: 5 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 4,
    marginTop: 14,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  activeTab: { backgroundColor: '#0284C7' },
  tabText: { color: '#64748B', fontWeight: '700' },
  activeTabText: { color: '#FFFFFF' },
  emptyState: {
    minHeight: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: '#64748B', marginTop: 10 },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  jobTitle: { color: '#0284C7', fontSize: 11, fontWeight: '800' },
  jobText: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginTop: 5 },
  jobSubText: { color: '#64748B', fontSize: 11, marginTop: 4 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  bottomExitButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  bottomExitButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
