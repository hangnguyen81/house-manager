import { getState } from '../store';
import { api } from '@/api';
import { scheduleChoreReminder, cancelNotification } from '@/utils/notifications';
import type { Chore, Recurrence } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// Chore repository — thin wrapper over the API backend.
// Handles client-side concerns (notifications). All data logic is in the backend.
// ─────────────────────────────────────────────────────────────────────────────

function actorId(): string {
  return getState().activeMemberId ?? '';
}

export const choreRepo = {
  list(): Chore[] {
    return api.listChores();
  },

  listForMember(memberId: string): Chore[] {
    return api.listChores().filter((c) => c.assigneeId === memberId);
  },

  get(id: string): Chore | undefined {
    return api.getChore(id);
  },

  create(input: { title: string; assigneeId: string; description?: string; dueDate?: string; recurrence?: Recurrence; pointsOverride?: number }): Chore {
    const chore = api.createChore(actorId(), input);
    if (input.dueDate) {
      scheduleChoreReminder(chore.id, chore.title, input.dueDate).then((nId) => {
        if (nId) api.updateChore(actorId(), chore.id, { notificationId: nId } as any);
      });
    }
    return chore;
  },

  edit(id: string, input: { title?: string; description?: string; assigneeId?: string; dueDate?: string; recurrence?: Recurrence; pointsOverride?: number }): Chore {
    return api.updateChore(actorId(), id, input);
  },

  assign(id: string, assigneeId: string): Chore {
    return api.updateChore(actorId(), id, { assigneeId });
  },

  start(id: string): Chore {
    return api.startChore(actorId(), id);
  },

  complete(id: string): { completed: Chore; pointsAwarded: number } {
    const chore = api.getChore(id);
    if (chore?.notificationId) cancelNotification(chore.notificationId);

    const { completed, spawned, pointsAwarded } = api.completeChore(actorId(), id);

    if (spawned?.dueDate) {
      scheduleChoreReminder(spawned.id, spawned.title, spawned.dueDate).then((nId) => {
        if (nId) api.updateChore(actorId(), spawned.id, { notificationId: nId } as any);
      });
    }

    return { completed, pointsAwarded };
  },

  reopen(id: string): Chore {
    return api.reopenChore(actorId(), id);
  },

  remove(id: string): void {
    const chore = api.getChore(id);
    if (chore?.notificationId) cancelNotification(chore.notificationId);
    api.removeChore(actorId(), id);
  },
};
