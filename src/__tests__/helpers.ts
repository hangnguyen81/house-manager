import { setState } from '@/data/store';
import { mockHouseholds, mockMembers, mockChores, mockSupplies, defaultSettings, mockChoreTemplates, mockRewards, mockRedemptions } from '@/data/mockSeed';

/**
 * Reset the Zustand store to seed data with h1 active and m1 (admin) as actor.
 * Call in beforeEach() for a clean slate.
 */
export function resetStore(options?: { activeMemberId?: string }) {
  setState({
    households: structuredClone(mockHouseholds),
    members: structuredClone(mockMembers),
    chores: structuredClone(mockChores),
    supplies: structuredClone(mockSupplies),
    choreTemplates: structuredClone(mockChoreTemplates),
    rewards: structuredClone(mockRewards),
    redemptions: structuredClone(mockRedemptions),
    settings: structuredClone(defaultSettings),
    activeHouseholdId: 'h1',
    activeMemberId: options?.activeMemberId ?? 'm1', // Mom (admin) by default
  });
}
