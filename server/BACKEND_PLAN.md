# Backend Plan: Express + PostgreSQL + Docker

## Context

The app has a typed `ApiBackend` interface (`src/api/contract.ts`) with a mock implementation using the Zustand store. The next step is a real backend. We chose Express + PostgreSQL + Docker, running locally.

**Key constraint**: The `ApiBackend` interface is synchronous. Repos and screens call it synchronously. We solve this with **optimistic updates** — mutations update the local Zustand store immediately (same as mock), then fire HTTP requests in the background. Reads come from the store. A `syncAll()` function fetches fresh data from the server on app startup.

## Directory Structure

```
household-manager/
├── server/                        # Express backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env / .env.example
│   ├── src/
│   │   ├── index.ts               # Express entry + migration runner
│   │   ├── db.ts                  # pg Pool from DATABASE_URL
│   │   ├── migrate.ts             # Reads migrations/, tracks in _migrations table
│   │   ├── mappers.ts             # snake_case rows -> camelCase domain types
│   │   ├── middleware/
│   │   │   ├── actorId.ts         # X-Actor-Id + X-Household-Id headers -> req.actorId, req.householdId
│   │   │   └── errorHandler.ts    # Error -> HTTP status + JSON
│   │   ├── routes/
│   │   │   ├── households.ts
│   │   │   ├── members.ts
│   │   │   ├── chores.ts
│   │   │   ├── choreTemplates.ts
│   │   │   ├── supplies.ts
│   │   │   ├── settings.ts
│   │   │   ├── rewards.ts
│   │   │   └── redemptions.ts
│   │   └── helpers/
│   │       ├── guards.ts          # requireAdmin/requireActor (DB queries)
│   │       └── recurrence.ts      # nextDueDate()
│   └── migrations/
│       ├── 001_create_members.sql
│       ├── 002_create_chores.sql
│       ├── 003_create_chore_templates.sql
│       ├── 004_create_supplies.sql
│       ├── 005_create_settings.sql
│       ├── 006_seed.sql
│       ├── 007_add_households.sql
│       ├── 008_add_points.sql
│       └── 009_add_rewards.sql
├── docker-compose.yml             # PostgreSQL only (Express runs on host)
├── .env                           # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_USE_REST_BACKEND
└── src/api/
    ├── contract.ts                # UNCHANGED
    ├── mockBackend.ts             # UNCHANGED
    ├── restBackend.ts             # Implements ApiBackend with fetch + optimistic updates
    └── index.ts                   # Env-var toggle between mock/rest
```

## Database Schema

### `households`
| Column     | Type | Notes |
|------------|------|-------|
| id         | TEXT | PK |
| name       | TEXT | NOT NULL |
| created_at | TEXT | ISO datetime |

### `members`
| Column       | Type | Notes |
|--------------|------|-------|
| id           | TEXT | PK |
| household_id | TEXT | FK -> households, NOT NULL |
| name         | TEXT | NOT NULL |
| role         | TEXT | CHECK: admin / member |
| color        | TEXT | hex avatar fallback |
| avatar_url   | TEXT | nullable |
| pin          | TEXT | nullable, 4-digit |
| points       | INTEGER | NOT NULL DEFAULT 0 |

### `chores`
| Column        | Type | Notes |
|---------------|------|-------|
| id            | TEXT | PK |
| household_id  | TEXT | FK -> households, NOT NULL |
| title         | TEXT | NOT NULL |
| description   | TEXT | nullable |
| assignee_id   | TEXT | FK -> members |
| created_by_id | TEXT | FK -> members |
| status        | TEXT | CHECK: assigned / in_progress / completed |
| recurrence    | TEXT | CHECK: none / daily / weekly / monthly |
| due_date      | TEXT | nullable, ISO date |
| created_at    | TEXT | ISO datetime |
| completed_at  | TEXT | nullable, ISO datetime |
| points_override | INTEGER | nullable, overrides category default |

**Partial unique index**: `(household_id, title, COALESCE(due_date, '')) WHERE status <> 'completed'` — enforces the "no two active chores with same title + due date within a household" rule at DB level.

### `chore_templates`
| Column       | Type | Notes |
|--------------|------|-------|
| id           | TEXT | PK |
| household_id | TEXT | FK -> households, NOT NULL |
| title        | TEXT | NOT NULL |
| category     | TEXT | CHECK: daily / weekly / monthly / seasonal |

