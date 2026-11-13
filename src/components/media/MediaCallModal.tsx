/**
 * MediaCallModal — Màn hình gọi Camera + Mic + Loa Robot
 *
 * Dùng WebView nhúng media-call.html trên server với auto-login bằng token
 * đã có từ app. Hỗ trợ 2 chế độ:
 *   - MONITOR: Xem camera robot (không mic)
 *   - ASSIST: Xem camera + đàm thoại 2 chiều (mic + loa)
 *
 * Luồng:
 *   1. App truyền accessToken qua postMessage vào WebView
 *   2. WebView tự động login, tạo/nhận phiên, kết nối LiveKit
 *   3. Staff xem camera, bật/tắt mic, kết thúc phiên
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowLeft,
  Camera,
  Mic,
  MicOff,
  Monitor,
  Phone,
  PhoneOff,
  Video,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import WebView from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { Colors } from '../../constants/theme';
import { apiClient } from '../../api/client';
import {
  mediaSessionApi,
  MediaSessionMode,
  MediaSessionResponse,
} from '../../api/modules/mediaSession.api';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Props ───────────────────────────────────────────────────────────────────

interface MediaCallModalProps {
  visible: boolean;
  onClose: () => void;
  /** Robot UUID để tạo phiên tự động */
  robotId?: string;
  /** Robot name hiển thị */
  robotName?: string;
  /** Chế độ mặc định */
  mode?: MediaSessionMode;
  /** Nếu gọi từ SOS/Fall incident */
  incidentId?: string;
  /** Session ID đã có (từ danh sách phiên chờ) */
  existingSessionId?: string;
  /** LiveKit URL được cấp sẵn từ BE (không cần Staff JWT trong WebView) */
  livekitUrl?: string;
  /** LiveKit join token được cấp sẵn từ BE */
  livekitToken?: string;
  /** Callback khi phiên kết thúc */
  onSessionEnd?: () => void;
}

// ─── Status types from WebView ───────────────────────────────────────────────

export type CallStatus =
  | 'INIT'
  | 'LOGGING_IN'
  | 'CREATING_SESSION'
  | 'ACCEPTING'
  | 'CONNECTING'
  | 'ROOM_CONNECTED'
  | 'CONNECTED'
  | 'CAMERA_LOST'
  | 'TIMEOUT'
  | 'ENDED'
  | 'ERROR';

export function statusLabel(s: CallStatus): string {
  switch (s) {
    case 'INIT':
      return 'Đang khởi tạo...';
    case 'LOGGING_IN':
      return 'Đang xác thực...';
    case 'CREATING_SESSION':
      return 'Đang mở phiên...';
    case 'ACCEPTING':
      return 'Đang nhận phiên...';
    case 'CONNECTING':
      return 'Đang kết nối camera...';
    case 'ROOM_CONNECTED':
      return 'Đã vào phòng · Chờ camera...';
    case 'CONNECTED':
      return '🟢 Trực tiếp';
    case 'CAMERA_LOST':
      return '⚠️ Mất tín hiệu camera';
    case 'TIMEOUT':
      return '⚠️ Hết thời gian chờ camera';
    case 'ENDED':
      return 'Phiên đã kết thúc';
    case 'ERROR':
      return '❌ Lỗi kết nối';
    default:
      return s;
  }
}

export function statusColor(s: CallStatus): string {
  switch (s) {
    case 'CONNECTED':
      return '#059669';
    case 'ROOM_CONNECTED':
      return '#38BDF8';
    case 'CAMERA_LOST':
    case 'TIMEOUT':
      return '#F59E0B';
    case 'ERROR':
      return '#EF4444';
    case 'ENDED':
      return '#64748B';
    default:
      return '#F59E0B';
  }
}

// ─── Build injectable HTML page ──────────────────────────────────────────────

export function buildMediaCallHtml(params: {
  baseUrl: string;
  token?: string;
  livekitUrl?: string;
  livekitToken?: string;
  robotId?: string;
  mode: MediaSessionMode;
  incidentId?: string;
  existingSessionId?: string;
}): string {
  const { baseUrl, token, livekitUrl, livekitToken, robotId, mode, incidentId, existingSessionId } = params;
  // LiveKit Client kết nối trực tiếp phòng đàm thoại.
  // Ưu tiên dùng livekitUrl và livekitToken từ BE cấp riêng cho phiên mà không cần nhúng Staff JWT vào WebView.
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Camera Robot</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #000; font-family: system-ui, sans-serif; }
  #video-container {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    position: relative; background: #111;
  }
  video {
    width: 100%; height: 100%;
    object-fit: contain; background: #000;
  }
  #status-overlay {
    position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: #fff; text-align: center;
    font-size: 14px; padding: 20px;
    background: rgba(0,0,0,0.7); border-radius: 12px;
    max-width: 90%;
  }
  #status-overlay.hidden { display: none; }
  .spinner {
    width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.3);
    border-top-color: #fff; border-radius: 50%;
    animation: spin 0.8s linear infinite; margin: 0 auto 10px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  #live-badge {
    position: absolute; top: 8px; left: 8px;
    background: #EF4444; color: #fff; padding: 3px 8px;
    border-radius: 4px; font-size: 11px; font-weight: 700;
    display: none;
  }
  #live-badge.show { display: block; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>
