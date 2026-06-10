# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Household Manager — a shared household app (chores + supply requests) built with **Expo SDK 56 + expo-router + TypeScript** using a development build (not Expo Go). Supports two backends: an in-memory mock (default) and a real **Express + PostgreSQL** backend — toggled via `EXPO_PUBLIC_USE_REST_BACKEND` env var. All data access goes through a repository layer; switching backends requires no repo or screen changes.

## Common Commands

```bash
# Start dev server (requires dev client build on device/simulator)
npm start                    # or: npx expo start --dev-client

# Build dev client locally
npx expo run:ios             # or: npx expo run:android

# Build dev client via EAS
npx eas build --profile development --platform ios

# Type-check (this is the only lint command)
npm run lint                 # runs: tsc --noEmit

# Run tests
npm test                     # vitest run (single run)
npm run test:watch           # vitest (watch mode)

# Install Expo-compatible packages (always prefer this over npm install for Expo packages)
npx expo install <package> -- --legacy-peer-deps

# Start backend (PostgreSQL via Docker + Express on host)
docker compose up -d                      # start PostgreSQL
cd server && npm install && npm run dev   # start Express (runs migrations + seeds)

# Type-check server code
cd server && npx tsc --noEmit

# Run server tests (requires Docker PostgreSQL running)
cd server && npm test        # vitest run against household_test DB
cd server && npm run test:watch
```

Note: `--legacy-peer-deps` is required due to a `react-dom` peer dependency conflict with the pinned `react@19.2.3` (must match `react-native-renderer` bundled in react-native 0.85.3).

**Testing**: Two Vitest setups:
- **Client** (`src/**/*.test.ts`): unit tests for mockBackend business logic. RN module mocks in `src/__tests__/setup.ts`. Use `resetStore()` from `src/__tests__/helpers.ts` in `beforeEach`.
- **Server** (`server/src/**/*.test.ts`): integration tests hitting a real `household_test` PostgreSQL database via supertest. Setup in `server/src/__tests__/setup.ts` runs migrations and reseeds before each test. Requires Docker PostgreSQL running. `server/src/app.ts` exports `createApp()` for test use.

## Architecture

### API Layer (`src/api/`)
- `contract.ts` — typed `ApiBackend` interface defining all backend operations (households, members, chores, templates, supplies, settings, points, rewards, redemptions)
- `mockBackend.ts` — mock implementation using the Zustand store (all business rules, validation, guards live here)
- `restBackend.ts` — REST implementation using Express + PostgreSQL with optimistic updates; `syncAll()` fetches server state on startup
- `index.ts` — env-var toggle: `EXPO_PUBLIC_USE_REST_BACKEND=true` uses REST, otherwise mock

Both backends enforce the same guards client-side (admin checks, duplicate chores, member deletion with dependency checks). The REST backend additionally fires background HTTP requests and reconciles with server responses.

### Server (`server/`)
Express + PostgreSQL backend running locally (PostgreSQL in Docker, Express on host).
- `server/src/index.ts` — entry point: runs migrations, mounts routes, starts Express on PORT (default 3000)
- `server/src/db.ts` — pg Pool from `DATABASE_URL`
- `server/src/migrate.ts` — reads SQL from `server/migrations/`, tracks in `_migrations` table
- `server/src/mappers.ts` — snake_case DB rows to camelCase domain types
- `server/src/middleware/` — `actorId.ts` (X-Actor-Id + X-Household-Id headers), `errorHandler.ts` (error → HTTP status including PG error codes 23503/23505)
- `server/src/routes/` — households, members, chores, choreTemplates, supplies, settings, rewards, redemptions
- `server/src/helpers/` — `guards.ts` (requireAdmin/requireActor via DB), `recurrence.ts` (nextDueDate)
- `server/migrations/` — 9 SQL files (schema + seed data + households migration + points + rewards)

