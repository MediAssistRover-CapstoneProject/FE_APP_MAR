import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import {
  Video,
  VideoOff,
  RefreshCw,
  Eye,
  ShieldCheck,
  Cpu,
  Wifi,
  WifiOff,
  Crosshair,
  Maximize2,
  Sliders,
  Layers,
} from 'lucide-react-native';
import { cameraApi, CameraHealthResponse } from '../../api/modules/camera.api';
import { useHospitalMapStore } from '../../store/useHospitalMapStore';
import { Colors } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

interface RobotCameraStreamViewProps {
  customHost?: string;
  height?: number;
  showControls?: boolean;
  onExpandPress?: () => void;
}

export const RobotCameraStreamView: React.FC<RobotCameraStreamViewProps> = ({
  customHost,
  height = SCREEN_W * 0.62,
  showControls = true,
  onExpandPress,
}) => {
  const { robotState } = useHospitalMapStore();
  const [streamSource, setStreamSource] = useState<'robot_pi' | 'ai_vision'>('robot_pi');
  const [cameraStatus, setCameraStatus] = useState<'CONNECTING' | 'STREAMING' | 'OFFLINE'>('CONNECTING');
  const [healthInfo, setHealthInfo] = useState<CameraHealthResponse | null>(null);
  const [snapshotUri, setSnapshotUri] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [useSnapshotMode, setUseSnapshotMode] = useState(false);
  const [showHudOverlay, setShowHudOverlay] = useState(true);

  // Blinking red dot animation for LIVE tag
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    blinkLoop.start();
    return () => blinkLoop.stop();
  }, [blinkAnim]);

  // Initial and periodic camera health check
  const checkHealth = async () => {
    setIsRefreshing(true);
    try {
      const data = await cameraApi.checkCameraHealth(customHost);
      setHealthInfo(data);
      if (data.status === 'STREAMING' || data.fps > 0) {
        setCameraStatus('STREAMING');
      } else {
        setCameraStatus('OFFLINE');
      }
    } catch {
      setCameraStatus('OFFLINE');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, [customHost, streamSource]);

  // Snapshot polling timer when in snapshot mode
  useEffect(() => {
    if (!streamEnabled || !useSnapshotMode) return;
    const snapInterval = setInterval(() => {
      setSnapshotUri(cameraApi.getSnapshotUrl(customHost));
    }, 600);
    return () => clearInterval(snapInterval);
  }, [streamEnabled, useSnapshotMode, customHost]);

  const activeStreamUrl = cameraApi.getStreamUrl(streamSource, customHost);

  return (
    <View style={styles.container}>
      {/* ===== 1. CAMERA SCREEN FRAME ===== */}
      <View style={[styles.streamCard, { height }]}>
        {streamEnabled ? (
          cameraStatus === 'STREAMING' ? (
            <Image
              source={{ uri: useSnapshotMode ? snapshotUri || activeStreamUrl : activeStreamUrl }}
              style={styles.streamImage}
              resizeMode="cover"
              onError={() => {
                // Tự động chuyển qua snapshot polling nếu stream mjpeg trực tiếp gặp lỗi
                if (!useSnapshotMode) setUseSnapshotMode(true);
              }}
            />
          ) : (
            // Offline / Standby Graphic
            <View style={styles.offlineBox}>
              <View style={styles.offlineCircle}>
                <VideoOff size={42} color="#94A3B8" />
              </View>
              <Text style={styles.offlineTitle}>CHƯA NHẬN ĐƯỢC TÍN HIỆU CAMERA</Text>
              <Text style={styles.offlineSub}>
                {streamSource === 'robot_pi'
                  ? `Đang lắng nghe từ Mắt Robot: ${activeStreamUrl}`
                  : `Đang kết nối AI Vision Service: ${activeStreamUrl}`}
              </Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={checkHealth}
                activeOpacity={0.8}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <RefreshCw size={14} color="#FFFFFF" />
                    <Text style={styles.retryBtnText}>Kiểm tra lại camera</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={styles.offlineBox}>
            <Eye size={40} color="#64748B" />
            <Text style={[styles.offlineTitle, { color: '#64748B' }]}>CAMERA ĐANG TẮT</Text>
            <Text style={styles.offlineSub}>Bấm nút bật camera bên dưới để mở lại luồng video</Text>
          </View>
        )}

        {/* ===== 2. HUD SCI-FI OVERLAYS ===== */}
        {showHudOverlay && streamEnabled && (
          <>
            {/* 4 Corner HUD Brackets */}
            <View style={[styles.hudCorner, styles.cornerTL]} />
            <View style={[styles.hudCorner, styles.cornerTR]} />
            <View style={[styles.hudCorner, styles.cornerBL]} />
            <View style={[styles.hudCorner, styles.cornerBR]} />

            {/* Reticle / Crosshair Tâm ngắm */}
            <View style={styles.crosshairBox} pointerEvents="none">
              <Crosshair size={32} color="rgba(56, 189, 248, 0.45)" strokeWidth={1} />
            </View>

            {/* Top HUD Badges */}
            <View style={styles.topHudRow} pointerEvents="none">
              {/* LIVE Tag */}
              <View style={styles.liveBadge}>
                <Animated.View
                  style={[
                    styles.liveDot,
                    {
                      backgroundColor: cameraStatus === 'STREAMING' ? '#EF4444' : '#F59E0B',
                      opacity: blinkAnim,
                    },
                  ]}
                />
                <Text style={styles.liveText}>
                  {cameraStatus === 'STREAMING' ? 'LIVE' : 'STANDBY'}
                </Text>
                <Text style={styles.sourceTagText}>
                  {streamSource === 'robot_pi' ? 'ROBOT-CAM' : 'AI-VISION'}
                </Text>
              </View>

              {/* Resolution & FPS */}
              <View style={styles.fpsBadge}>
                <Cpu size={12} color="#38BDF8" />
                <Text style={styles.fpsText}>
                  {healthInfo?.resolution || '640x480'} · {healthInfo?.fps || (cameraStatus === 'STREAMING' ? 24 : 0)} FPS
                </Text>
              </View>
            </View>

            {/* Bottom HUD Telemetry Overlay */}
            <View style={styles.bottomHudOverlay} pointerEvents="none">
              <View style={styles.hudTelemetryCol}>
                <Text style={styles.hudTelemetryText}>
                  NAV2: ({Math.round(robotState.x)}, {Math.round(robotState.y)}) · {robotState.heading}°
                </Text>
                <Text style={styles.hudTelemetrySub}>
                  PIN: {robotState.batteryPercent}% · VẬN TỐC: {robotState.status === 'NAVIGATING' ? `${robotState.speedMps} m/s` : '0.0 m/s'}
                </Text>
              </View>
              <View style={styles.hudStatusRight}>
                <ShieldCheck size={14} color="#10B981" />
                <Text style={styles.hudSafetyText}>TRÁNH VẬT CẢN ON</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* ===== 3. STREAM CONTROLS BAR ===== */}
      {showControls && (
        <View style={styles.controlBar}>
          {/* Nguồn phát: Robot Camera vs AI Vision */}
          <View style={styles.sourceToggleRow}>
            <TouchableOpacity
              style={[
                styles.sourceBtn,
                streamSource === 'robot_pi' && styles.sourceBtnActive,
              ]}
              onPress={() => setStreamSource('robot_pi')}
              activeOpacity={0.8}
            >
              <Video size={13} color={streamSource === 'robot_pi' ? '#FFFFFF' : '#94A3B8'} />
              <Text
                style={[
                  styles.sourceBtnText,
                  streamSource === 'robot_pi' && styles.sourceBtnTextActive,
                ]}
              >
                Mắt Robot (8090)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sourceBtn,
                streamSource === 'ai_vision' && styles.sourceBtnActive,
              ]}
              onPress={() => setStreamSource('ai_vision')}
              activeOpacity={0.8}
            >
              <Layers size={13} color={streamSource === 'ai_vision' ? '#FFFFFF' : '#94A3B8'} />
              <Text
                style={[
                  styles.sourceBtnText,
                  streamSource === 'ai_vision' && styles.sourceBtnTextActive,
                ]}
              >
                AI Fall/Pose (8001)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtonsRow}>
            {/* Toggle HUD overlay */}
            <TouchableOpacity
              style={[styles.miniActionBtn, showHudOverlay && styles.miniActionBtnActive]}
              onPress={() => setShowHudOverlay(!showHudOverlay)}
              activeOpacity={0.7}
              accessibilityLabel="Bật tắt chỉ số HUD"
            >
              <Sliders size={15} color={showHudOverlay ? '#38BDF8' : '#94A3B8'} />
            </TouchableOpacity>

            {/* Toggle Stream Pause/Play */}
            <TouchableOpacity
              style={styles.miniActionBtn}
              onPress={() => setStreamEnabled(!streamEnabled)}
              activeOpacity={0.7}
              accessibilityLabel="Bật tắt camera"
            >
              {streamEnabled ? (
                <Video size={15} color="#10B981" />
              ) : (
                <VideoOff size={15} color="#EF4444" />
              )}
            </TouchableOpacity>

            {/* Refresh Connection */}
            <TouchableOpacity
              style={styles.miniActionBtn}
              onPress={checkHealth}
              activeOpacity={0.7}
              accessibilityLabel="Làm mới kết nối camera"
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <RefreshCw size={15} color="#38BDF8" />
              )}
            </TouchableOpacity>

            {/* Phóng to nếu có handler */}
            {onExpandPress && (
              <TouchableOpacity
                style={styles.miniActionBtn}
                onPress={onExpandPress}
                activeOpacity={0.7}
                accessibilityLabel="Toàn màn hình"
              >
                <Maximize2 size={15} color="#F8FAFC" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  streamCard: {
    width: '100%',
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streamImage: {
    width: '100%',
    height: '100%',
  },
  offlineBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  offlineCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  offlineTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E2E8F0',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  offlineSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 12,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // HUD 4 Corners
  hudCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: 8,
    left: 8,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
  },
  cornerTR: {
    top: 8,
    right: 8,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
  },
  cornerBL: {
    bottom: 8,
    left: 8,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
  },
  cornerBR: {
    bottom: 8,
    right: 8,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
  },
  crosshairBox: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Top HUD Badges
  topHudRow: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  sourceTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
    marginLeft: 2,
  },
  fpsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fpsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  // Bottom HUD Telemetry
  bottomHudOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  hudTelemetryCol: {
    flex: 1,
  },
  hudTelemetryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.3,
  },
  hudTelemetrySub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  hudStatusRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  hudSafetyText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
  },
  // Control Bar
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginTop: 6,
  },
  sourceToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sourceBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  sourceBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  sourceBtnTextActive: {
    color: '#FFFFFF',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniActionBtnActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F172A',
  },
});
