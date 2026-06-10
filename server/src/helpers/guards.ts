import { pool } from '../db';
import { MemberRow, rowToMember } from '../mappers';

export async function requireAdmin(actorId: string | undefined) {
  if (!actorId) throw new Error('No active member selected.');
  const { rows } = await pool.query<MemberRow>('SELECT * FROM members WHERE id = $1', [actorId]);
  if (rows.length === 0) throw new Error('No active member selected.');
  if (rows[0].role !== 'admin') throw new Error('This action requires an admin.');
  return rowToMember(rows[0]);
}

export async function requireActor(actorId: string | undefined) {
  if (!actorId) throw new Error('No active member selected.');
  const { rows } = await pool.query<MemberRow>('SELECT * FROM members WHERE id = $1', [actorId]);
  if (rows.length === 0) throw new Error('No active member selected.');
  return rowToMember(rows[0]);
}