### Repository Pattern
Repos in `src/data/repositories/` are thin wrappers that delegate to the API backend and handle client-side concerns (notifications):
- `householdRepo` — delegates household CRUD to backend
- `choreRepo` — delegates CRUD + status transitions to backend, schedules/cancels local notifications
- `choreTemplateRepo` — delegates to backend
- `supplyRepo` — delegates to backend, sends instant notifications on approve/reject; exports derived selectors (`shoppingList`, `pendingRequests`, `visibleRejections`)
- `memberRepo` — delegates to backend (includes PIN management + points adjustment)
- `rewardRepo` — delegates reward CRUD to backend; `activeRewards()` derived selector
- `redemptionRepo` — delegates redemption ops to backend; sends notifications on fulfill/reject

### Store (`src/data/store.ts`)
Zustand store with `persist` middleware backed by `AsyncStorage`. All state (households, members, chores, supplies, templates, rewards, redemptions, settings, active household, active member) survives app reloads. Storage key: `household-store-v4`. Mock seed data is used as initial defaults only — once persisted data exists, it takes precedence.

The root layout (`app/_layout.tsx`) waits for hydration via `useStore.persist.onFinishHydration` before rendering, syncs the persisted language to i18next, and calls `syncAll()` when the REST backend is active.

Exposes `getState`/`setState` vanilla accessors so repositories can read/write outside React components.

### Business Rules (enforced in backends + server, not UI)
- Supply requests are editable/cancellable only while `requested`; approve/reject/markPurchased are admin-only. When an admin flags a supply, it is auto-approved (skips the `requested` step and goes straight to `approved` on the shopping list).
- Chores support recurrence (`none`, `daily`, `weekly`, `monthly`). Create/edit/delete are admin-only; assignee or admin can change status.
- **Chore uniqueness**: no two active (assigned/in_progress) chores with the same title can exist for the same due date within the same household. Chores without a due date allow only one active instance per title per household. Enforced in `create()`, `edit()`, and auto-spawn skips silently on conflict. DB enforces via partial unique index scoped to `household_id`.
- **Member deletion guard**: cannot delete a member who is still referenced by chores (assignee/creator) or supply requests (requester/decider). Enforced at 3 levels: client-side (both backends), server-side (app-level check), and database (FK `ON DELETE RESTRICT`).
- Derived data is never stored: shopping list = supplies filtered to `approved`; rejection visibility is computed from `decidedAt` + `settings.rejectionVisibility`
- Shopping screen groups items by date using `SectionList` — to-buy by approval date (`decidedAt`), purchased by purchase date (`purchasedAt`), with "Today"/"Yesterday" labels
- Chores list sorted: incomplete first (latest due date on top), completed after
- **Points system**: completing a chore awards points to the assignee. Point values are configurable per chore category in `HouseholdSettings` (`pointsDaily`, `pointsWeekly`, `pointsMonthly`, `pointsSeasonal`). Individual chores can override the category default via `pointsOverride`. Admins can manually adjust member points. Points are accumulated on `Member.points`. Reopening a chore does NOT auto-deduct points.
- **Rewards catalog & redemption**: admins create rewards with a point cost. Members redeem rewards (points deducted immediately). Admins fulfill or reject redemptions (rejected = points refunded). Rewards can be archived (hidden from catalog). Deletion blocked if referenced by redemptions. Reward title/cost denormalized on redemptions.
- `src/data/repositories/util.ts` provides `requireActor` / `requireAdmin` guards

### Theming (`src/theme/index.ts`)
"Evergreen" theme with light and dark modes. `ThemeContext` wraps the app in `_layout.tsx`; all screens use the `useTheme()` hook for colors. No hardcoded colors in screens — everything comes from theme tokens. Theme preference is stored in `HouseholdSettings.theme` and toggled in Settings.

When adding new UI, always use `const { colors } = useTheme()` and apply colors inline (e.g. `{ backgroundColor: colors.card }`). Never add hardcoded hex colors to StyleSheet.

