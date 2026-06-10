/**
 * REST backend — implements ApiBackend with optimistic updates.
 *
 * Reads return from the Zustand store (same as mock).
 * Mutations update the store optimistically, then fire HTTP requests in the background.
 * syncAll() fetches all data from the server and populates the store.
 */
import { getState, setState } from '@/data/store';
import { genId } from '@/utils/id';
import type {
  Household,
  Member,
  Chore,
  ChoreTemplate,
  SupplyRequest,
  HouseholdSettings,
  Recurrence,
  Reward,
  Redemption,
} from '@/types';
import type {
  ApiBackend,
  CreateMemberInput,
  UpdateMemberInput,
  CreateChoreInput,
  UpdateChoreInput,
  CreateChoreTemplateInput,
  UpdateChoreTemplateInput,
  FlagSupplyInput,
  UpdateSupplyInput,
  CreateRewardInput,
  UpdateRewardInput,
} from './contract';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';

// ── HTTP helpers ────────────────────────────────────────────────────────────

function headers(actorId?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (actorId) h['X-Actor-Id'] = actorId;
  const hId = getState().activeHouseholdId;
  if (hId) h['X-Household-Id'] = hId;
  return h;
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res;
}

function fireAndReconcile(
  path: string,
  init: RequestInit,
  reconcile?: (data: unknown) => void,
): void {
  api(path, init)
    .then((res) => {
      if (res.status === 204) return;
      return res.json();
    })
    .then((data) => {
      if (data && reconcile) reconcile(data);
    })
    .catch((err) => console.warn('[restBackend] background sync error:', err.message));
}

// ── Store helpers (same patterns as mockBackend) ────────────────────────────

function activeHouseholdId(): string {
  const id = getState().activeHouseholdId;
  if (!id) throw new Error('No active household selected.');
  return id;
}

function updateChoreInStore(id: string, patch: Partial<Chore>): Chore {
  const chores = getState().chores;
  const idx = chores.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error(`Chore ${id} not found.`);
  const next = { ...chores[idx], ...patch };
  const copy = chores.slice();
  copy[idx] = next;
  setState({ chores: copy });
  return next;
}

function updateSupplyInStore(id: string, patch: Partial<SupplyRequest>): SupplyRequest {
  const supplies = getState().supplies;
  const idx = supplies.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error(`Supply ${id} not found.`);
  const next = { ...supplies[idx], ...patch };
  const copy = supplies.slice();
  copy[idx] = next;
  setState({ supplies: copy });
  return next;
}

function mustGetChore(id: string): Chore {
  const chore = getState().chores.find((c) => c.id === id);
  if (!chore) throw new Error(`Chore ${id} not found.`);
  return chore;
}

function mustGetSupply(id: string): SupplyRequest {
  const item = getState().supplies.find((s) => s.id === id);
  if (!item) throw new Error(`Supply ${id} not found.`);
  return item;
}

function requireAdmin(actorId: string): Member {
  const actor = getState().members.find((m) => m.id === actorId);
  if (!actor) throw new Error('No active member selected.');
  if (actor.role !== 'admin') throw new Error('This action requires an admin.');
  return actor;
}

function requireActor(actorId: string): Member {
  const actor = getState().members.find((m) => m.id === actorId);
  if (!actor) throw new Error('No active member selected.');
  return actor;
}

function ensureMemberNotReferenced(id: string, name: string): void {
  const choreCount = getState().chores.filter(
    (c) => c.assigneeId === id || c.createdById === id,
  ).length;
  const supplyCount = getState().supplies.filter(
    (s) => s.requestedById === id || s.decidedById === id,
  ).length;
  const refs: string[] = [];
  if (choreCount > 0) refs.push(`${choreCount} chore(s)`);
  if (supplyCount > 0) refs.push(`${supplyCount} supply request(s)`);
  if (refs.length > 0) {
    throw new Error(`Cannot delete member "${name}": still referenced by ${refs.join(' and ')}. Reassign or remove them first.`);
  }
}

