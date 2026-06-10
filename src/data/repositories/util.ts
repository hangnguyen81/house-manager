import { getState } from '../store';
import type { Member } from '@/types';

// Returns the currently active member, or throws if none is selected.
export function requireActor(): Member {
  const { activeMemberId, members } = getState();
  const actor = members.find((m) => m.id === activeMemberId);
  if (!actor) throw new Error('No active member selected.');
  return actor;
}

// Guards an admin-only action. Throws if the active member is not an admin.
export function requireAdmin(): Member {
  const actor = requireActor();
  if (actor.role !== 'admin') {
    throw new Error('This action requires an admin.');
  }
  return actor;
}