</head>
<body>
<div id="video-container">
  <div id="live-badge">● LIVE</div>
  <div id="status-overlay">
    <div class="spinner"></div>
    <div id="status-text">Đang khởi tạo...</div>
  </div>
  <video id="remote-video" autoplay playsinline webkit-playsinline></video>
  <audio id="remote-audio" autoplay playsinline webkit-playsinline></audio>
</div>

<script src="https://mediassistrover.duckdns.org/vendor/livekit-client.umd.min.js"></script>
<script>
(function() {
  window.onerror = function(msg, url, line) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'status',
        status: 'ERROR',
        error: 'JS Error: ' + msg
      }));
    } catch(e) {}
  };
  const API = '${baseUrl}';
  const TOKEN = '${token || ''}';
  const DIRECT_URL = '${livekitUrl || ''}';
  const DIRECT_TOKEN = '${livekitToken || ''}';
  const ROBOT_ID = '${robotId || ''}';
  const MODE = '${mode}';
  const INCIDENT_ID = '${incidentId || ''}';
  const EXISTING_SESSION = '${existingSessionId || ''}';

  const videoEl = document.getElementById('remote-video');
  const audioEl = document.getElementById('remote-audio');
  const statusOverlay = document.getElementById('status-overlay');
  const statusText = document.getElementById('status-text');
  const liveBadge = document.getElementById('live-badge');

  let room = null;
  let currentSessionId = EXISTING_SESSION || null;
  let micTrack = null;
  let isMicEnabled = false;
  let statusPollTimer = null;
  let hasVideoFrame = false;
  let videoTimeoutTimer = null;

  function sendToApp(type, data) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
    } catch(e) {}
  }

  function setStatus(text, isConnected) {
    statusText.textContent = text;
    if (isConnected) {
      statusOverlay.classList.add('hidden');
      liveBadge.classList.add('show');
    } else {
      statusOverlay.classList.remove('hidden');
      liveBadge.classList.remove('show');
    }
  }

  async function apiCall(method, path, body) {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + TOKEN
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'API error ' + res.status);
    }
    return res.json();
  }

  function onFirstFrame() {
    if (!hasVideoFrame) {
      hasVideoFrame = true;
      if (videoTimeoutTimer) {
        clearTimeout(videoTimeoutTimer);
        videoTimeoutTimer = null;
      }
      sendToApp('status', { status: 'CONNECTED' });
      setStatus('', true);
    }
  }

  videoEl.addEventListener('playing', onFirstFrame);
  if (videoEl.requestVideoFrameCallback) {
    function rVFC() {
      onFirstFrame();
      if (room) videoEl.requestVideoFrameCallback(rVFC);
    }
    videoEl.requestVideoFrameCallback(rVFC);
  }

  async function startCall() {
    try {
      let joinUrl = DIRECT_URL;
      let joinToken = DIRECT_TOKEN;

      // Nếu chưa có sẵn URL/Token LiveKit từ Native App, đàm phán qua API Backend
      if (!joinUrl || !joinToken) {
        if (!TOKEN) throw new Error('Không có vé LiveKit hoặc mã phiên kết nối.');
        sendToApp('status', { status: 'LOGGING_IN' });
        setStatus('Đang xác thực...', false);
        const me = await apiCall('GET', '/auth/me');
        sendToApp('user', { name: me.fullName, role: me.role });

        let session;
        if (EXISTING_SESSION) {
          sendToApp('status', { status: 'ACCEPTING' });
          setStatus('Đang nhận phiên khẩn cấp...', false);
          try {
            session = await apiCall('POST', '/media-sessions/' + EXISTING_SESSION + '/accept', {});
          } catch(e) {
            session = await apiCall('GET', '/media-sessions/' + EXISTING_SESSION);
          }
        } else if (ROBOT_ID) {
          sendToApp('status', { status: 'CREATING_SESSION' });
          setStatus('Đang kết nối camera & loa mic...', false);
          const body = { robotId: ROBOT_ID, mode: MODE };
          if (INCIDENT_ID) body.incidentId = INCIDENT_ID;
          session = await apiCall('POST', '/media-sessions', body);
          if (session.state === 'RINGING') {
            sendToApp('status', { status: 'ACCEPTING' });
            session = await apiCall('POST', '/media-sessions/' + session.sessionId + '/accept', {});
          }
        } else {
          throw new Error('Chưa có ID robot hoặc phiên đang mở');
        }

        currentSessionId = session.sessionId;
        sendToApp('session', { sessionId: session.sessionId });

        sendToApp('status', { status: 'CONNECTING' });
        setStatus('Đang kết nối LiveKit WebRTC...', false);
        const join = await apiCall('POST', '/media-sessions/' + session.sessionId + '/join-token', {});
        joinUrl = join.url;
        joinToken = join.token;
      } else {
        if (currentSessionId) {
          sendToApp('session', { sessionId: currentSessionId });
        }
      }

      sendToApp('status', { status: 'CONNECTING' });
      setStatus('Đang kết nối LiveKit WebRTC...', false);

      room = new LivekitClient.Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: { resolution: LivekitClient.VideoPresets.h720.resolution }
      });

      room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, pub, participant) => {
        // Chỉ nhận camera từ participant robot-<robotId>
        const expectedPrefix = 'robot-' + ROBOT_ID;
        if (ROBOT_ID && participant.identity !== expectedPrefix && !participant.identity.startsWith('robot-')) {
          return;
        }

        if (track.kind === LivekitClient.Track.Kind.Video) {
          track.attach(videoEl);
          setStatus('Đang tải khung hình camera...', false);
          if (videoTimeoutTimer) clearTimeout(videoTimeoutTimer);
          videoTimeoutTimer = setTimeout(function() {
            if (!hasVideoFrame && room) {
              sendToApp('status', {
                status: 'TIMEOUT',
                error: 'Chưa có khung hình từ camera robot. Kiểm tra thiết bị trên robot hoặc thử lại.'
              });
              setStatus('Chưa có hình từ camera robot · Kiểm tra thiết bị trên robot', false);
            }
          }, 15000);
        } else if (track.kind === LivekitClient.Track.Kind.Audio) {
          try {
            track.attach(audioEl);
          } catch(e) {
            const el = track.attach();
            el.autoplay = true;
            document.body.appendChild(el);
          }
        }
      });

      room.on(LivekitClient.RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
        if (track.kind === LivekitClient.Track.Kind.Video) {
          hasVideoFrame = false;
          sendToApp('status', { status: 'CAMERA_LOST', error: 'Đã mất tín hiệu camera robot' });
          setStatus('Mất tín hiệu camera từ robot...', false);
          liveBadge.classList.remove('show');
        }
      });

      room.on(LivekitClient.RoomEvent.Disconnected, (reason) => {
        sendToApp('status', { status: 'ENDED', reason: reason });
        setStatus('Đã ngắt kết nối', false);
        liveBadge.classList.remove('show');
      });

      room.on(LivekitClient.RoomEvent.Connected, () => {
        sendToApp('status', { status: 'ROOM_CONNECTED' });
        setStatus('Đã vào phòng · Chờ camera robot...', false);
      });

      await room.connect(joinUrl, joinToken, {
        rtcConfig: { iceTransportPolicy: 'all' }
      });

      // Nếu là chế độ ASSIST (hỗ trợ SOS): BẬT NGAY MICRO VÀ LOA 2 CHIỀU!
      if (MODE === 'ASSIST') {
        try {
          await room.localParticipant.setMicrophoneEnabled(true, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          });
          isMicEnabled = true;
          sendToApp('mic', { enabled: true });
        } catch(e) {
          console.warn('Mic auto-enable error:', e);
          isMicEnabled = false;
          sendToApp('mic', { enabled: false, error: 'Chưa thể bật micro: ' + (e.message || 'Kiểm tra quyền micro') });
        }
      }

      // Khởi động phát âm thanh loa từ robot
      await room.startAudio().catch(() => {});

      // Start status polling nếu có TOKEN
      if (currentSessionId && TOKEN) {
        statusPollTimer = setInterval(async () => {
          try {
            const s = await apiCall('GET', '/media-sessions/' + currentSessionId);
            if (s.state === 'ENDED' || s.state === 'FAILED' || s.state === 'EXPIRED') {
              sendToApp('status', { status: 'ENDED', reason: s.endReason });
              setStatus('Phiên đã kết thúc', false);
              cleanup();
            }
          } catch(e) {}
        }, 5000);
      }

    } catch (err) {
      const msg = err.message || 'Lỗi không xác định';
      sendToApp('status', { status: 'ERROR', error: msg });
      setStatus('Lỗi: ' + msg, false);
    }
  }

  function cleanup() {
    if (statusPollTimer) { clearInterval(statusPollTimer); statusPollTimer = null; }
    if (room) { room.disconnect(); room = null; }
  }

  // Handle commands from React Native
  window.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'toggleMic') {
        if (room && room.localParticipant) {
          isMicEnabled = !isMicEnabled;
          room.localParticipant.setMicrophoneEnabled(isMicEnabled);
          sendToApp('mic', { enabled: isMicEnabled });
        }
      } else if (msg.type === 'endCall') {
        if (currentSessionId) {
          apiCall('POST', '/media-sessions/' + currentSessionId + '/end', { reason: 'STAFF_ENDED' })
            .catch(() => {});
        }
        cleanup();
        sendToApp('status', { status: 'ENDED', reason: 'STAFF_ENDED' });
      } else if (msg.type === 'toggleAudio') {
        if (audioEl) {
          audioEl.muted = !audioEl.muted;
          sendToApp('audio', { muted: audioEl.muted });
        }
      }
    } catch(e) {}
  });

  // Also listen for document message (Android WebView compatibility)
  document.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'toggleMic' && room && room.localParticipant) {
        isMicEnabled = !isMicEnabled;
        room.localParticipant.setMicrophoneEnabled(isMicEnabled);
        sendToApp('mic', { enabled: isMicEnabled });
      } else if (msg.type === 'endCall') {
        if (currentSessionId) {
          apiCall('POST', '/media-sessions/' + currentSessionId + '/end', { reason: 'STAFF_ENDED' })
            .catch(() => {});
        }
        cleanup();
        sendToApp('status', { status: 'ENDED', reason: 'STAFF_ENDED' });
      } else if (msg.type === 'toggleAudio') {
        if (audioEl) {
          audioEl.muted = !audioEl.muted;
          sendToApp('audio', { muted: audioEl.muted });
        }
      }
    } catch(e) {}
  });

  // Start with fallback SDK loader
  if (window.LivekitClient) {
    startCall();
  } else {
    var fb = document.createElement('script');
    fb.src = 'https://unpkg.com/livekit-client@2.13.5/dist/livekit-client.umd.js';
    fb.onload = function() { startCall(); };
    fb.onerror = function() {
      sendToApp('status', {
        status: 'ERROR',
        error: 'Không thể tải thư viện LiveKit WebRTC SDK'
      });
    };
    document.head.appendChild(fb);
  }
})();
</script>
</body>
</html>`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const MediaCallModal: React.FC<MediaCallModalProps> = ({
  visible,
  onClose,
  robotId,
  robotName,
  mode = 'MONITOR',
  incidentId,
  existingSessionId,
  livekitUrl,
  livekitToken,
  onSessionEnd,
}) => {
  const webViewRef = useRef<any>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('INIT');
  const [micEnabled, setMicEnabled] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(existingSessionId || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const isEndingRef = useRef(false);

  // Pulse animation for live indicator
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (callStatus === 'CONNECTED') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [callStatus, pulseAnim]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setCallStatus('INIT');
      setMicEnabled(false);
      setAudioMuted(false);
      setErrorMsg(null);
      setMicError(null);
      setSessionId(existingSessionId || null);
      isEndingRef.current = false;
    }
  }, [visible, existingSessionId]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'status':
          setCallStatus(msg.status as CallStatus);
          if (msg.error) setErrorMsg(msg.error);
          if (msg.status === 'ENDED') {
            onSessionEnd?.();
          }
          break;
        case 'mic':
          setMicEnabled(!!msg.enabled);
          if (msg.error) {
            setMicError(msg.error);
          } else {
            setMicError(null);
          }
          break;
        case 'audio':
          setAudioMuted(!!msg.muted);
          break;
        case 'session':
          if (msg.sessionId) setSessionId(msg.sessionId);
          break;
      }
    } catch {
      // ignore parse errors
    }
  }, [onSessionEnd]);

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

  const performEndCall = useCallback(async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    sendCommand({ type: 'endCall' });

    const targetSessionId = sessionId || existingSessionId;
    if (targetSessionId) {
      try {
        await mediaSessionApi.endSession(targetSessionId, 'STAFF_ENDED');
      } catch (err: any) {
        console.log('Error ending media session on server:', err);
      }
    }

    onSessionEnd?.();
    onClose();
  }, [sessionId, existingSessionId, sendCommand, onSessionEnd, onClose]);

  const handleEndCall = useCallback(() => {
    Alert.alert(
      'Kết thúc cuộc gọi',
      'Bạn có chắc muốn kết thúc cuộc gọi đàm thoại với robot?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Kết thúc',
          style: 'destructive',
          onPress: () => {
            void performEndCall();
          },
        },
      ]
    );
  }, [performEndCall]);

  const handleClose = useCallback(() => {
    if (callStatus === 'CONNECTED' || callStatus === 'ROOM_CONNECTED' || callStatus === 'CONNECTING') {
      handleEndCall();
    } else {
      onClose();
    }
  }, [callStatus, handleEndCall, onClose]);

  // Build the HTML
  const baseUrl = apiClient.getBaseUrl();
  // Nếu đã có vé LiveKit riêng từ BE thì giữ Staff JWT an toàn bên ngoài WebView
  const token = livekitToken ? '' : (apiClient.getToken() || '');
  const htmlContent = buildMediaCallHtml({
    baseUrl,
    token,
    livekitUrl,
    livekitToken,
    robotId,
    mode,
    incidentId,
    existingSessionId,
  });

  const isConnected = callStatus === 'CONNECTED';
  const isAssist = mode === 'ASSIST';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              {isConnected && (
                <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              )}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {robotName || 'Camera Robot'}
              </Text>
            </View>
            <Text style={[styles.headerStatus, { color: statusColor(callStatus) }]}>
              {statusLabel(callStatus)}
            </Text>
          </View>

          <View style={styles.modeBadge}>
            {isAssist ? (
              <Phone size={12} color="#fff" />
            ) : (
              <Monitor size={12} color="#fff" />
            )}
            <Text style={styles.modeBadgeText}>{mode}</Text>
          </View>
        </View>

        {/* WebView */}
        <View style={styles.webviewContainer}>
          {visible && (
            <WebView
              ref={webViewRef}
              source={{ html: htmlContent, baseUrl: 'https://mediassistrover.duckdns.org' }}
              style={styles.webview}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              mediaCapturePermissionGrantType="grant"
              onMessage={handleMessage}
              onError={(e: any) => {
                setCallStatus('ERROR');
                setErrorMsg(e.nativeEvent.description);
              }}
            />
          )}

          {/* Loading overlay when not connected */}
          {!isConnected && callStatus !== 'ENDED' && callStatus !== 'ERROR' && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>{statusLabel(callStatus)}</Text>
            </View>
          )}

          {/* Error overlay */}
          {callStatus === 'ERROR' && (
            <View style={styles.errorOverlay}>
              <WifiOff size={48} color="#EF4444" />
              <Text style={styles.errorTitle}>Kết nối thất bại</Text>
              <Text style={styles.errorMsg}>{errorMsg || 'Không thể kết nối camera robot'}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onClose}>
                <Text style={styles.retryBtnText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Control bar */}
        <View style={styles.controlBar}>
          {/* Audio toggle */}
          <TouchableOpacity
            style={[styles.controlBtn, audioMuted && styles.controlBtnActive]}
            onPress={handleToggleAudio}
            disabled={!isConnected}
          >
            {audioMuted ? (
              <VolumeX size={22} color="#fff" />
            ) : (
              <Volume2 size={22} color="#fff" />
            )}
            <Text style={styles.controlLabel}>
              {audioMuted ? 'Tắt loa' : 'Loa'}
            </Text>
          </TouchableOpacity>

          {/* Mic toggle (only in ASSIST mode) */}
          {isAssist && (
            <TouchableOpacity
              style={[
                styles.controlBtn,
                micEnabled ? styles.micBtnActive : styles.micBtnInactive,
              ]}
              onPress={handleToggleMic}
              disabled={!isConnected}
            >
              {micEnabled ? (
                <Mic size={22} color="#fff" />
              ) : (
                <MicOff size={22} color="#fff" />
              )}
              <Text style={styles.controlLabel}>
                {micEnabled ? 'Đang nói' : 'Bật mic'}
              </Text>
            </TouchableOpacity>
          )}

          {/* End call */}
          <TouchableOpacity
            style={styles.endCallBtn}
            onPress={handleEndCall}
          >
            <PhoneOff size={22} color="#fff" />
            <Text style={styles.controlLabel}>Kết thúc</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#111',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  headerStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  modeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // WebView
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorOverlay: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  errorTitle: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '700',
  },
  errorMsg: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Control bar
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 16,
    paddingBottom: 36,
    paddingHorizontal: 24,
    backgroundColor: '#111',
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    gap: 2,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  micBtnInactive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  micBtnActive: {
    backgroundColor: '#059669',
  },
  endCallBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    gap: 2,
  },
});
