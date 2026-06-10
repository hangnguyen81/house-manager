CREATE TABLE IF NOT EXISTS household_settings (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  rejection_visibility  TEXT NOT NULL DEFAULT '1_week',
  shopping_time         TEXT,
  language              TEXT NOT NULL DEFAULT 'en',
  theme                 TEXT NOT NULL DEFAULT 'light'
);

-- Ensure the single row always exists
INSERT INTO household_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
