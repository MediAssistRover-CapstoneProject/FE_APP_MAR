import {
  Destination,
  NavigationTask,
  RobotService,
  RobotServiceError,
} from './types';
import { requiredInput } from './validation';

const destinations: Destination[] = [
  {
    id: 'reception',
    name: 'Quầy tiếp đón',
    category: 'service',
    floor: 'Tầng trệt',
    description: 'Hướng dẫn đăng ký khám và các thủ tục ban đầu.',
  },
  {
    id: 'general-clinic',
    name: 'Phòng khám Nội tổng quát',
    category: 'clinic',
    floor: 'Tầng trệt',
    description: 'Khu phòng khám ngoại trú, phòng 101.',
  },
  {
    id: 'laboratory',
    name: 'Khu xét nghiệm',
    category: 'lab',
    floor: 'Tầng trệt',
    description: 'Tiếp nhận người có chỉ định xét nghiệm của bác sĩ.',
  },
  {
    id: 'pharmacy',
    name: 'Nhà thuốc',
    category: 'pharmacy',
    floor: 'Tầng trệt',
    description: 'Nhận thuốc và được dược sĩ hướng dẫn theo đơn.',
  },
  {
    id: 'payment',
    name: 'Quầy thanh toán',
    category: 'payment',
    floor: 'Tầng trệt',
    description: 'Hỗ trợ thanh toán viện phí.',
  },
  {
    id: 'waiting-area',
    name: 'Khu vực chờ',
    category: 'service',
    floor: 'Tầng trệt',
    description: 'Chỗ ngồi chờ gần khu khám ngoại trú.',
  },
];

function cloneTask(task: NavigationTask): NavigationTask {
  return { ...task, steps: [...task.steps] };
}

/**
 * Sample data only: no network access, staff notification, or robot movement.
 * Navigation never progresses automatically or claims a physical arrival.
 */
export function createMockRobotService(robotId = 'MAR-01'): RobotService {
  const tasks = new Map<string, NavigationTask>();
  let navigationSequence = 0;
  let sosSequence = 0;

  function findTask(taskId: string): NavigationTask {
    const task = tasks.get(requiredInput(taskId, 'Mã tác vụ'));
    if (!task) {
      throw new RobotServiceError(
        'not_found',
        'Không tìm thấy tác vụ trong phiên trải nghiệm này.',
      );
    }
    return task;
  }

  return {
    async getStatus() {
      const isEscorting = [...tasks.values()].some(
        (task) => task.mode === 'escort' && task.status === 'active',
      );
      return {
        id: robotId,
        name: 'Robot hỗ trợ ngoại trú',
        battery: 86,
        location: 'Sảnh tiếp đón',
        availability: isEscorting ? 'busy' : 'available',
      };
    },
    async getDestinations() {
      return destinations.map((destination) => ({ ...destination }));
    },
    async getActiveNavigation() {
      const task = [...tasks.values()].find(
        (item) =>
          item.status === 'active' ||
          item.status === 'pending' ||
          item.status === 'blocked',
      );
      return task ? cloneTask(task) : null;
    },
    async startNavigation(destinationId, mode) {
      const id = requiredInput(destinationId, 'Điểm đến');
      const destination = destinations.find((item) => item.id === id);
      if (!destination) {
        throw new RobotServiceError('not_found', 'Không tìm thấy điểm đến.');
      }
      if (mode !== 'directions' && mode !== 'escort') {
        throw new RobotServiceError('validation', 'Chế độ điều hướng không hợp lệ.');
      }
      const activeTask = [...tasks.values()].find(
        (task) => task.status === 'active' || task.status === 'pending',
      );
      if (activeTask) {
        throw new RobotServiceError(
          'conflict',
          'Vui lòng dừng tác vụ hiện tại trước khi chọn hành trình mới.',
        );
      }
      navigationSequence += 1;
      const task: NavigationTask = {
        id: `demo-nav-${String(navigationSequence).padStart(4, '0')}`,
        destinationId: destination.id,
        destinationName: destination.name,
        mode,
        status: 'active',
        steps: [
          'Lộ trình minh họa: bắt đầu tại sảnh tiếp đón.',
          `Xem biển chỉ dẫn đến ${destination.name.toLocaleLowerCase('vi-VN')}.`,
          'Hỏi nhân viên tiếp đón để được chỉ đường thực tế.',
        ],
        currentStep: 0,
      };
      tasks.set(task.id, task);
      return cloneTask(task);
    },
    async getNavigation(taskId) {
      return cloneTask(findTask(taskId));
    },
    async stopNavigation(taskId) {
      const task = findTask(taskId);
      if (task.status === 'active' || task.status === 'pending') {
        task.status = 'stopped';
      }
      return cloneTask(task);
    },
    async sendMessage(message) {
      const text = requiredInput(message, 'Câu hỏi');
      if (text.length > 2_000) {
        throw new RobotServiceError(
          'validation',
          'Vui lòng rút gọn câu hỏi còn tối đa 2.000 ký tự.',
        );
      }
      const lowerCaseText = text.toLocaleLowerCase('vi-VN').normalize('NFC');
      const normalized = lowerCaseText
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');
      if (
        lowerCaseText.includes('đau') ||
        /toi (?:bi )?dau|dau (?:bung|nguc|dau|hong|rang|lung|chan|tay)|trieu chung|chan doan|dieu tri|uong thuoc|lieu thuoc|sot|kho tho|cap cuu/.test(
          normalized,
        )
      ) {
        return {
          message:
            'Tôi hỗ trợ thông tin và chỉ đường, chưa thể đánh giá triệu chứng hoặc tư vấn điều trị. Vui lòng trao đổi với bác sĩ hoặc nhân viên y tế. Nếu đang cần hỗ trợ khẩn cấp, hãy báo ngay cho nhân viên gần nhất. Đây là câu trả lời minh họa.',
        };
      }
      if (/dang ky|thu tuc|quy trinh|kham benh/.test(normalized)) {
        return {
          message:
            'Thông tin minh họa: bạn có thể đến quầy tiếp đón để được hướng dẫn đăng ký khám. Các bước tiếp theo phụ thuộc hướng dẫn của bệnh viện và chỉ định của bác sĩ. Bạn muốn tìm quầy tiếp đón trên mục Điểm đến?',
        };
      }
      if (/thuoc|duoc/.test(normalized)) {
        return {
          message:
            'Thông tin minh họa: Nhà thuốc có trong danh sách Điểm đến. Vui lòng trao đổi với dược sĩ về đơn thuốc và cách sử dụng thuốc.',
        };
      }
      if (/thanh toan|vien phi|chi phi/.test(normalized)) {
        return {
          message:
            'Thông tin minh họa: chọn Quầy thanh toán trong mục Điểm đến. Nhân viên tại quầy sẽ xác nhận chi phí thực tế cho bạn.',
        };
      }
      return {
        message:
          'Tôi có thể hỗ trợ tìm quầy tiếp đón, phòng khám, khu xét nghiệm, nhà thuốc và quầy thanh toán. Bạn hãy chọn mục Điểm đến hoặc hỏi về thủ tục đăng ký khám. Đây là trợ lý minh họa, chưa kết nối dữ liệu bệnh viện.',
      };
    },
    async requestSos() {
      sosSequence += 1;
      // The UI must label this as a simulation. It does not contact staff.
      return {
        id: `demo-sos-${String(sosSequence).padStart(4, '0')}`,
        status: 'received',
        createdAt: new Date().toISOString(),
      };
    },
  };
}
