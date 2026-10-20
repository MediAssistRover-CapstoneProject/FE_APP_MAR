import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { NavigationTask, robotService } from '../services/robot';

type RobotSessionValue = {
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
  navigationReady: boolean;
  checkingNavigation: boolean;
  navigationError: string;
  reconcileNavigation: () => Promise<void>;
  requestNavigation: (destinationId: string, mode: NavigationTask['mode']) => Promise<NavigationTask>;
};
const RobotSessionContext = createContext<RobotSessionValue | null>(null);

export function RobotSessionProvider({ children }: PropsWithChildren) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const [checkingNavigation, setCheckingNavigation] = useState(false);
  const [navigationError, setNavigationError] = useState('');
  const currentTask = useRef<string | null>(null);
  const ready = useRef(false);
  const busy = useRef(false);
  const updateTask = useCallback((id: string | null) => {
    currentTask.current = id;
    setActiveTaskId(id);
  }, []);
  const reconcileNavigation = useCallback(async () => {
    if (busy.current) return;
    busy.current = true; ready.current = false;
    setCheckingNavigation(true); setNavigationReady(false); setNavigationError('');
    try {
      const task = await robotService.getActiveNavigation();
      updateTask(task?.id ?? null);
      ready.current = true; setNavigationReady(true);
    } catch {
      setNavigationError('Chưa xác nhận được lộ trình hiện tại. Vui lòng kiểm tra lại trước khi yêu cầu lộ trình mới.');
    } finally {
      busy.current = false; setCheckingNavigation(false);
    }
  }, [updateTask]);
  useEffect(() => { void reconcileNavigation(); }, [reconcileNavigation]);

  const requestNavigation = useCallback(async (destinationId: string, mode: NavigationTask['mode']) => {
    if (busy.current || !ready.current || currentTask.current) {
      throw new Error('Vui lòng kiểm tra hoặc kết thúc lộ trình hiện tại trước khi chọn lộ trình mới.');
    }
    busy.current = true; ready.current = false;
    setNavigationReady(false); setNavigationError('');
    try {
      const task = await robotService.startNavigation(destinationId, mode);
      updateTask(task.status === 'stopped' || task.status === 'arrived' ? null : task.id);
      ready.current = true; setNavigationReady(true);
      return task;
    } catch (cause) {
      // A failed HTTP response does not prove the server did not accept a command.
      // Keep this lock across screen changes until the backend reconciles the task.
      setNavigationError('Chưa xác nhận kết quả yêu cầu. Hãy kiểm tra lộ trình hiện tại trước khi gửi yêu cầu mới.');
      throw cause;
    } finally {
      busy.current = false;
    }
  }, [updateTask]);
  return <RobotSessionContext.Provider value={{
    activeTaskId, setActiveTaskId: updateTask, navigationReady, checkingNavigation,
    navigationError, reconcileNavigation, requestNavigation,
  }}>{children}</RobotSessionContext.Provider>;
}

export function useRobotSession() {
  const session = useContext(RobotSessionContext);
  if (!session) throw new Error('RobotSessionProvider chưa được khởi tạo.');
  return session;
}
