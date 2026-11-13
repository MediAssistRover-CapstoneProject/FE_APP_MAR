import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Bot,
  LogOut,
  Video,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RefreshCw,
  WifiOff,
} from 'lucide-react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { EndpointResponse, JobResponse, MapResponse, RobotDto, ZoneDto } from '../../api/types';
import { MapPlanPoint, MapRobotPose } from './BackendHospitalMap';
import {
  buildMediaCallHtml,
  CallStatus,
  statusLabel,
  statusColor,
} from '../media/MediaCallModal';
import { apiClient } from '../../api/client';
import { mediaSessionApi } from '../../api/modules/mediaSession.api';
import { normalizeRobotPose } from './robotPose';

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
  token: propToken,
  activeJob,
  robotPose,
  isPoseLive,
  plannedPath,
}) => {
  // LiveKit WebRTC state
  const webViewRef = useRef<any>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('INIT');
  const [micEnabled, setMicEnabled] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [keyReload, setKeyReload] = useState(0);

  // Native negotiation state
  const [sessionCredentials, setSessionCredentials] = useState<{
    url: string;
    token: string;
    sessionId: string;
  } | null>(null);
  const [isNegotiating, setIsNegotiating] = useState(false);

  // Live dot animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (callStatus === 'CONNECTED') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [callStatus, pulseAnim]);

  // Native session negotiation when modal opens
  useEffect(() => {
    if (!visible) {
      setCallStatus('INIT');
      setMicEnabled(false);
      setAudioMuted(false);
      setErrorMsg(null);
      setSessionCredentials(null);
      setIsNegotiating(false);
      return;
    }

    let isMounted = true;
    const initSession = async () => {
      if (!robot?.robotId) {
        setCallStatus('ERROR');
        setErrorMsg('Không xác định được ID của Robot');
        return;
      }

      setIsNegotiating(true);
      setCallStatus('CREATING_SESSION');
      setErrorMsg(null);

      try {
        // 1. Kiểm tra danh sách phiên media đang mở trên BE
        const existingSessions = await mediaSessionApi.getSessions().catch(() => []);
        let activeSession = existingSessions.find(
          (s) =>
            s.robotId === robot.robotId &&
            (s.state === 'RINGING' || s.state === 'CONNECTING' || s.state === 'ACTIVE')
        );

        if (activeSession) {
          if (activeSession.state === 'RINGING') {
            try {
              activeSession = await mediaSessionApi.acceptSession(activeSession.sessionId);
            } catch (err) {
              console.log('Error accepting session:', err);
            }
          }
        } else {
          // 2. Thử tạo phiên mới
          try {
            activeSession = await mediaSessionApi.createSession({
              robotId: robot.robotId,
              mode: 'ASSIST',
            });
            if (activeSession.state === 'RINGING') {
              activeSession = await mediaSessionApi.acceptSession(activeSession.sessionId);
            }
          } catch (createErr: any) {
            const msg = createErr?.message || '';
            if (
              msg.includes('incident') ||
              msg.includes('403') ||
              msg.includes('AccessDenied') ||
              msg.includes('require an accessible incident')
            ) {
              if (isMounted) {
                setCallStatus('ERROR');
                setErrorMsg(
                  'Robot chưa có sự cố khẩn cấp (SOS) hoặc phiên chưa được kích hoạt bởi Quản trị viên.'
                );
                setIsNegotiating(false);
              }
              return;
            }
            throw createErr;
          }
        }

        if (!activeSession?.sessionId) {
          throw new Error('Không tạo hoặc mở được phiên đàm thoại cho Robot này');
        }

        // 3. Lấy LiveKit join token trực tiếp từ BE (giữ Staff JWT ngoài WebView)
        const creds = await mediaSessionApi.getJoinToken(activeSession.sessionId);
        if (!creds?.url || !creds?.token) {
          throw new Error('BE không cấp được LiveKit credentials');
        }

        if (isMounted) {
          setSessionCredentials({
            url: creds.url,
            token: creds.token,
            sessionId: activeSession.sessionId,
          });
          setCallStatus('CONNECTING');
          setIsNegotiating(false);
        }
      } catch (err: any) {
        if (isMounted) {
          console.log('Error negotiating media session:', err);
          setCallStatus('ERROR');
          setErrorMsg(err?.message || 'Không thể kết nối đến camera robot');
          setIsNegotiating(false);
        }
      }
    };

    void initSession();

    return () => {
      isMounted = false;
    };
  }, [visible, robot?.robotId, keyReload]);

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
    sendCommand({ type: 'toggleMic' });
  }, [sendCommand]);

  const handleToggleAudio = useCallback(() => {
    sendCommand({ type: 'toggleAudio' });
  }, [sendCommand]);

  const handleReloadCall = useCallback(() => {
    setCallStatus('INIT');
    setErrorMsg(null);
    setKeyReload((k) => k + 1);
  }, []);

  const baseUrl = apiClient.getBaseUrl();
  const isConnected = callStatus === 'CONNECTED';
  const battery = robot?.batteryPercent ?? robot?.batteryRaw;
  const validPose = normalizeRobotPose(robotPose);

  // Build the injectable HTML for LiveKit
  const htmlContent = useMemo(() => {
    return buildMediaCallHtml({
      baseUrl,
      livekitUrl: sessionCredentials?.url,
      livekitToken: sessionCredentials?.token,
      robotId: robot?.robotId,
      mode: 'ASSIST',
      existingSessionId: sessionCredentials?.sessionId,
    });
  }, [baseUrl, sessionCredentials, robot?.robotId]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.identity}>
            <Bot size={22} color="#38BDF8" />
            <View style={styles.identityText}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {isConnected && (
                  <Animated.View style={[styles.liveIndicator, { opacity: pulseAnim }]} />
                )}
                <Text style={styles.title} numberOfLines={1}>
                  {robot?.robotName || robot?.robotCode || 'Robot AMR'}
                </Text>
              </View>
              <Text style={styles.subtitle} numberOfLines={1}>
                {robot
                  ? `${robot.robotCode} · ${robot.model} · ${robot.status}`
                  : 'Kết nối LiveKit WebRTC trực tiếp'}
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
            <Text style={styles.headerExitButtonText}>Đóng</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* STATS BAR */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>PIN</Text>
              <Text style={styles.statValue}>{battery == null ? '--' : `${battery}%`}</Text>
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
              <Text style={styles.statLabel}>TRẠNG THÁI GỌI</Text>
              <Text
                style={[styles.statValue, { color: statusColor(callStatus), fontSize: 12 }]}
                numberOfLines={1}
              >
                {statusLabel(callStatus)}
              </Text>
            </View>
          </View>

          {/* ================= 1. LIVEKIT CAMERA & 2-WAY AUDIO TALK ================= */}
          <View style={styles.cameraBox}>
            <View style={styles.cameraHeaderRow}>
              <View style={styles.cameraHeaderLeft}>
                <Video size={16} color="#38BDF8" />
                <Text style={styles.cameraHeaderTitle}>Camera & Đàm thoại Robot</Text>
              </View>
              <View style={[styles.liveStatusTag, { backgroundColor: statusColor(callStatus) }]}>
                <Text style={styles.liveStatusText}>{statusLabel(callStatus)}</Text>
              </View>
            </View>

            {/* Video Player (WebView LiveKit WebRTC) */}
            <View style={styles.videoPlayerContainer}>
              {visible && sessionCredentials && (
                <WebView
                  key={`${sessionCredentials.sessionId}-${keyReload}`}
                  ref={webViewRef}
                  source={{ html: htmlContent, baseUrl: 'https://mediassistrover.duckdns.org' }}
                  style={styles.videoWebview}
                  originWhitelist={['*']}
                  javaScriptEnabled
                  domStorageEnabled
                  mediaPlaybackRequiresUserAction={false}
                  allowsInlineMediaPlayback
                  mediaCapturePermissionGrantType="grant"
                  onShouldStartLoadWithRequest={() => true}
                  onMessage={handleMessage}
                  onError={(e: any) => {
                    if (e?.nativeEvent?.code === -999) return;
                    setCallStatus('ERROR');
                    setErrorMsg(e.nativeEvent.description || 'Lỗi kết nối WebRTC');
                  }}
                />
              )}

              {/* Loading overlay when connecting */}
              {!isConnected && callStatus !== 'ENDED' && callStatus !== 'ERROR' && (
                <View style={styles.connectingOverlay}>
                  <ActivityIndicator size="large" color="#38BDF8" />
                  <Text style={styles.connectingText}>
                    {isNegotiating ? 'Đang chuẩn bị phiên đàm thoại...' : statusLabel(callStatus)}
                  </Text>
                  <Text style={styles.connectingSubText}>
                    {isNegotiating
                      ? 'Đang xác thực và cấp vé LiveKit từ hệ thống...'
                      : 'Đang kết nối camera và âm thanh từ Robot...'}
                  </Text>
                </View>
              )}

              {/* Error overlay */}
              {callStatus === 'ERROR' && (
                <View style={styles.errorOverlay}>
                  <WifiOff size={36} color="#EF4444" />
                  <Text style={styles.errorTitle}>Lỗi kết nối Camera</Text>
                  <Text style={styles.errorMsg} numberOfLines={3}>
                    {errorMsg || 'Không thể kết nối LiveKit tới Robot'}
                  </Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={handleReloadCall}>
                    <RefreshCw size={14} color="#FFFFFF" />
                    <Text style={styles.retryBtnText}>Thử lại</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Talk & Audio Controls Row */}
            <View style={styles.audioControlsRow}>
              <TouchableOpacity
                style={[
                  styles.audioBtn,
                  micEnabled ? styles.micBtnActive : styles.audioBtnNormal,
                ]}
                onPress={handleToggleMic}
                disabled={!isConnected}
                activeOpacity={0.8}
              >
                {micEnabled ? <Mic size={18} color="#FFFFFF" /> : <MicOff size={18} color="#94A3B8" />}
                <Text style={[styles.audioBtnText, micEnabled && { color: '#FFFFFF' }]}>
                  {micEnabled ? 'Đang nói (Mic BẬT)' : 'Bật Mic nói'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.audioBtn,
                  audioMuted ? styles.audioMutedBtn : styles.audioBtnNormal,
                ]}
                onPress={handleToggleAudio}
                disabled={!isConnected}
                activeOpacity={0.8}
              >
                {audioMuted ? <VolumeX size={18} color="#EF4444" /> : <Volume2 size={18} color="#059669" />}
                <Text style={[styles.audioBtnText, audioMuted && { color: '#EF4444' }]}>
                  {audioMuted ? 'Loa đang TẮT' : 'Loa Robot BẬT'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.refreshCallBtn}
                onPress={handleReloadCall}
                accessibilityLabel="Kết nối lại cuộc gọi"
              >
                <RefreshCw size={16} color="#0284C7" />
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
  videoPlayerContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#000000',
    position: 'relative',
  },
  videoWebview: {
    flex: 1,
    backgroundColor: '#000000',
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
  },
  connectingText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  connectingSubText: {
    color: '#94A3B8',
    fontSize: 11,
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
    marginTop: 6,
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
