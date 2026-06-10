import { describe, it, expect, beforeEach } from 'vitest';
import { mockBackend } from './mockBackend';
import { getState, setState } from '@/data/store';
import { resetStore } from '@/__tests__/helpers';

beforeEach(() => resetStore());

// ── Households ──────────────────────────────────────────────────────────────

describe('households', () => {
  it('lists households', () => {
    expect(mockBackend.listHouseholds().length).toBeGreaterThan(0);
  });

  it('creates a household', () => {
    const h = mockBackend.createHousehold('Test House');
    expect(h.name).toBe('Test House');
    expect(mockBackend.getHousehold(h.id)).toBeDefined();
  });

  it('updates a household', () => {
    const updated = mockBackend.updateHousehold('h1', 'Renamed');
    expect(updated.name).toBe('Renamed');
  });

  it('blocks deleting household with members', () => {
    expect(() => mockBackend.removeHousehold('h1')).toThrow('still has members');
  });

  it('deletes empty household', () => {
    const h = mockBackend.createHousehold('Empty');
    mockBackend.removeHousehold(h.id);
    expect(mockBackend.getHousehold(h.id)).toBeUndefined();
  });
});

// ── Members ─────────────────────────────────────────────────────────────────

describe('members', () => {
  it('lists members scoped to active household', () => {
    const members = mockBackend.listMembers();
    expect(members.every((m) => m.householdId === 'h1')).toBe(true);
  });

  it('creates a member with points: 0', () => {
    const m = mockBackend.createMember('m1', { name: 'New', role: 'member', color: '#000' });
    expect(m.points).toBe(0);
    expect(m.householdId).toBe('h1');
  });

  it('non-admin cannot create member', () => {
    expect(() => mockBackend.createMember('m3', { name: 'X', role: 'member', color: '#000' })).toThrow('admin');
  });

  it('blocks deleting member referenced by chores', () => {
    // m4 is assignee of chore c1
    expect(() => mockBackend.removeMember('m1', 'm4')).toThrow('Cannot delete member');
  });

  it('blocks removing last admin', () => {
    // Remove m2 (admin), then try m1 (last admin)
    // First clear references so m2 can be deleted
    setState({ chores: [], supplies: [] });
    mockBackend.removeMember('m1', 'm2');
    expect(() => mockBackend.removeMember('m1', 'm1')).toThrow('last admin');
  });

  it('adjusts member points (admin only)', () => {
    const updated = mockBackend.adjustMemberPoints('m1', 'm3', 25);
    expect(updated.points).toBe(25);
  });

  it('non-admin cannot adjust points', () => {
    expect(() => mockBackend.adjustMemberPoints('m3', 'm3', 10)).toThrow('admin');
  });

  it('sets and verifies PIN', () => {
    mockBackend.setMemberPin('m3', '1234');
    expect(mockBackend.verifyMemberPin('m3', '1234')).toBe(true);
    expect(mockBackend.verifyMemberPin('m3', '0000')).toBe(false);
  });

  it('member without PIN passes verification', () => {
    expect(mockBackend.verifyMemberPin('m3', 'anything')).toBe(true);
  });
});

// ── Chores ───────────────────────────────────────────────────────────────────

describe('chores', () => {
  it('lists chores scoped to active household', () => {
    const chores = mockBackend.listChores();
    expect(chores.every((c) => c.householdId === 'h1')).toBe(true);
  });

  it('creates a chore (admin only)', () => {
    const c = mockBackend.createChore('m1', { title: 'New chore', assigneeId: 'm3' });
    expect(c.status).toBe('assigned');
    expect(c.recurrence).toBe('none');
    expect(c.householdId).toBe('h1');
  });

  it('creates chore with pointsOverride', () => {
    const c = mockBackend.createChore('m1', { title: 'Special', assigneeId: 'm3', pointsOverride: 99 });
    expect(c.pointsOverride).toBe(99);
  });

  it('non-admin cannot create chore', () => {
    expect(() => mockBackend.createChore('m3', { title: 'X', assigneeId: 'm3' })).toThrow('admin');
  });

  it('blocks duplicate active chore', () => {
    mockBackend.createChore('m1', { title: 'Dup', assigneeId: 'm3', dueDate: '2026-07-01' });
    expect(() => mockBackend.createChore('m1', { title: 'Dup', assigneeId: 'm4', dueDate: '2026-07-01' })).toThrow('DUPLICATE');
  });

  it('allows same title on different due dates', () => {
    mockBackend.createChore('m1', { title: 'Task', assigneeId: 'm3', dueDate: '2026-07-01' });
    const c2 = mockBackend.createChore('m1', { title: 'Task', assigneeId: 'm3', dueDate: '2026-07-02' });
    expect(c2).toBeDefined();
  });

  it('starts a chore', () => {
    const started = mockBackend.startChore('m4', 'c1'); // m4 is assignee
    expect(started.status).toBe('in_progress');
  });

  it('non-assignee non-admin cannot start chore', () => {
    expect(() => mockBackend.startChore('m3', 'c1')).toThrow('Only the assignee');
  });

  it('completes chore and awards points', () => {
    // c2 is in_progress, assigned to m3, daily recurrence
    const before = getState().members.find((m) => m.id === 'm3')!.points;
    const { completed, pointsAwarded } = mockBackend.completeChore('m3', 'c2');
    expect(completed.status).toBe('completed');
    expect(pointsAwarded).toBe(5); // daily = 5
    const after = getState().members.find((m) => m.id === 'm3')!.points;
    expect(after).toBe(before + 5);
  });

  it('completes chore with pointsOverride uses override', () => {
    const c = mockBackend.createChore('m1', { title: 'Override', assigneeId: 'm3', pointsOverride: 42 });
    mockBackend.startChore('m3', c.id);
    const { pointsAwarded } = mockBackend.completeChore('m3', c.id);
    expect(pointsAwarded).toBe(42);
  });

  it('completing recurring chore spawns next', () => {
    // c1 is weekly, assigned to m4
    mockBackend.startChore('m4', 'c1');
    const { spawned } = mockBackend.completeChore('m4', 'c1');
    expect(spawned).toBeDefined();
    expect(spawned!.recurrence).toBe('weekly');
    expect(spawned!.status).toBe('assigned');
  });

  it('reopens a completed chore (admin only)', () => {
    mockBackend.startChore('m4', 'c1');
    mockBackend.completeChore('m4', 'c1');
    const reopened = mockBackend.reopenChore('m1', 'c1');
    expect(reopened.status).toBe('assigned');
  });

  it('completing already-completed chore returns 0 points', () => {
    const { pointsAwarded } = mockBackend.completeChore('m1', 'c3'); // c3 already completed
    expect(pointsAwarded).toBe(0);
  });
});

