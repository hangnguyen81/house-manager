import { Router } from 'express';
import { pool } from '../db';
import { ChoreTemplateRow, rowToTemplate } from '../mappers';
import { requireAdmin } from '../helpers/guards';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const hId = req.householdId;
    const { rows } = hId
      ? await pool.query<ChoreTemplateRow>('SELECT * FROM chore_templates WHERE household_id = $1 ORDER BY id', [hId])
      : await pool.query<ChoreTemplateRow>('SELECT * FROM chore_templates ORDER BY id');
    res.json(rows.map(rowToTemplate));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { id, title, category } = req.body;
    const householdId = req.householdId ?? req.body.householdId;
    const { rows } = await pool.query<ChoreTemplateRow>(
      `INSERT INTO chore_templates (id, household_id, title, category) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, householdId, title, category],
    );
    res.status(201).json(rowToTemplate(rows[0]));
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { title, category } = req.body;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (category !== undefined) { sets.push(`category = $${idx++}`); vals.push(category); }

    if (sets.length === 0) { res.status(422).json({ error: 'No fields to update.' }); return; }

    vals.push(req.params.id);
    const { rows } = await pool.query<ChoreTemplateRow>(
      `UPDATE chore_templates SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    if (rows.length === 0) throw new Error(`Chore template ${req.params.id} not found.`);
    res.json(rowToTemplate(rows[0]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    await pool.query('DELETE FROM chore_templates WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