### `supply_requests`
| Column           | Type | Notes |
|------------------|------|-------|
| id               | TEXT | PK |
| household_id     | TEXT | FK -> households, NOT NULL |
| name             | TEXT | NOT NULL |
| quantity         | TEXT | nullable |
| note             | TEXT | nullable |
| urgency          | TEXT | CHECK: normal / urgent |
| status           | TEXT | CHECK: requested / approved / rejected / purchased |
| requested_by_id  | TEXT | FK -> members |
| decided_by_id    | TEXT | nullable FK -> members |
| rejection_reason | TEXT | nullable |
| created_at       | TEXT | ISO datetime |
| decided_at       | TEXT | nullable |
| purchased_at     | TEXT | nullable |

### `rewards`
| Column       | Type    | Notes |
|--------------|---------|-------|
| id           | TEXT    | PK |
| household_id | TEXT    | FK -> households, NOT NULL |
| title        | TEXT    | NOT NULL |
| description  | TEXT    | nullable |
| cost         | INTEGER | NOT NULL |
| icon         | TEXT    | nullable, Ionicons name |
| is_active    | BOOLEAN | NOT NULL DEFAULT true |
| created_at   | TEXT    | ISO datetime |

### `redemptions`
| Column           | Type    | Notes |
|------------------|---------|-------|
| id               | TEXT    | PK |
| household_id     | TEXT    | FK -> households, NOT NULL |
| reward_id        | TEXT    | FK -> rewards, NOT NULL |
| reward_title     | TEXT    | NOT NULL, denormalized |
| reward_cost      | INTEGER | NOT NULL, denormalized |
| member_id        | TEXT    | FK -> members, NOT NULL |
| status           | TEXT    | CHECK: pending / fulfilled / rejected |
| redeemed_at      | TEXT    | ISO datetime |
| decided_at       | TEXT    | nullable |
| decided_by_id    | TEXT    | nullable FK -> members |
| rejection_reason | TEXT    | nullable |

### `household_settings`
Per-household settings (one row per household, unique on `household_id`).

| Column               | Type    | Notes |
|----------------------|---------|-------|
| id                   | INTEGER | legacy column |
| household_id         | TEXT    | FK -> households, UNIQUE, NOT NULL |
| rejection_visibility | TEXT    | default '1_week' |
| shopping_time        | TEXT    | nullable |
| language             | TEXT    | default 'en' |
| theme                | TEXT    | default 'light' |
| points_daily         | INTEGER | NOT NULL DEFAULT 5 |
| points_weekly        | INTEGER | NOT NULL DEFAULT 10 |
| points_monthly       | INTEGER | NOT NULL DEFAULT 15 |
| points_seasonal      | INTEGER | NOT NULL DEFAULT 20 |

FK policies:
- `members/chores/templates/supplies` → `REFERENCES households(id) ON DELETE RESTRICT`
- `chores/supplies` → `REFERENCES members(id) ON DELETE RESTRICT`
- `household_settings` → `REFERENCES households(id) ON DELETE CASCADE`

### Member Deletion Guard (3 levels)
Deleting a member who is still referenced by chores or supply requests is blocked at three levels:
1. **Client-side** (both `mockBackend` and `restBackend`): `ensureMemberNotReferenced()` checks the Zustand store before mutating, throws with a descriptive message
2. **Server-side** (`routes/members.ts`): queries `chores` and `supply_requests` for references before attempting DELETE, returns 409 with counts
3. **Database**: FK constraints with `ON DELETE RESTRICT` — final safety net, caught by `errorHandler` (PG error code `23503` -> 409)

## API Routes

All routes under `/api`. Actor identity sent via `X-Actor-Id` header. Household scoping via `X-Household-Id` header — when present, list endpoints filter by household; create endpoints use it to set `household_id`.

### Households
| Route | Method | ApiBackend method |
|-------|--------|-------------------|
| `/api/households` | GET | listHouseholds |
| `/api/households/:id` | GET | getHousehold |
| `/api/households` | POST | createHousehold (auto-creates settings) |
| `/api/households/:id` | PATCH | updateHousehold |
| `/api/households/:id` | DELETE | removeHousehold (blocked if members exist) |

### Members
| Route | Method | ApiBackend method |
|-------|--------|-------------------|
| `/api/members` | GET | listMembers |
| `/api/members/:id` | GET | getMember |
| `/api/members` | POST | createMember |
| `/api/members/:id` | PATCH | updateMember |
| `/api/members/:id` | DELETE | removeMember |
| `/api/members/:id/pin` | PUT | setMemberPin |
| `/api/members/:id/adjust-points` | POST | adjustMemberPoints (admin-only, body: `{delta}`) |
| `/api/members/:id/verify-pin` | POST | verifyMemberPin |

