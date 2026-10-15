import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Phone, PhoneOff, MapPin, Siren } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

interface SOSCallModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const SOSCallModal: React.FC<SOSCallModalProps> = ({
  visible,
  onAccept,
  onDecline,
}) => {
  // Pulse animation cho vòng chuông SOS
  const pulseAnim1 = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      const loop1 = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim1, { toValue: 1.35, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim1, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      const loop2 = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim2, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim2, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      loop1.start();
      loop2.start();

      return () => {
        loop1.stop();
        loop2.stop();
      };
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        {/* Vòng tròn hiệu ứng sóng âm SOS */}
        <View style={styles.pulseArea}>
          <Animated.View
            style={[
              styles.pulseCircleOuter,
              { transform: [{ scale: pulseAnim2 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseCircleMid,
              { transform: [{ scale: pulseAnim1 }] },
            ]}
          />
          <View style={styles.pulseCircleCenter}>
            <Siren size={44} color="#EF4444" strokeWidth={2.2} />
            <Text style={styles.sosTextInCircle}>SOS</Text>
          </View>
        </View>

        {/* Thông tin cuộc gọi */}
        <View style={styles.titleBox}>
          <Text style={styles.callTitle}>Cuộc gọi khẩn cấp</Text>
          <Text style={styles.callSubtitle}>Bệnh nhân bấm nút SOS</Text>
          <Text style={styles.robotIdText}>Robot ID: #RC-01 · 17:46</Text>
        </View>

        {/* Thẻ vị trí */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeaderRow}>
            <View style={styles.redDot} />
            <Text style={styles.locationHeaderText}>VỊ TRÍ ROBOT ĐÃ GHI NHẬN</Text>
          </View>
          <View style={styles.locationBody}>
            <MapPin size={18} color="#EF4444" style={{ marginTop: 2 }} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationZone}>Khu chờ</Text>
              <Text style={styles.locationNote}>Tọa độ đang được chia sẻ real-time</Text>
            </View>
          </View>
        </View>

        {/* Nút nghe máy / từ chối */}
        <View style={styles.actionRow}>
          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={onDecline}
              activeOpacity={0.8}
            >
              <PhoneOff size={28} color="#EF4444" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.declineText}>Từ chối</Text>
          </View>

          <View style={styles.actionItem}>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={onAccept}
              activeOpacity={0.8}
            >
              <Phone size={28} color="#FFFFFF" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.acceptText}>Nghe máy</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6F4FE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  pulseArea: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  pulseCircleOuter: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  pulseCircleMid: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  pulseCircleCenter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  sosTextInCircle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  titleBox: {
    alignItems: 'center',
    marginBottom: 28,
  },
  callTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0A2540',
    marginBottom: 6,
  },
  callSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0284C7',
    marginBottom: 4,
  },
  robotIdText: {
    fontSize: 12,
    color: '#64748B',
  },
  locationCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  locationHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.8,
  },
  locationBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  locationInfo: {
    flex: 1,
  },
  locationZone: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A2540',
  },
  locationNote: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  actionItem: {
    alignItems: 'center',
    gap: 10,
  },
  declineBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
  },
  declineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  acceptBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0284C7',
  },
});
