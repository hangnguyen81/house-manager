# Household Manager — MVP Plan (React Native + Expo)

A shared app for one household. Adults are admins; everyone can flag chores and supplies, but adults hold purchasing control. This doc covers the **lean MVP** with a **frontend-only / mock-data** build for now (backend slots in later).

---

## 1. Goals & non-goals

**MVP goals**

- One household, multiple members, two roles (admin / member).
- Admins assign and manage chores; members complete the ones assigned to them.
- Anyone can flag a supply as "running low"; admins approve and mark it purchased.
- Everything works against in-memory mock data — no real auth or network calls yet.

**Out of scope for MVP** (parked for later)

- ~~Multiple households / household switching.~~ (Now implemented — see §10)
- ~~Points, rewards, gamification.~~ (Fully implemented — see §10. Points accumulation, leaderboard, rewards catalog, and redemption.)
- ~~Recurring chore automation, calendars, push notifications.~~ (Now implemented — see §10)
- ~~Real backend~~ (Now implemented — Express + PostgreSQL + Docker, see §10). Auth, sync, offline conflict resolution still deferred.

Keeping the surface small here makes the eventual backend swap clean.

---

## 2. Roles & permissions

Two roles only — keep it binary for the MVP.

| Action | Admin (parent/adult) | Member (kid/other) |
|---|---|---|
| View household members | ✅ | ✅ |
| Add / remove / edit members | ✅ | ❌ |
| Create & assign chores | ✅ | ❌ |
| Complete a chore assigned to me | ✅ | ✅ |
| Mark someone else's chore complete | ✅ | ❌ |
| Flag a supply as running low | ✅ | ✅ |
| Approve / reject a supply request | ✅ | ❌ |
| Mark a supply as purchased | ✅ | ❌ |
| View shopping list | ✅ | ✅ (read-only) |

The key design principle you described: **flagging is open to everyone, spending is gated to admins.** A member can always raise a need; only an admin can act on the money side.

---

## 3. Core workflows

### 3.1 Chore assignment lifecycle

```
  (admin creates) → ASSIGNED → [Start, optional] → IN_PROGRESS → [Mark done] → COMPLETED
```

States: `assigned → in_progress → completed`. **No review gate in MVP** ("done is done"). `IN_PROGRESS` is optional — a member can go straight from `assigned` to `completed`.

