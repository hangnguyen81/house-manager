-- Seed members (same as mockSeed.ts)
INSERT INTO members (id, name, role, color) VALUES
  ('m1', 'Mom',  'admin',  '#E8743B'),
  ('m2', 'Dad',  'admin',  '#19A979'),
  ('m3', 'Ava',  'member', '#945ECF'),
  ('m4', 'Leo',  'member', '#1F77B4')
ON CONFLICT (id) DO NOTHING;

-- Seed chores
INSERT INTO chores (id, title, assignee_id, created_by_id, status, recurrence, due_date, created_at, completed_at) VALUES
  ('c1', 'Take out recycling', 'm4', 'm1', 'assigned',    'weekly', '2026-06-10', '2026-06-09T08:00:00Z', NULL),
  ('c2', 'Load dishwasher',    'm3', 'm1', 'in_progress', 'daily',  NULL,         '2026-06-09T08:00:00Z', NULL),
  ('c3', 'Walk the dog',       'm4', 'm2', 'completed',   'none',   NULL,         '2026-06-08T07:00:00Z', '2026-06-08T17:30:00Z')
ON CONFLICT (id) DO NOTHING;

-- Seed supply requests
INSERT INTO supply_requests (id, name, quantity, urgency, status, requested_by_id, decided_by_id, rejection_reason, created_at, decided_at) VALUES
  ('s1', 'Milk',          '2 cartons', 'urgent', 'requested', 'm3', NULL, NULL,            '2026-06-09T07:30:00Z', NULL),
  ('s2', 'Dish soap',     NULL,        'normal', 'approved',  'm4', 'm2', NULL,            '2026-06-08T19:00:00Z', '2026-06-08T20:00:00Z'),
  ('s3', 'Energy drinks', NULL,        'normal', 'rejected',  'm3', 'm1', 'Not this week', '2026-06-07T15:00:00Z', '2026-06-07T18:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Seed chore templates
INSERT INTO chore_templates (id, title, category) VALUES
  ('ct1',  'Making the bed',                                  'daily'),
  ('ct2',  'Wiping down kitchen counters',                    'daily'),
  ('ct3',  'Loading/running the dishwasher',                  'daily'),
  ('ct4',  'Taking out the trash',                            'daily'),
  ('ct5',  'Sweeping high-traffic floors',                    'daily'),
  ('ct6',  'Vacuuming and mopping',                           'weekly'),
  ('ct7',  'Cleaning bathrooms',                              'weekly'),
  ('ct8',  'Changing bed sheets',                             'weekly'),
  ('ct9',  'Dusting surfaces',                                'weekly'),
  ('ct10', 'Wiping down appliances',                          'weekly'),
  ('ct11', 'Cleaning the microwave/oven',                     'monthly'),
  ('ct12', 'Washing trash cans',                              'monthly'),
  ('ct13', 'Dusting ceiling fans',                            'monthly'),
  ('ct14', 'Cleaning baseboards',                             'monthly'),
  ('ct15', 'Running a clean cycle on the washing machine',    'monthly'),
  ('ct16', 'Washing windows',                                 'seasonal'),
  ('ct17', 'Deep-cleaning carpets',                           'seasonal'),
  ('ct18', 'Sorting/purging closets',                         'seasonal'),
  ('ct19', 'Cleaning gutters',                                'seasonal'),
  ('ct20', 'Flipping mattresses',                             'seasonal')
ON CONFLICT (id) DO NOTHING;
