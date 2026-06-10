# Plan: Points & Rewards System

## Context
The household manager app tracks chores and supplies. Points/rewards has been on the roadmap since the start. The goal is to motivate members (especially kids) by awarding points when chores are completed — with a leaderboard on the Home screen and admin-configurable point values per chore category.

**Scope**: Point accumulation + leaderboard. No rewards catalog or redemption — just earning and displaying points.

## Design Decisions

- **Points on Member** — `points: number` added directly to `Member` (default 0). Simplest approach; no separate points table needed.
- **Point values per category** — Stored in `HouseholdSettings` as `pointsDaily`, `pointsWeekly`, `pointsMonthly`, `pointsSeasonal`. Admins configure in Settings.
- **Per-chore override** — Optional `pointsOverride?: number` on `Chore`. When set, overrides the category default. Useful for special chores.
- **Points awarded in `completeChore`** — Both backends compute and award points when a chore is completed. Return type becomes `{ completed, spawned?, pointsAwarded }`.
- **Reopening a chore does NOT auto-deduct** — Admins can manually adjust if needed via `adjustMemberPoints`.
- **Seasonal chores** — `Recurrence` has no `seasonal` value, so `none`-recurrence chores default to `pointsDaily` unless `pointsOverride` is set. When creating from a seasonal category, auto-set `pointsOverride` to `pointsSeasonal`.
- **Leaderboard** — Derived client-side from `listMembers()` sorted by `points DESC`. Shown on Home screen.

## Implementation Order

### Phase 1: Types + Seed + Contract

**`src/types/index.ts`**
- Add `points: number` to `Member`
- Add `pointsOverride?: number` to `Chore`
- Add to `HouseholdSettings`: `pointsDaily: number`, `pointsWeekly: number`, `pointsMonthly: number`, `pointsSeasonal: number`

**`src/data/mockSeed.ts`**
- Add `points: 0` to each mock member
- Add `pointsDaily: 5, pointsWeekly: 10, pointsMonthly: 15, pointsSeasonal: 20` to `defaultSettings`

**`src/api/contract.ts`**
- Change `completeChore` return: `{ completed: Chore; spawned?: Chore; pointsAwarded: number }`
- Add `pointsOverride?: number` to `CreateChoreInput` and `UpdateChoreInput`
- Add method: `adjustMemberPoints(actorId: string, memberId: string, delta: number): Member`

### Phase 2: Server (DB + Routes + Mappers)

**`server/migrations/008_add_points.sql`**
```sql
ALTER TABLE members ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE chores ADD COLUMN IF NOT EXISTS points_override INTEGER;
ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS points_daily INTEGER NOT NULL DEFAULT 5;
ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS points_weekly INTEGER NOT NULL DEFAULT 10;
ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS points_monthly INTEGER NOT NULL DEFAULT 15;
ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS points_seasonal INTEGER NOT NULL DEFAULT 20;
```

**`server/src/mappers.ts`**
- `MemberRow` + `rowToMember`: add `points`
- `ChoreRow` + `rowToChore`: add `points_override` → `pointsOverride`
- `SettingsRow` + `rowToSettings`: add four `points_*` fields

**`server/src/routes/chores.ts`** — `POST /:id/complete`
- After marking complete, look up household settings for point values
- Compute: `chore.points_override ?? settings.points_<recurrence>` (default to `points_daily` for `none`)
- `UPDATE members SET points = points + $1 WHERE id = $2`
- Return `{ completed, spawned, pointsAwarded }`
- Also handle `points_override` in POST (create) and PATCH (update)

**`server/src/routes/members.ts`** — New `POST /:id/adjust-points`
- `requireAdmin`
- `UPDATE members SET points = points + $1 WHERE id = $2 RETURNING *`
- Return updated member

**`server/src/routes/settings.ts`** — PATCH handler
- Handle `pointsDaily`, `pointsWeekly`, `pointsMonthly`, `pointsSeasonal` fields

### Phase 3: Both Client Backends

**`src/api/mockBackend.ts`**
- Add helper `chorePoints(chore)`: returns `chore.pointsOverride ?? settings.points<Recurrence>`
- In `completeChore`: after status update, compute points, increment assignee's `member.points` in store, return `{ completed, spawned, pointsAwarded }`
- Add `adjustMemberPoints(actorId, memberId, delta)`: requireAdmin, update member.points in store
- Update `createChore` / `updateChore` to pass through `pointsOverride`

**`src/api/restBackend.ts`**
- Mirror mockBackend logic for `completeChore` (optimistic points increment + background HTTP)
- Add `adjustMemberPoints` with optimistic update + `POST /members/:id/adjust-points`
- Update `createChore` / `updateChore` to include `pointsOverride` in request body

