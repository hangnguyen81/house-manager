# Household Manager

A shared household app for **chores, supplies, and rewards** — built with **Expo SDK 56 + expo-router + TypeScript** using a development build. Designed for families where adults manage tasks and kids earn points for completing them.

Supports two backends: an **in-memory mock** (default, zero setup) and a real **Express + PostgreSQL** backend — toggled via a single env var. All data access goes through a repository layer, so switching backends requires no screen or repo changes.

## Features

- **Chore management** — Admins create and assign chores with optional due dates and recurrence (daily/weekly/monthly). Members complete chores and earn points. Auto-scheduling spawns the next instance when a recurring chore is completed.
- **Supply requests** — Any member flags items as "running low." Admins approve or reject; approved items appear on the shopping list. Admin-flagged supplies are auto-approved.
- **Shopping list** — Approved supplies grouped by date. Admins check items off as purchased.
- **Points & leaderboard** — Chore completion awards points (configurable per category, with per-chore overrides). Home screen shows a leaderboard ranked by points. Admins can manually adjust points.
- **Rewards catalog** — Admins create rewards with a point cost. Members browse and redeem. Admins fulfill or reject pending redemptions (rejected = points refunded). Dedicated Rewards tab.
- **Multiple households** — Each household has its own members, chores, templates, supplies, rewards, and settings. Entry flow: household picker then profile picker.
- **Role-based access** — Two roles: admin and member. Admins manage everything; members complete chores, flag supplies, and redeem rewards. Settings tab hidden for non-admins.
- **Local PIN auth** — Optional 4-digit PIN per member. Profile picker prompts on protected members.
- **Notifications** — Local reminders for chore due dates (9 AM). Instant notifications on supply approval/rejection and reward fulfillment/rejection.
- **Theming** — "Evergreen" light/dark theme. Forest green primary, amber accents. Toggle in Settings.
- **i18n** — English and Vietnamese. Every UI string uses `t()`. Language toggle in Settings.

## Quick start

```bash
# Install dependencies
npm install --legacy-peer-deps

# Build dev client (first time — needs Xcode or Android Studio)
npx expo run:ios          # or: npx expo run:android

# Start dev server
npx expo start --dev-client
```

The app runs immediately with mock data — no backend needed.

> `--legacy-peer-deps` is required due to a `react-dom` peer conflict with the pinned `react@19.2.3`.

## Running with the real backend

Requires Docker for PostgreSQL. Express runs on the host.

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Start Express (runs migrations + seeds automatically)
cd server && npm install && npm run dev

# 3. Connect the app — edit .env in project root
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_USE_REST_BACKEND=true