// ── Supplies ────────────────────────────────────────────────────────────────

describe('supplies', () => {
  it('member flags supply as requested', () => {
    const s = mockBackend.flagSupply('m3', { name: 'Bread' });
    expect(s.status).toBe('requested');
    expect(s.requestedById).toBe('m3');
  });

  it('admin flags supply as auto-approved', () => {
    const s = mockBackend.flagSupply('m1', { name: 'Juice' });
    expect(s.status).toBe('approved');
    expect(s.decidedById).toBe('m1');
    expect(s.decidedAt).toBeDefined();
  });

  it('edits a requested supply', () => {
    const s = mockBackend.flagSupply('m3', { name: 'X' });
    const edited = mockBackend.editSupply(s.id, { name: 'Y' });
    expect(edited.name).toBe('Y');
  });

  it('cannot edit approved supply', () => {
    const s = mockBackend.flagSupply('m3', { name: 'X' });
    mockBackend.approveSupply('m1', s.id);
    expect(() => mockBackend.editSupply(s.id, { name: 'Y' })).toThrow('pending');
  });

  it('approve -> mark purchased flow', () => {
    const s = mockBackend.flagSupply('m3', { name: 'Eggs' });
    mockBackend.approveSupply('m1', s.id);
    const purchased = mockBackend.markSupplyPurchased('m1', s.id);
    expect(purchased.status).toBe('purchased');
  });

  it('cannot purchase non-approved item', () => {
    const s = mockBackend.flagSupply('m3', { name: 'Eggs' });
    expect(() => mockBackend.markSupplyPurchased('m1', s.id)).toThrow('approved');
  });

  it('unapprove returns to requested', () => {
    const s = mockBackend.flagSupply('m3', { name: 'Eggs' });
    mockBackend.approveSupply('m1', s.id);
    const result = mockBackend.unapproveSupply('m1', s.id);
    expect(result.status).toBe('requested');
  });

  it('reject supply with reason', () => {
    const s = mockBackend.flagSupply('m3', { name: 'Candy' });
    const rejected = mockBackend.rejectSupply('m1', s.id, 'Too sugary');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Too sugary');
  });

  it('cancel removes supply', () => {
    const s = mockBackend.flagSupply('m3', { name: 'X' });
    mockBackend.cancelSupply(s.id);
    expect(mockBackend.getSupply(s.id)).toBeUndefined();
  });
});

// ── Rewards ─────────────────────────────────────────────────────────────────

describe('rewards', () => {
  it('lists rewards scoped to household', () => {
    const rewards = mockBackend.listRewards();
    expect(rewards.every((r) => r.householdId === 'h1')).toBe(true);
    expect(rewards.length).toBe(4); // seed data
  });

  it('creates a reward (admin only)', () => {
    const r = mockBackend.createReward('m1', { title: 'Ice cream', cost: 10 });
    expect(r.title).toBe('Ice cream');
    expect(r.isActive).toBe(true);
  });

  it('non-admin cannot create reward', () => {
    expect(() => mockBackend.createReward('m3', { title: 'X', cost: 5 })).toThrow('admin');
  });

  it('updates a reward', () => {
    const updated = mockBackend.updateReward('m1', 'r1', { cost: 99 });
    expect(updated.cost).toBe(99);
  });

  it('archives a reward', () => {
    const archived = mockBackend.archiveReward('m1', 'r1');
    expect(archived.isActive).toBe(false);
  });

  it('deletes reward with no redemptions', () => {
    const r = mockBackend.createReward('m1', { title: 'Temp', cost: 1 });
    mockBackend.removeReward('m1', r.id);
    expect(mockBackend.getReward(r.id)).toBeUndefined();
  });

  it('blocks deleting reward with redemptions', () => {
    // Give m3 enough points to redeem
    mockBackend.adjustMemberPoints('m1', 'm3', 100);
    setState({ activeMemberId: 'm3' });
    mockBackend.redeemReward('m3', 'r1');
    expect(() => mockBackend.removeReward('m1', 'r1')).toThrow('referenced');
  });
});

