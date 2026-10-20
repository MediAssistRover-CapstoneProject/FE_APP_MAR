import React, { useState, useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/navigation';
import { AppText } from '../../components/ui';
import { AudioWaveform } from '../../components/AudioWaveform';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Emergency'>;

export function SosCallScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [callSeconds, setCallSeconds] = useState(2);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSecs: number) => {
    const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
    const secs = String(totalSecs % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
      {/* Top Header Row */}
      <View style={styles.topHeader}>
        <View style={styles.sosBadge}>
          <View style={styles.redDot} />
          <AppText style={styles.sosBadgeText}>SOS • ROBOT MRC-01</AppText>
        </View>

        <View style={styles.robotMiniIcon}>
          <Ionicons name="hardware-chip-outline" size={16} color="#94A3B8" />
        </View>
      </View>

      {/* Main Calling Content */}
      <View style={styles.centerContainer}>
        {/* Concentric Glowing Rings Avatar */}
        <View style={styles.outerRing}>
          <View style={styles.middleRing}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={54} color="#0F4C81" />
            </View>
          </View>
        </View>

        {/* Staff Identity */}
        <AppText style={styles.staffName}>Y tá Trần Thị Lan</AppText>
        <AppText style={styles.staffRole}>Nhân viên trực - Khoa Nội TH</AppText>

        {/* Calling Status with Wave */}
        <View style={styles.statusBox}>
          <AppText style={styles.callingStatusText}>Đang gọi Staff...</AppText>
          <View style={styles.waveWrap}>
            <AudioWaveform color="#F59E0B" count={18} height={16} />
          </View>
        </View>

        {/* Location Broadcast Note */}
        <View style={styles.locationNotice}>
          <Ionicons name="location-sharp" size={14} color="#38BDF8" />
          <AppText style={styles.locationNoticeText}>
            Vị trí robot: Khu chờ · đang chia sẻ realtime
          </AppText>
        </View>
      </View>

      {/* Bottom Control Section */}
      <View style={styles.bottomSection}>
        <View style={styles.timerRow}>
          <View style={styles.waitingTimer}>
            <View style={styles.orangeDot} />
            <AppText style={styles.waitingTimerText}>
              Chờ Staff nghe máy : {formatTimer(callSeconds)}
            </AppText>
          </View>
          <AppText style={styles.hintCloseText}>Nhấn nút đỏ để đóng</AppText>
        </View>

        {/* Call Action Buttons */}
        <View style={styles.callActionsRow}>
          {/* Mute Button */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsMuted((v) => !v)}
            style={({ pressed }) => [
              styles.secondaryCallButton,
              isMuted && styles.buttonActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={24}
              color={isMuted ? '#EF4444' : '#38BDF8'}
            />
          </Pressable>

          {/* Hang up End Call Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kết thúc cuộc gọi khẩn cấp"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.endCallButton,
              pressed && { transform: [{ scale: 0.95 }], backgroundColor: '#DC2626' },
            ]}
          >
            <Ionicons name="call" size={32} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </Pressable>

          {/* Speaker Button */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsSpeakerOn((v) => !v)}
            style={({ pressed }) => [
              styles.secondaryCallButton,
              isSpeakerOn && styles.buttonActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={isSpeakerOn ? 'volume-high' : 'volume-mute'}
              size={24}
              color="#38BDF8"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#071526',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  sosBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#450A0A',
    borderWidth: 1,
    borderColor: '#991B1B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  sosBadgeText: {
    color: '#FECACA',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  robotMiniIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#132840',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 8,
  },
  outerRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1.5,
    borderColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    marginBottom: 12,
  },
  middleRing: {
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 2,
    borderColor: '#00C9A7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 201, 167, 0.15)',
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  staffName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  staffRole: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  statusBox: {
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  callingStatusText: {
    color: '#F59E0B',
    fontSize: 15,
    fontWeight: '700',
  },
  waveWrap: {
    marginTop: 4,
  },
  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    backgroundColor: 'rgba(30, 58, 95, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  locationNoticeText: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '500',
  },
  bottomSection: {
    gap: 20,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  waitingTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orangeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  waitingTimerText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
  },
  hintCloseText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
  },
  callActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  secondaryCallButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#132840',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1E3A5F',
  },
  buttonActive: {
    backgroundColor: '#1E3A5F',
    borderColor: '#38BDF8',
  },
  endCallButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
});