# 4. Start the app (clear cache for env change)
npx expo start --dev-client --clear
```

Switch back to mock: set `EXPO_PUBLIC_USE_REST_BACKEND=false` and restart.

## Project structure

```
household-manager/
├─ app/                         # expo-router screens
│  ├─ _layout.tsx               # root layout: hydration gate, i18n, theme, syncAll
│  ├─ index.tsx                 # entry: household picker -> profile picker
│  └─ (tabs)/
│     ├─ _layout.tsx            # bottom tabs: Home, Chores, Supplies, Shopping, Rewards, Settings
│     ├─ index.tsx              # Home: greeting, my chores, points badge, leaderboard
│     ├─ chores.tsx             # chore CRUD, status actions, recurrence, points override
│     ├─ supplies.tsx           # flag/edit/cancel, approve/reject/purchase
│     ├─ shopping.tsx           # shopping list grouped by date
│     ├─ rewards.tsx            # reward catalog, redeem, admin manage, redemption history
│     └─ settings.tsx           # members, chore templates, points config, language, theme
├─ src/
│  ├─ types/index.ts            # domain types: Household, Member, Chore, Reward, Redemption, ...
│  ├─ data/
│  │  ├─ mockSeed.ts            # seed data for mock backend
│  │  ├─ store.ts               # Zustand + AsyncStorage persistence (v4)
│  │  └─ repositories/          # business-rule wrappers over API backend
│  │     ├─ choreRepo.ts        # + notifications + points
│  │     ├─ supplyRepo.ts       # + notifications + derived selectors
│  │     ├─ rewardRepo.ts       # reward CRUD + activeRewards()
│  │     ├─ redemptionRepo.ts   # redeem/fulfill/reject + notifications
│  │     ├─ memberRepo.ts       # + PIN + points adjustment
│  │     ├─ householdRepo.ts
│  │     ├─ choreTemplateRepo.ts
│  │     └─ index.ts
│  ├─ api/
│  │  ├─ contract.ts            # typed ApiBackend interface (the swap point)
│  │  ├─ mockBackend.ts         # in-memory implementation
│  │  ├─ restBackend.ts         # REST + optimistic updates + syncAll()
│  │  └─ index.ts               # env-var toggle
│  ├─ hooks/useRole.ts          # { actor, isAdmin }
│  ├─ i18n/                     # i18next: en.json (source), vi.json (mirror)
│  ├─ theme/index.ts            # Evergreen theme tokens + ThemeContext
│  └─ utils/
├─ server/                      # Express + PostgreSQL backend
│  ├─ src/
│  │  ├─ index.ts               # entry: migrations + Express
│  │  ├─ db.ts                  # pg Pool
│  │  ├─ migrate.ts             # migration runner
│  │  ├─ mappers.ts             # snake_case -> camelCase
│  │  ├─ middleware/             # actorId, errorHandler
│  │  ├─ routes/                # households, members, chores, supplies, settings, rewards, redemptions
│  │  └─ helpers/               # guards, recurrence
│  └─ migrations/               # 001-009 SQL files
├─ DOCS/                        # design documents and plans
├─ docker-compose.yml           # PostgreSQL 16 Alpine
└─ .env                         # API URL + backend toggle
```

## Architecture

### Backend swap via API contract

`src/api/contract.ts` defines a typed `ApiBackend` interface. Two implementations:

| Backend | File | How it works |
|---------|------|-------------|
| **Mock** | `mockBackend.ts` | Reads/writes Zustand store directly. All business rules here. |
| **REST** | `restBackend.ts` | Optimistic store updates + background HTTP. `syncAll()` on startup. |

Toggled by `EXPO_PUBLIC_USE_REST_BACKEND` env var. Repositories are thin wrappers that delegate to the active backend and add client-side concerns (notifications).

### Key business rules

| Rule | Enforcement |
|------|------------|
| Supply editable only while `requested` | Backend + UI |
| Admin-flagged supplies auto-approved | Both backends + server |
| No duplicate active chores (same title + due date) | Client + DB unique index |
| Member deletion blocked if referenced | Client + server + DB FK |
| Reward deletion blocked if redemptions exist | Client + server + DB FK |
| Points deducted on redeem, refunded on reject | Both backends + server |
| Chore recurrence auto-spawn on complete | Both backends + server |

### Database (9 migrations)

`households` > `members` > `chores`, `chore_templates`, `supply_requests`, `rewards` > `redemptions` > `household_settings`

All tables use TEXT primary keys (client-generated IDs). FK constraints use `ON DELETE RESTRICT` (except settings which cascade with household).

### State management

Zustand store with `persist` middleware backed by `AsyncStorage` (key: `household-store-v4`). Root layout gates rendering on hydration. All state survives app reloads.

## Type checking & tests

```bash
# Type-check
npm run lint              # client (baseUrl warning is expected)
cd server && npx tsc --noEmit   # server

# Client tests — mock backend business logic (56 tests)
npm test

# Server tests — integration tests against PostgreSQL (44 tests, requires Docker)
cd server && npm test
```

**Client tests** cover all mockBackend operations: households, members (CRUD, deletion guards, PIN, points), chores (CRUD, recurrence, uniqueness, points, override), supplies (flag, approve/reject, auto-approve, purchase), rewards (CRUD, archive, deletion guard), redemptions (redeem, fulfill, reject, refund), settings, templates.

**Server tests** use supertest against a real `household_test` database. Same coverage as client but validates HTTP status codes, SQL constraints, error handler mapping, and the full request/response cycle.

## Documentation

| File | Contents |
|------|----------|
| `CLAUDE.md` | AI assistant instructions — architecture, commands, conventions |
| `DOCS/ROADMAP.md` | Completed roadmap (11 items) + future ideas |
| `DOCS/household-app-plan.md` | Original MVP plan + all beyond-MVP additions |
| `DOCS/Points-Rewards-System.md` | Points system design + implementation plan |
| `DOCS/Rewards-Catalog-Plan.md` | Rewards catalog design + implementation plan |
| `server/BACKEND_PLAN.md` | Full backend architecture, schema, API routes |

## Current limitations

- **Local PIN auth only** — no external auth provider (Firebase/OAuth can replace later)
- **No component/E2E tests** — business logic + API integration only
- **Local backend only** — Docker + host Express; no deployment config
- **Parked features** — chore review gate, time-based supply edit window
