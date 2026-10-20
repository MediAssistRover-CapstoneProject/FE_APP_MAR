import Ionicons from '@expo/vector-icons/Ionicons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { RootStackParamList } from '../../app/navigation';
import { useRobotSession } from '../../app/RobotSession';
import { AppText, Button, Card, LoadingState, Notice, Screen } from '../../components/ui';
import { Destination, isDemoMode, robotService } from '../../services/robot';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Destinations'>;
const filters = [
  { id: 'all', label: 'Tất cả' }, { id: 'clinic', label: 'Phòng khám' },
  { id: 'lab', label: 'Xét nghiệm' }, { id: 'pharmacy', label: 'Nhà thuốc' },
  { id: 'payment', label: 'Thanh toán' }, { id: 'service', label: 'Dịch vụ' },
] as const;
const categoryIcons = { clinic: 'medkit-outline', lab: 'flask-outline', pharmacy: 'medical-outline', payment: 'card-outline', service: 'information-circle-outline' } as const;
const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

export function DestinationsScreen({ navigation, route }: Props) {
  const { activeTaskId, navigationReady, checkingNavigation, navigationError, reconcileNavigation, requestNavigation } = useRobotSession();
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true); setLoadError('');
    robotService.getDestinations()
      .then((data) => { if (alive) setDestinations(data); })
      .catch((cause) => { if (alive) setLoadError(cause instanceof Error ? cause.message : 'Chưa tải được địa điểm.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [retry]);

  async function start(destination: Destination) {
    if (submitting.current) return;
    if (activeTaskId) { navigation.navigate('Navigation', { taskId: activeTaskId }); return; }
    submitting.current = true; setPendingId(destination.id); setError('');
    try {
      const task = await requestNavigation(destination.id, route.params.mode);
      if (mounted.current) navigation.replace('Navigation', { taskId: task.id });
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Chưa gửi được yêu cầu. Vui lòng thử lại.');
    } finally {
      submitting.current = false;
      if (mounted.current) setPendingId(null);
    }
  }
  const visible = destinations.filter((item) => (category === 'all' || item.category === category) && searchable(`${item.name} ${item.floor} ${item.description}`).includes(searchable(query.trim())));
  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <AppText variant="title">{route.params.mode === 'escort' ? 'Bạn muốn đến đâu?' : 'Tìm nơi bạn cần đến'}</AppText>
        <AppText variant="caption">{route.params.mode === 'escort' ? 'Chọn địa điểm để yêu cầu robot dẫn đường.' : 'Xem lộ trình và hướng dẫn từng bước.'}</AppText>
      </View>
      {isDemoMode && <Notice message="Danh sách địa điểm minh họa, chưa phải bản đồ của bệnh viện thực tế." />}
      {activeTaskId && <Button title="Quay lại lộ trình đang mở" variant="secondary" onPress={() => navigation.navigate('Navigation', { taskId: activeTaskId })} />}
      {!navigationReady && pendingId === null && <View style={{ gap: 10 }}>
        {navigationError && <Notice message={navigationError} tone="error" />}
        <Button title="Kiểm tra lộ trình hiện tại" variant="secondary" loading={checkingNavigation} onPress={() => void reconcileNavigation()} />
      </View>}
      <View style={styles.search}>
        <Ionicons name="search-outline" size={22} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Tên phòng, khoa hoặc dịch vụ…" placeholderTextColor={colors.muted} style={styles.input} accessibilityLabel="Tìm địa điểm" returnKeyType="search" />
        {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Xóa từ khóa" onPress={() => setQuery('')} style={styles.clear}><Ionicons name="close-circle" size={22} color={colors.muted} /></Pressable>}
      </View>
      <View style={styles.filters}>
        {filters.map((filter) => <Pressable accessibilityRole="button" accessibilityState={{ selected: category === filter.id }} key={filter.id} onPress={() => setCategory(filter.id)} style={[styles.chip, category === filter.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <AppText variant="caption" style={category === filter.id && { color: '#FFFFFF' }}>{filter.label}</AppText>
        </Pressable>)}
      </View>
      {error && <Notice message={error} tone="error" />}
      {loading ? <LoadingState /> : loadError ? <Card><Notice message={loadError} tone="error" /><Button title="Tải lại địa điểm" onPress={() => setRetry((n) => n + 1)} /></Card> : (
        <>
          <AppText variant="caption">{visible.length} địa điểm</AppText>
          {visible.length === 0 && <Card><AppText variant="heading">Chưa tìm thấy địa điểm</AppText><AppText variant="caption">Thử tên khác hoặc chọn “Tất cả”. Bạn cũng có thể nhờ nhân viên tại quầy tiếp đón.</AppText></Card>}
          {visible.map((destination) => <Card key={destination.id}>
            <View style={styles.destinationHeader}>
              <View style={styles.icon}><Ionicons name={categoryIcons[destination.category]} size={24} color={colors.primary} /></View>
              <View style={{ flex: 1 }}><AppText variant="heading">{destination.name}</AppText><AppText variant="caption">{destination.floor}</AppText></View>
            </View>
            <AppText variant="caption">{destination.description}</AppText>
            <Button title={route.params.mode === 'escort' ? 'Dẫn tôi đến đây' : 'Xem chỉ đường'} onPress={() => void start(destination)} variant="secondary" icon="navigate-outline" loading={pendingId === destination.id} disabled={pendingId !== null || activeTaskId !== null || !navigationReady} />
          </Card>)}
        </>
      )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 56 },
  input: { flex: 1, minWidth: 0, fontSize: 16, color: colors.text, paddingVertical: 16 },
  clear: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 11, paddingHorizontal: 15, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, minHeight: 44 },
  destinationHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  icon: { backgroundColor: colors.primarySoft, padding: 12, borderRadius: 12 },
});