function ensureNoDuplicateChore(title: string, dueDate: string | undefined, householdId: string, excludeId?: string): void {
  const conflict = getState().chores.find(
    (c) =>
      c.id !== excludeId &&
      c.householdId === householdId &&
      c.title === title &&
      c.status !== 'completed' &&
      (c.dueDate ?? '') === (dueDate ?? ''),
  );
  if (conflict) throw new Error(`DUPLICATE:${title}`);
}

function chorePoints(chore: Chore): number {
  if (chore.pointsOverride != null) return chore.pointsOverride;
  const settings = getState().settings;
  switch (chore.recurrence) {
    case 'daily': return settings.pointsDaily;
    case 'weekly': return settings.pointsWeekly;
    case 'monthly': return settings.pointsMonthly;
    default: return settings.pointsDaily;
  }
}

function updateMemberInStore(id: string, patch: Partial<Member>): Member {
  const members = getState().members;
  const idx = members.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error(`Member ${id} not found.`);
  const next = { ...members[idx], ...patch };
  const copy = members.slice();
  copy[idx] = next;
  setState({ members: copy });
  return next;
}

function nextDueDate(from: string | undefined, recurrence: Recurrence): string {
  const base = from ? new Date(from) : new Date();
  switch (recurrence) {
    case 'daily': base.setDate(base.getDate() + 1); break;
    case 'weekly': base.setDate(base.getDate() + 7); break;
    case 'monthly': base.setMonth(base.getMonth() + 1); break;
    default: break;
  }
  return base.toISOString().slice(0, 10);
}

// ── Reconcile helpers ───────────────────────────────────────────────────────

function reconcileHousehold(data: Household): void {
  const households = getState().households;
  const idx = households.findIndex((h) => h.id === data.id);
  if (idx === -1) return;
  const copy = households.slice();
  copy[idx] = data;
  setState({ households: copy });
}

function reconcileMember(data: Member): void {
  const members = getState().members;
  const idx = members.findIndex((m) => m.id === data.id);
  if (idx === -1) return;
  const copy = members.slice();
  copy[idx] = data;
  setState({ members: copy });
}

function reconcileChore(data: Chore): void {
  const chores = getState().chores;
  const idx = chores.findIndex((c) => c.id === data.id);
  if (idx === -1) return;
  const copy = chores.slice();
  copy[idx] = data;
  setState({ chores: copy });
}

function reconcileSupply(data: SupplyRequest): void {
  const supplies = getState().supplies;
  const idx = supplies.findIndex((s) => s.id === data.id);
  if (idx === -1) return;
  const copy = supplies.slice();
  copy[idx] = data;
  setState({ supplies: copy });
}

function reconcileReward(data: Reward): void {
  const rewards = getState().rewards;
  const idx = rewards.findIndex((r) => r.id === data.id);
  if (idx === -1) return;
  const copy = rewards.slice();
  copy[idx] = data;
  setState({ rewards: copy });
}

function reconcileRedemption(data: Redemption): void {
  const redemptions = getState().redemptions;
  const idx = redemptions.findIndex((rd) => rd.id === data.id);
  if (idx === -1) return;
  const copy = redemptions.slice();
  copy[idx] = data;
  setState({ redemptions: copy });
}

// ── syncAll — full data fetch from server ───────────────────────────────────

export async function syncAll(): Promise<void> {
  try {
    const [householdsRes, membersRes, choresRes, templatesRes, suppliesRes, settingsRes, rewardsRes, redemptionsRes] = await Promise.all([
      api('/households'),
      api('/members'),
      api('/chores'),
      api('/chore-templates'),
      api('/supplies'),
      api('/settings'),
      api('/rewards'),
      api('/redemptions'),
    ]);
    const [households, members, chores, templates, supplies, settings, rewards, redemptions] = await Promise.all([
      householdsRes.json(),
      membersRes.json(),
      choresRes.json(),
      templatesRes.json(),
      suppliesRes.json(),
      settingsRes.json(),
      rewardsRes.json(),
      redemptionsRes.json(),
    ]);
    setState({
      households: households as Household[],
      members: members as Member[],
      chores: chores as Chore[],
      choreTemplates: templates as ChoreTemplate[],
      supplies: supplies as SupplyRequest[],
      settings: settings as HouseholdSettings,
      rewards: rewards as Reward[],
      redemptions: redemptions as Redemption[],
    });
  } catch (err) {
    console.warn('[restBackend] syncAll failed:', err);
  }
}

