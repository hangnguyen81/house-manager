import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      actorId?: string;
      householdId?: string;
    }
  }
}

export function actorIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const actorHeader = req.headers['x-actor-id'];
  if (typeof actorHeader === 'string' && actorHeader.length > 0) {
    req.actorId = actorHeader;
  }
  const householdHeader = req.headers['x-household-id'];
  if (typeof householdHeader === 'string' && householdHeader.length > 0) {
    req.householdId = householdHeader;
  }
  next();
}
