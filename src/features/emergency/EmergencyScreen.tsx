import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../app/navigation';
import { SosCallScreen } from './SosCallScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Emergency'>;

export function EmergencyScreen(props: Props) {
  return <SosCallScreen {...props} />;
}
