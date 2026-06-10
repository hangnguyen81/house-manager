import { getState } from '../store';
import { api } from '@/api';
import type { ChoreTemplate, ChoreCategory } from '@/types';

function actorId(): string {
  return getState().activeMemberId ?? '';
}

export const choreTemplateRepo = {
  list(): ChoreTemplate[] {
    return api.listChoreTemplates();
  },

  listByCategory(category: ChoreCategory): ChoreTemplate[] {
    return api.listChoreTemplates().filter((t) => t.category === category);
  },

  add(input: { title: string; category: ChoreCategory }): ChoreTemplate {
    return api.createChoreTemplate(actorId(), input);
  },

  edit(id: string, patch: { title?: string; category?: ChoreCategory }): ChoreTemplate {
    return api.updateChoreTemplate(actorId(), id, patch);
  },

  remove(id: string): void {
    api.removeChoreTemplate(actorId(), id);
  },
};