Design notes:
- A future review gate (a `submitted` state + admin approve/reject-to-redo) can be added behind a per-household toggle; the MVP deliberately skips it. See 8.1.
- A chore has an optional `dueDate`. Overdue chores are derived in the UI (don't store a separate "overdue" state).
- Only the assignee or an admin can move a chore forward.

### 3.2 Supply "running low" → purchase flow

This is the workflow that makes the app more than a chore list. The split is: **member raises need → admin decides → admin buys.**

```
  Anyone: "We're low on milk"
            │
            ▼
     ┌─────────────┐
     │  REQUESTED  │   (created by any member)
     └─────────────┘
            │
     admin triages
       │        │
   reject     approve
       │        │
       ▼        ▼
 ┌─────────┐  ┌──────────┐
 │REJECTED │  │ APPROVED │  → appears on the Shopping List
 └─────────┘  └──────────┘
                   │ admin marks bought
                   ▼
              ┌───────────┐
              │ PURCHASED │
              └───────────┘
```

States: `requested → approved → purchased`, plus a `rejected` branch. **Admin shortcut**: when an admin flags a supply, it is auto-approved (skips `requested`, goes straight to `approved` on the shopping list).

Design notes:
- A supply request carries: item name, optional qty/note, who requested it, urgency (`normal` / `urgent`), timestamps.
- **Approved items auto-populate the Shopping List** — the shopping list is just a filtered view of supplies where `status = approved`. No separate data structure needed.
- When an admin checks an item off the shopping list, it transitions to `purchased` and drops off the active list.
- Optional nicety: a "pantry" of known recurring items so flagging "low on X" is one tap instead of typing. Park this — typing is fine for MVP.
- Rejected requests stay visible to the requester briefly with the reason ("we have plenty"), then archive. This avoids the "why did my request vanish?" confusion.

### 3.3 Member onboarding (mocked)

For MVP with no real auth: the admin adds members locally (name, role, avatar/color). A simple "Who are you?" picker on app launch selects the active profile. This stands in for real per-user login and keeps every screen testable. The profile picker is the one thing you'll rip out when auth lands.

---

## 4. Suggested screens & navigation

Bottom tab navigation, four tabs, with role-aware content rather than separate apps.

1. **Home / Today** — greeting for the active profile, my chores due today, count of pending supply requests (admins see "needs approval" badge).
2. **Chores** — list with filters (mine / everyone / by status). Admin gets a `+` to create & assign. Tapping a chore opens its detail + action buttons appropriate to role/state.
3. **Supplies** — two sections: "Flagged" (requested/approved) and a `+` to flag something low. Admins get approve/reject buttons inline.
4. **Shopping** — the approved-but-not-purchased list. Admin can check items off (→ purchased). Members see it read-only.

Plus:
- **Profile picker** (modal on launch) — pick active member.
- **Members** screen (admin only, reached from Home or a settings icon) — add/edit/remove members.

Role differences are handled by conditionally rendering action buttons, not by building two navigators.

---

## 5. Mock data model (TypeScript)

These types are written so the eventual backend can return the same shapes. Keep them in `src/types/`.

```ts
export type Role = 'admin' | 'member';

export interface Member {
  id: string;
  name: string;
  role: Role;
  color: string;        // for avatar fallback
  avatarUrl?: string;
}

// MVP: no review gate. 'submitted' reserved for a future toggle.
export type ChoreStatus = 'assigned' | 'in_progress' | 'completed';

export interface Chore {
  id: string;
  title: string;
  description?: string;
  assigneeId: string;       // Member.id
  createdById: string;      // admin who created it
  status: ChoreStatus;
  dueDate?: string;         // ISO date
  createdAt: string;
  completedAt?: string;
}

export type SupplyStatus = 'requested' | 'approved' | 'rejected' | 'purchased';
export type Urgency = 'normal' | 'urgent';

export interface SupplyRequest {
  id: string;
  name: string;             // "Milk"
  quantity?: string;        // "2 cartons" — free text for MVP
  note?: string;
  urgency: Urgency;
  status: SupplyStatus;
  requestedById: string;    // any member
  decidedById?: string;     // admin who approved/rejected
  rejectionReason?: string;
  createdAt: string;
  purchasedAt?: string;
  decidedAt?: string;       // when approved/rejected — drives the 1-week archive
}

export type Language = 'en' | 'vi';   // MVP languages; 'en' is default/fallback

// Household-level settings (single household in MVP)
export interface HouseholdSettings {
  rejectionVisibility: 'immediate' | '1_day' | '1_week' | 'forever'; // default '1_week'
  shoppingTime?: string;    // optional ISO datetime; powers the future edit-time gate
  language: Language;       // app language; defaults to device locale if 'vi', else 'en'
}
```

**Editability (MVP, status-based — see 8.2):** a `SupplyRequest` is editable only while `status === 'requested'`. `approved` and `purchased` are locked; the requester can cancel a `requested` item but must ask an admin to undo an `approved` one. A rejected item is hidden from the requester once `now > decidedAt + rejectionVisibility`.

**Derived, not stored:** overdue chores, the shopping list (`supplies.filter(s => s.status === 'approved')`), and per-member chore counts.

### Seed data sketch

```ts
export const mockMembers: Member[] = [
  { id: 'm1', name: 'Mom',   role: 'admin',  color: '#E8743B' },
  { id: 'm2', name: 'Dad',   role: 'admin',  color: '#19A979' },
  { id: 'm3', name: 'Ava',   role: 'member', color: '#945ECF' },
  { id: 'm4', name: 'Leo',   role: 'member', color: '#1F77B4' },
];

export const mockChores: Chore[] = [
  { id: 'c1', title: 'Take out recycling', assigneeId: 'm4',
    createdById: 'm1', status: 'assigned', dueDate: '2026-06-10',
    createdAt: '2026-06-09T08:00:00Z' },
  { id: 'c2', title: 'Load dishwasher', assigneeId: 'm3',
    createdById: 'm1', status: 'in_progress',
    createdAt: '2026-06-09T08:00:00Z' },
];

export const mockSupplies: SupplyRequest[] = [
  { id: 's1', name: 'Milk', quantity: '2 cartons', urgency: 'urgent',
    status: 'requested', requestedById: 'm3',
    createdAt: '2026-06-09T07:30:00Z' },
  { id: 's2', name: 'Dish soap', urgency: 'normal',
    status: 'approved', requestedById: 'm4', decidedById: 'm2',
    createdAt: '2026-06-08T19:00:00Z' },
];
```

---

## 6. Suggested tech & structure

- **Expo (managed) with a development build** (custom dev client) — **not Expo Go**. See "Development build" below.
- **expo-router** for file-based navigation — fastest path for a small app.
- **TypeScript** throughout.
- **State:** a single store with [Zustand](https://github.com/pmndrs/zustand) holding members, chores, supplies, and `activeMemberId`. It's tiny and the actions map cleanly to future API calls. (Context + reducer also fine; Redux is overkill here.)
- **Data layer abstraction:** put all reads/writes behind a `repository` module (e.g. `choreRepo.assign()`, `supplyRepo.approve()`) that currently mutates the mock store. When the backend arrives, you reimplement the repo and the screens don't change. **This is the single most important structural choice** for an easy backend swap.
- **UI kit:** Expo's defaults + a light component set, or `react-native-paper` / NativeWind if you want speed. Your call.
- **i18n:** `i18next` + `react-i18next` + `expo-localization` (English/Vietnamese) — see section 9.

### Development build (not Expo Go)

> Confidence note: the workflow below (`expo-dev-client` + EAS Build, or local `expo run:` builds) is the standard, current Expo approach. Exact CLI flags and EAS config evolve between versions — verify against current Expo docs when you set it up.

A **development build** is your own debug build of the app that includes the `expo-dev-client` runtime instead of the generic Expo Go shell. Why it fits here:

- You can add **any native module / config plugin** later (e.g. push notifications, secure storage, a real auth SDK) — Expo Go can't load arbitrary native code, a dev build can.
- It's still the fast JS dev loop: the dev client connects to the Metro bundler and hot-reloads JS exactly like Expo Go. You only rebuild the client when native deps change.
- Same binary shape you'll ship later, so fewer surprises moving toward production.

Setup outline:

1. `npx expo install expo-dev-client`.
2. **Build the dev client** — two options:
   - **EAS Build (cloud):** add a `development` profile in `eas.json` (`developmentClient: true`, `distribution: "internal"`), then `eas build --profile development --platform ios|android`. Install the resulting build on a simulator/device.
   - **Local build:** `npx expo run:ios` / `npx expo run:android` (needs Xcode / Android Studio toolchains locally).
3. **Run the dev server:** `npx expo start --dev-client`, then open the installed dev build (not Expo Go).

`eas.json` profile sketch:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    }
  }
}
```

For MVP (frontend, mock data, no native deps yet) a dev build isn't strictly required, but standing it up now means adding the first native dependency later is a non-event rather than a migration.

### Suggested layout

```
src/
  types/            # Member, Chore, SupplyRequest
  data/
    mockSeed.ts
    store.ts        # Zustand store
    repositories/   # choreRepo, supplyRepo, memberRepo  <-- swap target
  features/
    chores/
    supplies/
    shopping/
    members/
  components/        # shared UI
  app/               # expo-router screens (tabs, modals)
