import { Router } from 'express';
import { pool } from '../db';
import { RewardRow, rowToReward } from '../mappers';
import { requireAdmin } from '../helpers/guards';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const hId = req.householdId;
    const { rows } = hId
      ? await pool.query<RewardRow>('SELECT * FROM rewards WHERE household_id = $1 ORDER BY created_at DESC', [hId])
      : await pool.query<RewardRow>('SELECT * FROM rewards ORDER BY created_at DESC');
    res.json(rows.map(rowToReward));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query<RewardRow>('SELECT * FROM rewards WHERE id = $1', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: `Reward ${req.params.id} not found.` }); return; }
    res.json(rowToReward(rows[0]));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { id, title, description, cost, icon } = req.body;
    const householdId = req.householdId ?? req.body.householdId;
    const { rows } = await pool.query<RewardRow>(
      `INSERT INTO rewards (id, household_id, title, description, cost, icon, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7) RETURNING *`,
      [id, householdId, title, description ?? null, cost, icon ?? null, new Date().toISOString()],
    );
    res.status(201).json(rowToReward(rows[0]));
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { title, description, cost, icon } = req.body;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description); }
    if (cost !== undefined) { sets.push(`cost = $${idx++}`); vals.push(cost); }
    if (icon !== undefined) { sets.push(`icon = $${idx++}`); vals.push(icon); }

    if (sets.length === 0) { res.status(422).json({ error: 'No fields to update.' }); return; }

    vals.push(req.params.id);
    const { rows } = await pool.query<RewardRow>(
      `UPDATE rewards SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    if (rows.length === 0) throw new Error(`Reward ${req.params.id} not found.`);
    res.json(rowToReward(rows[0]));
  } catch (e) { next(e); }
});

router.post('/:id/archive', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { rows } = await pool.query<RewardRow>(
      'UPDATE rewards SET is_active = false WHERE id = $1 RETURNING *',
      [req.params.id],
    );
    if (rows.length === 0) throw new Error(`Reward ${req.params.id} not found.`);
    res.json(rowToReward(rows[0]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { rows: [countRow] } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM redemptions WHERE reward_id = $1', [req.params.id],
    );
    if (parseInt(countRow.count) > 0) {
      throw new Error(`Cannot delete reward: still referenced by ${countRow.count} redemption(s). Archive it instead.`);
    }
    const { rowCount } = await pool.query('DELETE FROM rewards WHERE id = $1', [req.params.id]);
    if (rowCount === 0) throw new Error(`Reward ${req.params.id} not found.`);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