### Chores
| Route | Method | ApiBackend method |
|-------|--------|-------------------|
| `/api/chores` | GET | listChores |
| `/api/chores/:id` | GET | getChore |
| `/api/chores` | POST | createChore |
| `/api/chores/:id` | PATCH | updateChore |
| `/api/chores/:id/start` | POST | startChore |
| `/api/chores/:id/complete` | POST | completeChore (returns `{completed, spawned?, pointsAwarded}`) |
| `/api/chores/:id/reopen` | POST | reopenChore |
| `/api/chores/:id` | DELETE | removeChore |

### Chore Templates
| Route | Method | ApiBackend method |
|-------|--------|-------------------|
| `/api/chore-templates` | GET | listChoreTemplates |
| `/api/chore-templates` | POST | createChoreTemplate |
| `/api/chore-templates/:id` | PATCH | updateChoreTemplate |
| `/api/chore-templates/:id` | DELETE | removeChoreTemplate |

### Supplies
| Route | Method | ApiBackend method |
|-------|--------|-------------------|
| `/api/supplies` | GET | listSupplies |
| `/api/supplies/:id` | GET | getSupply |
| `/api/supplies` | POST | flagSupply (auto-approves if actor is admin) |
| `/api/supplies/:id` | PATCH | editSupply |
| `/api/supplies/:id` | DELETE | cancelSupply |
| `/api/supplies/:id/approve` | POST | approveSupply |
| `/api/supplies/:id/reject` | POST | rejectSupply |
| `/api/supplies/:id/unapprove` | POST | unapproveSupply |
| `/api/supplies/:id/purchased` | POST | markSupplyPurchased |

### Rewards
| Route | Method | ApiBackend method |
|-------|--------|-------------------|
| `/api/rewards` | GET | listRewards |
| `/api/rewards/:id` | GET | getReward |
| `/api/rewards` | POST | createReward (admin) |
| `/api/rewards/:id` | PATCH | updateReward (admin) |
| `/api/rewards/:id/archive` | POST | archiveReward (admin) |
| `/api/rewards/:id` | DELETE | removeReward (admin, blocked if redemptions exist) |

### Redemptions
| Route | Method | ApiBackend method |
|-------|--------|-------------------|
| `/api/redemptions` | GET | listRedemptions |
| `/api/redemptions` | POST | redeemReward (any member, deducts points) |
| `/api/redemptions/:id/fulfill` | POST | fulfillRedemption (admin) |
| `/api/redemptions/:id/reject` | POST | rejectRedemption (admin, refunds points) |

### Settings
| Route | Method | ApiBackend method |
|-------|--------|-------------------|
| `/api/settings` | GET | getSettings |
| `/api/settings` | PATCH | updateSettings |

## Client Integration: Optimistic Update Pattern

The `restBackend.ts` implements `ApiBackend` with this pattern:

- **Reads** (`list*`, `get*`): return from Zustand store (same as mock)
- **Mutations**: update the Zustand store optimistically (same as mock), then fire `fetch()` in the background. On server response, reconcile store with server truth
- **`syncAll()`**: fetches all entities from server, populates store. Called on app startup after hydration

Key details:
- Uses `EXPO_PUBLIC_API_URL` env var for base URL
- Sends `X-Actor-Id` and `X-Household-Id` headers on every request
- IDs generated client-side with `genId()` and sent to server (server uses the provided ID)
- All `list*` methods filter by `activeHouseholdId`; all `create*` methods stamp `householdId`
- `notificationId` is client-only — never sent to or stored on the server

## Backend Toggle

`src/api/index.ts` reads the env var:

```ts
const USE_REST = process.env.EXPO_PUBLIC_USE_REST_BACKEND === 'true';
export const api: ApiBackend = USE_REST ? restBackend : mockBackend;
```

Set `EXPO_PUBLIC_USE_REST_BACKEND=true` in `.env` to use the real backend. Set to `false` (or omit) to use mock.

## Error Handling

The `errorHandler` middleware maps errors to HTTP status codes. It handles both app-level error messages and PostgreSQL error codes:

**PostgreSQL error codes** (checked first):
- **`23503`** (FK violation) -> **409** — "Cannot delete: record is still referenced by other data"
- **`23505`** (unique violation) -> **409**

**App-level error messages**:
- **403** — "requires an admin" / "Only the assignee or an admin"
- **404** — "not found" / "No active member"
- **409** — "DUPLICATE:" / "Cannot delete" / "still referenced"
- **409** — "Not enough points"
- **422** — "Only a pending" / "Only an assigned" / "Only an approved" / "Cannot remove the last admin" / "no longer available"
- **500** — unhandled errors

## Migration System

- `migrate.ts` reads SQL files from `server/migrations/`, sorted alphabetically
- Tracks applied migrations in a `_migrations` table
- Runs automatically on server startup
- Seed data matches `src/data/mockSeed.ts` exactly

