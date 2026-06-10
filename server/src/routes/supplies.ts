import { Router } from 'express';
import { pool } from '../db';
import { SupplyRow, rowToSupply } from '../mappers';
import { requireAdmin, requireActor } from '../helpers/guards';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const hId = req.householdId;
    const { rows } = hId
      ? await pool.query<SupplyRow>('SELECT * FROM supply_requests WHERE household_id = $1 ORDER BY created_at DESC', [hId])
      : await pool.query<SupplyRow>('SELECT * FROM supply_requests ORDER BY created_at DESC');
    res.json(rows.map(rowToSupply));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query<SupplyRow>('SELECT * FROM supply_requests WHERE id = $1', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: `Supply ${req.params.id} not found.` }); return; }
    res.json(rowToSupply(rows[0]));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const actor = await requireActor(req.actorId);
    const { id, name, quantity, note, urgency } = req.body;
    const householdId = req.householdId ?? req.body.householdId;
    const now = new Date().toISOString();
    const isAdmin = actor.role === 'admin';
    const { rows } = await pool.query<SupplyRow>(
      `INSERT INTO supply_requests (id, household_id, name, quantity, note, urgency, status, requested_by_id, decided_by_id, decided_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [id, householdId, name, quantity ?? null, note ?? null, urgency ?? 'normal', isAdmin ? 'approved' : 'requested', req.actorId, isAdmin ? req.actorId : null, isAdmin ? now : null, now],
    );
    res.status(201).json(rowToSupply(rows[0]));
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query<SupplyRow>('SELECT * FROM supply_requests WHERE id = $1', [req.params.id]);
    if (existing.length === 0) throw new Error(`Supply ${req.params.id} not found.`);
    if (existing[0].status !== 'requested') throw new Error('Only a pending (requested) item can be edited.');

    const { name, quantity, note, urgency } = req.body;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); vals.push(name); }
    if (quantity !== undefined) { sets.push(`quantity = $${idx++}`); vals.push(quantity); }
    if (note !== undefined) { sets.push(`note = $${idx++}`); vals.push(note); }
    if (urgency !== undefined) { sets.push(`urgency = $${idx++}`); vals.push(urgency); }

    if (sets.length === 0) { res.json(rowToSupply(existing[0])); return; }

    vals.push(req.params.id);
    const { rows } = await pool.query<SupplyRow>(
      `UPDATE supply_requests SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    res.json(rowToSupply(rows[0]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query<SupplyRow>('SELECT * FROM supply_requests WHERE id = $1', [req.params.id]);
    if (existing.length === 0) throw new Error(`Supply ${req.params.id} not found.`);
    if (existing[0].status !== 'requested') throw new Error('Only a pending (requested) item can be cancelled.');
    await pool.query('DELETE FROM supply_requests WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

router.post('/:id/approve', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req.actorId);
    const now = new Date().toISOString();
    const { rows } = await pool.query<SupplyRow>(
      `UPDATE supply_requests SET status = 'approved', decided_by_id = $1, decided_at = $2, rejection_reason = NULL
       WHERE id = $3 RETURNING *`,
      [admin.id, now, req.params.id],
    );
    if (rows.length === 0) throw new Error(`Supply ${req.params.id} not found.`);
    res.json(rowToSupply(rows[0]));
  } catch (e) { next(e); }
});

router.post('/:id/reject', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req.actorId);
    const now = new Date().toISOString();
    const { rows } = await pool.query<SupplyRow>(
      `UPDATE supply_requests SET status = 'rejected', decided_by_id = $1, decided_at = $2, rejection_reason = $3
       WHERE id = $4 RETURNING *`,
      [admin.id, now, req.body.reason ?? null, req.params.id],
    );
    if (rows.length === 0) throw new Error(`Supply ${req.params.id} not found.`);
    res.json(rowToSupply(rows[0]));
  } catch (e) { next(e); }
});

router.post('/:id/unapprove', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { rows } = await pool.query<SupplyRow>(
      `UPDATE supply_requests SET status = 'requested', decided_by_id = NULL, decided_at = NULL
       WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (rows.length === 0) throw new Error(`Supply ${req.params.id} not found.`);
    res.json(rowToSupply(rows[0]));
  } catch (e) { next(e); }
});

router.post('/:id/purchased', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { rows: existing } = await pool.query<SupplyRow>('SELECT * FROM supply_requests WHERE id = $1', [req.params.id]);
    if (existing.length === 0) throw new Error(`Supply ${req.params.id} not found.`);
    if (existing[0].status !== 'approved') throw new Error('Only an approved item can be marked purchased.');
    const { rows } = await pool.query<SupplyRow>(
      `UPDATE supply_requests SET status = 'purchased', purchased_at = $1 WHERE id = $2 RETURNING *`,
      [new Date().toISOString(), req.params.id],
    );
    res.json(rowToSupply(rows[0]));
  } catch (e) { next(e); }
});

export default router;
