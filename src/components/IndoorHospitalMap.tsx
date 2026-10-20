import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from './ui';
import { colors } from '../theme';

interface Props {
  targetRoom?: string;
}

export function IndoorHospitalMap({ targetRoom = 'P. 102' }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.mapCanvas}>
        {/* Top Rooms Row */}
        <View style={styles.roomRow}>
          <View style={styles.roomBox}>
            <AppText style={styles.roomText}>P. 104</AppText>
          </View>
          <View style={[styles.roomBox, styles.targetRoomBox]}>
            <View style={styles.roomHeaderBadge}>
              <Ionicons name="medical" size={10} color="#FFFFFF" />
            </View>
            <AppText style={[styles.roomText, styles.targetRoomText]}>{targetRoom}</AppText>
            <AppText style={styles.targetSubText}>Nội TH</AppText>
          </View>
        </View>

        {/* Corridor with Path */}
        <View style={styles.corridor}>
          {/* Path Line */}
          <View style={styles.pathLineHorizontal} />
          <View style={styles.pathLineVertical} />

          {/* Robot Position Marker */}
          <View style={styles.robotMarker}>
            <View style={styles.robotPulseRing} />
            <Ionicons name="navigate" size={13} color="#FFFFFF" />
          </View>
        </View>

        {/* Middle Rooms Row */}
        <View style={styles.roomRow}>
          <View style={styles.roomBox}>
            <AppText style={styles.roomText}>P. 103</AppText>
          </View>
          <View style={styles.roomBox}>
            <AppText style={styles.roomText}>P. 101</AppText>
          </View>
        </View>

        {/* Bottom Rooms Row */}
        <View style={styles.roomRow}>
          <View style={styles.roomBox}>
            <AppText style={styles.roomText}>Khu chờ</AppText>
          </View>
          <View style={styles.roomBox}>
            <AppText style={styles.roomText}>Lễ tân</AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F0F7FF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D0E4FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  mapCanvas: {
    width: '100%',
    aspectRatio: 1.8,
    position: 'relative',
    justifyContent: 'space-between',
  },
  roomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    zIndex: 1,
  },
  roomBox: {
    flex: 1,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CFE2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  targetRoomBox: {
    backgroundColor: '#0F4C81',
    borderColor: '#0F4C81',
  },
  roomHeaderBadge: {
    position: 'absolute',
    top: 2,
    right: 4,
  },
  targetRoomText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  targetSubText: {
    color: '#BAE6FD',
    fontSize: 9,
    fontWeight: '500',
  },
  corridor: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
    pointerEvents: 'none',
  },
  pathLineHorizontal: {
    position: 'absolute',
    top: '36%',
    left: '46%',
    width: '32%',
    height: 3,
    backgroundColor: '#0284C7',
    borderRadius: 2,
  },
  pathLineVertical: {
    position: 'absolute',
    top: '36%',
    right: '22%',
    width: 3,
    height: '24%',
    backgroundColor: '#0284C7',
    borderRadius: 2,
  },
  robotMarker: {
    position: 'absolute',
    top: '33%',
    left: '42%',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0066CC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#0066CC',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  robotPulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    opacity: 0.6,
  },
});
