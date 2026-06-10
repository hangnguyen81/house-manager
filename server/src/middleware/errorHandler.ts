import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const msg = err.message;

  // PostgreSQL error codes (available on DatabaseError objects)
  const code = (err as unknown as Record<string, unknown>).code as string | undefined;

  // FK constraint violation — e.g. deleting a member still referenced by chores/supplies
  if (code === '23503') {
    const detail = (err as unknown as Record<string, unknown>).detail as string | undefined;
    res.status(409).json({ error: `Cannot delete: record is still referenced by other data.`, detail });
    return;
  }

  // Unique constraint violation from DB level
  if (code === '23505') {
    res.status(409).json({ error: msg });
    return;
  }

  if (msg.includes('requires an admin') || msg.includes('Only the assignee or an admin')) {
    res.status(403).json({ error: msg });
    return;
  }
  if (msg.includes('not found') || msg.includes('No active member')) {
    res.status(404).json({ error: msg });
    return;
  }
  if (msg.startsWith('DUPLICATE:') || msg.includes('unique') || msg.includes('duplicate')) {
    res.status(409).json({ error: msg });
    return;
  }
  if (msg.includes('Only a pending') || msg.includes('Only an assigned') || msg.includes('Only an approved') || msg.includes('Cannot remove the last admin') || msg.includes('no longer available')) {
    res.status(422).json({ error: msg });
    return;
  }
  if (msg.includes('Not enough points')) {
    res.status(409).json({ error: msg });
    return;
  }
  if (msg.includes('Cannot delete') || msg.includes('still referenced') || msg.includes('foreign key')) {
    res.status(409).json({ error: msg });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}
