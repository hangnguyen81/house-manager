import { Router } from 'express';
import { pool } from '../db';
import { MemberRow, rowToMember } from '../mappers';
import { requireAdmin } from '../helpers/guards';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const hId = req.householdId;
    const { rows } = hId
      ? await pool.query<MemberRow>('SELECT * FROM members WHERE household_id = $1 ORDER BY id', [hId])
      : await pool.query<MemberRow>('SELECT * FROM members ORDER BY id');
    res.json(rows.map(rowToMember));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query<MemberRow>('SELECT * FROM members WHERE id = $1', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: `Member ${req.params.id} not found.` }); return; }
    res.json(rowToMember(rows[0]));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { id, name, role, color, avatarUrl } = req.body;
    const householdId = req.householdId ?? req.body.householdId;
    const { rows } = await pool.query<MemberRow>(
      `INSERT INTO members (id, household_id, name, role, color, avatar_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, householdId, name, role, color, avatarUrl ?? null],
    );
    res.status(201).json(rowToMember(rows[0]));
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { name, role, color, avatarUrl } = req.body;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name); }
    if (role !== undefined) { sets.push(`role = $${idx++}`); vals.push(role); }
    if (color !== undefined) { sets.push(`color = $${idx++}`); vals.push(color); }
    if (avatarUrl !== undefined) { sets.push(`avatar_url = $${idx++}`); vals.push(avatarUrl); }

    if (sets.length === 0) { res.status(422).json({ error: 'No fields to update.' }); return; }

    vals.push(req.params.id);
    const { rows } = await pool.query<MemberRow>(
      `UPDATE members SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    if (rows.length === 0) throw new Error(`Member ${req.params.id} not found.`);
    res.json(rowToMember(rows[0]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const id = req.params.id;
    const { rows: target } = await pool.query<MemberRow>('SELECT * FROM members WHERE id = $1', [id]);
    if (target.length === 0) { res.status(204).end(); return; }
    if (target[0].role === 'admin') {
      const { rows: admins } = await pool.query(
        'SELECT id FROM members WHERE role = $1 AND household_id = $2',
        ['admin', target[0].household_id],
      );
      if (admins.length <= 1) throw new Error('Cannot remove the last admin.');
    }
    // Check for dependent records before deleting
    const { rows: [choreCount] } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM chores WHERE assignee_id = $1 OR created_by_id = $1', [id],
    );
    const { rows: [supplyCount] } = await pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM supply_requests WHERE requested_by_id = $1 OR decided_by_id = $1', [id],
    );
    const refs: string[] = [];
    if (parseInt(choreCount.count) > 0) refs.push(`${choreCount.count} chore(s)`);
    if (parseInt(supplyCount.count) > 0) refs.push(`${supplyCount.count} supply request(s)`);
    if (refs.length > 0) {
      throw new Error(`Cannot delete member "${target[0].name}": still referenced by ${refs.join(' and ')}. Reassign or remove them first.`);
    }
    await pool.query('DELETE FROM members WHERE id = $1', [id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/adjust-points', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const delta = req.body.delta;
    if (typeof delta !== 'number') { res.status(422).json({ error: 'delta must be a number.' }); return; }
    const { rows } = await pool.query<MemberRow>(
      'UPDATE members SET points = points + $1 WHERE id = $2 RETURNING *',
      [delta, req.params.id],
    );
    if (rows.length === 0) throw new Error(`Member ${req.params.id} not found.`);
    res.json(rowToMember(rows[0]));
  } catch (e) { next(e); }
});

router.put('/:id/pin', async (req, res, next) => {
  try {
    const { pin } = req.body;
    const { rows } = await pool.query<MemberRow>(
      `UPDATE members SET pin = $1 WHERE id = $2 RETURNING *`,
      [pin ?? null, req.params.id],
    );
    if (rows.length === 0) throw new Error(`Member ${req.params.id} not found.`);
    res.json(rowToMember(rows[0]));
  } catch (e) { next(e); }
});

router.post('/:id/verify-pin', async (req, res, next) => {
  try {
    const { rows } = await pool.query<MemberRow>('SELECT * FROM members WHERE id = $1', [req.params.id]);
    if (rows.length === 0) { res.json({ valid: false }); return; }
    const member = rows[0];
    if (!member.pin) { res.json({ valid: true }); return; }
    res.json({ valid: member.pin === req.body.pin });
  } catch (e) { next(e); }
});

export default router;
