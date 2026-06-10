import { getState } from '../store';
import { api } from '@/api';
import { sendInstantNotification } from '@/utils/notifications';
import type { SupplyRequest, Urgency, RejectionVisibility } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Supply repository — thin wrapper over the API backend.
// Handles client-side concerns (notifications). All data logic is in the backend.
// ─────────────────────────────────────────────────────────────────────────────

function actorId(): string {
  return getState().activeMemberId ?? '';
}

export const supplyRepo = {
  list(): SupplyRequest[] {
    return api.listSupplies();
  },

  get(id: string): SupplyRequest | undefined {
    return api.getSupply(id);
  },

  flag(input: { name: string; quantity?: string; note?: string; urgency?: Urgency }): SupplyRequest {
    return api.flagSupply(actorId(), input);
  },

  edit(id: string, patch: Partial<Pick<SupplyRequest, 'name' | 'quantity' | 'note' | 'urgency'>>): SupplyRequest {
    return api.editSupply(id, patch);
  },

  cancel(id: string): void {
    api.cancelSupply(id);
  },

  approve(id: string): SupplyRequest {
    const item = api.getSupply(id);
    const result = api.approveSupply(actorId(), id);
    if (item) {
      sendInstantNotification('✅ Supply approved', `"${item.name}" has been approved and added to the shopping list.`, { type: 'supply', supplyId: id });
    }
    return result;
  },

  reject(id: string, reason?: string): SupplyRequest {
    const item = api.getSupply(id);
    const result = api.rejectSupply(actorId(), id, reason);
    if (item) {
      const body = reason ? `"${item.name}" was rejected: ${reason}` : `"${item.name}" was rejected.`;
      sendInstantNotification('❌ Supply rejected', body, { type: 'supply', supplyId: id });
    }
    return result;
  },

  unapprove(id: string): SupplyRequest {
    return api.unapproveSupply(actorId(), id);
  },

  markPurchased(id: string): SupplyRequest {
    return api.markSupplyPurchased(actorId(), id);
  },
};

// ── Derived views (computed, never stored) ──────────────────────────────────

export function shoppingList(): SupplyRequest[] {
  return api.listSupplies()
    .filter((s) => s.status === 'approved')
    .sort(byUrgencyThenDate);
}

export function pendingRequests(): SupplyRequest[] {
  return api.listSupplies()
    .filter((s) => s.status === 'requested')
    .sort(byUrgencyThenDate);
}

export function visibleRejections(now: Date = new Date()): SupplyRequest[] {
  const supplies = api.listSupplies();
  const settings = api.getSettings();
  return supplies.filter(
    (s) => s.status === 'rejected' && isRejectionVisible(s.decidedAt, settings.rejectionVisibility, now),
  );
}

function isRejectionVisible(
  decidedAt: string | undefined,
  visibility: RejectionVisibility,
  now: Date,
): boolean {
  if (visibility === 'forever') return true;
  if (visibility === 'immediate') return false;
  if (!decidedAt) return true;
  const ms = visibility === '1_day' ? 86_400_000 : 604_800_000;
  return now.getTime() - new Date(decidedAt).getTime() < ms;
}

function byUrgencyThenDate(a: SupplyRequest, b: SupplyRequest): number {
  if (a.urgency !== b.urgency) return a.urgency === 'urgent' ? -1 : 1;
  return a.createdAt.localeCompare(b.createdAt);
}
