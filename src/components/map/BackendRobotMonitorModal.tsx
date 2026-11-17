import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Bot,
  Camera,
  LogOut,
  Video,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RefreshCw,
  WifiOff,
  Radio,
} from 'lucide-react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import {
  EndpointResponse,
  JobResponse,
  MapResponse,
  RobotBatteryResponse,
  RobotDto,
  ZoneDto,
} from '../../api/types';
import { robotApi } from '../../api/modules/robot.api';
import { MapPlanPoint, MapRobotPose } from './BackendHospitalMap';
import {
  buildMediaCallHtml,
  CallStatus,
  statusLabel,
  statusColor,
} from '../media/MediaCallModal';
import { RobotCameraStreamView } from '../camera/RobotCameraStreamView';
import { apiClient } from '../../api/client';
import { BATTERY_REFRESH_INTERVAL_MS, MQTT_PREVIEW_POLL_MS } from '../../api/pollingPolicy';
import {
  isOpenCameraSession,
  isOwnMonitorSession,
  mediaSessionApi,
  MediaSessionMode,
} from '../../api/modules/mediaSession.api';
import { normalizeRobotPose } from './robotPose';
import { formatRobotBatteryDisplay, pickNewerRobotBattery } from './robotBattery';

interface Props {
  visible: boolean;
  onClose: () => void;
  robot: RobotDto | null;
  battery?: RobotBatteryResponse | null;
  map: MapResponse | null;
  metadata: Record<string, any> | null;
  endpoints: EndpointResponse[];
  zones: ZoneDto[];
  token: string | null;
  activeJob: JobResponse | null;
  activeJobId?: string | null;
  robotPose?: MapRobotPose | null;
  isPoseLive?: boolean;
  plannedPath?: MapPlanPoint[] | null;
}

type CameraSourceTab = 'webrtc' | 'mqtt_preview' | 'pi_lan';

function translateCameraError(error: any): string {
  const code = error?.code || error?.message || '';
  const map: Record<string, string> = {
    MEDIA_DISABLED: 'Máy chủ chưa bật dịch vụ camera trực tiếp.',
    MEDIA_DEVICE_NOT_CONNECTED:
      'Robot hiện chưa kết nối dịch vụ camera trực tiếp (WebRTC) hoặc đang ngoại tuyến.',
    ROBOT_MEDIA_SESSION_ALREADY_OPEN:
      'Robot đang có phiên camera khác trên hệ thống. Đang đồng bộ lại phiên...',
    MEDIA_SERVER_UNAVAILABLE: 'Chưa kết nối được máy chủ LiveKit camera.',
    MEDIA_CONFIGURATION_INVALID: 'Cấu hình dịch vụ camera trên máy chủ chưa đầy đủ.',
    MEDIA_EXTERNAL_WSS_ORIGIN_REQUIRED: 'Máy chủ chưa cấu hình địa chỉ WSS camera bảo mật.',
  };
  if (map[code]) return map[code];
  if (error?.message && map[error.message]) return map[error.message];
  return error?.message || 'Chưa kết nối được camera. Hệ thống sẽ tự thử lại.';
}

