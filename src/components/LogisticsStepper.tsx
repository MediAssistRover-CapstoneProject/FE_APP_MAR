import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText } from './ui';
import { colors } from '../theme';

interface Props {
  currentStep: number; // 1 to 6
  steps?: string[];
  warningStep?: number;
  returnStep?: number;
}

const DEFAULT_STEPS = [
  'Nhận\nnhiệm vụ',
  'Lấy\nvật phẩm',
  'Vận\nchuyển',
  'Đến\nnơi',
  'Bàn\ngiao',
  'Hoàn\nthành',
];

export function LogisticsStepper({ currentStep, steps = DEFAULT_STEPS, warningStep, returnStep }: Props) {
  const stepList = steps;
  return (
    <View style={styles.container}>
      <View style={styles.stepperRow}>
        {stepList.map((step, idx) => {
          const stepNum = idx + 1;
          const isDone = stepNum < currentStep && warningStep !== stepNum && returnStep !== stepNum;
          const isWarning = warningStep === stepNum;
          const isReturn = returnStep === stepNum;
          const isAlert = isWarning || isReturn;
          const isActive = stepNum === currentStep && !isAlert;

          return (
            <React.Fragment key={idx}>
              {/* Connector line before circle (except first) */}
              {idx > 0 && (
                <View
                  style={[
                    styles.connector,
                    stepNum <= currentStep ? styles.connectorActive : styles.connectorInactive,
                    isAlert && styles.connectorWarning,
                  ]}
                />
              )}

              {/* Circle Icon */}
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.circle,
                    isDone && styles.circleDone,
                    isActive && styles.circleActive,
                    isAlert && styles.circleWarning,
                    !isDone && !isActive && !isAlert && styles.circleUpcoming,
                  ]}
                >
                  {isReturn ? (
                    <Ionicons name="arrow-undo" size={12} color="#FFFFFF" />
                  ) : isWarning ? (
                    <AppText style={styles.warningExclamation}>!</AppText>
                  ) : isDone ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : isActive ? (
                    <View style={styles.activeDot} />
                  ) : (
                    <AppText style={styles.upcomingText}>{stepNum}</AppText>
                  )}
                </View>
                <AppText
                  style={[
                    styles.label,
                    isActive && styles.labelActive,
                    isAlert && styles.labelWarning,
                    isDone && styles.labelDone,
                  ]}
                >
                  {step}
                </AppText>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepItem: {
    alignItems: 'center',
    width: 48,
  },
  connector: {
    flex: 1,
    height: 2,
    marginTop: 13,
    marginHorizontal: -4,
  },
  connectorActive: {
    backgroundColor: '#0284C7',
  },
  connectorWarning: {
    backgroundColor: '#F59E0B',
  },
  connectorInactive: {
    backgroundColor: '#E2E8F0',
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  circleDone: {
    backgroundColor: '#10B981',
  },
  circleActive: {
    backgroundColor: '#0284C7',
    borderWidth: 3,
    borderColor: '#BAE6FD',
  },
  circleWarning: {
    backgroundColor: '#F59E0B',
    borderWidth: 3,
    borderColor: '#FDE68A',
  },
  warningExclamation: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    lineHeight: 15,
  },
  circleUpcoming: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  upcomingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  label: {
    fontSize: 8,
    textAlign: 'center',
    color: '#94A3B8',
    lineHeight: 11,
    fontWeight: '500',
  },
  labelActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  labelWarning: {
    color: '#D97706',
    fontWeight: '700',
  },
  labelDone: {
    color: '#10B981',
    fontWeight: '600',
  },
});
