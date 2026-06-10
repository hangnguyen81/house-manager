CREATE TABLE IF NOT EXISTS supply_requests (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  quantity         TEXT,
  note             TEXT,
  urgency          TEXT NOT NULL CHECK (urgency IN ('normal', 'urgent')),
  status           TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'rejected', 'purchased')),
  requested_by_id  TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  decided_by_id    TEXT REFERENCES members(id) ON DELETE RESTRICT,
  rejection_reason TEXT,
  created_at       TEXT NOT NULL,
  decided_at       TEXT,
  purchased_at     TEXT
);