```

---

## 7. Build roadmap (lean MVP)

1. **Scaffold** — Expo + expo-router + TS, bottom tabs, types, mock seed, Zustand store, repository layer. **Install `expo-dev-client` and build a development build** (EAS `development` profile or `expo run:`) — run via `expo start --dev-client`, not Expo Go. **Set up i18n now** (i18next + en/vi files) so every screen uses `t()` from the start.
2. **Profiles** — launch profile picker, `activeMemberId`, role-aware UI helper (`useRole()`). Add the language switcher to settings.
3. **Chores** — list + filters, admin create/assign, status transitions, reject-to-redo branch.
4. **Supplies** — flag-low form, admin approve/reject, urgency badge.
5. **Shopping** — approved-items view, check-off → purchased, member read-only.
6. **Polish** — empty states, overdue styling, Home dashboard counts.
7. ~~**Backend swap**~~ **(Done)** — Express + PostgreSQL backend with optimistic updates, toggled via env var. Auth + profile picker replacement still deferred.

---

## 8. Decisions (settled)

- **Chore review gate:** ❌ No gate for MVP — "done is done." A member's "Mark done" goes straight to `completed`. (`submitted` state is removed from the MVP chore lifecycle — see 8.1.)
- **Urgency surfacing:** Sort only — urgent requests float to the top of the admin's list. No notifications in MVP.
- **Rejected request visibility:** Stay visible to the requester for **1 week**, then archive. Built against a `rejectionVisibility` setting (default `'1_week'`) so it can later become a household preference: `immediate | 1_day | 1_week | forever`.
- **Supply request editing:** ✅ Status-based. Editable while `requested`; **locked once `approved`**; `purchased` is final. Requester can cancel a `requested` item but must ask an admin to undo an `approved` one. (The time-based shopping-window gate is parked as a post-MVP enhancement — see 8.2.)
- **Multiple households:** ❌ Out of MVP — the data model assumes a **single household**. No `householdId` foreign keys yet.

### 8.1 Updated chore lifecycle (no review gate)

```
(admin creates) → ASSIGNED → [member: Start] → IN_PROGRESS → [member: Mark done] → COMPLETED
```

`IN_PROGRESS` stays optional. There's no `submitted` step and no reject-to-redo branch in MVP. (If parents later want oversight, reintroduce `submitted` + the review gate behind a per-household toggle — the type already leaves room.)

### 8.2 Supply editing gate — DECIDED: status-based

**MVP rule (confirmed):**

- A request is **editable while `requested`** — the requester can change name/qty/note/urgency, or cancel it outright.
- Once **`approved`**, it **locks**. The admin now owns it (they've decided to buy it; editing under them is confusing). The requester can ask an admin to undo the approval, which returns it to `requested` and re-opens editing.
- **`purchased`** is final.

Enforcement lives in the repository layer: `supplyRepo.edit(id, …)` and `supplyRepo.cancel(id)` reject unless `status === 'requested'`. The UI hides edit/cancel controls for non-`requested` items so the rule is visible, not just enforced.

**Parked (post-MVP): time-based shopping-window gate.** Your original idea — editable until 15 minutes before shopping time — is a good later enhancement. The lightest future version: add a household `shoppingTime` (already stubbed in `HouseholdSettings`), lock editing when `now >= shoppingTime - 15min` regardless of status, and show a countdown ("edits lock in 2h 15m"). The status-based rule above is a strict subset, so adding this later won't require reworking the data model.

---

## 9. Internationalization (i18n)

**MVP languages:** English (`en`, default + fallback) and Vietnamese (`vi`).

### Suggested stack

> Confidence note: `i18next` + `react-i18next` is the mainstream, well-documented choice for React Native and pairs cleanly with Expo. `expo-localization` for reading the device locale is the standard Expo API. The exact APIs below are typical usage — worth a quick check against current package docs when you install, since minor API details shift between versions.

- **`i18next` + `react-i18next`** — translation lookup, the `useTranslation()` hook, interpolation, and pluralization (Vietnamese has no plural forms, English has two — i18next handles both rule sets for you).
- **`expo-localization`** — read the device's preferred locale on first launch to pick the initial language.
- Persist the user's explicit choice (e.g. via AsyncStorage / your settings store) so a manual override survives restarts and beats the device locale.

### Language resolution order

1. User's saved choice in `HouseholdSettings.language` (if set).
2. Else device locale from `expo-localization` — use `vi` if the device is Vietnamese, otherwise `en`.
3. Else fall back to `en`.

### Structure

```
src/
  i18n/
    index.ts            # i18next init, language detection + persistence
    en.json             # English strings (source of truth)
    vi.json             # Vietnamese strings
