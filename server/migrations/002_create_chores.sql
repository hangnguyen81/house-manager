CREATE TABLE IF NOT EXISTS chores (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT,
  assignee_id    TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  created_by_id  TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  status         TEXT NOT NULL CHECK (status IN ('assigned', 'in_progress', 'completed')),
  recurrence     TEXT NOT NULL CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
  due_date       TEXT,
  created_at     TEXT NOT NULL,
  completed_at   TEXT
);

-- Enforce uniqueness: no two active chores with same title + due_date
CREATE UNIQUE INDEX IF NOT EXISTS idx_chores_active_unique
  ON chores (title, COALESCE(due_date, ''))
  WHERE status <> 'completed';
