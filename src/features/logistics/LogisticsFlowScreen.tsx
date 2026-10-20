import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LogisticsTaskScreen } from './LogisticsTaskScreen';
import { LogisticsMovingScreen } from './LogisticsMovingScreen';
import { LogisticsArrivedScreen } from './LogisticsArrivedScreen';

export function LogisticsFlowScreen() {
  const [subStep, setSubStep] = useState<1 | 2 | 3>(1);

  if (subStep === 1) {
    return <LogisticsTaskScreen onNext={() => setSubStep(2)} />;
  }

  if (subStep === 2) {
    return (
      <LogisticsMovingScreen
        onNext={() => setSubStep(3)}
        onBack={() => setSubStep(1)}
      />
    );
  }

  return (
    <LogisticsArrivedScreen
      onReset={() => setSubStep(1)}
      onBack={() => setSubStep(2)}
    />
  );
}
