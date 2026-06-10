import { useStore } from '@/data/store';
import type { Member } from '@/types';

// Convenience hook for role-aware UI. Components read this to show/hide
// admin-only controls. (Repositories still enforce the rules server-side-style.)
export function useRole(): { actor: Member | null; isAdmin: boolean } {
  const activeMemberId = useStore((s) => s.activeMemberId);
  const members = useStore((s) => s.members);
  const actor = members.find((m) => m.id === activeMemberId) ?? null;
  return { actor, isAdmin: actor?.role === 'admin' };
}
