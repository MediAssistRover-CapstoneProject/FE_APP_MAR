import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/app/AppNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RobotSessionProvider } from './src/app/RobotSession';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ErrorBoundary>
        <RobotSessionProvider>
          <AppNavigator />
        </RobotSessionProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
