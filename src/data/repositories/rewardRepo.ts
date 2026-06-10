import { getState } from '../store';
import { api } from '@/api';
import type { Reward } from '@/types';

function actorId(): string {
  return getState().activeMemberId ?? '';
}

export const rewardRepo = {
  list(): Reward[] {
    return api.listRewards();
  },

  activeRewards(): Reward[] {
    return api.listRewards().filter((r) => r.isActive);
  },

  get(id: string): Reward | undefined {
    return api.getReward(id);
  },

  create(input: { title: string; description?: string; cost: number; icon?: string }): Reward {
    return api.createReward(actorId(), input);
  },

  edit(id: string, input: { title?: string; description?: string; cost?: number; icon?: string }): Reward {
    return api.updateReward(actorId(), id, input);
  },

  archive(id: string): Reward {
    return api.archiveReward(actorId(), id);
  },

  remove(id: string): void {
    api.removeReward(actorId(), id);
  },
};
