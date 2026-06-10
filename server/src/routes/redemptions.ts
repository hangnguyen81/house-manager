import { Router } from 'express';
import { pool } from '../db';
import { RedemptionRow, RewardRow, MemberRow, rowToRedemption } from '../mappers';
import { requireAdmin, requireActor } from '../helpers/guards';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const hId = req.householdId;
    const { rows } = hId
      ? await pool.query<RedemptionRow>('SELECT * FROM redemptions WHERE household_id = $1 ORDER BY redeemed_at DESC', [hId])
      : await pool.query<RedemptionRow>('SELECT * FROM redemptions ORDER BY redeemed_at DESC');
    res.json(rows.map(rowToRedemption));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const actor = await requireActor(req.actorId);
    const { rewardId } = req.body;
    const householdId = req.householdId ?? req.body.householdId;

    // Get reward
    const { rows: rewardRows } = await pool.query<RewardRow>('SELECT * FROM rewards WHERE id = $1', [rewardId]);
    if (rewardRows.length === 0) throw new Error(`Reward ${rewardId} not found.`);
    const reward = rewardRows[0];
    if (!reward.is_active) throw new Error('This reward is no longer available.');

    // Check points
    const { rows: memberRows } = await pool.query<MemberRow>('SELECT * FROM members WHERE id = $1', [actor.id]);
    const member = memberRows[0];
    if (member.points < reward.cost) {
      throw new Error(`Not enough points (need ${reward.cost}, have ${member.points}).`);
    }

    // Deduct points
    await pool.query('UPDATE members SET points = points - $1 WHERE id = $2', [reward.cost, actor.id]);

    // Create redemption
    const id = req.body.id ?? `rd_${Date.now()}`;
    const now = new Date().toISOString();
    const { rows } = await pool.query<RedemptionRow>(
      `INSERT INTO redemptions (id, household_id, reward_id, reward_title, reward_cost, member_id, status, redeemed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING *`,
      [id, householdId, rewardId, reward.title, reward.cost, actor.id, now],
    );
    res.status(201).json(rowToRedemption(rows[0]));
  } catch (e) { next(e); }
});

router.post('/:id/fulfill', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req.actorId);
    const { rows: existing } = await pool.query<RedemptionRow>('SELECT * FROM redemptions WHERE id = $1', [req.params.id]);
    if (existing.length === 0) throw new Error(`Redemption ${req.params.id} not found.`);
    if (existing[0].status !== 'pending') throw new Error('Only a pending redemption can be fulfilled.');

    const now = new Date().toISOString();
    const { rows } = await pool.query<RedemptionRow>(
      `UPDATE redemptions SET status = 'fulfilled', decided_at = $1, decided_by_id = $2 WHERE id = $3 RETURNING *`,
      [now, admin.id, req.params.id],
    );
    res.json(rowToRedemption(rows[0]));
  } catch (e) { next(e); }
});

router.post('/:id/reject', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req.actorId);
    const { rows: existing } = await pool.query<RedemptionRow>('SELECT * FROM redemptions WHERE id = $1', [req.params.id]);
    if (existing.length === 0) throw new Error(`Redemption ${req.params.id} not found.`);
    if (existing[0].status !== 'pending') throw new Error('Only a pending redemption can be rejected.');

    const now = new Date().toISOString();
    // Refund points
    await pool.query('UPDATE members SET points = points + $1 WHERE id = $2', [existing[0].reward_cost, existing[0].member_id]);

    const { rows } = await pool.query<RedemptionRow>(
      `UPDATE redemptions SET status = 'rejected', decided_at = $1, decided_by_id = $2, rejection_reason = $3 WHERE id = $4 RETURNING *`,
      [now, admin.id, req.body.reason ?? null, req.params.id],
    );
    res.json(rowToRedemption(rows[0]));
  } catch (e) { next(e); }
});

export default router;