// ── Redemptions ─────────────────────────────────────────────────────────────

describe('redemptions', () => {
  beforeEach(() => {
    // Give m3 enough points
    mockBackend.adjustMemberPoints('m1', 'm3', 100);
  });

  it('redeems reward and deducts points', () => {
    const before = getState().members.find((m) => m.id === 'm3')!.points;
    setState({ activeMemberId: 'm3' });
    const rd = mockBackend.redeemReward('m3', 'r1'); // cost 20
    expect(rd.status).toBe('pending');
    expect(rd.rewardTitle).toBe('Extra screen time');
    expect(rd.rewardCost).toBe(20);
    const after = getState().members.find((m) => m.id === 'm3')!.points;
    expect(after).toBe(before - 20);
  });

  it('blocks redeem with insufficient points', () => {
    resetStore(); // m3 has 0 points
    expect(() => mockBackend.redeemReward('m3', 'r1')).toThrow('Not enough points');
  });

  it('blocks redeem of archived reward', () => {
    mockBackend.archiveReward('m1', 'r1');
    expect(() => mockBackend.redeemReward('m3', 'r1')).toThrow('no longer available');
  });

  it('fulfills a redemption', () => {
    setState({ activeMemberId: 'm3' });
    const rd = mockBackend.redeemReward('m3', 'r1');
    const fulfilled = mockBackend.fulfillRedemption('m1', rd.id);
    expect(fulfilled.status).toBe('fulfilled');
    expect(fulfilled.decidedById).toBe('m1');
  });

  it('rejects redemption and refunds points', () => {
    setState({ activeMemberId: 'm3' });
    const rd = mockBackend.redeemReward('m3', 'r1'); // cost 20
    const pointsAfterRedeem = getState().members.find((m) => m.id === 'm3')!.points;

    const rejected = mockBackend.rejectRedemption('m1', rd.id, 'Not today');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Not today');

    const pointsAfterReject = getState().members.find((m) => m.id === 'm3')!.points;
    expect(pointsAfterReject).toBe(pointsAfterRedeem + 20);
  });

  it('cannot fulfill already fulfilled', () => {
    setState({ activeMemberId: 'm3' });
    const rd = mockBackend.redeemReward('m3', 'r1');
    mockBackend.fulfillRedemption('m1', rd.id);
    expect(() => mockBackend.fulfillRedemption('m1', rd.id)).toThrow('pending');
  });

  it('non-admin cannot fulfill', () => {
    setState({ activeMemberId: 'm3' });
    const rd = mockBackend.redeemReward('m3', 'r1');
    expect(() => mockBackend.fulfillRedemption('m3', rd.id)).toThrow('admin');
  });
});

// ── Settings ────────────────────────────────────────────────────────────────

describe('settings', () => {
  it('gets settings', () => {
    const s = mockBackend.getSettings();
    expect(s.householdId).toBe('h1');
    expect(s.pointsDaily).toBe(5);
  });

  it('updates settings', () => {
    const updated = mockBackend.updateSettings({ pointsDaily: 99 });
    expect(updated.pointsDaily).toBe(99);
    expect(mockBackend.getSettings().pointsDaily).toBe(99);
  });

  it('updated point values affect chore completion', () => {
    mockBackend.updateSettings({ pointsDaily: 50 });
    const c = mockBackend.createChore('m1', { title: 'Test', assigneeId: 'm3', recurrence: 'daily' });
    const { pointsAwarded } = mockBackend.completeChore('m3', c.id);
    expect(pointsAwarded).toBe(50);
  });
});

// ── Chore Templates ─────────────────────────────────────────────────────────

describe('chore templates', () => {
  it('lists templates scoped to household', () => {
    const templates = mockBackend.listChoreTemplates();
    expect(templates.every((t) => t.householdId === 'h1')).toBe(true);
    expect(templates.length).toBe(20); // seed data
  });

  it('creates a template (admin only)', () => {
    const t = mockBackend.createChoreTemplate('m1', { title: 'New task', category: 'daily' });
    expect(t.title).toBe('New task');
  });

  it('non-admin cannot create template', () => {
    expect(() => mockBackend.createChoreTemplate('m3', { title: 'X', category: 'daily' })).toThrow('admin');
  });
});
