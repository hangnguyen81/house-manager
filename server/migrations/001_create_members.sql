CREATE TABLE IF NOT EXISTS members (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  color      TEXT NOT NULL,
  avatar_url TEXT,
  pin        TEXT
);
