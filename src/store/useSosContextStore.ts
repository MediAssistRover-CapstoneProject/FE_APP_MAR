import { create } from 'zustand';
import { buildSosScopeKey, SosCompletedCallRecord } from '../screens/main/sosDecision';

interface SosContextState {
  completedCallsByScope: Record<string, SosCompletedCallRecord>;
  routeInvalidationCounterByScope: Record<string, number>;
  recordCompletedCall: (
    record: SosCompletedCallRecord,
    serverUrl?: string | null,
    accountId?: string | null
  ) => void;
  clearCompletedCall: (
    incidentId: string,
    serverUrl?: string | null,
    accountId?: string | null
  ) => void;
  invalidateRouteForIncident: (
    incidentId: string,
    serverUrl?: string | null,
    accountId?: string | null
  ) => void;
  resetAll: () => void;
}

export const useSosContextStore = create<SosContextState>((set) => ({
  completedCallsByScope: {},
  routeInvalidationCounterByScope: {},

  recordCompletedCall: (record, serverUrl, accountId) =>
    set((state) => {
      const key = buildSosScopeKey({
        serverUrl: serverUrl ?? record.serverUrl,
        accountId: accountId ?? record.accountId,
        incidentId: record.incidentId,
      });
      return {
        completedCallsByScope: {
          ...state.completedCallsByScope,
          [key]: record,
        },
      };
    }),

  clearCompletedCall: (incidentId, serverUrl, accountId) =>
    set((state) => {
      const key = buildSosScopeKey({ serverUrl, accountId, incidentId });
      if (!(key in state.completedCallsByScope)) return state;
      const next = { ...state.completedCallsByScope };
      delete next[key];
      return { completedCallsByScope: next };
    }),

  invalidateRouteForIncident: (incidentId, serverUrl, accountId) =>
    set((state) => {
      const key = buildSosScopeKey({ serverUrl, accountId, incidentId });
      return {
        routeInvalidationCounterByScope: {
          ...state.routeInvalidationCounterByScope,
          [key]: (state.routeInvalidationCounterByScope[key] || 0) + 1,
        },
      };
    }),

  resetAll: () =>
    set({
      completedCallsByScope: {},
      routeInvalidationCounterByScope: {},
    }),
}));
