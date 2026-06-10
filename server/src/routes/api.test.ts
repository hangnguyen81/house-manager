import { describe, it, expect } from 'vitest';
import { request, adminHeaders, memberHeaders } from '../__tests__/helpers';
import { pool } from '../db';

// ── Households ──────────────────────────────────────────────────────────────

describe('GET /api/households', () => {
  it('lists households', async () => {
    const res = await request.get('/api/households');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('The Family');
  });
});

describe('POST /api/households', () => {
  it('creates a household with settings', async () => {
    const res = await request.post('/api/households')
      .set(adminHeaders)
      .send({ id: 'h2', name: 'Test House' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test House');

    // Verify settings auto-created
    const settings = await request.get('/api/settings').set({ 'X-Household-Id': 'h2' });
    expect(settings.status).toBe(200);
    expect(settings.body.householdId).toBe('h2');
  });
});

describe('DELETE /api/households/:id', () => {
  it('blocks deleting household with members', async () => {
    const res = await request.delete('/api/households/h1').set(adminHeaders);
    expect(res.status).toBe(409);
  });

  it('deletes empty household', async () => {
    await request.post('/api/households').set(adminHeaders).send({ id: 'h_empty', name: 'Empty' });
    const res = await request.delete('/api/households/h_empty').set(adminHeaders);
    expect(res.status).toBe(204);
  });
});

// ── Members ─────────────────────────────────────────────────────────────────

describe('GET /api/members', () => {
  it('lists members scoped to household', async () => {
    const res = await request.get('/api/members').set({ 'X-Household-Id': 'h1' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.every((m: any) => m.householdId === 'h1')).toBe(true);
  });
});

describe('POST /api/members', () => {
  it('creates member (admin)', async () => {
    const res = await request.post('/api/members')
      .set(adminHeaders)
      .send({ id: 'm5', name: 'New', role: 'member', color: '#000' });
    expect(res.status).toBe(201);
    expect(res.body.points).toBe(0);
  });

  it('rejects non-admin', async () => {
    const res = await request.post('/api/members')
      .set(memberHeaders)
      .send({ id: 'm6', name: 'X', role: 'member', color: '#000' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/members/:id', () => {
  it('blocks deleting member with chores', async () => {
    // Create a chore referencing m4
    await request.post('/api/chores').set(adminHeaders)
      .send({ id: 'cx1', title: 'Task', assigneeId: 'm4' });
    const res = await request.delete('/api/members/m4').set(adminHeaders);
    expect(res.status).toBe(409);
  });

  it('blocks removing last admin', async () => {
    // Remove m2 first (second admin, no refs)
    await request.delete('/api/members/m2').set(adminHeaders);
    const res = await request.delete('/api/members/m1').set(adminHeaders);
    expect(res.status).toBe(422);
  });
});

describe('POST /api/members/:id/adjust-points', () => {
  it('adjusts points (admin)', async () => {
    const res = await request.post('/api/members/m3/adjust-points')
      .set(adminHeaders)
      .send({ delta: 25 });
    expect(res.status).toBe(200);
    expect(res.body.points).toBe(25);
  });

  it('rejects non-admin', async () => {
    const res = await request.post('/api/members/m3/adjust-points')
      .set(memberHeaders)
      .send({ delta: 10 });
    expect(res.status).toBe(403);
  });
});

describe('PIN management', () => {
  it('sets and verifies PIN', async () => {
    await request.put('/api/members/m3/pin').set(adminHeaders).send({ pin: '1234' });
    const valid = await request.post('/api/members/m3/verify-pin').send({ pin: '1234' });
    expect(valid.body.valid).toBe(true);
    const invalid = await request.post('/api/members/m3/verify-pin').send({ pin: '0000' });
    expect(invalid.body.valid).toBe(false);
  });
});

// ── Chores ───────────────────────────────────────────────────────────────────

describe('POST /api/chores', () => {
  it('creates chore (admin)', async () => {
    const res = await request.post('/api/chores')
      .set(adminHeaders)
      .send({ id: 'c1', title: 'Dishes', assigneeId: 'm3' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('assigned');
  });

  it('creates chore with pointsOverride', async () => {
    const res = await request.post('/api/chores')
      .set(adminHeaders)
      .send({ id: 'c2', title: 'Special', assigneeId: 'm3', pointsOverride: 42 });
    expect(res.status).toBe(201);
    expect(res.body.pointsOverride).toBe(42);
  });

  it('rejects non-admin', async () => {
    const res = await request.post('/api/chores')
      .set(memberHeaders)
      .send({ id: 'cx', title: 'X', assigneeId: 'm3' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/chores/:id/start', () => {
  it('assignee can start', async () => {
    await request.post('/api/chores').set(adminHeaders)
      .send({ id: 'cs1', title: 'Start me', assigneeId: 'm3' });
    const res = await request.post('/api/chores/cs1/start').set(memberHeaders);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('non-assignee non-admin rejected', async () => {
    await request.post('/api/chores').set(adminHeaders)
      .send({ id: 'cs2', title: 'Not mine', assigneeId: 'm4' });
    const res = await request.post('/api/chores/cs2/start').set(memberHeaders); // m3 tries m4's chore
    expect(res.status).toBe(403);
  });
});

describe('POST /api/chores/:id/complete', () => {
  it('completes and awards points', async () => {
    await request.post('/api/chores').set(adminHeaders)
      .send({ id: 'cc1', title: 'Complete me', assigneeId: 'm3', recurrence: 'daily' });
    const res = await request.post('/api/chores/cc1/complete').set(memberHeaders);
    expect(res.status).toBe(200);
    expect(res.body.completed.status).toBe('completed');
    expect(res.body.pointsAwarded).toBe(5); // default daily

    // Verify points incremented
    const member = await request.get('/api/members/m3');
    expect(member.body.points).toBe(5);
  });

  it('uses pointsOverride when set', async () => {
    await request.post('/api/chores').set(adminHeaders)
      .send({ id: 'cc2', title: 'Override', assigneeId: 'm3', pointsOverride: 99 });
    const res = await request.post('/api/chores/cc2/complete').set(memberHeaders);
    expect(res.body.pointsAwarded).toBe(99);
  });

  it('spawns next for recurring chore', async () => {
    await request.post('/api/chores').set(adminHeaders)
      .send({ id: 'cc3', title: 'Weekly', assigneeId: 'm3', recurrence: 'weekly', dueDate: '2026-07-01' });
    const res = await request.post('/api/chores/cc3/complete')
      .set(memberHeaders)
      .send({ spawnedId: 'cc3_next' });
    expect(res.body.spawned).toBeDefined();
    expect(res.body.spawned.recurrence).toBe('weekly');
  });
});

describe('POST /api/chores/:id/reopen', () => {
  it('reopens (admin)', async () => {
    await request.post('/api/chores').set(adminHeaders)
      .send({ id: 'cr1', title: 'Reopen me', assigneeId: 'm3' });
    await request.post('/api/chores/cr1/complete').set(memberHeaders);
    const res = await request.post('/api/chores/cr1/reopen').set(adminHeaders);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('assigned');
  });
});

// ── Supplies ────────────────────────────────────────────────────────────────

describe('POST /api/supplies', () => {
  it('member creates as requested', async () => {
    const res = await request.post('/api/supplies')
      .set(memberHeaders)
      .send({ id: 'su1', name: 'Milk' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('requested');
  });

  it('admin creates as auto-approved', async () => {
    const res = await request.post('/api/supplies')
      .set(adminHeaders)
      .send({ id: 'su2', name: 'Juice' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('approved');
    expect(res.body.decidedById).toBe('m1');
  });
});

describe('supply lifecycle', () => {
  it('approve -> purchase flow', async () => {
    await request.post('/api/supplies').set(memberHeaders).send({ id: 'sl1', name: 'Eggs' });
    await request.post('/api/supplies/sl1/approve').set(adminHeaders);
    const res = await request.post('/api/supplies/sl1/purchased').set(adminHeaders);
    expect(res.body.status).toBe('purchased');
  });

  it('reject with reason', async () => {
    await request.post('/api/supplies').set(memberHeaders).send({ id: 'sl2', name: 'Candy' });
    const res = await request.post('/api/supplies/sl2/reject')
      .set(adminHeaders)
      .send({ reason: 'Too sugary' });
    expect(res.body.status).toBe('rejected');
    expect(res.body.rejectionReason).toBe('Too sugary');
  });

  it('unapprove returns to requested', async () => {
    await request.post('/api/supplies').set(memberHeaders).send({ id: 'sl3', name: 'Soap' });
    await request.post('/api/supplies/sl3/approve').set(adminHeaders);
    const res = await request.post('/api/supplies/sl3/unapprove').set(adminHeaders);
    expect(res.body.status).toBe('requested');
  });

  it('cannot edit approved supply', async () => {
    await request.post('/api/supplies').set(memberHeaders).send({ id: 'sl4', name: 'X' });
    await request.post('/api/supplies/sl4/approve').set(adminHeaders);
    const res = await request.patch('/api/supplies/sl4').set(adminHeaders).send({ name: 'Y' });
    expect(res.status).toBe(422);
  });

  it('cancel removes supply', async () => {
    await request.post('/api/supplies').set(memberHeaders).send({ id: 'sl5', name: 'X' });
    const res = await request.delete('/api/supplies/sl5').set(memberHeaders);
    expect(res.status).toBe(204);
    const get = await request.get('/api/supplies/sl5');
    expect(get.status).toBe(404);
  });
});

// ── Rewards ─────────────────────────────────────────────────────────────────

describe('POST /api/rewards', () => {
  it('creates reward (admin)', async () => {
    const res = await request.post('/api/rewards')
      .set(adminHeaders)
      .send({ id: 'r1', title: 'Screen time', cost: 20 });
    expect(res.status).toBe(201);
    expect(res.body.isActive).toBe(true);
  });

  it('rejects non-admin', async () => {
    const res = await request.post('/api/rewards')
      .set(memberHeaders)
      .send({ id: 'rx', title: 'X', cost: 5 });
    expect(res.status).toBe(403);
  });
});

describe('reward lifecycle', () => {
  it('archive reward', async () => {
    await request.post('/api/rewards').set(adminHeaders).send({ id: 'ra1', title: 'A', cost: 10 });
    const res = await request.post('/api/rewards/ra1/archive').set(adminHeaders);
    expect(res.body.isActive).toBe(false);
  });

  it('delete reward with no redemptions', async () => {
    await request.post('/api/rewards').set(adminHeaders).send({ id: 'rd1', title: 'Del', cost: 5 });
    const res = await request.delete('/api/rewards/rd1').set(adminHeaders);
    expect(res.status).toBe(204);
  });

  it('blocks deleting reward with redemptions', async () => {
    await request.post('/api/rewards').set(adminHeaders).send({ id: 'rb1', title: 'Blocked', cost: 5 });
    await pool.query('UPDATE members SET points = 100 WHERE id = $1', ['m3']);
    await request.post('/api/redemptions').set(memberHeaders).send({ rewardId: 'rb1' });
    const res = await request.delete('/api/rewards/rb1').set(adminHeaders);
    expect(res.status).toBe(409);
  });
});

// ── Redemptions ─────────────────────────────────────────────────────────────

describe('POST /api/redemptions', () => {
  it('redeems and deducts points', async () => {
    await request.post('/api/rewards').set(adminHeaders).send({ id: 'rr1', title: 'Prize', cost: 20 });
    await pool.query('UPDATE members SET points = 50 WHERE id = $1', ['m3']);

    const res = await request.post('/api/redemptions')
      .set(memberHeaders)
      .send({ rewardId: 'rr1' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.rewardCost).toBe(20);

    const member = await request.get('/api/members/m3');
    expect(member.body.points).toBe(30);
  });

  it('blocks insufficient points', async () => {
    await request.post('/api/rewards').set(adminHeaders).send({ id: 'rr2', title: 'Expensive', cost: 999 });
    const res = await request.post('/api/redemptions')
      .set(memberHeaders)
      .send({ rewardId: 'rr2' });
    expect(res.status).toBe(409);
  });

  it('blocks archived reward', async () => {
    await request.post('/api/rewards').set(adminHeaders).send({ id: 'rr3', title: 'Archived', cost: 5 });
    await request.post('/api/rewards/rr3/archive').set(adminHeaders);
    await pool.query('UPDATE members SET points = 100 WHERE id = $1', ['m3']);
    const res = await request.post('/api/redemptions')
      .set(memberHeaders)
      .send({ rewardId: 'rr3' });
    expect(res.status).toBe(422);
  });
});

describe('redemption fulfill/reject', () => {
  it('fulfills redemption', async () => {
    await request.post('/api/rewards').set(adminHeaders).send({ id: 'rf1', title: 'Fulfill', cost: 10 });
    await pool.query('UPDATE members SET points = 50 WHERE id = $1', ['m3']);
    const rd = await request.post('/api/redemptions').set(memberHeaders).send({ rewardId: 'rf1', id: 'rd_f1' });

    const res = await request.post('/api/redemptions/rd_f1/fulfill').set(adminHeaders);
    expect(res.body.status).toBe('fulfilled');
    expect(res.body.decidedById).toBe('m1');
  });

  it('rejects and refunds points', async () => {
    await request.post('/api/rewards').set(adminHeaders).send({ id: 'rf2', title: 'Reject', cost: 15 });
    await pool.query('UPDATE members SET points = 50 WHERE id = $1', ['m3']);
    await request.post('/api/redemptions').set(memberHeaders).send({ rewardId: 'rf2', id: 'rd_r1' });

    const memberBefore = await request.get('/api/members/m3');
    const pointsBefore = memberBefore.body.points; // 50 - 15 = 35

    const res = await request.post('/api/redemptions/rd_r1/reject')
      .set(adminHeaders)
      .send({ reason: 'Not today' });
    expect(res.body.status).toBe('rejected');
    expect(res.body.rejectionReason).toBe('Not today');

    const memberAfter = await request.get('/api/members/m3');
    expect(memberAfter.body.points).toBe(pointsBefore + 15);
  });

  it('non-admin cannot fulfill', async () => {
    await request.post('/api/rewards').set(adminHeaders).send({ id: 'rf3', title: 'X', cost: 5 });
    await pool.query('UPDATE members SET points = 50 WHERE id = $1', ['m3']);
    await request.post('/api/redemptions').set(memberHeaders).send({ rewardId: 'rf3', id: 'rd_na' });

    const res = await request.post('/api/redemptions/rd_na/fulfill').set(memberHeaders);
    expect(res.status).toBe(403);
  });
});

// ── Settings ────────────────────────────────────────────────────────────────

describe('settings', () => {
  it('gets settings', async () => {
    const res = await request.get('/api/settings').set({ 'X-Household-Id': 'h1' });
    expect(res.status).toBe(200);
    expect(res.body.pointsDaily).toBe(5);
  });

  it('updates settings', async () => {
    const res = await request.patch('/api/settings')
      .set({ 'X-Household-Id': 'h1', 'Content-Type': 'application/json' })
      .send({ pointsDaily: 99 });
    expect(res.body.pointsDaily).toBe(99);
  });

  it('updated points affect chore completion', async () => {
    await request.patch('/api/settings')
      .set({ 'X-Household-Id': 'h1', 'Content-Type': 'application/json' })
      .send({ pointsWeekly: 50 });

    await request.post('/api/chores').set(adminHeaders)
      .send({ id: 'cp1', title: 'Weekly task', assigneeId: 'm3', recurrence: 'weekly' });
    const res = await request.post('/api/chores/cp1/complete').set(memberHeaders);
    expect(res.body.pointsAwarded).toBe(50);
  });
});

// ── Chore Templates ─────────────────────────────────────────────────────────

describe('chore templates', () => {
  it('creates template (admin)', async () => {
    const res = await request.post('/api/chore-templates')
      .set(adminHeaders)
      .send({ id: 'ct1', title: 'Sweep', category: 'daily' });
    expect(res.status).toBe(201);
  });

  it('lists templates scoped to household', async () => {
    await request.post('/api/chore-templates').set(adminHeaders)
      .send({ id: 'ct2', title: 'Mop', category: 'weekly' });
    const res = await request.get('/api/chore-templates').set({ 'X-Household-Id': 'h1' });
    expect(res.body.every((t: any) => t.householdId === 'h1')).toBe(true);
  });
});