### Phase 4: Repository Layer

**`src/data/repositories/choreRepo.ts`**
- `complete(id)` return type changes to `{ completed: Chore; pointsAwarded: number }`
- Destructure `pointsAwarded` from `api.completeChore()`, pass through

**`src/data/repositories/memberRepo.ts`**
- Add `adjustPoints(memberId: string, delta: number): Member` → delegates to `api.adjustMemberPoints(actorId(), memberId, delta)`

### Phase 5: i18n

**`src/i18n/en.json`** — Add keys:
```json
"home": {
  "myPoints": "My points: {{points}}",
  "leaderboard": "Leaderboard",
  "pointsLabel": "{{points}} pts"
},
"chores": {
  "pointsAwarded": "+{{points}} points!",
  "pointsOverride": "Points (optional)",
  "pointsOverridePlaceholder": "e.g. 10"
},
"settings": {
  "pointsConfig": "Points configuration",
  "pointsConfigHint": "Set how many points each chore category is worth.",
  "pointsDaily": "Daily chores",
  "pointsWeekly": "Weekly chores",
  "pointsMonthly": "Monthly chores",
  "pointsSeasonal": "Seasonal chores",
  "adjustPoints": "Adjust points",
  "adjustPointsDelta": "Amount (+/-)",
  "pointsAdjusted": "Points adjusted"
}
```

**`src/i18n/vi.json`** — Matching Vietnamese keys.

### Phase 6: UI

**`app/(tabs)/index.tsx`** (Home screen)
- After greeting row: show points badge `t('home.myPoints', { points: actor?.points ?? 0 })`
- New "Leaderboard" section at bottom: `members.sort((a,b) => b.points - a.points)` → ranked list with avatar, name, points
- When completing a chore (two places: line 87 and the Start→Complete flow), capture `pointsAwarded` and show `Alert.alert(t('chores.pointsAwarded', { points }))`

**`app/(tabs)/chores.tsx`**
- In create/edit form: add optional "Points override" `TextInput` (number-pad) below recurrence picker
- When completing (line 174): capture `pointsAwarded`, show alert
- Display `pointsOverride` badge on chore cards if set

**`app/(tabs)/settings.tsx`**
- New collapsible "Points configuration" section (same pattern as Members/Templates sections)
- Four rows with label + `TextInput` (number-pad) for each category point value
- In Members section: add trophy icon button per member → opens "Adjust Points" modal with numeric delta input

### Phase 7: Store migration

**`src/data/store.ts`**
- Bump storage key to `household-store-v3` to reset persisted data with new defaults
- Or: use `member.points ?? 0` defensively everywhere + handle missing settings fields

## Files Modified

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `points` to Member, `pointsOverride` to Chore, point config to Settings |
| `src/data/mockSeed.ts` | Add default values |
| `src/api/contract.ts` | New method + updated return type + input types |
| `src/api/mockBackend.ts` | Points logic in completeChore + new adjustMemberPoints |
| `src/api/restBackend.ts` | Same + HTTP calls |
| `src/data/repositories/choreRepo.ts` | Return pointsAwarded from complete() |
| `src/data/repositories/memberRepo.ts` | Add adjustPoints() |
| `src/data/store.ts` | Bump storage key |
| `server/migrations/008_add_points.sql` | New migration |
| `server/src/mappers.ts` | New fields in row types + mappers |
| `server/src/routes/chores.ts` | Award points in complete, handle pointsOverride |
| `server/src/routes/members.ts` | New adjust-points route |
| `server/src/routes/settings.ts` | Handle point config fields |
| `src/i18n/en.json` | New keys |
| `src/i18n/vi.json` | New keys |
| `app/(tabs)/index.tsx` | Points badge + leaderboard + completion feedback |
| `app/(tabs)/chores.tsx` | Points override in form + completion feedback |
| `app/(tabs)/settings.tsx` | Points config section + adjust points per member |

## Verification

1. `npm run lint` — type-check client (only baseUrl warning)
2. `cd server && npx tsc --noEmit` — type-check server
3. `docker compose up -d && cd server && npm run dev` — migration runs, server starts
4. `curl http://localhost:3000/api/settings -H 'X-Household-Id: h1'` — confirm point config fields
5. Complete a chore via curl → verify member's points incremented
6. Test in app (mock mode): complete chore → alert shows points → Home leaderboard updates
7. Test in app (REST mode): same + verify server persists points
8. Settings: change category point values, verify new completions use updated values
9. Settings: adjust member points manually, verify leaderboard reflects change