### Multiple Households
The app supports multiple households. Each household has its own members, chores, templates, supplies, and settings. All entities carry a `householdId` field.

- **Entry flow**: `app/index.tsx` is a two-step gate — household picker first, then profile picker (filtered to that household's members)
- **Data scoping**: both backends filter `list*` results by `activeHouseholdId`; all `create*` methods stamp `householdId` on new entities; all tab screens filter store data by `activeHouseholdId`
- **REST scoping**: client sends `X-Household-Id` header on every request; server routes scope queries by `household_id` when the header is present
- **Household CRUD**: `householdRepo` / `ApiBackend.createHousehold()` etc.; creating a household auto-creates its settings row
- **Deletion guard**: cannot delete a household that still has members

### Routing
Uses expo-router file-based routing in `app/`:
- `app/index.tsx` — two-step entry: household picker → profile picker (stands in for auth)
- `app/(tabs)/` — bottom tab navigator with Ionicons (`@expo/vector-icons`): Home, Chores, Supplies, Shopping, Rewards, Settings
- `app/(tabs)/rewards.tsx` — rewards catalog, redemption, admin management (visible to all members)
- `app/(tabs)/settings.tsx` — member management, chore template catalog, points configuration, language, theme (admin-only tab, hidden via `href: null` for non-admins). Members, chore categories, and points config are collapsible sections.

### i18n
- i18next with `react-i18next`; initialized in `app/_layout.tsx`
- Uses `compatibilityJSON: 'v3'` (Hermes runtime lacks `Intl.PluralRules`)
- `src/i18n/en.json` is source of truth; `vi.json` must be kept key-for-key identical
- All user-facing strings use `t()` — never hardcode display text
- `useRole` hook (`src/hooks/useRole.ts`) provides `{ actor, isAdmin }` for role-aware UI

### Path Aliases
`@/*` maps to `src/*` (configured in tsconfig.json).

### Chore Templates
The household maintains a catalog of chores grouped by frequency (`ChoreCategory`: daily, weekly, monthly, seasonal). Templates are managed in Settings. When creating a new chore, the flow is category-first: pick a category (which auto-sets recurrence), then either select a template from that category or type a custom title.

### Types
All domain types in `src/types/index.ts`: `Household`, `Member` (with `points`), `Chore` (with `pointsOverride`), `ChoreTemplate`, `ChoreCategory`, `SupplyRequest`, `HouseholdSettings` (with `pointsDaily/Weekly/Monthly/Seasonal`), `Reward`, `RedemptionStatus`, `Redemption`, `ThemeMode`, `Recurrence`, and their associated union types. All entities carry `householdId: string`.

### Key Dependencies
- `react@19.2.3` — must match `react-native-renderer` bundled in react-native 0.85.3 (do not upgrade independently)
- `@expo/vector-icons` — Ionicons used for tab bar and UI icons
- `expo-linking` — required by expo-router (native module, needs rebuild if added)
- `@react-native-async-storage/async-storage` — persistence backend for Zustand store (native module, needs rebuild if added)
- `expo-notifications` — local notifications for chore reminders and supply status changes (native module, needs rebuild if added)

Server dependencies (in `server/package.json`):
- `express`, `pg`, `cors`, `dotenv` — runtime
- `typescript`, `ts-node-dev`, `@types/*` — dev

## Current Limitations
- Local PIN auth only — no external auth provider (Firebase etc. can replace later)
- Backend runs locally only (Docker + host Express); no deployment config yet

## Documentation
- `DOCS/ROADMAP.md` — roadmap with completed items + future ideas
- `DOCS/household-app-plan.md` — original MVP plan + implemented-beyond-MVP notes
- `DOCS/Points-Rewards-System.md` — points & rewards implementation plan (done)
- `DOCS/Rewards-Catalog-Plan.md` — rewards catalog/redemption plan