```

Translation files are flat-ish namespaced JSON keyed by feature, e.g.:

```json
// en.json
{
  "chores": {
    "title": "Chores",
    "markDone": "Mark done",
    "dueOn": "Due {{date}}",
    "assignedTo": "Assigned to {{name}}"
  },
  "supplies": {
    "flagLow": "Flag as running low",
    "urgent": "Urgent",
    "approve": "Approve",
    "reject": "Reject"
  }
}
```

```json
// vi.json
{
  "chores": {
    "title": "Công việc nhà",
    "markDone": "Đánh dấu hoàn thành",
    "dueOn": "Hạn {{date}}",
    "assignedTo": "Giao cho {{name}}"
  },
  "supplies": {
    "flagLow": "Báo sắp hết",
    "urgent": "Khẩn cấp",
    "approve": "Duyệt",
    "reject": "Từ chối"
  }
}
```

Usage in a component: `const { t } = useTranslation(); ...t('chores.markDone')`.

### Rules to keep the build clean

- **No hard-coded user-facing strings** — every label/button/message goes through `t()` from day one. Retrofitting i18n later is painful; doing it up front is nearly free.
- **`en.json` is the source of truth.** Keep `vi.json` key-for-key identical. A tiny "missing keys" check (en keys − vi keys) in CI or a script catches gaps.
- **Dates, numbers, currency are locale-sensitive too** — format them via `Intl` / a date library with the active locale, not by string-concatenation. (Vietnamese uses `dd/mm/yyyy` and `.`/`,` differently than English.)
- **Interpolate, don't concatenate** — use `t('chores.dueOn', { date })`, never `t('due') + date`, because word order differs across languages.
- **Mock data stays language-neutral** where possible (member names, item names are user data, not UI chrome — they aren't translated).
- **Settings screen** gets a simple language switcher (English / Tiếng Việt) writing to `HouseholdSettings.language`. This is per-app for MVP; a per-member preference can come later alongside real auth.

### Scope note

Only static UI chrome is translated in MVP. User-entered content (chore titles, supply names, notes) is shown as typed — no machine translation.

---

## 10. Implemented beyond MVP

The following features have been built on top of the original MVP plan:

### Chore enhancements
- **Recurrence** — chores support `daily`, `weekly`, `monthly`, or `none`. New `Recurrence` type and field on `Chore`.
- **Auto-scheduling** — completing a recurring chore auto-spawns the next instance (daily +1d, weekly +7d, monthly +1m) with computed due date and notification.
- **Chore templates** — household catalog of chores grouped by `ChoreCategory` (daily, weekly, monthly, seasonal). Managed in Settings; used as quick-picks during chore creation via a category-first flow.
- **Uniqueness constraint** — no two active (assigned/in_progress) chores with the same title can exist for the same due date. Enforced in `create()`, `edit()`, and auto-spawn.

### Points & rewards
- Completing a chore awards points to the assignee based on category defaults (daily=5, weekly=10, monthly=15, seasonal=20) or per-chore `pointsOverride`
- Admins configure point values per category in Settings; can manually adjust member points via trophy icon
- Home screen shows points badge and leaderboard (members sorted by points DESC)
- Chores screen shows points override field in create/edit, points badge on cards with override
- Both backends compute points in `completeChore()` and return `pointsAwarded`; new `adjustMemberPoints()` API method
- Server: migration `008_add_points.sql`; `POST /members/:id/adjust-points` route (admin-only)
- Reopening a chore does NOT auto-deduct points

### Persistence
- Zustand `persist` middleware with `AsyncStorage`. All state survives app reloads (storage key: `household-store-v4`). Root layout gates rendering on hydration.

### Theming
- "Evergreen" light/dark theme (`src/theme/index.ts`). Forest green primary with amber accents. All screens use `useTheme()` hook — no hardcoded colors. Theme toggle in Settings; preference stored in `HouseholdSettings.theme`.

### Notifications
- Local notifications via `expo-notifications`. Chore due date reminders scheduled at 9 AM (auto-cancelled on complete/delete). Instant notifications on supply approval/rejection. Permission requested on app startup.

### Member management UI
- Collapsible "Members in family" section in Settings. Admins can add, edit (name, role, color), and remove household members. Last-admin guard prevents lockout.

### Navigation & UI
- Bottom tab icons via `@expo/vector-icons` (Ionicons).
- Settings tab is admin-only (hidden via `href: null` for non-admins).
- Full CRUD on all screens: Chores, Supplies, Shopping.
- Filter bars with per-member filtering on Chores, status filtering on Supplies, to-buy/purchased on Shopping.
- Shopping screen uses `SectionList` to group items by date — to-buy by approval date (`decidedAt`), purchased by purchase date (`purchasedAt`). Shows "Today"/"Yesterday" for recent dates.
- Chores list sorted: incomplete first (latest due date on top, no-due-date at bottom), completed after.
- Settings screen order: Members management → House chores management → Points configuration → Language → Theme.

### Updated data model additions
- `Household: { id, name, createdAt }` — household entity
- `householdId: string` — added to `Member`, `Chore`, `ChoreTemplate`, `SupplyRequest`, `HouseholdSettings`
- `Chore.recurrence: Recurrence` — chore repeat frequency
- `Chore.notificationId?: string` — tracks scheduled notification
- `Chore.pointsOverride?: number` — override category default points for this chore
- `ChoreTemplate: { id, title, category }` — chore catalog entry
- `ChoreCategory: 'daily' | 'weekly' | 'monthly' | 'seasonal'`
- `Member.pin?: string` — optional 4-digit PIN for local auth
- `Member.points: number` — accumulated reward points (default 0)
- `HouseholdSettings.theme: ThemeMode` — light/dark preference
- `HouseholdSettings.pointsDaily/Weekly/Monthly/Seasonal: number` — configurable point values per chore category
- `ThemeMode: 'light' | 'dark'`

### Local PIN auth
- Optional 4-digit PIN per member. Profile picker shows lock icon and prompts for PIN on protected members. Admins manage PINs in Settings (set/change/remove per member). No external service — works fully offline. PINs are persisted with the store via AsyncStorage.

### API backend layer
- `src/api/contract.ts` — typed `ApiBackend` interface covering all operations (members, chores, templates, supplies, settings)
- `src/api/mockBackend.ts` — mock implementation with all business rules (guards, validation, state mutations) using the Zustand store
- `src/api/restBackend.ts` — REST implementation with Express + PostgreSQL backend, optimistic updates, and `syncAll()` for startup data fetch
- `src/api/index.ts` — env-var toggle: `EXPO_PUBLIC_USE_REST_BACKEND=true` uses REST, otherwise mock
- Repos refactored to thin wrappers: delegate data operations to the backend, handle client-side concerns (notifications) locally
- Both backends enforce identical guards client-side (admin checks, duplicate chores, member deletion with dependency checks)

### Real backend (Express + PostgreSQL + Docker)
- `server/` directory with Express app, PostgreSQL via Docker Compose
- 9 SQL migrations: members, chores (with partial unique index), chore_templates, supply_requests, household_settings (single-row), seed data, households, points
- Migration runner tracks applied migrations in `_migrations` table, runs automatically on server startup
- Routes mirror the `ApiBackend` interface 1:1 under `/api` prefix
- Actor identity via `X-Actor-Id` header; IDs generated client-side and sent to server
- Error handler maps both app-level messages and PostgreSQL error codes (23503 FK violation, 23505 unique violation) to proper HTTP statuses
- Member deletion guard enforced at 3 levels: client-side (store check), server-side (query check), database (FK `ON DELETE RESTRICT`)
- `notificationId` is client-only — never sent to or stored on the server
- `docker-compose.yml` runs PostgreSQL 16 Alpine; Express runs on host via `npm run dev`
- See `server/BACKEND_PLAN.md` for full architecture documentation

### Multiple households
- All entities now carry `householdId`. Users pick (or create) a household before selecting a profile.
- New `Household` type + `householdRepo` + `ApiBackend` household CRUD
- `app/index.tsx` is a two-step entry: household picker → profile picker; "Switch household" to go back
- Store gains `households` array + `activeHouseholdId`; both backends filter `list*` by active household; all `create*` stamp `householdId`
- Server: migration `007_add_households.sql`; new `/api/households` route; `X-Household-Id` header scopes all queries
- Chore uniqueness index scoped to `household_id`; household deletion guard (cannot delete if members exist)
- All tab screens filter store data by `activeHouseholdId`
- `HouseholdSettings` is now per-household (keyed by `household_id` instead of single-row `id=1`)

### Rewards catalog & redemption
- `Reward: { id, householdId, title, description?, cost, icon?, isActive, createdAt }` — admin-managed catalog
- `Redemption: { id, householdId, rewardId, rewardTitle, rewardCost, memberId, status, redeemedAt, ... }` — spend receipt with denormalized title/cost
- `RedemptionStatus: 'pending' | 'fulfilled' | 'rejected'` — admin fulfills or rejects (rejected = points refunded)
- Points deducted immediately on redeem; reward deletion blocked if referenced by redemptions (archive instead)
- New Rewards tab (`app/(tabs)/rewards.tsx`, icon: `gift-outline`) — catalog + redeem + admin management
- Server: migration `009_add_rewards.sql`, `/api/rewards` and `/api/redemptions` routes
- Both backends + repos (`rewardRepo`, `redemptionRepo`) + i18n + notifications on fulfill/reject
- Storage key bumped to `household-store-v4`
