import { getState } from '../store';
import { api } from '@/api';
import { sendInstantNotification } from '@/utils/notifications';
import type { Redemption } from '@/types';

function actorId(): string {
  return getState().activeMemberId ?? '';
}

export const redemptionRepo = {
  list(): Redemption[] {
    return api.listRedemptions();
  },

  pendingRedemptions(): Redemption[] {
    return api.listRedemptions().filter((rd) => rd.status === 'pending');
  },

  myRedemptions(memberId: string): Redemption[] {
    return api.listRedemptions().filter((rd) => rd.memberId === memberId);
  },

  redeem(rewardId: string): Redemption {
    return api.redeemReward(actorId(), rewardId);
  },

  fulfill(id: string): Redemption {
    const rd = api.listRedemptions().find((r) => r.id === id);
    const result = api.fulfillRedemption(actorId(), id);
    if (rd) {
      sendInstantNotification('✅ Reward fulfilled', `"${rd.rewardTitle}" has been fulfilled!`, { type: 'reward', redemptionId: id });
    }
    return result;
  },

  reject(id: string, reason?: string): Redemption {
    const rd = api.listRedemptions().find((r) => r.id === id);
    const result = api.rejectRedemption(actorId(), id, reason);
    if (rd) {
      const body = reason ? `"${rd.rewardTitle}" was rejected: ${reason}. Points refunded.` : `"${rd.rewardTitle}" was rejected. Points refunded.`;
      sendInstantNotification('❌ Reward rejected', body, { type: 'reward', redemptionId: id });
    }
    return result;
  },
};
