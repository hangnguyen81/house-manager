-- Create households table
CREATE TABLE IF NOT EXISTS households (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Insert default household for existing data
INSERT INTO households (id, name, created_at)
VALUES ('h1', 'The Family', '2026-06-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Add household_id to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS household_id TEXT;
UPDATE members SET household_id = 'h1' WHERE household_id IS NULL;
ALTER TABLE members ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE members ADD CONSTRAINT fk_members_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE RESTRICT;

-- Add household_id to chores
ALTER TABLE chores ADD COLUMN IF NOT EXISTS household_id TEXT;
UPDATE chores SET household_id = 'h1' WHERE household_id IS NULL;
ALTER TABLE chores ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE chores ADD CONSTRAINT fk_chores_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE RESTRICT;

-- Add household_id to chore_templates
ALTER TABLE chore_templates ADD COLUMN IF NOT EXISTS household_id TEXT;
UPDATE chore_templates SET household_id = 'h1' WHERE household_id IS NULL;
ALTER TABLE chore_templates ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE chore_templates ADD CONSTRAINT fk_chore_templates_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE RESTRICT;

-- Add household_id to supply_requests
ALTER TABLE supply_requests ADD COLUMN IF NOT EXISTS household_id TEXT;
UPDATE supply_requests SET household_id = 'h1' WHERE household_id IS NULL;
ALTER TABLE supply_requests ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE supply_requests ADD CONSTRAINT fk_supply_requests_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE RESTRICT;

-- Change household_settings from single-row to per-household
ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS household_id TEXT;
UPDATE household_settings SET household_id = 'h1' WHERE household_id IS NULL;
ALTER TABLE household_settings ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE household_settings ADD CONSTRAINT fk_settings_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE;
-- Drop the old id=1 check and PK, replace with household_id unique
ALTER TABLE household_settings DROP CONSTRAINT IF EXISTS household_settings_pkey;
ALTER TABLE household_settings DROP CONSTRAINT IF EXISTS household_settings_id_check;
ALTER TABLE household_settings ADD CONSTRAINT household_settings_household_unique UNIQUE (household_id);

-- Update the chore uniqueness index to include household_id
DROP INDEX IF EXISTS idx_chores_active_unique;
CREATE UNIQUE INDEX idx_chores_active_unique
  ON chores (household_id, title, COALESCE(due_date, ''))
  WHERE status <> 'completed';
