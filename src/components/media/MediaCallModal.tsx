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
  CheckCircle2,
  MapPin,
  Mic,
  MicOff,
  Monitor,
  Navigation,
  Phone,
  PhoneOff,
  RefreshCw,
  Video,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  XCircle,
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

export interface MediaSessionEndPayload {
  source: 'UI_END_BUTTON' | 'WEBVIEW_STATUS' | 'MODAL_CLOSE';
  sessionId?: string;
  incidentId?: string;
  robotId?: string;
  uiStatus?: string;
  endReason?: string;
  error?: string;
  backendSession?: MediaSessionResponse | null;
}

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
  /** Lỗi trước khi vào WebView (ví dụ 409/403/mất kết nối thiết bị) */
  externalError?: string | null;
  /** Thử kết nối lại camera khi có lỗi / chưa có khung hình */
  onRetryCamera?: () => Promise<void> | void;
  /** Đang thực hiện thử lại kết nối camera */
  isRetrying?: boolean;
  /** Nhãn tùy chỉnh cho nút kết thúc ở thanh điều khiển */
  endButtonLabel?: string;
  /** Trạng thái hiện tại của sự cố để hiển thị nút xác nhận ngay khi đang xem camera MONITOR */
  incidentStatus?: string | null;
  /** Tài khoản hiện tại có quyền xác nhận/báo nhầm hay không */
  canConfirmIncident?: boolean;
  /** Lý do nếu không có quyền xác nhận */
  decisionPermissionReason?: string | null;
  /** Đang gửi yêu cầu xác nhận/báo nhầm */
  isSubmittingDecision?: boolean;
  /** Tóm tắt vị trí đã lưu từ GET /emergency-incidents/{id}/location */
  locationSummary?: string | null;
  /** Xác nhận sự cố ngay trong lúc phiên MONITOR đang ACTIVE */
  onConfirmWhileViewing?: () => Promise<void> | void;
  /** Mở luồng Báo nhầm ngay từ màn hình camera MONITOR */
  onFalseAlarmWhileViewing?: () => void;
  /** Mở bản đồ tuyến đường đến SOS ngay sau khi xác nhận trên camera */
  onOpenMapRouteWhileViewing?: () => void;
  /** Callback khi phiên kết thúc (đính kèm metadata đã khử lặp) */
  onSessionEnd?: (payload?: MediaSessionEndPayload) => void;
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
  | 'DISCONNECTED'
  | 'TIMEOUT'
  | 'EXPIRED'
  | 'FAILED'
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
    case 'DISCONNECTED':
      return '⚠️ Mất kết nối phòng gọi';
    case 'TIMEOUT':
      return '⚠️ Hết thời gian chờ camera';
    case 'EXPIRED':
      return '⚠️ Phiên đã hết hạn';
    case 'FAILED':
      return '❌ Phiên thất bại';
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
    case 'DISCONNECTED':
    case 'TIMEOUT':
    case 'EXPIRED':
      return '#F59E0B';
    case 'ERROR':
    case 'FAILED':
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
  const isViewOnly = mode !== 'ASSIST';
  // LiveKit Client kết nối trực tiếp phòng media.
  // Chế độ MONITOR (isViewOnly === true): không tạo <audio>, autoSubscribe = false, chỉ subscribe track Video từ đúng robot-<robotId>.
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
  <video id="remote-video" autoplay muted playsinline webkit-playsinline></video>
  ${isViewOnly ? '' : '<audio id="remote-audio" autoplay playsinline webkit-playsinline></audio>'}
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
  const IS_VIEW_ONLY = ${isViewOnly ? 'true' : 'false'};
  const INCIDENT_ID = '${incidentId || ''}';
  const EXISTING_SESSION = '${existingSessionId || ''}';

  const videoEl = document.getElementById('remote-video');
  const audioEl = IS_VIEW_ONLY ? null : document.getElementById('remote-audio');
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
  videoEl.addEventListener('loadeddata', onFirstFrame);
  videoEl.addEventListener('timeupdate', onFirstFrame);
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
          setStatus(IS_VIEW_ONLY ? 'Đang kết nối camera chỉ xem...' : 'Đang kết nối camera & loa mic...', false);
          const body = { robotId: ROBOT_ID, mode: IS_VIEW_ONLY ? 'MONITOR' : 'ASSIST' };
          if (INCIDENT_ID) body.incidentId = INCIDENT_ID;
          session = await apiCall('POST', '/media-sessions', body);
          if (!IS_VIEW_ONLY && session.state === 'RINGING') {
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

      function isTargetRobotParticipant(participant) {
        if (!participant || !participant.identity) return false;
        if (ROBOT_ID) {
          return participant.identity === ('robot-' + ROBOT_ID);
        }
        return participant.identity.startsWith('robot-');
      }

      function isVideoPublication(pub) {
        return Boolean(pub && (pub.kind === LivekitClient.Track.Kind.Video || pub.kind === 'video'));
      }

      function enforceViewOnlyPublication(pub, participant) {
        if (!IS_VIEW_ONLY || !pub) return;
        if (!isTargetRobotParticipant(participant)) {
          if (typeof pub.setSubscribed === 'function') {
            try { pub.setSubscribed(false); } catch(e) {}
          }
          return;
        }
        if (isVideoPublication(pub)) {
          if (!pub.isSubscribed && typeof pub.setSubscribed === 'function') {
            try { pub.setSubscribed(true); } catch(e) {}
          }
        } else if (pub.isSubscribed && typeof pub.setSubscribed === 'function') {
          try { pub.setSubscribed(false); } catch(e) {}
        }
      }

      function syncViewOnlyVideoTracks() {
        if (!IS_VIEW_ONLY || !room || !room.remoteParticipants) return;
        room.remoteParticipants.forEach((participant) => {
          if (!participant || !participant.trackPublications) return;
          participant.trackPublications.forEach((pub) => {
            enforceViewOnlyPublication(pub, participant);
          });
        });
      }

      room.on(LivekitClient.RoomEvent.TrackPublished, (pub, participant) => {
        enforceViewOnlyPublication(pub, participant);
      });

      room.on(LivekitClient.RoomEvent.ParticipantConnected, (participant) => {
        if (!IS_VIEW_ONLY || !participant || !participant.trackPublications) return;
        participant.trackPublications.forEach((pub) => {
          enforceViewOnlyPublication(pub, participant);
        });
      });

      room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, pub, participant) => {
        // Chỉ nhận luồng từ đúng participant robot-<robotId>
        if (!isTargetRobotParticipant(participant)) {
          if (IS_VIEW_ONLY && pub && typeof pub.setSubscribed === 'function') {
            try { pub.setSubscribed(false); } catch(e) {}
          }
          return;
        }

        if (track.kind === LivekitClient.Track.Kind.Video) {
          videoEl.muted = true;
          track.attach(videoEl);
          videoEl.play().then(function() { onFirstFrame(); }).catch(function() {});
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
          // Chế độ MONITOR / chỉ xem camera tuyệt đối không đăng ký nhận hay phát audio từ robot
          if (IS_VIEW_ONLY) {
            if (pub && typeof pub.setSubscribed === 'function') {
              try { pub.setSubscribed(false); } catch(e) {}
            }
            return;
          }
          if (audioEl) {
            try {
              track.attach(audioEl);
            } catch(e) {
              const el = track.attach();
              el.autoplay = true;
              document.body.appendChild(el);
            }
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

      room.on(LivekitClient.RoomEvent.Reconnecting, () => {
        hasVideoFrame = false;
        setStatus('Đang kết nối lại camera robot...', false);
        liveBadge.classList.remove('show');
      });

      room.on(LivekitClient.RoomEvent.Reconnected, () => {
        setStatus('Đã kết nối lại · Đang khôi phục camera robot...', false);
        if (IS_VIEW_ONLY) {
          syncViewOnlyVideoTracks();
        }
      });

      room.on(LivekitClient.RoomEvent.Disconnected, (reason) => {
        const isDuplicate = LivekitClient.DisconnectReason && reason === LivekitClient.DisconnectReason.DUPLICATE_IDENTITY;
        sendToApp('status', {
          status: isDuplicate ? 'CAMERA_LOST' : 'DISCONNECTED',
          sessionId: currentSessionId,
          reason: isDuplicate ? 'DUPLICATE_IDENTITY' : reason,
          error: isDuplicate ? 'Camera đang được mở trên cửa sổ Web Admin · Đang chuyển sang luồng ảnh MQTT' : undefined
        });
        setStatus(isDuplicate ? 'Đang chuyển sang luồng ảnh camera MQTT...' : 'Đã ngắt kết nối', false);
        liveBadge.classList.remove('show');
      });

      room.on(LivekitClient.RoomEvent.Connected, () => {
        sendToApp('status', { status: 'ROOM_CONNECTED' });
        setStatus('Đã vào phòng · Chờ camera robot...', false);
        if (IS_VIEW_ONLY) {
          syncViewOnlyVideoTracks();
        }
      });

      await room.connect(joinUrl, joinToken, {
        autoSubscribe: !IS_VIEW_ONLY,
        maxRetries: 1,
        peerConnectionTimeout: 10000,
        websocketTimeout: 10000,
        rtcConfig: { iceTransportPolicy: 'all' }
      });

      if (IS_VIEW_ONLY) {
        syncViewOnlyVideoTracks();
      } else if (MODE === 'ASSIST') {
        // Chỉ chế độ ASSIST mới bật mic và loa 2 chiều
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

        // Khởi động phát âm thanh loa từ robot
        await room.startAudio().catch(() => {});
      }

      // Start status polling nếu có TOKEN
      if (currentSessionId && TOKEN) {
        statusPollTimer = setInterval(async () => {
          try {
            const s = await apiCall('GET', '/media-sessions/' + currentSessionId);
            if (s.state === 'ENDED' || s.state === 'FAILED' || s.state === 'EXPIRED') {
              sendToApp('status', {
                status: s.state,
                sessionId: currentSessionId,
                reason: s.endReason,
                backendSession: s,
              });
              setStatus(
                s.state === 'ENDED'
                  ? 'Phiên đã kết thúc'
                  : s.state === 'EXPIRED'
                  ? 'Phiên đã hết hạn'
                  : 'Phiên gặp lỗi',
                false
              );
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
  function handleIncomingCommand(raw) {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'toggleMic') {
        if (!IS_VIEW_ONLY && MODE === 'ASSIST' && room && room.localParticipant) {
          isMicEnabled = !isMicEnabled;
          room.localParticipant.setMicrophoneEnabled(isMicEnabled);
          sendToApp('mic', { enabled: isMicEnabled });
        }
      } else if (msg.type === 'endCall') {
        const reason = msg.reason || (IS_VIEW_ONLY ? 'STAFF_ENDED_VIEW' : 'STAFF_ENDED');
        if (currentSessionId) {
          apiCall('POST', '/media-sessions/' + currentSessionId + '/end', { reason })
            .catch(() => {});
        }
        cleanup();
        sendToApp('status', { status: 'ENDED', sessionId: currentSessionId, reason });
      } else if (msg.type === 'toggleAudio') {
        if (!IS_VIEW_ONLY && MODE === 'ASSIST' && audioEl) {
          audioEl.muted = !audioEl.muted;
          sendToApp('audio', { muted: audioEl.muted });
        }
      }
    } catch(e) {}
  }

  window.addEventListener('message', (event) => handleIncomingCommand(event.data));
  document.addEventListener('message', (event) => handleIncomingCommand(event.data));

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
  externalError,
  onRetryCamera,
  isRetrying = false,
  endButtonLabel,
  incidentStatus,
  canConfirmIncident = false,
  decisionPermissionReason,
  isSubmittingDecision = false,
  locationSummary,
  onConfirmWhileViewing,
  onFalseAlarmWhileViewing,
  onOpenMapRouteWhileViewing,
  onSessionEnd,
}) => {
  const webViewRef = useRef<any>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('INIT');
  const [micEnabled, setMicEnabled] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(existingSessionId || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const isEndingRef = useRef(false);
  const emittedEndKeysRef = useRef<Set<string>>(new Set());
  const sessionGenerationRef = useRef(0);

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

  // Reset state when modal opens or fresh credentials arrive on retry
  useEffect(() => {
    if (visible) {
      sessionGenerationRef.current += 1;
      setCallStatus('INIT');
      setMicEnabled(false);
      setAudioMuted(false);
      setErrorMsg(null);
      setMicError(null);
      setSessionId(existingSessionId || null);
      isEndingRef.current = false;
    } else {
      sessionGenerationRef.current += 1;
    }
  }, [visible, existingSessionId, livekitToken]);

  const emitSessionEndOnce = useCallback(
    (payload: MediaSessionEndPayload) => {
      const dedupeKey = payload.sessionId || sessionId || existingSessionId || 'unknown-session';
      if (emittedEndKeysRef.current.has(dedupeKey)) {
        return;
      }
      emittedEndKeysRef.current.add(dedupeKey);
      onSessionEnd?.(payload);
    },
    [onSessionEnd, sessionId, existingSessionId]
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      switch (msg.type) {
        case 'status': {
          const nextStatus = msg.status as CallStatus;
          const resolvedSessionId = (msg.sessionId || sessionId || existingSessionId) || undefined;
          setCallStatus(nextStatus);
          if (msg.error) setErrorMsg(msg.error);

          if (nextStatus === 'ENDED' && !isEndingRef.current) {
            emitSessionEndOnce({
              source: 'WEBVIEW_STATUS',
              sessionId: resolvedSessionId,
              incidentId,
              robotId,
              uiStatus: 'ENDED',
              endReason: msg.reason,
              error: msg.error,
              backendSession: msg.backendSession || null,
            });
          } else if (nextStatus === 'DISCONNECTED' && !isEndingRef.current) {
            // Đối soát với BE xem LiveKit Disconnected là kết thúc thật (ENDED) hay mất mạng/hết hạn
            if (resolvedSessionId) {
              const genAtStart = sessionGenerationRef.current;
              mediaSessionApi
                .getSession(resolvedSessionId)
                .then((srv) => {
                  if (genAtStart !== sessionGenerationRef.current) return;
                  if (srv.state === 'ENDED') {
                    setCallStatus('ENDED');
                    emitSessionEndOnce({
                      source: 'WEBVIEW_STATUS',
                      sessionId: resolvedSessionId,
                      incidentId,
                      robotId,
                      uiStatus: 'ENDED',
                      endReason: srv.endReason || msg.reason,
                      backendSession: srv,
                    });
                  } else if (srv.state === 'EXPIRED' || srv.state === 'FAILED') {
                    const sessionLabel = mode === 'ASSIST' ? 'Phiên đàm thoại' : 'Phiên xem camera';
                    setCallStatus(srv.state);
                    setErrorMsg(
                      srv.state === 'EXPIRED'
                        ? `${sessionLabel} đã hết hạn.`
                        : `${sessionLabel} gặp lỗi kết nối.`
                    );
                  } else {
                    setCallStatus('ERROR');
                    setErrorMsg('Mất kết nối WebRTC tạm thời, phiên vẫn chưa kết thúc.');
                  }
                })
                .catch(() => {
                  if (genAtStart !== sessionGenerationRef.current) return;
                  setCallStatus('ERROR');
                  setErrorMsg(
                    mode === 'ASSIST'
                      ? 'Mất kết nối cuộc gọi, chưa xác nhận được kết thúc từ máy chủ.'
                      : 'Mất kết nối xem camera, chưa xác nhận được kết thúc từ máy chủ.'
                  );
                });
            } else {
              setCallStatus('ERROR');
              setErrorMsg(
                mode === 'ASSIST' ? 'Mất kết nối cuộc gọi.' : 'Mất kết nối xem camera robot.'
              );
            }
          }
          break;
        }
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
  }, [sessionId, existingSessionId, incidentId, robotId, emitSessionEndOnce]);

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

  const isConnected = callStatus === 'CONNECTED';
  const isAssist = mode === 'ASSIST';
  const isErrorState =
    Boolean(externalError) ||
    callStatus === 'ERROR' ||
    callStatus === 'TIMEOUT' ||
    callStatus === 'CAMERA_LOST' ||
    callStatus === 'EXPIRED' ||
    callStatus === 'FAILED';

  const handleDismissOnly = useCallback(() => {
    if (!isEndingRef.current && callStatus !== 'ENDED') {
      onSessionEnd?.({
        source: 'MODAL_CLOSE',
        sessionId: (sessionId || existingSessionId) || undefined,
        incidentId,
        robotId,
        uiStatus: callStatus,
        error: externalError || errorMsg || undefined,
      });
    }
    onClose();
  }, [callStatus, sessionId, existingSessionId, incidentId, robotId, externalError, errorMsg, onSessionEnd, onClose]);

  const performEndCall = useCallback(async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    const targetSessionId = sessionId || existingSessionId;
    const endReason = mode === 'ASSIST' ? 'STAFF_ENDED' : 'STAFF_ENDED_VIEW';

    let backendSession: MediaSessionResponse | null = null;
    let endErrorMessage: string | null = null;
    let endErrorStatus: number | undefined;
    if (targetSessionId) {
      try {
        backendSession = await mediaSessionApi.endSession(targetSessionId, endReason);
      } catch (err: any) {
        endErrorMessage = err?.message || null;
        endErrorStatus = typeof err?.status === 'number' ? err.status : undefined;
        console.log('Error ending media session on server:', err);
        backendSession = await mediaSessionApi.getSession(targetSessionId).catch(() => null);
      }

      const srvState = backendSession?.state;
      const isConfirmedTerminal =
        srvState === 'ENDED' || srvState === 'EXPIRED' || srvState === 'FAILED';
      if (!isConfirmedTerminal) {
        // Khi phiên chưa được /accept (403) hoặc màn hình đã vào trạng thái lỗi, cho phép đóng modal thoát ra ngay thay vì kẹt nút Kết thúc xem
        if (isErrorState || endErrorStatus === 403 || endErrorStatus === 404) {
          sendCommand({ type: 'endCall', reason: endReason });
          handleDismissOnly();
          return;
        }
        isEndingRef.current = false;
        const label = mode === 'ASSIST' ? 'Kết thúc cuộc gọi' : 'Kết thúc xem';
        Alert.alert(
          'Chưa kết thúc được phiên trên máy chủ',
          endErrorMessage ||
            (srvState
              ? `Phiên media vẫn đang ở trạng thái ${srvState}. Vui lòng bấm "${label}" để thử lại.`
              : `Không thể xác nhận đã kết thúc phiên với máy chủ. Vui lòng thử bấm "${label}" lại.`)
        );
        return;
      }

      sendCommand({ type: 'endCall', reason: endReason });

      emitSessionEndOnce({
        source: 'UI_END_BUTTON',
        sessionId: targetSessionId,
        incidentId,
        robotId,
        uiStatus: srvState || 'ENDED',
        endReason: backendSession?.endReason || endReason,
        error: endErrorMessage || undefined,
        backendSession,
      });
      onClose();
      return;
    }

    sendCommand({ type: 'endCall', reason: endReason });
    emitSessionEndOnce({
      source: 'UI_END_BUTTON',
      incidentId,
      robotId,
      uiStatus: 'ENDED',
      endReason,
      backendSession: null,
    });
    onClose();
  }, [
    mode,
    sessionId,
    existingSessionId,
    incidentId,
    robotId,
    isErrorState,
    sendCommand,
    emitSessionEndOnce,
    handleDismissOnly,
    onClose,
  ]);

  const handleRetryCamera = useCallback(async () => {
    if (isRetrying) return;
    setCallStatus('INIT');
    setErrorMsg(null);
    setReloadNonce((prev) => prev + 1);
    if (onRetryCamera) {
      await onRetryCamera();
    }
  }, [isRetrying, onRetryCamera]);

  const handleEndCall = useCallback(() => {
    if (isErrorState) {
      void performEndCall();
      return;
    }
    const isAssistMode = mode === 'ASSIST';
    Alert.alert(
      isAssistMode ? 'Kết thúc cuộc gọi' : 'Kết thúc xem camera',
      isAssistMode
        ? 'Bạn có chắc muốn kết thúc cuộc gọi đàm thoại với robot?'
        : 'Bạn đã kiểm tra xong camera robot và muốn kết thúc xem?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: isAssistMode ? 'Kết thúc cuộc gọi' : 'Kết thúc xem',
          style: 'destructive',
          onPress: () => {
            void performEndCall();
          },
        },
      ]
    );
  }, [mode, isErrorState, performEndCall]);

  const handleClose = useCallback(() => {
    if (callStatus === 'CONNECTED' || callStatus === 'ROOM_CONNECTED' || callStatus === 'CONNECTING') {
      const isAssistMode = mode === 'ASSIST';
      Alert.alert(
        isAssistMode ? 'Đóng cửa sổ cuộc gọi' : 'Đóng cửa sổ xem camera',
        isAssistMode
          ? 'Nếu chỉ đóng cửa sổ mà chưa kết thúc phiên, cuộc gọi vẫn giữ trên máy chủ.'
          : 'Đóng cửa sổ sẽ chưa kết thúc phiên xem camera trên máy chủ.',
        [
          { text: 'Ở lại', style: 'cancel' },
          {
            text: 'Đóng cửa sổ',
            onPress: handleDismissOnly,
          },
          {
            text: isAssistMode ? 'Kết thúc cuộc gọi' : 'Kết thúc xem',
            style: 'destructive',
            onPress: () => {
              void performEndCall();
            },
          },
        ]
      );
    } else {
      // Đóng cửa sổ khi lỗi / timeout / chưa kết thúc không phát sự kiện ENDED
      handleDismissOnly();
    }
  }, [callStatus, mode, handleDismissOnly, performEndCall]);

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

  const displayErrorText =
    externalError ||
    errorMsg ||
    (callStatus === 'TIMEOUT'
      ? 'Hết thời gian chờ khung hình camera robot. Vui lòng thử lại.'
      : callStatus === 'CAMERA_LOST'
      ? 'Mất tín hiệu hình ảnh từ camera robot.'
      : callStatus === 'EXPIRED'
      ? 'Phiên xem camera đã hết hạn.'
      : 'Không thể kết nối camera robot.');
  const resolvedEndLabel = endButtonLabel || (isAssist ? 'Kết thúc cuộc gọi' : 'Kết thúc xem');

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
              {isConnected && !externalError && (
                <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
              )}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {robotName || 'Camera Robot'}
              </Text>
            </View>
            <Text style={[styles.headerStatus, { color: externalError ? '#EF4444' : statusColor(callStatus) }]}>
              {externalError ? '❌ Camera chưa khả dụng' : statusLabel(callStatus)}
            </Text>
          </View>

          <View style={[styles.modeBadge, !isAssist && { backgroundColor: '#0284C7' }]}>
            {isAssist ? (
              <Phone size={12} color="#fff" />
            ) : (
              <Monitor size={12} color="#fff" />
            )}
            <Text style={styles.modeBadgeText}>{isAssist ? 'ASSIST' : 'CHỈ XEM'}</Text>
          </View>
        </View>

        {/* WebView */}
        <View style={styles.webviewContainer}>
          {visible && !externalError && (
            <WebView
              key={`${existingSessionId || robotId || 'cam'}-${mode}-${reloadNonce}`}
              ref={webViewRef}
              source={{ html: htmlContent, baseUrl: 'https://mediassistrover.duckdns.org' }}
              style={styles.webview}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              mediaCapturePermissionGrantType={isAssist ? 'grant' : 'deny'}
              onMessage={handleMessage}
              onError={(e: any) => {
                setCallStatus('ERROR');
                setErrorMsg(e.nativeEvent.description);
              }}
            />
          )}

          {/* Loading overlay when connecting */}
          {!isConnected && !isErrorState && callStatus !== 'ENDED' && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>{statusLabel(callStatus)}</Text>
            </View>
          )}

          {/* Error overlay with Retry button */}
          {isErrorState && (
            <View style={styles.errorOverlay}>
              <WifiOff size={48} color="#EF4444" />
              <Text style={styles.errorTitle}>
                {isAssist ? 'Kết nối cuộc gọi thất bại' : 'Camera robot chưa khả dụng'}
              </Text>
              <Text style={styles.errorMsg}>{displayErrorText}</Text>
              <View style={styles.errorBtnRow}>
                <TouchableOpacity
                  style={styles.retryPrimaryBtn}
                  onPress={() => void handleRetryCamera()}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <RefreshCw size={16} color="#fff" />
                      <Text style={styles.retryBtnText}>Thử lại</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.retryBtn} onPress={handleDismissOnly}>
                  <Text style={styles.retryBtnText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Location summary bar from /location (MONITOR mode) */}
        {!isAssist && locationSummary ? (
          <View style={styles.locationBanner}>
            <MapPin size={14} color="#38BDF8" />
            <Text style={styles.locationBannerText} numberOfLines={2}>
              {locationSummary}
            </Text>
          </View>
        ) : null}

        {/* Active-review verification bar while MONITOR session is active */}
        {!isAssist && incidentId && (
          <View style={styles.verifyBar}>
            {incidentStatus === 'IN_PROGRESS' ? (
              <View style={styles.verifyConfirmedRow}>
                <View style={styles.verifyConfirmedTextWrap}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <Text style={styles.verifyConfirmedText}>Đã xác nhận sự cố (IN_PROGRESS)</Text>
                </View>
                {onOpenMapRouteWhileViewing ? (
                  <TouchableOpacity
                    style={styles.verifyRouteBtn}
                    onPress={onOpenMapRouteWhileViewing}
                    activeOpacity={0.85}
                  >
                    <Navigation size={14} color="#fff" />
                    <Text style={styles.verifyBtnText}>Xem đường đến SOS</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : incidentStatus === 'RESOLVED' ||
              incidentStatus === 'CLOSED' ||
              incidentStatus === 'FALSE_ALARM' ? (
              <Text style={styles.verifyHintText}>
                Sự cố đã chuyển sang trạng thái {incidentStatus}.
              </Text>
            ) : canConfirmIncident ? (
              <View style={styles.verifyActionContainer}>
                {!isConnected && !isErrorState ? (
                  <Text style={styles.verifyHintText}>
                    Đang chờ hình ảnh trực tiếp từ camera để bật nút Xác nhận sự cố...
                  </Text>
                ) : null}
                <View style={styles.verifyBtnRow}>
                  <TouchableOpacity
                    style={[
                      styles.verifyConfirmBtn,
                      (!isConnected || isSubmittingDecision || isErrorState) &&
                        styles.verifyBtnDisabled,
                    ]}
                    disabled={!isConnected || isSubmittingDecision || isErrorState}
                    onPress={() => {
                      void onConfirmWhileViewing?.();
                    }}
                    activeOpacity={0.85}
                  >
                    {isSubmittingDecision ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="#fff" />
                        <Text style={styles.verifyBtnText}>Xác nhận sự cố</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.verifyFalseAlarmBtn,
                      isSubmittingDecision && styles.verifyBtnDisabled,
                    ]}
                    disabled={isSubmittingDecision}
                    onPress={() => onFalseAlarmWhileViewing?.()}
                    activeOpacity={0.85}
                  >
                    <XCircle size={16} color="#FCA5A5" />
                    <Text style={styles.verifyFalseAlarmText}>Báo nhầm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : decisionPermissionReason ? (
              <Text style={styles.verifyHintText}>{decisionPermissionReason}</Text>
            ) : null}
          </View>
        )}

        {/* Control bar */}
        <View style={styles.controlBar}>
          {/* Audio toggle (only in ASSIST mode) */}
          {isAssist && (
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
          )}

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

          {/* End call / End view */}
          <TouchableOpacity
            style={[styles.endCallBtn, !isAssist && styles.endViewWideBtn]}
            onPress={handleEndCall}
          >
            <PhoneOff size={20} color="#fff" />
            <Text style={isAssist ? styles.controlLabel : styles.endViewWideLabel}>
              {resolvedEndLabel}
            </Text>
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
    backgroundColor: Colors.actionSurface,
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
  },
  retryPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
    minWidth: 96,
    height: 60,
    paddingHorizontal: 14,
    borderRadius: 30,
    backgroundColor: '#EF4444',
    gap: 2,
  },
  endViewWideBtn: {
    width: 'auto',
    minWidth: 180,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 8,
  },
  endViewWideLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  locationBannerText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  verifyBar: {
    backgroundColor: '#172554',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(56, 189, 248, 0.25)',
  },
  verifyActionContainer: {
    gap: 8,
  },
  verifyBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verifyConfirmBtn: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
  },
  verifyFalseAlarmBtn: {
    flex: 0.9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 10,
  },
  verifyRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
  },
  verifyBtnDisabled: {
    opacity: 0.45,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  verifyFalseAlarmText: {
    color: '#FECACA',
    fontSize: 13,
    fontWeight: '700',
  },
  verifyConfirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  verifyConfirmedTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  verifyConfirmedText: {
    color: '#A7F3D0',
    fontSize: 13,
    fontWeight: '700',
  },
  verifyHintText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
