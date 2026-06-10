import { Router } from 'express';
import { pool } from '../db';
import { ChoreRow, MemberRow, SettingsRow, rowToChore } from '../mappers';
import { requireAdmin, requireActor } from '../helpers/guards';
import { nextDueDate } from '../helpers/recurrence';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const hId = req.householdId;
    const { rows } = hId
      ? await pool.query<ChoreRow>('SELECT * FROM chores WHERE household_id = $1 ORDER BY created_at DESC', [hId])
      : await pool.query<ChoreRow>('SELECT * FROM chores ORDER BY created_at DESC');
    res.json(rows.map(rowToChore));
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query<ChoreRow>('SELECT * FROM chores WHERE id = $1', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: `Chore ${req.params.id} not found.` }); return; }
    res.json(rowToChore(rows[0]));
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const actor = await requireAdmin(req.actorId);
    const { id, title, description, assigneeId, dueDate, recurrence, pointsOverride } = req.body;
    const householdId = req.householdId ?? req.body.householdId;
    const rec = recurrence ?? 'none';
    const { rows } = await pool.query<ChoreRow>(
      `INSERT INTO chores (id, household_id, title, description, assignee_id, created_by_id, status, recurrence, due_date, created_at, points_override)
       VALUES ($1, $2, $3, $4, $5, $6, 'assigned', $7, $8, $9, $10) RETURNING *`,
      [id, householdId, title, description ?? null, assigneeId, actor.id, rec, dueDate ?? null, new Date().toISOString(), pointsOverride ?? null],
    );
    res.status(201).json(rowToChore(rows[0]));
  } catch (e) {
    if (e instanceof Error && e.message.includes('idx_chores_active_unique')) {
      e.message = `DUPLICATE:${req.body.title}`;
    }
    next(e);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { title, description, assigneeId, dueDate, recurrence, pointsOverride } = req.body;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (title !== undefined) { sets.push(`title = $${idx++}`); vals.push(title); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); vals.push(description); }
    if (assigneeId !== undefined) { sets.push(`assignee_id = $${idx++}`); vals.push(assigneeId); }
    if (dueDate !== undefined) { sets.push(`due_date = $${idx++}`); vals.push(dueDate); }
    if (recurrence !== undefined) { sets.push(`recurrence = $${idx++}`); vals.push(recurrence); }
    if (pointsOverride !== undefined) { sets.push(`points_override = $${idx++}`); vals.push(pointsOverride); }

    if (sets.length === 0) { res.status(422).json({ error: 'No fields to update.' }); return; }

    vals.push(req.params.id);
    const { rows } = await pool.query<ChoreRow>(
      `UPDATE chores SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    if (rows.length === 0) throw new Error(`Chore ${req.params.id} not found.`);
    res.json(rowToChore(rows[0]));
  } catch (e) {
    if (e instanceof Error && e.message.includes('idx_chores_active_unique')) {
      e.message = `DUPLICATE:${req.body.title ?? 'chore'}`;
    }
    next(e);
  }
});

router.post('/:id/start', async (req, res, next) => {
  try {
    const actor = await requireActor(req.actorId);
    const { rows: found } = await pool.query<ChoreRow>('SELECT * FROM chores WHERE id = $1', [req.params.id]);
    if (found.length === 0) throw new Error(`Chore ${req.params.id} not found.`);
    const chore = found[0];

    if (actor.role !== 'admin' && actor.id !== chore.assignee_id) {
      throw new Error('Only the assignee or an admin can change this chore.');
    }
    if (chore.status !== 'assigned') throw new Error('Only an assigned chore can be started.');

    const { rows } = await pool.query<ChoreRow>(
      `UPDATE chores SET status = 'in_progress' WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    res.json(rowToChore(rows[0]));
  } catch (e) { next(e); }
});

router.post('/:id/complete', async (req, res, next) => {
  try {
    const actor = await requireActor(req.actorId);
    const { rows: found } = await pool.query<ChoreRow>('SELECT * FROM chores WHERE id = $1', [req.params.id]);
    if (found.length === 0) throw new Error(`Chore ${req.params.id} not found.`);
    const chore = found[0];

    if (actor.role !== 'admin' && actor.id !== chore.assignee_id) {
      throw new Error('Only the assignee or an admin can change this chore.');
    }
    if (chore.status === 'completed') {
      res.json({ completed: rowToChore(chore), pointsAwarded: 0 });
      return;
    }

    const now = new Date().toISOString();
    const { rows: completed } = await pool.query<ChoreRow>(
      `UPDATE chores SET status = 'completed', completed_at = $1 WHERE id = $2 RETURNING *`,
      [now, req.params.id],
    );

    // Award points to assignee
    const { rows: settingsRows } = await pool.query<SettingsRow>(
      'SELECT * FROM household_settings WHERE household_id = $1',
      [chore.household_id],
    );
    const recurrenceKey = chore.recurrence === 'none' ? 'points_daily' : `points_${chore.recurrence}` as keyof SettingsRow;
    const categoryPoints = settingsRows.length > 0 ? (settingsRows[0][recurrenceKey] as number) : 5;
    const pointsAwarded = chore.points_override ?? categoryPoints;
    await pool.query<MemberRow>(
      'UPDATE members SET points = points + $1 WHERE id = $2',
      [pointsAwarded, chore.assignee_id],
    );

    let spawned = undefined;
    if (chore.recurrence !== 'none') {
      const newDue = nextDueDate(chore.due_date ?? undefined, chore.recurrence);
      const spawnId = req.body.spawnedId;
      try {
        const { rows: spawnedRows } = await pool.query<ChoreRow>(
          `INSERT INTO chores (id, household_id, title, description, assignee_id, created_by_id, status, recurrence, due_date, created_at, points_override)
           VALUES ($1, $2, $3, $4, $5, $6, 'assigned', $7, $8, $9, $10) RETURNING *`,
          [spawnId, chore.household_id, chore.title, chore.description, chore.assignee_id, chore.created_by_id, chore.recurrence, newDue, now, chore.points_override],
        );
        spawned = rowToChore(spawnedRows[0]);
      } catch {
        // unique constraint violation — silently skip spawn (duplicate exists)
      }
    }

    res.json({ completed: rowToChore(completed[0]), spawned, pointsAwarded });
  } catch (e) { next(e); }
});

router.post('/:id/reopen', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { rows } = await pool.query<ChoreRow>(
      `UPDATE chores SET status = 'assigned', completed_at = NULL WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (rows.length === 0) throw new Error(`Chore ${req.params.id} not found.`);
    res.json(rowToChore(rows[0]));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await requireAdmin(req.actorId);
    const { rowCount } = await pool.query('DELETE FROM chores WHERE id = $1', [req.params.id]);
    if (rowCount === 0) throw new Error(`Chore ${req.params.id} not found.`);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default router;
