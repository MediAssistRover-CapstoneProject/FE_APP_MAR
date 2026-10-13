import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { Check } from 'lucide-react-native';

interface Step {
  id: number;
  label: string;
}

const STEPS: Step[] = [
  { id: 1, label: 'Nhập email' },
  { id: 2, label: 'Nhập OTP' },
  { id: 3, label: 'Mật khẩu mới' },
  { id: 4, label: 'Hoàn thành' },
];

interface StepperProps {
  currentStep: number; // 1 | 2 | 3 | 4
}

export const Stepper: React.FC<StepperProps> = memo(({ currentStep }) => {
  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isActive = currentStep === step.id;
        const isUpcoming = currentStep < step.id;

        return (
          <React.Fragment key={step.id}>
            {/* Step Item */}
            <View style={styles.stepWrapper}>
              <View
                style={[
                  styles.circle,
                  isCompleted && styles.completedCircle,
                  isActive && styles.activeCircle,
                  isUpcoming && styles.upcomingCircle,
                ]}
              >
                {isCompleted ? (
                  <Check size={14} color="#FFFFFF" strokeWidth={3} />
                ) : (
                  <Text
                    style={[
                      styles.circleText,
                      isActive && styles.activeCircleText,
                      isUpcoming && styles.upcomingCircleText,
                    ]}
                  >
                    {step.id}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  isActive && styles.activeStepLabel,
                  isCompleted && styles.completedStepLabel,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>

            {/* Connecting Line */}
            {index < STEPS.length - 1 && (
              <View
                style={[
                  styles.line,
                  currentStep > index + 1 && styles.completedLine,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    marginVertical: Spacing.lg,
  },
  stepWrapper: {
    alignItems: 'center',
    width: 68,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  activeCircle: {
    backgroundColor: Colors.primary,
  },
  completedCircle: {
    backgroundColor: Colors.emerald,
  },
  upcomingCircle: {
    backgroundColor: Colors.stepInactive,
  },
  circleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  activeCircleText: {
    color: Colors.textInverse,
  },
  upcomingCircleText: {
    color: Colors.stepInactiveText,
  },
  stepLabel: {
    ...Typography.caption,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  activeStepLabel: {
    color: Colors.primary,
    fontWeight: '700',
  },
  completedStepLabel: {
    color: Colors.emerald,
    fontWeight: '600',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.stepInactive,
    marginBottom: 16,
    marginHorizontal: -4,
  },
  completedLine: {
    backgroundColor: Colors.emerald,
  },
});