export const BackendRobotMonitorModal: React.FC<Props> = ({
  visible,
  onClose,
  robot,
  battery,
  activeJob,
  activeJobId,
  robotPose,
}) => {
  const webViewRef = useRef<any>(null);
  const [cameraTab, setCameraTab] = useState<CameraSourceTab>('webrtc');
  const [sessionMode, setSessionMode] = useState<MediaSessionMode>('MONITOR');
  const [callStatus, setCallStatus] = useState<CallStatus>('INIT');
  const [micEnabled, setMicEnabled] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [keyReload, setKeyReload] = useState(0);
  const [polledBattery, setPolledBattery] = useState<RobotBatteryResponse | null>(null);

  // WebRTC LiveKit credentials (từ POST /api/v1/media-sessions/{id}/join-token)
  const [sessionCredentials, setSessionCredentials] = useState<{
    url: string;
    token: string;
    sessionId: string;
    mode: MediaSessionMode;
  } | null>(null);
  const [isNegotiating, setIsNegotiating] = useState(false);

  // Fallback / MQTT Snapshot state (từ GET /api/v1/jobs/{jobId}/camera-preview.jpg — khớp LiveMapping.jsx)
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(
    activeJobId || activeJob?.jobId || null
  );
  const [mqttPreviewFrame, setMqttPreviewFrame] = useState<{
    dataUri: string;
    capturedAt: string | null;
    revision: string | null;
  } | null>(null);
  const [mqttPreviewMessage, setMqttPreviewMessage] = useState<string>(
    'Đang chờ khung hình camera từ phiên quét / nhiệm vụ của robot...'
  );

  // Quản lý đóng phiên MONITOR khi thoát modal (khớp robotCamera.js trên FE_WEB_MAR)
  const ownedSessionRef = useRef<{ sessionId: string; viewerToken: string } | null>(null);
  const viewerTokenRef = useRef<string | null>(null);

  // Live dot animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (callStatus === 'CONNECTED' || mqttPreviewFrame?.dataUri) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [callStatus, mqttPreviewFrame?.dataUri, pulseAnim]);

  const closeOwnedMonitorSession = useCallback(async () => {
    const owned = ownedSessionRef.current;
    ownedSessionRef.current = null;
    if (owned?.sessionId) {
      await mediaSessionApi
        .endSession(owned.sessionId, 'MONITOR_VIEW_CLOSED', owned.viewerToken)
        .catch(() => {});
    }
  }, []);

  // 1. Luồng chính: Kết nối WebRTC LiveKit (Khớp FE_WEB_MAR src/features/media/robotCamera.js)
  useEffect(() => {
    if (!visible) {
      void closeOwnedMonitorSession();
      setCallStatus('INIT');
      setSessionMode('MONITOR');
      setMicEnabled(false);
      setAudioMuted(false);
      setErrorMsg(null);
      setSessionCredentials(null);
      setMqttPreviewFrame(null);
      setIsNegotiating(false);
      return;
    }

    let isMounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const initWebRtcCamera = async () => {
      if (!robot?.robotId) {
        setCallStatus('ERROR');
        setErrorMsg('Không xác định được ID của Robot');
        return;
      }

      setIsNegotiating(true);
      setCallStatus('CREATING_SESSION');
      setErrorMsg(null);

      try {
        // Lấy token có quyền mở phiên MONITOR & đọc camera-preview.jpg (tự động cấp quyền Admin viewer nếu cần)
        const viewerAuth = await mediaSessionApi.acquireCameraViewerAuth();
        if (!isMounted) return;
        viewerTokenRef.current = viewerAuth.token;

        // Bước 1: GET /api/v1/media/configuration (Khớp robotCamera.js line 60)
        const config = await mediaSessionApi.getConfiguration(viewerAuth.token);
        if (!isMounted) return;
        if (config?.enabled !== true) {
          setCallStatus('ERROR');
          setErrorMsg('Máy chủ chưa bật dịch vụ camera trực tiếp.');
          setIsNegotiating(false);
          return;
        }

        // Bước 2: GET /api/v1/media-sessions
        const existingSessions = await mediaSessionApi
          .getSessions(viewerAuth.token)
          .catch(() => []);
        if (!isMounted) return;

        // Chỉ tái sử dụng phiên MONITOR do chính tài khoản này mở và còn hiệu lực
        let activeSession = existingSessions.find(
          (s) =>
            s.robotId === robot.robotId &&
            s.mode === 'MONITOR' &&
            s.staffAccountId === viewerAuth.accountId &&
            isOpenCameraSession(s)
        );

        // Xem camera đơn thuần không gọi accept cho cuộc SOS, không nâng ASSIST, không hủy job
        // và không kết thúc phiên của Staff khác.

        // Bước 3: POST /api/v1/media-sessions với mode MONITOR
        if (!activeSession) {
          try {
            const created = await mediaSessionApi.createSession(
              {
                robotId: robot.robotId,
                mode: 'MONITOR',
              },
              viewerAuth.token
            );
            if (!isMounted) {
              // Nếu modal đã đóng trong lúc request đang gửi, hủy phiên vừa tạo ngay lập tức
              if (created?.sessionId) {
                void mediaSessionApi
                  .endSession(created.sessionId, 'MONITOR_VIEW_CLOSED', viewerAuth.token)
                  .catch(() => {});
              }
              return;
            }
            activeSession = created;
            if (activeSession?.sessionId) {
              ownedSessionRef.current = {
                sessionId: activeSession.sessionId,
                viewerToken: viewerAuth.token,
              };
            }
          } catch (createErr: any) {
            // Nếu xung đột ROBOT_MEDIA_SESSION_ALREADY_OPEN (409), báo bận và cho thử lại
            if (
              createErr?.status === 409 ||
              String(createErr?.message || '').includes('ROBOT_MEDIA_SESSION_ALREADY_OPEN')
            ) {
              setCallStatus('ERROR');
              setErrorMsg('Robot đang bận truyền media (phiên khác đang diễn ra). Vui lòng thử lại sau.');
              setIsNegotiating(false);
              return;
            }
            throw createErr;
          }
        }

        if (!activeSession?.sessionId) {
          throw new Error('Không mở được phiên xem camera cho Robot này.');
        }

        // Bước 4: POST /api/v1/media-sessions/{sessionId}/join-token (Khớp robotCamera.js line 89)
        const creds = await mediaSessionApi.getJoinToken(
          activeSession.sessionId,
          viewerAuth.token
        );
        if (!creds?.url || !creds?.token) {
          throw new Error('Máy chủ không cấp được vé kết nối WebRTC LiveKit.');
        }

        if (isMounted) {
          setSessionCredentials({
            url: creds.url,
            token: creds.token,
            sessionId: activeSession.sessionId,
            mode: activeSession.mode || sessionMode,
          });
          setCallStatus('CONNECTING');
          setIsNegotiating(false);
        }
      } catch (err: any) {
        if (!isMounted) return;
        const friendlyMsg = translateCameraError(err);
        setCallStatus('ERROR');
        setErrorMsg(friendlyMsg);
        setIsNegotiating(false);

        // Tự động thử kết nối lại sau 8 giây giống robotCamera.js nếu robot chưa kịp kết nối
        if (err?.status !== 401 && err?.status !== 403) {
          retryTimer = setTimeout(() => {
            if (isMounted) {
              setKeyReload((k) => k + 1);
            }
          }, 8000);
        }
      }
    };

    void initWebRtcCamera();

    return () => {
      isMounted = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [visible, robot?.robotId, sessionMode, keyReload, closeOwnedMonitorSession]);

  // 2. Luồng dự phòng & song song: chỉ polling GET /api/v1/jobs/{jobId}/camera-preview.jpg
  // khi Staff thật sự chọn tab Ảnh MQTT (tránh kéo JPEG ngầm mỗi 1.8s lúc đang xem WebRTC)
  useEffect(() => {
    if (!visible || !robot?.robotId || cameraTab !== 'mqtt_preview') return;

    let alive = true;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let cachedAuth: { token: string } | null = null;
    let lastJobLookupAt = 0;

    const pollJobCameraPreview = async () => {
      try {
        if (!cachedAuth) {
          cachedAuth = await mediaSessionApi.acquireCameraViewerAuth();
        }
        if (!alive) return;

        let targetJobId = activeJobId || activeJob?.jobId || resolvedJobId;
        const now = Date.now();
        if (!targetJobId && now - lastJobLookupAt >= 10_000) {
          lastJobLookupAt = now;
          targetJobId = await mediaSessionApi.findRobotActiveOrLatestJobId(
            robot.robotId,
            cachedAuth.token
          );
          if (alive && targetJobId) {
            setResolvedJobId(targetJobId);
          }
        }

        if (targetJobId) {
          const preview = await mediaSessionApi.fetchJobCameraPreview(
            targetJobId,
            cachedAuth.token
          );
          if (!alive) return;

          if (preview.status === 200 && preview.dataUri) {
            setMqttPreviewFrame({
              dataUri: preview.dataUri,
              capturedAt: preview.capturedAt,
              revision: preview.revision,
            });
            setMqttPreviewMessage(
              preview.capturedAt
                ? `Ảnh camera từ phiên quét lúc ${new Date(preview.capturedAt).toLocaleTimeString('vi-VN')}`
                : `Đang nhận ảnh camera từ Robot (Job ${targetJobId.slice(0, 8)})`
            );
          } else if (preview.status === 204) {
            setMqttPreviewMessage('Chưa có ảnh camera MQTT mới hoặc phiên quét đã dừng quá 10 giây.');
          }
        } else {
          setMqttPreviewMessage('Chưa có phiên quét bản đồ đang chạy trên Robot.');
        }
      } catch {
        cachedAuth = null;
        if (alive) {
          setMqttPreviewMessage('Đang kiểm tra luồng ảnh camera từ phiên quét...');
        }
      }

      if (alive) {
        pollTimer = setTimeout(pollJobCameraPreview, MQTT_PREVIEW_POLL_MS);
      }
    };

    void pollJobCameraPreview();

    return () => {
      alive = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [visible, robot?.robotId, cameraTab, activeJobId, activeJob?.jobId, resolvedJobId]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'status':
          setCallStatus(msg.status as CallStatus);
          if (msg.error) setErrorMsg(msg.error);
          break;
        case 'mic':
          setMicEnabled(!!msg.enabled);
          break;
        case 'audio':
          setAudioMuted(!!msg.muted);
          break;
      }
    } catch {
      // ignore
    }
  }, []);

  const sendCommand = useCallback((cmd: object) => {
    const js = `window.dispatchEvent(new MessageEvent('message', { data: '${JSON.stringify(cmd).replace(/'/g, "\\'")}' })); true;`;
    webViewRef.current?.injectJavaScript?.(js);
  }, []);

  const handleToggleMic = useCallback(() => {
    Alert.alert(
      'Chế độ xem camera (MONITOR)',
      'Xem camera từ bản đồ chỉ truyền hình ảnh trực tiếp, không bật micro hoặc loa robot để đảm bảo an toàn vận hành. Đàm thoại hai chiều được kích hoạt trong phiên cứu hộ SOS hoặc cảnh báo sự cố.'
    );
  }, []);

  const handleToggleAudio = useCallback(() => {
    sendCommand({ type: 'toggleAudio' });
  }, [sendCommand]);

  const handleReloadCall = useCallback(() => {
    setCallStatus('INIT');
    setErrorMsg(null);
    setKeyReload((k) => k + 1);
  }, []);

  const handleModalClose = useCallback(() => {
    void closeOwnedMonitorSession();
    onClose();
  }, [closeOwnedMonitorSession, onClose]);

  const baseUrl = apiClient.getBaseUrl();
  const isWebRtcLive = callStatus === 'CONNECTED';
  const hasMqttFallbackFrame = Boolean(mqttPreviewFrame?.dataUri);

  const hasParentBatterySync = battery !== undefined;

  useEffect(() => {
    const targetRobotId = robot?.robotId;
    if (!visible || !targetRobotId) {
      setPolledBattery(null);
      return;
    }

    // Nếu MapScreen đã đồng bộ pin xuống modal qua prop thì tránh poll song song trừ khi bấm tải lại
    if (hasParentBatterySync && keyReload === 0) {
      return;
    }

    let cancelled = false;
    setPolledBattery((prev) => (prev?.robotId === targetRobotId ? prev : null));

    const fetchBattery = async () => {
      try {
        const res = await robotApi.getRobotBattery(targetRobotId);
        if (!cancelled && res && (!res.robotId || res.robotId === targetRobotId)) {
          setPolledBattery(res);
        }
      } catch {
        // Giữ dữ liệu pin gần nhất hoặc prop cha khi polling gặp lỗi mạng
      }
    };

    void fetchBattery();
    if (hasParentBatterySync) {
      return () => {
        cancelled = true;
      };
    }

    const timer = setInterval(() => {
      void fetchBattery();
    }, BATTERY_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [visible, robot?.robotId, keyReload, hasParentBatterySync]);

  const effectiveBattery = pickNewerRobotBattery(battery, polledBattery, robot?.robotId);
  const batteryDisplay = formatRobotBatteryDisplay(effectiveBattery, robot);
  const validPose = normalizeRobotPose(robotPose);

  const htmlContent = useMemo(() => {
    return buildMediaCallHtml({
      baseUrl,
      livekitUrl: sessionCredentials?.url,
      livekitToken: sessionCredentials?.token,
      robotId: robot?.robotId,
      mode: sessionCredentials?.mode || sessionMode,
      existingSessionId: sessionCredentials?.sessionId,
    });
  }, [baseUrl, sessionCredentials, robot?.robotId, sessionMode]);

  const effectiveStatusLabel =
    isWebRtcLive
      ? '🟢 Trực tiếp (WebRTC)'
      : hasMqttFallbackFrame
        ? '🟢 Ảnh trực tiếp (MQTT)'
        : statusLabel(callStatus);

  const effectiveStatusColor =
    isWebRtcLive || hasMqttFallbackFrame ? '#059669' : statusColor(callStatus);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleModalClose}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.identity}>
            <Bot size={22} color="#38BDF8" />
            <View style={styles.identityText}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {(isWebRtcLive || hasMqttFallbackFrame) && (
                  <Animated.View style={[styles.liveIndicator, { opacity: pulseAnim }]} />
                )}
                <Text style={styles.title} numberOfLines={1}>
                  {robot?.robotName && robot.robotName !== 'string'
                    ? robot.robotName
                    : robot?.robotCode || 'Robot AMR'}
                </Text>
              </View>
              <Text style={styles.subtitle} numberOfLines={1}>
                {robot
                  ? `${robot.robotCode} · ${robot.status} · Chế độ ${sessionMode}`
                  : 'Kết nối Camera Robot'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.headerExitButton}
            onPress={handleModalClose}
            activeOpacity={0.8}
            accessibilityLabel="Thoát màn hình Robot"
          >
            <LogOut size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.headerExitButtonText}>Đóng</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* STATS BAR */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>PIN</Text>
              <Text style={[styles.statValue, { color: batteryDisplay.tintColor }]} numberOfLines={1}>
                {batteryDisplay.detailText}
              </Text>
              {!!batteryDisplay.subText && (
                <Text style={styles.statSubText} numberOfLines={1}>
                  {batteryDisplay.subText}
                </Text>
              )}
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TỌA ĐỘ NAV2</Text>
              <Text style={styles.statValue} numberOfLines={1}>
                {validPose
                  ? `${validPose.xM.toFixed(2)}, ${validPose.yM.toFixed(2)}`
                  : 'Chưa định vị'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>TRẠNG THÁI CAMERA</Text>
              <Text
                style={[styles.statValue, { color: effectiveStatusColor, fontSize: 12 }]}
                numberOfLines={1}
              >
                {effectiveStatusLabel}
              </Text>
            </View>
          </View>

          {/* ================= 1. CAMERA & 2-WAY AUDIO TALK ================= */}
          <View style={styles.cameraBox}>
            <View style={styles.cameraHeaderRow}>
              <View style={styles.cameraHeaderLeft}>
                <Video size={16} color="#38BDF8" />
                <Text style={styles.cameraHeaderTitle}>Camera & Đàm thoại Robot</Text>
              </View>
              <View style={[styles.liveStatusTag, { backgroundColor: effectiveStatusColor }]}>
                <Text style={styles.liveStatusText}>{effectiveStatusLabel}</Text>
              </View>
            </View>

            {/* Thanh chọn nguồn Camera đồng bộ với Web Admin (LiveMapping.jsx) */}
            <View style={styles.sourceTabsRow}>
              <TouchableOpacity
                style={[
                  styles.sourceTabBtn,
                  cameraTab === 'webrtc' && styles.sourceTabBtnActive,
                ]}
                onPress={() => setCameraTab('webrtc')}
                activeOpacity={0.8}
              >
                <Video size={12} color={cameraTab === 'webrtc' ? '#FFFFFF' : '#94A3B8'} />
                <Text
                  style={[
                    styles.sourceTabText,
                    cameraTab === 'webrtc' && styles.sourceTabTextActive,
                  ]}
                >
                  WebRTC LiveKit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sourceTabBtn,
                  cameraTab === 'mqtt_preview' && styles.sourceTabBtnActive,
                ]}
                onPress={() => setCameraTab('mqtt_preview')}
                activeOpacity={0.8}
              >
                <Camera size={12} color={cameraTab === 'mqtt_preview' ? '#FFFFFF' : '#94A3B8'} />
                <Text
                  style={[
                    styles.sourceTabText,
                    cameraTab === 'mqtt_preview' && styles.sourceTabTextActive,
                  ]}
                >
                  Ảnh Quét Map (MQTT)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sourceTabBtn,
                  cameraTab === 'pi_lan' && styles.sourceTabBtnActive,
                ]}
                onPress={() => setCameraTab('pi_lan')}
                activeOpacity={0.8}
              >
                <Radio size={12} color={cameraTab === 'pi_lan' ? '#FFFFFF' : '#94A3B8'} />
                <Text
                  style={[
                    styles.sourceTabText,
                    cameraTab === 'pi_lan' && styles.sourceTabTextActive,
                  ]}
                >
                  Stream Pi (LAN)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Video Player Container */}
            {cameraTab === 'pi_lan' ? (
              <View style={{ padding: 8, backgroundColor: '#020617' }}>
                <RobotCameraStreamView
                  height={230}
                  showControls
                  robot={robot}
                  battery={effectiveBattery}
                />
              </View>
            ) : cameraTab === 'mqtt_preview' ? (
              <View style={styles.videoPlayerContainer}>
                {mqttPreviewFrame?.dataUri ? (
                  <View style={{ flex: 1 }}>
                    <Image
                      source={{ uri: mqttPreviewFrame.dataUri }}
                      style={styles.mqttPreviewImage}
                      resizeMode="contain"
                    />
                    <View style={styles.mqttTimestampBadge}>
                      <Text style={styles.mqttTimestampText}>{mqttPreviewMessage}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.connectingOverlay}>
                    <Camera size={32} color="#38BDF8" />
                    <Text style={styles.connectingText}>Camera phiên quét bản đồ (MQTT)</Text>
                    <Text style={styles.connectingSubText}>{mqttPreviewMessage}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.videoPlayerContainer}>
                {visible && sessionCredentials && (
                  <WebView
                    key={`${sessionCredentials.sessionId}-${sessionCredentials.mode}-${keyReload}`}
                    ref={webViewRef}
                    source={{ html: htmlContent, baseUrl: 'https://mediassistrover.duckdns.org' }}
                    style={styles.videoWebview}
                    originWhitelist={['*']}
                    javaScriptEnabled
                    domStorageEnabled
                    mediaPlaybackRequiresUserAction={false}
                    allowsInlineMediaPlayback
                    mediaCapturePermissionGrantType="deny"
                    onShouldStartLoadWithRequest={() => true}
                    onMessage={handleMessage}
                    onError={(e: any) => {
                      if (e?.nativeEvent?.code === -999) return;
                      setCallStatus('ERROR');
                      setErrorMsg(e.nativeEvent.description || 'Lỗi kết nối WebRTC');
                    }}
                  />
                )}

                {/* Tự động hiển thị ảnh camera-preview.jpg (Fallback giống LiveMapping.jsx) khi WebRTC đang chờ hoặc bận */}
                {!isWebRtcLive && hasMqttFallbackFrame && mqttPreviewFrame && (
                  <View style={styles.fallbackPreviewOverlay}>
                    <Image
                      source={{ uri: mqttPreviewFrame.dataUri }}
                      style={styles.mqttPreviewImage}
                      resizeMode="contain"
                    />
                    <View style={styles.mqttTimestampBadge}>
                      <Text style={styles.mqttTimestampText}>
                        {mqttPreviewMessage} (Dự phòng MQTT)
                      </Text>
                    </View>
                  </View>
                )}

                {/* Loading overlay when connecting and no fallback frame */}
                {!isWebRtcLive &&
                  !hasMqttFallbackFrame &&
                  callStatus !== 'ENDED' &&
                  callStatus !== 'ERROR' && (
                    <View style={styles.connectingOverlay}>
                      <ActivityIndicator size="large" color="#38BDF8" />
                      <Text style={styles.connectingText}>
                        {isNegotiating
                          ? 'Đang mở phiên xem camera robot...'
                          : statusLabel(callStatus)}
                      </Text>
                      <Text style={styles.connectingSubText}>
                        {isNegotiating
                          ? 'Đang xác thực /api/v1/media-sessions & cấp vé LiveKit...'
                          : 'Đang kết nối luồng video trực tiếp từ Robot...'}
                      </Text>
                    </View>
                  )}

                {/* Error overlay when both WebRTC and MQTT preview are unavailable */}
                {callStatus === 'ERROR' && !hasMqttFallbackFrame && (
                  <View style={styles.errorOverlay}>
                    <WifiOff size={36} color="#EF4444" />
                    <Text style={styles.errorTitle}>Chưa nhận được tín hiệu Camera</Text>
                    <Text style={styles.errorMsg} numberOfLines={3}>
                      {errorMsg || 'Không thể kết nối LiveKit tới Robot'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <TouchableOpacity style={styles.retryBtn} onPress={handleReloadCall}>
                        <RefreshCw size={14} color="#FFFFFF" />
                        <Text style={styles.retryBtnText}>Kết nối lại</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.retryBtn, { backgroundColor: '#334155' }]}
                        onPress={() => setCameraTab('pi_lan')}
                      >
                        <Radio size={14} color="#FFFFFF" />
                        <Text style={styles.retryBtnText}>Stream LAN</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* View-Only Status & Reload Row (MONITOR never enables mic or speaker audio) */}
            <View style={styles.audioControlsRow}>
              <View style={[styles.audioBtn, styles.audioBtnNormal]}>
                <MicOff size={18} color="#94A3B8" />
                <Text style={styles.audioBtnText}>
                  Chỉ xem camera · Không thu/phát âm thanh
                </Text>
              </View>

              <TouchableOpacity
                style={styles.refreshCallBtn}
                onPress={handleReloadCall}
                accessibilityLabel="Kết nối lại camera"
              >
                <RefreshCw size={16} color="#38BDF8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ACTIVE JOB INFO */}
          {activeJob && (
            <View style={styles.jobCard}>
              <Text style={styles.jobTitle}>NHIỆM VỤ ĐANG THỰC HIỆN</Text>
              <Text style={styles.jobText}>
                {activeJob.jobCode} · {activeJob.status}
              </Text>
              <Text style={styles.jobSubText}>
                Ưu tiên {activeJob.priority} · Job ID: {activeJob.jobId}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1120' },
  header: {
    backgroundColor: '#0F172A',
    paddingTop: 54,
    paddingHorizontal: 18,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  identityText: { flex: 1, marginLeft: 10 },
  title: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  subtitle: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  headerExitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  headerExitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  content: { padding: 14, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard: {
    flex: 1,
    minHeight: 64,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 9,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statLabel: { color: '#94A3B8', fontWeight: '700', fontSize: 9 },
  statValue: { color: '#FFFFFF', fontWeight: '800', fontSize: 13, marginTop: 3 },
  statSubText: { color: '#94A3B8', fontWeight: '600', fontSize: 10, marginTop: 2 },

  // Camera & Talk Card
  cameraBox: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 14,
  },
  cameraHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  cameraHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cameraHeaderTitle: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
  liveStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveStatusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  sourceTabsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  sourceTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  sourceTabBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  sourceTabText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  sourceTabTextActive: {
    color: '#FFFFFF',
  },
  videoPlayerContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoWebview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fallbackPreviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  mqttPreviewImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  mqttTimestampBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  mqttTimestampText: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  connectingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  connectingText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  connectingSubText: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 16,
  },
  errorTitle: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 14,
  },
  errorMsg: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  // Audio Talk Controls
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#0F172A',
  },
  audioBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 8,
  },
  audioBtnNormal: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  micBtnActive: {
    backgroundColor: '#059669',
  },
  audioMutedBtn: {
    backgroundColor: '#451A1A',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  audioBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  refreshCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Job Card
  jobCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  jobTitle: { color: '#38BDF8', fontSize: 10, fontWeight: '800' },
  jobText: { color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginTop: 4 },
  jobSubText: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
});