## Files Modified (client-side)
- `src/api/index.ts` — env-var toggle between mock/rest
- `app/_layout.tsx` — `syncAll()` call on startup when REST is active
- `.env` — API config
- `.gitignore` — server/dist, server/node_modules, .env

## Files Modified (additional, post-initial implementation)
- `src/api/mockBackend.ts` — added `ensureMemberNotReferenced()` guard, household scoping, household CRUD
- `src/api/restBackend.ts` — same guards + household scoping + X-Household-Id header
- `src/api/contract.ts` — added household CRUD methods
- `src/types/index.ts` — added `Household` type, `householdId` to all entities
- `src/data/store.ts` — added `households`, `activeHouseholdId`
- `src/data/mockSeed.ts` — added `mockHouseholds`, `householdId` to all seed data
- `src/data/repositories/householdRepo.ts` — new household repo
- `app/index.tsx` — two-step entry: household picker → profile picker
- `app/(tabs)/*.tsx` — all screens filter store data by `activeHouseholdId`
- `app/(tabs)/settings.tsx` — `handleDeleteMember` catch shows specific error for dependency violations
- `src/i18n/en.json` + `vi.json` — added household + memberInUseError keys
- `server/src/middleware/actorId.ts` — now extracts `X-Household-Id` header
- `server/src/middleware/errorHandler.ts` — handles PG error codes 23503 (FK) and 23505 (unique)
- `server/src/routes/*.ts` — all routes scope queries by `household_id`
- `server/src/routes/households.ts` — new household route
- `server/src/mappers.ts` — all row types include `household_id`
- `server/migrations/007_add_households.sql` — adds households table + household_id to all tables
- `server/migrations/008_add_points.sql` — adds `points` to members, `points_override` to chores, `points_daily/weekly/monthly/seasonal` to settings
- `src/api/contract.ts` — added `adjustMemberPoints` method, `pointsOverride` to chore inputs, `pointsAwarded` to completeChore return
- `src/api/mockBackend.ts` — points computation in completeChore, adjustMemberPoints
- `src/api/restBackend.ts` — same + HTTP calls for points
- `src/data/repositories/choreRepo.ts` — complete() now returns `{ completed, pointsAwarded }`
- `src/data/repositories/memberRepo.ts` — added adjustPoints()
- `src/data/store.ts` — storage key bumped to `household-store-v3`
- `src/i18n/en.json` + `vi.json` — points/leaderboard/config keys
- `app/(tabs)/index.tsx` — points badge + leaderboard + completion alert
- `app/(tabs)/chores.tsx` — pointsOverride in form + badge on cards + completion alert
- `app/(tabs)/settings.tsx` — points config section + adjust-points modal per member
- `server/src/mappers.ts` — points fields in row types + mappers
- `server/src/routes/chores.ts` — award points on complete, handle pointsOverride in create/update
- `server/src/routes/members.ts` — new adjust-points route
- `server/src/routes/settings.ts` — handle points config fields
- `server/migrations/009_add_rewards.sql` — rewards + redemptions tables
- `server/src/routes/rewards.ts` — reward CRUD + archive routes
- `server/src/routes/redemptions.ts` — redeem + fulfill + reject routes
- `server/src/mappers.ts` — RewardRow, RedemptionRow + mappers
- `server/src/index.ts` — mount rewards + redemptions routes
- `src/api/contract.ts` — added reward + redemption methods + input types
- `src/api/mockBackend.ts` — reward + redemption implementations
- `src/api/restBackend.ts` — same + HTTP calls + syncAll updated
- `src/data/store.ts` — added rewards, redemptions; bumped to household-store-v4
- `src/data/mockSeed.ts` — added mockRewards, mockRedemptions
- `src/data/repositories/rewardRepo.ts` — new reward repo
- `src/data/repositories/redemptionRepo.ts` — new redemption repo + notifications
- `src/i18n/en.json` + `vi.json` — rewards tab + catalog + redemption keys
- `app/(tabs)/rewards.tsx` — new Rewards screen
- `app/(tabs)/_layout.tsx` — added Rewards tab
- `server/src/app.ts` — extracted createApp() from index.ts for test use
- `server/src/index.ts` — refactored to use createApp()
- `server/src/middleware/errorHandler.ts` — added "Not enough points" (409) and "no longer available" (422) mappings
- `server/vitest.config.ts` — Vitest config for server integration tests
- `server/src/__tests__/setup.ts` — test setup: migrations + data reset per test
- `server/src/__tests__/helpers.ts` — supertest app + header presets
- `server/src/routes/api.test.ts` — 44 integration tests
- `server/.env.test` — test database connection string
