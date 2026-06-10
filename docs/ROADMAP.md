# Roadmap

Suggested next steps for the Household Manager app, roughly ordered by impact.

## ~~1. Persistence~~ (Done)
Zustand `persist` middleware with `AsyncStorage`. All state survives app reloads. Hydration gate in root layout.

## ~~2. Member management UI~~ (Done)
Collapsible "Members in family" section in Settings — add, edit (name, role, color), and remove household members. Last-admin guard shows alert.

## ~~3. Notifications / reminders~~ (Done)
Local notifications via `expo-notifications`:
- Chore due date reminders (scheduled at 9 AM on due date, auto-cancelled on complete/delete)
- Supply approval/rejection instant notifications
- Permission requested on app startup

## ~~4. Chore scheduling~~ (Done)
Completing a recurring chore auto-spawns the next instance with the computed due date (daily +1d, weekly +7d, monthly +1m). New instance gets its own notification. Non-recurring chores are unaffected. Uniqueness constraint: no two active chores with the same title for the same due date.

## ~~5. Local PIN auth~~ (Done)
Optional 4-digit PIN per member. Profile picker shows lock icon for PIN-protected members and prompts for PIN entry. Settings lets admins set/change/remove PINs via key icon per member. No external auth service — works fully offline. Real auth (Firebase etc.) can replace this later.

## ~~6. Backend API layer~~ (Done)
API contract (`src/api/contract.ts`) defines a typed `ApiBackend` interface. Mock backend (`src/api/mockBackend.ts`) implements it using the Zustand store. Repos are now thin wrappers that delegate to the backend and handle client-side concerns (notifications). To swap to a real backend (Firebase, Supabase, REST), implement `ApiBackend` in a new file and change the import in `src/api/index.ts`.

## ~~7. Real backend (Express + PostgreSQL + Docker)~~ (Done)
Full REST backend with Express + PostgreSQL (Docker). Toggled via `EXPO_PUBLIC_USE_REST_BACKEND` env var — no repo or screen changes needed.
- `server/` directory with Express app, pg Pool, migration runner, typed route handlers
- 6 SQL migrations (members, chores, chore_templates, supply_requests, household_settings, seed data)
- `src/api/restBackend.ts` implements `ApiBackend` with optimistic updates + background HTTP sync
- `syncAll()` fetches server state on app startup
- Member deletion guard enforced at 3 levels: client-side, server-side, DB (FK constraints)
- Error handler maps PostgreSQL error codes (23503 FK, 23505 unique) to proper HTTP statuses
- See `server/BACKEND_PLAN.md` for full architecture documentation

## ~~8. Multiple households~~ (Done)
All entities now carry `householdId`. Users pick (or create) a household before selecting a profile.
- New `Household` type: `{ id, name, createdAt }`; `householdId` added to `Member`, `Chore`, `ChoreTemplate`, `SupplyRequest`, `HouseholdSettings`
- Store gains `households`, `activeHouseholdId`; both backends filter `list*` by active household; all `create*` stamp `householdId`
- New `householdRepo` + `ApiBackend` household CRUD (list, get, create, update, remove)
- `app/index.tsx` is now a two-step entry: household picker → profile picker; "Switch household" button to go back
- Server: migration `007_add_households.sql` adds `households` table and `household_id` to all tables; new `/api/households` route; `X-Household-Id` header scopes all queries
- Chore uniqueness index now scoped to `household_id`; household deletion guard (cannot delete if members exist)
- All tab screens filter store data by `activeHouseholdId`

## ~~9. Points & rewards~~ (Done)
Completing a chore awards points to the assignee based on chore category (daily=5, weekly=10, monthly=15, seasonal=20 by default). Admins configure point values per category in Settings. Individual chores can override the category default via `pointsOverride`. Admins can manually adjust member points via trophy icon in Settings.
- `Member.points: number` accumulates earned points
- `Chore.pointsOverride?: number` overrides category default for a specific chore
- `HouseholdSettings`: `pointsDaily`, `pointsWeekly`, `pointsMonthly`, `pointsSeasonal`
- Home screen: points badge + leaderboard (members sorted by points DESC)
- Chores screen: points override field in create/edit form, points badge on cards
- Completion feedback: alert shows "+N points!" on chore completion
- Both backends compute and award points in `completeChore()`; new `adjustMemberPoints()` method
- Server: migration `008_add_points.sql`, `POST /members/:id/adjust-points` route
- Reopening a chore does NOT auto-deduct points
- Storage key bumped to `household-store-v3`

## ~~10. Admin auto-approve supplies~~ (Done)
When an admin flags a supply request, it is automatically approved — skips the `requested` step and goes straight to `approved` (appears on the shopping list immediately). Regular members still go through the normal request → admin approval flow. Enforced in both client backends and server.

## ~~11. Rewards catalog & redemption~~ (Done)
Members can spend points on admin-defined rewards. Admins manage a reward catalog (create, edit, archive, delete). Members browse active rewards and redeem with their points.
- `Reward`: `{ id, householdId, title, description?, cost, icon?, isActive, createdAt }`
- `Redemption`: `{ id, householdId, rewardId, rewardTitle, rewardCost, memberId, status, redeemedAt, decidedAt?, decidedById?, rejectionReason? }`
- `RedemptionStatus`: `pending → fulfilled` or `pending → rejected` (rejected = points refunded)
- Points deducted immediately on redeem; refunded on reject
- Reward deletion blocked if referenced by redemptions (archive instead)
- Denormalized `rewardTitle`/`rewardCost` on redemptions (survives reward edits)
- New Rewards tab (`app/(tabs)/rewards.tsx`, icon: `gift-outline`) visible to all members
- Admin FAB to create rewards; edit/archive/delete on reward cards
- Admin fulfills/rejects pending redemptions (same pattern as supply approval)
- Notifications on fulfill/reject
- Server: migration `009_add_rewards.sql`, `/api/rewards` and `/api/redemptions` routes
- Both backends + repos + i18n (en/vi) + store bumped to `household-store-v4`
- 4 sample rewards in seed data

## ~~12. Tests (Vitest)~~ (Done)
Two Vitest test suites:
- **Client** (56 tests): mockBackend business logic. RN modules mocked. Covers all operations.
- **Server** (44 tests): integration tests via supertest against `household_test` PostgreSQL. Validates HTTP statuses, SQL constraints, error handler mapping, full request/response cycle.
- Refactored `server/src/app.ts` to export `createApp()` for test use (separated from `index.ts` listen)
- Error handler updated: "Not enough points" → 409, "no longer available" → 422

## What's next
- Real auth (Firebase Auth / OAuth) — replace local PIN with token-based auth
- Chore review gate (admin approve before marking complete)
- Deploy backend (e.g. Railway, Fly.io, AWS)
