import { create } from 'zustand';
import { apiClient } from '../api/client';
import { staffApi } from '../api/modules/staff.api';
import { ShiftResponse, StaffFaceStatusResponse, StaffMeResponse } from '../api/types';
import { useAuthStore } from './useAuthStore';

const STAFF_CACHE_TTL_MS = 60_000;

interface StaffProfileCacheState {
  scopeKey: string;
  staffMe: StaffMeResponse | null;
  shifts: ShiftResponse[];
  faceStatus: StaffFaceStatusResponse | null;
  fetchedAt: number;
  isLoading: boolean;
  ensureLoaded: (force?: boolean) => Promise<{
    staffMe: StaffMeResponse | null;
    shifts: ShiftResponse[];
    faceStatus: StaffFaceStatusResponse | null;
  }>;
  applyStaffMeUpdate: (
    staffMe: StaffMeResponse,
    faceStatus?: StaffFaceStatusResponse | null
  ) => void;
  refreshFaceStatus: () => Promise<StaffFaceStatusResponse | null>;
  invalidate: () => void;
}

let inFlightKey = '';
let inFlightPromise: Promise<{
  staffMe: StaffMeResponse | null;
  shifts: ShiftResponse[];
  faceStatus: StaffFaceStatusResponse | null;
}> | null = null;

function currentScopeKey(): string {
  const { user, token } = useAuthStore.getState();
  return `${apiClient.getBaseUrl()}::${user?.accountId || user?.username || 'anon'}::${
    token ? token.slice(-10) : 'none'
  }`;
}

function mergeFaceStatusIntoStaffMe(
  staffMe: StaffMeResponse | null,
  faceStatus: StaffFaceStatusResponse | null
): StaffMeResponse | null {
  if (!staffMe || !faceStatus) return staffMe;
  if (
    staffMe.account?.accountId &&
    faceStatus.accountId &&
    staffMe.account.accountId.toLowerCase() !== faceStatus.accountId.toLowerCase()
  ) {
    return staffMe;
  }
  return {
    ...staffMe,
    staffProfile: {
      ...staffMe.staffProfile,
      url: faceStatus.avatarUrl !== undefined ? faceStatus.avatarUrl : staffMe.staffProfile.url,
      faceStatus: faceStatus.status || staffMe.staffProfile.faceStatus,
      faceAvatarVersion:
        faceStatus.avatarVersion !== undefined
          ? faceStatus.avatarVersion
          : staffMe.staffProfile.faceAvatarVersion,
    },
  };
}

export const useStaffProfileStore = create<StaffProfileCacheState>((set, get) => ({
  scopeKey: '',
  staffMe: null,
  shifts: [],
  faceStatus: null,
  fetchedAt: 0,
  isLoading: false,

  invalidate: () => {
    inFlightKey = '';
    inFlightPromise = null;
    set({ fetchedAt: 0, staffMe: null, shifts: [], faceStatus: null });
  },

  applyStaffMeUpdate: (staffMe, faceStatus) => {
    const scope = currentScopeKey();
    if (!useAuthStore.getState().token) return;
    if (staffMe?.account) {
      useAuthStore.setState({ user: staffMe.account });
    }
    const nextFaceStatus =
      faceStatus !== undefined ? faceStatus : get().scopeKey === scope ? get().faceStatus : null;
    const syncedStaffMe = mergeFaceStatusIntoStaffMe(staffMe, nextFaceStatus) || staffMe;
    set({
      scopeKey: scope,
      staffMe: syncedStaffMe,
      faceStatus: nextFaceStatus,
      fetchedAt: Date.now(),
    });
  },

  refreshFaceStatus: async () => {
    if (!useAuthStore.getState().token) return null;
    const scope = currentScopeKey();
    const accountId =
      get().staffMe?.account?.accountId || useAuthStore.getState().user?.accountId;
    if (!accountId) return null;
    const faceStatus = await staffApi.getFaceStatus(accountId);
    if (currentScopeKey() !== scope) return null;
    set((state) => ({
      scopeKey: scope,
      faceStatus,
      staffMe: mergeFaceStatusIntoStaffMe(state.staffMe, faceStatus),
      fetchedAt: Date.now(),
    }));
    return faceStatus;
  },

  ensureLoaded: async (force = false) => {
    if (!useAuthStore.getState().token) {
      return { staffMe: null, shifts: [], faceStatus: null };
    }
    const scope = currentScopeKey();
    const state = get();
    const sameScope = state.scopeKey === scope;
    const isFresh =
      sameScope && state.fetchedAt > 0 && Date.now() - state.fetchedAt < STAFF_CACHE_TTL_MS;

    if (!force && isFresh && (state.staffMe || state.shifts.length > 0)) {
      return { staffMe: state.staffMe, shifts: state.shifts, faceStatus: state.faceStatus };
    }

    if (!force && inFlightPromise && inFlightKey === scope) {
      return inFlightPromise;
    }

    set({
      isLoading: true,
      ...(sameScope ? {} : { scopeKey: scope, staffMe: null, shifts: [], faceStatus: null }),
    });

    const reqPromise = (async () => {
      try {
        const [staffMe, shifts] = await Promise.all([
          staffApi.getStaffMe().catch(() => null),
          staffApi.getAllStaffShifts().catch(() => [] as ShiftResponse[]),
        ]);

        if (currentScopeKey() !== scope) {
          return { staffMe: null, shifts: [], faceStatus: null };
        }

        const accountId =
          staffMe?.account?.accountId || useAuthStore.getState().user?.accountId;
        const faceStatus = accountId
          ? await staffApi.getFaceStatus(accountId).catch(() => null)
          : null;

        if (currentScopeKey() !== scope) {
          return { staffMe: null, shifts: [], faceStatus: null };
        }

        const syncedStaffMe = mergeFaceStatusIntoStaffMe(staffMe, faceStatus);

        if (syncedStaffMe?.account) {
          useAuthStore.setState({ user: syncedStaffMe.account });
        }

        set({
          scopeKey: scope,
          staffMe: syncedStaffMe,
          shifts,
          faceStatus,
          fetchedAt: Date.now(),
          isLoading: false,
        });
        return { staffMe: syncedStaffMe, shifts, faceStatus };
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
