import { create } from 'zustand';

export interface ItemData {
  id: string;
  title: string;
  category: string;
  description: string;
  price?: string;
  imageUrl?: string;
  isFavorite: boolean;
}

interface AppState {
  // User state
  userName: string;
  userEmail: string;
  isLoggedIn: boolean;

  // Search & Filter state
  searchQuery: string;
  selectedCategory: string;

  // App items (dữ liệu mock mượt mà)
  items: ItemData[];

  // Actions (hàm cập nhật trạng thái)
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  toggleFavorite: (id: string) => void;
  setUser: (name: string, email: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  userName: 'Alex Nguyen',
  userEmail: 'alex.nguyen@example.com',
  isLoggedIn: true,

  searchQuery: '',
  selectedCategory: 'Tất cả',

  items: [
    {
      id: '1',
      title: 'Thiết kế Mobile App Minimal',
      category: 'UI/UX',
      description: 'Giao diện ứng dụng tinh gọn, tối ưu trải nghiệm người dùng.',
      price: '$120',
      isFavorite: false,
    },
    {
      id: '2',
      title: 'Hệ thống Design Tokens',
      category: 'Design System',
      description: 'Quy chuẩn bảng màu, typo và components đồng bộ.',
      price: '$85',
      isFavorite: true,
    },
    {
      id: '3',
      title: 'Tối ưu hoá Luồng Dữ Liệu',
      category: 'Performance',
      description: 'Zustand + FlashList giúp app đạt 60fps không giật lag.',
      price: '$150',
      isFavorite: false,
    },
    {
      id: '4',
      title: 'E-commerce Mobile Screen',
      category: 'UI/UX',
      description: 'Bộ giao diện bán hàng chuyên nghiệp, checkout 1 chạm.',
      price: '$99',
      isFavorite: false,
    },
  ],

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  toggleFavorite: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
      ),
    })),
  setUser: (name, email) =>
    set({ userName: name, userEmail: email, isLoggedIn: true }),
}));
