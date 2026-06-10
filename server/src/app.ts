import express from 'express';
import cors from 'cors';
import { actorIdMiddleware } from './middleware/actorId';
import { errorHandler } from './middleware/errorHandler';
import householdsRouter from './routes/households';
import membersRouter from './routes/members';
import choresRouter from './routes/chores';
import choreTemplatesRouter from './routes/choreTemplates';
import suppliesRouter from './routes/supplies';
import settingsRouter from './routes/settings';
import rewardsRouter from './routes/rewards';
import redemptionsRouter from './routes/redemptions';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(actorIdMiddleware);

  app.use('/api/households', householdsRouter);
  app.use('/api/members', membersRouter);
  app.use('/api/chores', choresRouter);
  app.use('/api/chore-templates', choreTemplatesRouter);
  app.use('/api/supplies', suppliesRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/rewards', rewardsRouter);
  app.use('/api/redemptions', redemptionsRouter);

  app.use(errorHandler);

  return app;
}
