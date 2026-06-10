import { Router } from 'express';
import { pool } from '../db';
import { SettingsRow, rowToSettings } from '../mappers';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const hId = req.householdId;
    if (!hId) {
      const { rows } = await pool.query<SettingsRow>('SELECT * FROM household_settings LIMIT 1');
      res.json(rowToSettings(rows[0]));
      return;
    }
    const { rows } = await pool.query<SettingsRow>('SELECT * FROM household_settings WHERE household_id = $1', [hId]);
    if (rows.length === 0) {
      // Auto-create settings for this household
      await pool.query('INSERT INTO household_settings (household_id, id) VALUES ($1, 1) ON CONFLICT DO NOTHING', [hId]);
      const { rows: created } = await pool.query<SettingsRow>('SELECT * FROM household_settings WHERE household_id = $1', [hId]);
      res.json(rowToSettings(created[0]));
      return;
    }
    res.json(rowToSettings(rows[0]));
  } catch (e) { next(e); }
});

router.patch('/', async (req, res, next) => {
  try {
    const hId = req.householdId;
    const { rejectionVisibility, shoppingTime, language, theme, pointsDaily, pointsWeekly, pointsMonthly, pointsSeasonal } = req.body;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (rejectionVisibility !== undefined) { sets.push(`rejection_visibility = $${idx++}`); vals.push(rejectionVisibility); }
    if (shoppingTime !== undefined) { sets.push(`shopping_time = $${idx++}`); vals.push(shoppingTime); }
    if (language !== undefined) { sets.push(`language = $${idx++}`); vals.push(language); }
    if (theme !== undefined) { sets.push(`theme = $${idx++}`); vals.push(theme); }
    if (pointsDaily !== undefined) { sets.push(`points_daily = $${idx++}`); vals.push(pointsDaily); }
    if (pointsWeekly !== undefined) { sets.push(`points_weekly = $${idx++}`); vals.push(pointsWeekly); }
    if (pointsMonthly !== undefined) { sets.push(`points_monthly = $${idx++}`); vals.push(pointsMonthly); }
    if (pointsSeasonal !== undefined) { sets.push(`points_seasonal = $${idx++}`); vals.push(pointsSeasonal); }

    if (sets.length === 0) {
      const { rows } = hId
        ? await pool.query<SettingsRow>('SELECT * FROM household_settings WHERE household_id = $1', [hId])
        : await pool.query<SettingsRow>('SELECT * FROM household_settings LIMIT 1');
      res.json(rowToSettings(rows[0]));
      return;
    }

    let query: string;
    if (hId) {
      vals.push(hId);
      query = `UPDATE household_settings SET ${sets.join(', ')} WHERE household_id = $${idx} RETURNING *`;
    } else {
      query = `UPDATE household_settings SET ${sets.join(', ')} WHERE id = 1 RETURNING *`;
    }

    const { rows } = await pool.query<SettingsRow>(query, vals);
    res.json(rowToSettings(rows[0]));
  } catch (e) { next(e); }
});

export default router;
