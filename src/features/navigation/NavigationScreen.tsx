import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RootStackParamList } from '../../app/navigation';
import { useRobotSession } from '../../app/RobotSession';
import { AppText, Button, Card, LoadingState, Notice, Screen } from '../../components/ui';
import { isDemoMode, NavigationTask, robotService } from '../../services/robot';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Navigation'>;
const labels: Record<NavigationTask['status'], string> = {
  active: 'Đang hướng dẫn', pending: 'Đang chờ tiếp nhận',
  blocked: 'Lộ trình đang bị gián đoạn', stopped: 'Đã dừng lộ trình', arrived: 'Đã đến nơi',
};
export function NavigationScreen({ route, navigation }: Props) {
  const { setActiveTaskId } = useRobotSession();
  const [task, setTask] = useState<NavigationTask | null>(null);
  const [error, setError] = useState('');
  const [stopError, setStopError] = useState('');
  const [stopping, setStopping] = useState(false);
  const [retry, setRetry] = useState(0);
  const mutationInFlight = useRef(false);
  const revision = useRef(0);
  const taskId = route.params.taskId;

  const receive = useCallback((result: NavigationTask) => {
    setTask(result);
    setActiveTaskId(result.status === 'stopped' || result.status === 'arrived' ? null : result.id);
  }, [setActiveTaskId]);

  useFocusEffect(useCallback(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const version = revision.current;
      if (!mutationInFlight.current) {
        try {
          const result = await robotService.getNavigation(taskId);
          if (alive && version === revision.current) { receive(result); setError(''); }
          if (result.status === 'stopped' || result.status === 'arrived') return;
        } catch (cause) {
          if (alive && version === revision.current) setError(cause instanceof Error ? cause.message : 'Chưa thể cập nhật lộ trình.');
        }
      }
      if (alive) timer = setTimeout(poll, 3000);
    }
    void poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [taskId, retry, receive]));

  async function stop() {
    if (mutationInFlight.current) return;
    mutationInFlight.current = true; revision.current += 1; setStopping(true); setStopError('');
    try {
      const result = await robotService.stopNavigation(taskId);
      receive(result);
      setError('');
    } catch (cause) {
      setStopError(cause instanceof Error ? cause.message : 'Chưa xác nhận robot đã dừng. Hãy nhờ nhân viên hỗ trợ.');
    } finally {
      mutationInFlight.current = false; revision.current += 1; setStopping(false);
      setRetry((n) => n + 1);
    }
  }
  const finished = task?.status === 'arrived' || task?.status === 'stopped';
  return (
    <Screen>
      {isDemoMode && <Notice message="Lộ trình mô phỏng · Robot thực tế không di chuyển. Tiến độ sẽ lấy từ robot khi kết nối." />}
      {error && <View style={{ gap: 10 }}><Notice message={`${error} Trạng thái hiển thị có thể chưa được cập nhật.`} tone="error" /><Button title="Cập nhật lại" variant="secondary" onPress={() => setRetry((n) => n + 1)} /></View>}
      {!task && !error && <LoadingState message="Đang nhận lộ trình…" />}
      {task && <>
        <Card>
          <View style={styles.icon}><Ionicons name={finished ? 'checkmark-outline' : 'navigate-outline'} size={32} color={colors.primary} /></View>
          <AppText variant="caption">{task.mode === 'escort' ? 'ROBOT DẪN ĐƯỜNG' : 'CHỈ ĐƯỜNG TỪNG BƯỚC'}</AppText>
          <AppText variant="title">{task.destinationName}</AppText>
          <AppText style={{ fontWeight: '600', color: task.status === 'blocked' ? colors.danger : colors.primary }}>
            {error ? 'Chưa xác nhận trạng thái mới nhất' : labels[task.status]}
          </AppText>
          {task.status === 'blocked' && <Notice message="Vui lòng chờ tại vị trí an toàn và nhờ nhân viên hỗ trợ." tone="error" />}
        </Card>
        <AppText variant="heading">Các bước di chuyển</AppText>
        <Card>
          {task.steps.map((step, index) => (
            <View key={`${index}-${step}`} style={styles.step}>
              <View style={[styles.number, index === task.currentStep && !finished && { backgroundColor: colors.primary }]}>
                <AppText style={{ color: index === task.currentStep && !finished ? '#FFFFFF' : colors.primary, fontWeight: '700' }}>{index + 1}</AppText>
              </View>
              <AppText style={{ flex: 1 }}>{step}</AppText>
            </View>
          ))}
        </Card>
      </>}
      {stopError && <Notice message={stopError} tone="error" />}
      {!finished && <Button title={stopping ? 'Đang gửi yêu cầu dừng…' : 'Dừng lộ trình'} icon="stop-circle-outline" variant="danger" loading={stopping} onPress={() => void stop()} />}
      {finished && <Button title="Về trang chính" icon="home-outline" onPress={() => navigation.popToTop()} />}
      <Button title="Nhờ nhân viên hỗ trợ" variant="secondary" onPress={() => navigation.navigate('Emergency')} />
      {!finished && <AppText variant="caption">Nếu cần dừng robot ngay, hãy nhờ nhân viên sử dụng nút dừng trên robot. Nút trên ứng dụng cần kết nối để gửi yêu cầu.</AppText>}
    </Screen>
  );
}
const styles = StyleSheet.create({
  icon: { width: 62, height: 62, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', gap: 14, paddingVertical: 10, alignItems: 'flex-start' },
  number: { minWidth: 34, minHeight: 34, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
