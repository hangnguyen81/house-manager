import { getState } from '../store';
import { api } from '@/api';
import type { Member, Role } from '@/types';

function actorId(): string {
  return getState().activeMemberId ?? '';
}

export const memberRepo = {
  list(): Member[] {
    return api.listMembers();
  },

  get(id: string): Member | undefined {
    return api.getMember(id);
  },

  add(input: { name: string; role: Role; color: string; avatarUrl?: string }): Member {
    return api.createMember(actorId(), input);
  },

  update(id: string, patch: Partial<Omit<Member, 'id'>>): Member {
    return api.updateMember(actorId(), id, patch);
  },

  setPin(id: string, pin: string | undefined): Member {
    return api.setMemberPin(id, pin);
  },

  verifyPin(id: string, input: string): boolean {
    return api.verifyMemberPin(id, input);
  },

  adjustPoints(memberId: string, delta: number): Member {
    return api.adjustMemberPoints(actorId(), memberId, delta);
  },

  remove(id: string): void {
    api.removeMember(actorId(), id);
  },
};
