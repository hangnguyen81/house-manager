import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Household, Member, Chore, SupplyRequest, HouseholdSettings, ChoreTemplate, Reward, Redemption } from '@/types';
import { mockHouseholds, mockMembers, mockChores, mockSupplies, defaultSettings, mockChoreTemplates, mockRewards, mockRedemptions } from './mockSeed';

// The store holds raw state + low-level setters only.
// All business rules live in the repositories (see ./repositories), so screens
// never mutate state directly — they call repo functions and read via selectors.
export interface HouseholdState {
  households: Household[];
  members: Member[];
  chores: Chore[];
  supplies: SupplyRequest[];
  choreTemplates: ChoreTemplate[];
  rewards: Reward[];
  redemptions: Redemption[];
  settings: HouseholdSettings;
  activeHouseholdId: string | null;
  activeMemberId: string | null;

  setHouseholds: (households: Household[]) => void;
  setMembers: (members: Member[]) => void;
  setChores: (chores: Chore[]) => void;
  setSupplies: (supplies: SupplyRequest[]) => void;
  setChoreTemplates: (templates: ChoreTemplate[]) => void;
  setRewards: (rewards: Reward[]) => void;
  setRedemptions: (redemptions: Redemption[]) => void;
  setSettings: (patch: Partial<HouseholdSettings>) => void;
  setActiveHousehold: (id: string | null) => void;
  setActiveMember: (id: string | null) => void;
}

export const useStore = create<HouseholdState>()(
  persist(
    (set) => ({
      households: mockHouseholds,
      members: mockMembers,
      chores: mockChores,
      supplies: mockSupplies,
      choreTemplates: mockChoreTemplates,
      rewards: mockRewards,
      redemptions: mockRedemptions,
      settings: defaultSettings,
      activeHouseholdId: null,
      activeMemberId: null,

      setHouseholds: (households) => set({ households }),
      setMembers: (members) => set({ members }),
      setChores: (chores) => set({ chores }),
      setSupplies: (supplies) => set({ supplies }),
      setChoreTemplates: (templates) => set({ choreTemplates: templates }),
      setRewards: (rewards) => set({ rewards }),
      setRedemptions: (redemptions) => set({ redemptions }),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setActiveHousehold: (id) => set({ activeHouseholdId: id }),
      setActiveMember: (id) => set({ activeMemberId: id }),
    }),
    {
      name: 'household-store-v4',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist data, not setter functions (zustand handles this automatically).
      // partialize excludes nothing — all state fields are persisted.
    },
  ),
);

// Vanilla accessors so repositories can read/write outside React components.
export const getState = useStore.getState;
export const setState = useStore.setState;