// ── REST Backend Implementation ─────────────────────────────────────────────

export const restBackend: ApiBackend = {
  // ── Households ──

  listHouseholds() {
    return getState().households;
  },

  getHousehold(id) {
    return getState().households.find((h) => h.id === id);
  },

  createHousehold(name) {
    const id = genId('h');
    const household: Household = { id, name, createdAt: new Date().toISOString() };
    setState({ households: [...getState().households, household] });
    fireAndReconcile('/households', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ id, name }),
    }, (data) => reconcileHousehold(data as Household));
    return household;
  },

  updateHousehold(id, name) {
    const households = getState().households;
    const idx = households.findIndex((h) => h.id === id);
    if (idx === -1) throw new Error(`Household ${id} not found.`);
    const next = { ...households[idx], name };
    const copy = households.slice();
    copy[idx] = next;
    setState({ households: copy });
    fireAndReconcile(`/households/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ name }),
    }, (data) => reconcileHousehold(data as Household));
    return next;
  },

  removeHousehold(id) {
    const memberCount = getState().members.filter((m) => m.householdId === id).length;
    if (memberCount > 0) throw new Error('Cannot delete a household that still has members.');
    setState({ households: getState().households.filter((h) => h.id !== id) });
    if (getState().activeHouseholdId === id) setState({ activeHouseholdId: null });
    fireAndReconcile(`/households/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
  },

  // ── Members ──

  listMembers() {
    const hId = getState().activeHouseholdId;
    return getState().members.filter((m) => m.householdId === hId);
  },

  getMember(id) {
    return getState().members.find((m) => m.id === id);
  },

  createMember(actorId, input) {
    requireAdmin(actorId);
    const hId = activeHouseholdId();
    const id = genId('m');
    const member: Member = { id, householdId: hId, ...input, points: 0 };
    setState({ members: [...getState().members, member] });
    fireAndReconcile('/members', {
      method: 'POST',
      headers: headers(actorId),
      body: JSON.stringify({ id, householdId: hId, ...input }),
    }, (data) => reconcileMember(data as Member));
    return member;
  },

  updateMember(actorId, id, input) {
    requireAdmin(actorId);
    const members = getState().members;
    const idx = members.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Member ${id} not found.`);
    const next = { ...members[idx], ...input };
    const copy = members.slice();
    copy[idx] = next;
    setState({ members: copy });
    fireAndReconcile(`/members/${id}`, {
      method: 'PATCH',
      headers: headers(actorId),
      body: JSON.stringify(input),
    }, (data) => reconcileMember(data as Member));
    return next;
  },

  removeMember(actorId, id) {
    requireAdmin(actorId);
    const hId = getState().activeHouseholdId;
    const members = getState().members.filter((m) => m.householdId === hId);
    const target = members.find((m) => m.id === id);
    if (!target) return;
    if (target.role === 'admin' && members.filter((m) => m.role === 'admin').length <= 1) {
      throw new Error('Cannot remove the last admin.');
    }
    ensureMemberNotReferenced(id, target.name);
    setState({ members: getState().members.filter((m) => m.id !== id) });
    if (getState().activeMemberId === id) setState({ activeMemberId: null });
    fireAndReconcile(`/members/${id}`, {
      method: 'DELETE',
      headers: headers(actorId),
    });
  },

  setMemberPin(id, pin) {
    const members = getState().members;
    const idx = members.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error(`Member ${id} not found.`);
    const next = { ...members[idx], pin };
    const copy = members.slice();
    copy[idx] = next;
    setState({ members: copy });
    fireAndReconcile(`/members/${id}/pin`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ pin }),
    }, (data) => reconcileMember(data as Member));
    return next;
  },

  verifyMemberPin(id, pin) {
    const member = getState().members.find((m) => m.id === id);
    if (!member) return false;
    if (!member.pin) return true;
    return member.pin === pin;
  },

  adjustMemberPoints(actorId, memberId, delta) {
    requireAdmin(actorId);
    const member = getState().members.find((m) => m.id === memberId);
    if (!member) throw new Error(`Member ${memberId} not found.`);
    const updated = updateMemberInStore(memberId, { points: (member.points ?? 0) + delta });
    fireAndReconcile(`/members/${memberId}/adjust-points`, {
      method: 'POST',
      headers: headers(actorId),
      body: JSON.stringify({ delta }),
    }, (data) => reconcileMember(data as Member));
    return updated;
  },

  // ── Chores ──

  listChores() {
    const hId = getState().activeHouseholdId;
    return getState().chores.filter((c) => c.householdId === hId);
  },

  getChore(id) {
    return getState().chores.find((c) => c.id === id);
  },

  createChore(actorId, input) {
    const actor = requireAdmin(actorId);
    const hId = activeHouseholdId();
    ensureNoDuplicateChore(input.title, input.dueDate, hId);
    const id = genId('c');
    const chore: Chore = {
      id,
      householdId: hId,
      title: input.title,
      description: input.description,
      assigneeId: input.assigneeId,
      createdById: actor.id,
      status: 'assigned',
      recurrence: input.recurrence ?? 'none',
      dueDate: input.dueDate,
      createdAt: new Date().toISOString(),
      ...(input.pointsOverride != null && { pointsOverride: input.pointsOverride }),
    };
    setState({ chores: [chore, ...getState().chores] });
    fireAndReconcile('/chores', {
      method: 'POST',
      headers: headers(actorId),
      body: JSON.stringify({ id, householdId: hId, ...input }),
    }, (data) => reconcileChore(data as Chore));
    return chore;
  },

  updateChore(actorId, id, input) {
    requireAdmin(actorId);
    const chore = mustGetChore(id);
    const newTitle = input.title ?? chore.title;
    const newDueDate = input.dueDate !== undefined ? input.dueDate : chore.dueDate;
    ensureNoDuplicateChore(newTitle, newDueDate, chore.householdId, id);
    const updated = updateChoreInStore(id, input);
    fireAndReconcile(`/chores/${id}`, {
      method: 'PATCH',
      headers: headers(actorId),
      body: JSON.stringify(input),
    }, (data) => reconcileChore(data as Chore));
    return updated;
  },

  startChore(actorId, id) {
    const chore = mustGetChore(id);
    const actor = requireActor(actorId);
    if (actor.role !== 'admin' && actor.id !== chore.assigneeId) {
      throw new Error('Only the assignee or an admin can change this chore.');
    }
    if (chore.status !== 'assigned') throw new Error('Only an assigned chore can be started.');
    const updated = updateChoreInStore(id, { status: 'in_progress' });
    fireAndReconcile(`/chores/${id}/start`, {
      method: 'POST',
      headers: headers(actorId),
    }, (data) => reconcileChore(data as Chore));
    return updated;
  },

  completeChore(actorId, id) {
    const chore = mustGetChore(id);
    const actor = requireActor(actorId);
    if (actor.role !== 'admin' && actor.id !== chore.assigneeId) {
      throw new Error('Only the assignee or an admin can change this chore.');
    }
    if (chore.status === 'completed') return { completed: chore, pointsAwarded: 0 };
    const completed = updateChoreInStore(id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      notificationId: undefined,
    });

    // Optimistic points increment
    const pointsAwarded = chorePoints(chore);
    const assignee = getState().members.find((m) => m.id === chore.assigneeId);
    if (assignee) {
      updateMemberInStore(assignee.id, { points: (assignee.points ?? 0) + pointsAwarded });
    }

    let spawned: Chore | undefined;
    if (chore.recurrence !== 'none') {
      const newDueDate = nextDueDate(chore.dueDate, chore.recurrence);
      const hasDuplicate = getState().chores.some(
        (c) =>
          c.householdId === chore.householdId &&
          c.title === chore.title &&
          c.status !== 'completed' &&
          (c.dueDate ?? '') === newDueDate,
      );
      if (!hasDuplicate) {
        const spawnedId = genId('c');
        spawned = {
          id: spawnedId,
          householdId: chore.householdId,
          title: chore.title,
          description: chore.description,
          assigneeId: chore.assigneeId,
          createdById: chore.createdById,
          status: 'assigned',
          recurrence: chore.recurrence,
          dueDate: newDueDate,
          createdAt: new Date().toISOString(),
          ...(chore.pointsOverride != null && { pointsOverride: chore.pointsOverride }),
        };
        setState({ chores: [spawned, ...getState().chores] });

        fireAndReconcile(`/chores/${id}/complete`, {
          method: 'POST',
          headers: headers(actorId),
          body: JSON.stringify({ spawnedId }),
        }, (data) => {
          const result = data as { completed: Chore; spawned?: Chore; pointsAwarded: number };
          reconcileChore(result.completed);
          if (result.spawned) reconcileChore(result.spawned);
        });

        return { completed, spawned, pointsAwarded };
      }
    }

    fireAndReconcile(`/chores/${id}/complete`, {
      method: 'POST',
      headers: headers(actorId),
      body: JSON.stringify({}),
    }, (data) => {
      const result = data as { completed: Chore; spawned?: Chore; pointsAwarded: number };
      reconcileChore(result.completed);
    });

    return { completed, spawned, pointsAwarded };
  },

  reopenChore(actorId, id) {
    requireAdmin(actorId);
    const updated = updateChoreInStore(id, { status: 'assigned', completedAt: undefined });
    fireAndReconcile(`/chores/${id}/reopen`, {
      method: 'POST',
      headers: headers(actorId),
    }, (data) => reconcileChore(data as Chore));
    return updated;
  },

  removeChore(actorId, id) {
    requireAdmin(actorId);
    mustGetChore(id);
    setState({ chores: getState().chores.filter((c) => c.id !== id) });
    fireAndReconcile(`/chores/${id}`, {
      method: 'DELETE',
      headers: headers(actorId),
    });
  },

  // ── Chore Templates ──

  listChoreTemplates() {
    const hId = getState().activeHouseholdId;
    return getState().choreTemplates.filter((t) => t.householdId === hId);
  },

  createChoreTemplate(actorId, input) {
    requireAdmin(actorId);
    const hId = activeHouseholdId();
    const id = genId('ct');
    const template: ChoreTemplate = { id, householdId: hId, ...input };
    setState({ choreTemplates: [...getState().choreTemplates, template] });
    fireAndReconcile('/chore-templates', {
      method: 'POST',
      headers: headers(actorId),
      body: JSON.stringify({ id, householdId: hId, ...input }),
    });
    return template;
  },

  updateChoreTemplate(actorId, id, input) {
    requireAdmin(actorId);
    const templates = getState().choreTemplates;
    const idx = templates.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error(`Chore template ${id} not found.`);
    const next = { ...templates[idx], ...input };
    const copy = templates.slice();
    copy[idx] = next;
    setState({ choreTemplates: copy });
    fireAndReconcile(`/chore-templates/${id}`, {
      method: 'PATCH',
      headers: headers(actorId),
      body: JSON.stringify(input),
    });
    return next;
  },

  removeChoreTemplate(actorId, id) {
    requireAdmin(actorId);
    setState({ choreTemplates: getState().choreTemplates.filter((t) => t.id !== id) });
    fireAndReconcile(`/chore-templates/${id}`, {
      method: 'DELETE',
      headers: headers(actorId),
    });
  },

  // ── Supplies ──

  listSupplies() {
    const hId = getState().activeHouseholdId;
    return getState().supplies.filter((s) => s.householdId === hId);
  },

  getSupply(id) {
    return getState().supplies.find((s) => s.id === id);
  },

  flagSupply(actorId, input) {
    const actor = requireActor(actorId);
    const hId = activeHouseholdId();
    const id = genId('s');
    const now = new Date().toISOString();
    const isAdmin = actor.role === 'admin';
    const item: SupplyRequest = {
      id,
      householdId: hId,
      name: input.name,
      quantity: input.quantity,
      note: input.note,
      urgency: input.urgency ?? 'normal',
      status: isAdmin ? 'approved' : 'requested',
      requestedById: actorId,
      createdAt: now,
      ...(isAdmin && { decidedById: actorId, decidedAt: now }),
    };
    setState({ supplies: [item, ...getState().supplies] });
    fireAndReconcile('/supplies', {
      method: 'POST',
      headers: headers(actorId),
      body: JSON.stringify({ id, householdId: hId, ...input }),
    }, (data) => reconcileSupply(data as SupplyRequest));
    return item;
  },

  editSupply(id, input) {
    const item = mustGetSupply(id);
    if (item.status !== 'requested') throw new Error('Only a pending (requested) item can be edited.');
    const updated = updateSupplyInStore(id, input);
    fireAndReconcile(`/supplies/${id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(input),
    }, (data) => reconcileSupply(data as SupplyRequest));
    return updated;
  },

  cancelSupply(id) {
    const item = mustGetSupply(id);
    if (item.status !== 'requested') throw new Error('Only a pending (requested) item can be cancelled.');
    setState({ supplies: getState().supplies.filter((s) => s.id !== id) });
    fireAndReconcile(`/supplies/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
  },

  approveSupply(actorId, id) {
    const admin = requireAdmin(actorId);
    const updated = updateSupplyInStore(id, {
      status: 'approved',
      decidedById: admin.id,
      decidedAt: new Date().toISOString(),
      rejectionReason: undefined,
    });
    fireAndReconcile(`/supplies/${id}/approve`, {
      method: 'POST',
      headers: headers(actorId),
    }, (data) => reconcileSupply(data as SupplyRequest));
    return updated;
  },

  rejectSupply(actorId, id, reason?) {
    const admin = requireAdmin(actorId);
    const updated = updateSupplyInStore(id, {
      status: 'rejected',
      decidedById: admin.id,
      decidedAt: new Date().toISOString(),
      rejectionReason: reason,
    });
    fireAndReconcile(`/supplies/${id}/reject`, {
      method: 'POST',
      headers: headers(actorId),
      body: JSON.stringify({ reason }),
    }, (data) => reconcileSupply(data as SupplyRequest));
    return updated;
  },

  unapproveSupply(actorId, id) {
    requireAdmin(actorId);
    const updated = updateSupplyInStore(id, { status: 'requested', decidedById: undefined, decidedAt: undefined });
    fireAndReconcile(`/supplies/${id}/unapprove`, {
      method: 'POST',
      headers: headers(actorId),
    }, (data) => reconcileSupply(data as SupplyRequest));
    return updated;
  },

  markSupplyPurchased(actorId, id) {
    requireAdmin(actorId);
    const item = mustGetSupply(id);
    if (item.status !== 'approved') throw new Error('Only an approved item can be marked purchased.');
    const updated = updateSupplyInStore(id, { status: 'purchased', purchasedAt: new Date().toISOString() });
    fireAndReconcile(`/supplies/${id}/purchased`, {
      method: 'POST',
      headers: headers(actorId),
    }, (data) => reconcileSupply(data as SupplyRequest));
    return updated;
  },

  // ── Rewards ──

  listRewards() {
    const hId = getState().activeHouseholdId;
    return getState().rewards.filter((r) => r.householdId === hId);
  },

  getReward(id) {
    return getState().rewards.find((r) => r.id === id);
  },

  createReward(actorId, input) {
    requireAdmin(actorId);
    const hId = activeHouseholdId();
    const id = genId('r');
    const reward: Reward = {
      id, householdId: hId, title: input.title, description: input.description,
      cost: input.cost, icon: input.icon, isActive: true, createdAt: new Date().toISOString(),
    };
    setState({ rewards: [reward, ...getState().rewards] });
    fireAndReconcile('/rewards', {
      method: 'POST', headers: headers(actorId),
      body: JSON.stringify({ id, householdId: hId, ...input }),
    }, (data) => reconcileReward(data as Reward));
    return reward;
  },

  updateReward(actorId, id, input) {
    requireAdmin(actorId);
    const rewards = getState().rewards;
    const idx = rewards.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Reward ${id} not found.`);
    const next = { ...rewards[idx], ...input };
    const copy = rewards.slice();
    copy[idx] = next;
    setState({ rewards: copy });
    fireAndReconcile(`/rewards/${id}`, {
      method: 'PATCH', headers: headers(actorId),
      body: JSON.stringify(input),
    }, (data) => reconcileReward(data as Reward));
    return next;
  },

  archiveReward(actorId, id) {
    requireAdmin(actorId);
    const rewards = getState().rewards;
    const idx = rewards.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Reward ${id} not found.`);
    const next = { ...rewards[idx], isActive: false };
    const copy = rewards.slice();
    copy[idx] = next;
    setState({ rewards: copy });
    fireAndReconcile(`/rewards/${id}/archive`, {
      method: 'POST', headers: headers(actorId),
    }, (data) => reconcileReward(data as Reward));
    return next;
  },

  removeReward(actorId, id) {
    requireAdmin(actorId);
    const redemptionCount = getState().redemptions.filter((rd) => rd.rewardId === id).length;
    if (redemptionCount > 0) {
      throw new Error(`Cannot delete reward: still referenced by ${redemptionCount} redemption(s). Archive it instead.`);
    }
    setState({ rewards: getState().rewards.filter((r) => r.id !== id) });
    fireAndReconcile(`/rewards/${id}`, { method: 'DELETE', headers: headers(actorId) });
  },

  // ── Redemptions ──

  listRedemptions() {
    const hId = getState().activeHouseholdId;
    return getState().redemptions.filter((rd) => rd.householdId === hId);
  },

  redeemReward(actorId, rewardId) {
    const actor = requireActor(actorId);
    const reward = getState().rewards.find((r) => r.id === rewardId);
    if (!reward) throw new Error(`Reward ${rewardId} not found.`);
    if (!reward.isActive) throw new Error('This reward is no longer available.');
    if ((actor.points ?? 0) < reward.cost) {
      throw new Error(`Not enough points (need ${reward.cost}, have ${actor.points ?? 0}).`);
    }
    updateMemberInStore(actor.id, { points: (actor.points ?? 0) - reward.cost });
    const id = genId('rd');
    const redemption: Redemption = {
      id, householdId: reward.householdId, rewardId: reward.id,
      rewardTitle: reward.title, rewardCost: reward.cost, memberId: actor.id,
      status: 'pending', redeemedAt: new Date().toISOString(),
    };
    setState({ redemptions: [redemption, ...getState().redemptions] });
    fireAndReconcile('/redemptions', {
      method: 'POST', headers: headers(actorId),
      body: JSON.stringify({ id, rewardId }),
    }, (data) => reconcileRedemption(data as Redemption));
    return redemption;
  },

  fulfillRedemption(actorId, id) {
    requireAdmin(actorId);
    const redemptions = getState().redemptions;
    const idx = redemptions.findIndex((rd) => rd.id === id);
    if (idx === -1) throw new Error(`Redemption ${id} not found.`);
    if (redemptions[idx].status !== 'pending') throw new Error('Only a pending redemption can be fulfilled.');
    const next = { ...redemptions[idx], status: 'fulfilled' as const, decidedAt: new Date().toISOString(), decidedById: actorId };
    const copy = redemptions.slice();
    copy[idx] = next;
    setState({ redemptions: copy });
    fireAndReconcile(`/redemptions/${id}/fulfill`, {
      method: 'POST', headers: headers(actorId),
    }, (data) => reconcileRedemption(data as Redemption));
    return next;
  },

  rejectRedemption(actorId, id, reason?) {
    requireAdmin(actorId);
    const redemptions = getState().redemptions;
    const idx = redemptions.findIndex((rd) => rd.id === id);
    if (idx === -1) throw new Error(`Redemption ${id} not found.`);
    const rd = redemptions[idx];
    if (rd.status !== 'pending') throw new Error('Only a pending redemption can be rejected.');
    // Refund points
    const member = getState().members.find((m) => m.id === rd.memberId);
    if (member) updateMemberInStore(member.id, { points: (member.points ?? 0) + rd.rewardCost });
    const next = { ...rd, status: 'rejected' as const, decidedAt: new Date().toISOString(), decidedById: actorId, rejectionReason: reason };
    const copy = redemptions.slice();
    copy[idx] = next;
    setState({ redemptions: copy });
    fireAndReconcile(`/redemptions/${id}/reject`, {
      method: 'POST', headers: headers(actorId),
      body: JSON.stringify({ reason }),
    }, (data) => reconcileRedemption(data as Redemption));
    return next;
  },

  // ── Settings ──

  getSettings() {
    return getState().settings;
  },

  updateSettings(patch) {
    const next = { ...getState().settings, ...patch };
    setState({ settings: next });
    fireAndReconcile('/settings', {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(patch),
    });
    return next;
  },
};
