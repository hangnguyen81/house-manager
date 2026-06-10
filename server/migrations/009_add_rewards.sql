CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
  reward_id TEXT NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  reward_title TEXT NOT NULL,
  reward_cost INTEGER NOT NULL,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'rejected')),
  redeemed_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by_id TEXT REFERENCES members(id) ON DELETE RESTRICT,
  rejection_reason TEXT
);
