CREATE TABLE IF NOT EXISTS chore_templates (
  id       TEXT PRIMARY KEY,
  title    TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('daily', 'weekly', 'monthly', 'seasonal'))
);
