import dotenv from 'dotenv';
dotenv.config();

import { runMigrations } from './migrate';
import { createApp } from './app';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function main() {
  console.log('Running migrations...');
  await runMigrations();
  console.log('Migrations complete.');

  const app = createApp();

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
