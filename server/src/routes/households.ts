import { Router } from 'express';
import { pool } from '../db';
import { HouseholdRow, rowToHousehold } from '../mappers';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query<HouseholdRow>('SELECT * FROM households ORDER BY created_at');
    res.json(rows.map(rowToHousehold));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query<HouseholdRow>('SELECT * FROM households WHERE id = $1', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: `Household ${req.params.id} not found.` }); return; }
    res.json(rowToHousehold(rows[0]));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { id, name } = req.body;
    const now = new Date().toISOString();
    const { rows } = await pool.query<HouseholdRow>(
      `INSERT INTO households (id, name, created_at) VALUES ($1, $2, $3) RETURNING *`,
      [id, name, now],
    );
    // Create default settings for the new household
    await pool.query(
      `INSERT INTO household_settings (household_id, id) VALUES ($1, 1) ON CONFLICT DO NOTHING`,
      [id],
    );
    res.status(201).json(rowToHousehold(rows[0]));
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    const { rows } = await pool.query<HouseholdRow>(
      `UPDATE households SET name = $1 WHERE id = $2 RETURNING *`,
      [name, req.params.id],
    );
    if (rows.length === 0) throw new Error(`Household ${req.params.id} not found.`);
    res.json(rowToHousehold(rows[0]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const { rows: members } = await pool.query('SELECT COUNT(*) as count FROM members WHERE household_id = $1', [id]);
    if (parseInt(members[0].count) > 0) {
      throw new Error('Cannot delete a household that still has members.');
    }
    await pool.query('DELETE FROM household_settings WHERE household_id = $1', [id]);
    await pool.query('DELETE FROM households WHERE id = $1', [id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
