import { create } from 'zustand';
import { apiClient } from '../api/client';
import { staffApi } from '../api/modules/staff.api';
import { ShiftResponse, StaffMeResponse } from '../api/types';
import { useAuthStore } from './useAuthStore';

const STAFF_CACHE_TTL_MS = 60_000;

interface StaffProfileCacheState {
  scopeKey: string;
  staffMe: StaffMeResponse | null;
  shifts: ShiftResponse[];
  fetchedAt: number;
  isLoading: boolean;
  ensureLoaded: (force?: boolean) => Promise<{
    staffMe: StaffMeResponse | null;
    shifts: ShiftResponse[];
  }>;
  invalidate: () => void;
}

let inFlightKey = '';
let inFlightPromise: Promise<{
  staffMe: StaffMeResponse | null;
  shifts: ShiftResponse[];
}> | null = null;

function currentScopeKey(): string {
  const { user, token } = useAuthStore.getState();
  return `${apiClient.getBaseUrl()}::${user?.accountId || user?.username || 'anon'}::${
    token ? token.slice(-10) : 'none'
  }`;
}

export const useStaffProfileStore = create<StaffProfileCacheState>((set, get) => ({
  scopeKey: '',
  staffMe: null,
  shifts: [],
  fetchedAt: 0,
  isLoading: false,

  invalidate: () => {
    inFlightKey = '';
    inFlightPromise = null;
    set({ fetchedAt: 0, staffMe: null, shifts: [] });
  },

  ensureLoaded: async (force = false) => {
    if (!useAuthStore.getState().token) {
      return { staffMe: null, shifts: [] };
    }
    const scope = currentScopeKey();
    const state = get();
    const sameScope = state.scopeKey === scope;
    const isFresh =
      sameScope && state.fetchedAt > 0 && Date.now() - state.fetchedAt < STAFF_CACHE_TTL_MS;

    if (!force && isFresh && (state.staffMe || state.shifts.length > 0)) {
      return { staffMe: state.staffMe, shifts: state.shifts };
    }

    if (!force && inFlightPromise && inFlightKey === scope) {
      return inFlightPromise;
    }

    set({ isLoading: true, ...(sameScope ? {} : { scopeKey: scope, staffMe: null, shifts: [] }) });

    const reqPromise = (async () => {
      try {
        const [staffMe, shifts] = await Promise.all([
          staffApi.getStaffMe().catch(() => null),
          staffApi.getAllStaffShifts().catch(() => [] as ShiftResponse[]),
        ]);

        if (currentScopeKey() !== scope) {
          return { staffMe: null, shifts: [] };
        }

        if (staffMe?.account) {
          useAuthStore.setState({ user: staffMe.account });
        }

        set({
          scopeKey: scope,
          staffMe,
          shifts,
          fetchedAt: Date.now(),
          isLoading: false,
        });
        return { staffMe, shifts };
      } finally {
        if (inFlightKey === scope) {
          inFlightKey = '';
          inFlightPromise = null;
        }
        set({ isLoading: false });
      }
    })();

    inFlightKey = scope;
    inFlightPromise = reqPromise;
    return reqPromise;
  },
}));
