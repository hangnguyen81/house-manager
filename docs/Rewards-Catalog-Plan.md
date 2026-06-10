# Plan: Rewards Catalog & Redemption

## Context
Points accumulation and leaderboard are already implemented (Roadmap #9). Members earn points by completing chores. The next step is letting members **spend** those points on rewards defined by admins — turning the points system into a full motivation loop.

**Scope**: Admin-managed reward catalog, member redemption requests, admin fulfillment tracking. No real-world integrations (gift cards, etc.) — rewards are household-defined (e.g. "Extra screen time", "Pick dinner", "Skip one chore").

---

## Design Decisions

- **Reward as a new entity** — `Reward` with `id`, `householdId`, `title`, `description?`, `cost` (points), `icon?`, `isActive`. Admins create/edit/archive rewards; members browse and redeem.
- **Redemption as a new entity** — `Redemption` tracks each spend: who redeemed, which reward, when, status. This is the "receipt" — separate from the reward catalog.
- **Redemption status flow**: `pending → fulfilled` or `pending → rejected`. Admin confirms the reward was given (fulfilled) or rejects if inappropriate. Points are deducted immediately on redemption; rejected redemptions refund points.
- **Points deducted on redeem, refunded on reject** — Optimistic deduction keeps it simple. If an admin rejects, points are returned automatically.
- **No inventory / stock limits** — Rewards are infinitely redeemable (admins can archive to disable). Stock tracking is over-engineering for a household app.
- **No expiration** — Rewards and points don't expire. Keep it simple.
- **Reward icons** — Optional Ionicons icon name stored on the reward. Defaults to `gift-outline` if not set. Keeps it fun without requiring image uploads.
- **New tab or section?** — Add a **Rewards tab** to the bottom navigation (6th tab, icon: `gift-outline`). The catalog + redemption history live here. This is cleaner than cramming it into Settings or Home.

---

## Data Model

### `Reward`
```ts
export interface Reward {
  id: string;
  householdId: string;
  title: string;           // "Extra screen time"
  description?: string;    // "30 minutes of extra screen time"
  cost: number;            // points required
  icon?: string;           // Ionicons name, default 'gift-outline'
  isActive: boolean;       // false = archived (hidden from members, not deletable if referenced)
  createdAt: string;       // ISO datetime
}
```

### `Redemption`
```ts
export type RedemptionStatus = 'pending' | 'fulfilled' | 'rejected';

export interface Redemption {
  id: string;
  householdId: string;
  rewardId: string;        // Reward.id
  rewardTitle: string;     // denormalized — survives reward edits/archival
  rewardCost: number;      // denormalized — the cost at time of redemption
  memberId: string;        // who redeemed
  status: RedemptionStatus;
  redeemedAt: string;      // ISO datetime
  decidedAt?: string;      // when fulfilled/rejected
  decidedById?: string;    // admin who fulfilled/rejected
  rejectionReason?: string;
}
```

**Why denormalize `rewardTitle` and `rewardCost`?** An admin might edit a reward's title or cost after someone redeemed it. The redemption should reflect what was redeemed at that time, not the current state. Same pattern as `SupplyRequest` storing `name` rather than a FK to a product catalog.

---

## Business Rules

1. **Only admins** can create, edit, and archive rewards.
2. **Any member** can redeem a reward if they have enough points and the reward is active.
3. **Points deducted immediately** on redemption. `member.points -= reward.cost`.
4. **Insufficient points** → error, redemption blocked.
5. **Rejected redemption** → points refunded. `member.points += redemption.rewardCost`.
6. **Fulfilled redemption** → no point change (already deducted).
7. **Archived rewards** (`isActive: false`) don't appear in the catalog for members but existing pending redemptions remain valid.
8. **Reward deletion** blocked if any redemptions reference it (same pattern as member deletion guard). Admins should archive instead.
9. **Only pending redemptions** can be fulfilled or rejected.

---

## Implementation Order

### Phase 1: Types + Seed + Contract

**`src/types/index.ts`**
- Add `Reward` interface
- Add `RedemptionStatus` type and `Redemption` interface

**`src/data/mockSeed.ts`**
- Add `mockRewards: Reward[]` with 3–4 sample rewards
- Add `mockRedemptions: Redemption[]` (empty array)

**`src/data/store.ts`**
- Add `rewards: Reward[]` and `redemptions: Redemption[]` to `HouseholdState`
- Add `setRewards` and `setRedemptions` setters
- Bump storage key to `household-store-v4`

**`src/api/contract.ts`**
- Add input types: `CreateRewardInput`, `UpdateRewardInput`
- Add to `ApiBackend`:
  ```ts
  // Rewards
  listRewards(): Reward[];
  getReward(id: string): Reward | undefined;
  createReward(actorId: string, input: CreateRewardInput): Reward;
  updateReward(actorId: string, id: string, input: UpdateRewardInput): Reward;
  archiveReward(actorId: string, id: string): Reward;
  removeReward(actorId: string, id: string): void;

  // Redemptions
  listRedemptions(): Redemption[];
  redeemReward(actorId: string, rewardId: string): Redemption;
  fulfillRedemption(actorId: string, id: string): Redemption;
  rejectRedemption(actorId: string, id: string, reason?: string): Redemption;
  ```

### Phase 2: Server (DB + Routes + Mappers)

**`server/migrations/009_add_rewards.sql`**
```sql
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
```

**`server/src/mappers.ts`**
- Add `RewardRow` + `rowToReward`
- Add `RedemptionRow` + `rowToRedemption`

**`server/src/routes/rewards.ts`** — New route file
| Route | Method | Description |
|-------|--------|-------------|
| `GET /` | GET | List rewards (filtered by household) |
| `GET /:id` | GET | Get single reward |
| `POST /` | POST | Create reward (admin) |
| `PATCH /:id` | PATCH | Update reward (admin) |
| `POST /:id/archive` | POST | Archive reward (admin, sets `is_active = false`) |
| `DELETE /:id` | DELETE | Delete reward (admin, blocked if redemptions exist) |

**`server/src/routes/redemptions.ts`** — New route file
| Route | Method | Description |
|-------|--------|-------------|
| `GET /` | GET | List redemptions (filtered by household) |
| `POST /` | POST | Redeem a reward (any member, deducts points) |
| `POST /:id/fulfill` | POST | Fulfill redemption (admin) |
| `POST /:id/reject` | POST | Reject redemption (admin, refunds points) |

**`server/src/index.ts`**
- Mount `/api/rewards` and `/api/redemptions` routes

### Phase 3: Both Client Backends

**`src/api/mockBackend.ts`**
- Implement all reward + redemption methods
- `redeemReward`: check points >= cost, deduct, create redemption
- `rejectRedemption`: refund points, set status
- `removeReward`: guard against existing redemptions

**`src/api/restBackend.ts`**
- Same logic with optimistic updates + background HTTP
- Add to `syncAll()`: fetch rewards + redemptions

### Phase 4: Repository Layer

**`src/data/repositories/rewardRepo.ts`** — New file
- Thin wrapper: `list`, `get`, `create`, `edit`, `archive`, `remove`
- `activeRewards()` derived selector: `list().filter(r => r.isActive)`

**`src/data/repositories/redemptionRepo.ts`** — New file
- Thin wrapper: `list`, `redeem`, `fulfill`, `reject`
- `pendingRedemptions()` derived selector
- `myRedemptions(memberId)` derived selector
- Send notification on fulfill/reject (same pattern as supply approve/reject)

**`src/data/repositories/index.ts`**
- Export new repos

### Phase 5: i18n

**`src/i18n/en.json`** — Add keys:
```json
"rewards": {
  "title": "Rewards",
  "catalog": "Reward catalog",
  "myRedemptions": "My redemptions",
  "pendingRedemptions": "Pending redemptions",
  "redeem": "Redeem",
  "redeemConfirm": "Spend {{cost}} points on \"{{title}}\"?",
  "notEnoughPoints": "Not enough points (need {{cost}}, have {{points}})",
  "fulfilled": "Fulfilled",
  "rejected": "Rejected",
  "pending": "Pending",
  "newReward": "New reward",
  "editReward": "Edit reward",
  "rewardTitle": "Reward name",
  "rewardTitlePlaceholder": "e.g. Extra screen time",
  "rewardDescription": "Description (optional)",
  "rewardDescriptionPlaceholder": "e.g. 30 minutes of extra screen time",
  "rewardCost": "Cost (points)",
  "rewardCostPlaceholder": "e.g. 50",
  "rewardIcon": "Icon",
  "archive": "Archive",
  "archiveConfirm": "Archive this reward? It won't appear in the catalog.",
  "deleteConfirm": "Delete this reward?",
  "cannotDelete": "Cannot delete reward",
  "fulfill": "Mark fulfilled",
  "reject": "Reject",
  "rejectReasonPlaceholder": "Reason (optional)",
  "pointsSpent": "-{{cost}} points",
  "pointsRefunded": "+{{cost}} points refunded",
  "empty": "No rewards yet.",
  "emptyRedemptions": "No redemptions yet.",
  "redeemedBy": "Redeemed by {{name}}",
  "redeemedOn": "Redeemed {{date}}",
  "rejectedReason": "Rejected: {{reason}}",
  "archived": "Archived"
}
```

**`src/i18n/vi.json`** — Matching Vietnamese keys.

### Phase 6: UI — Rewards Tab

**`app/(tabs)/rewards.tsx`** — New screen
Three sections, role-dependent:

**All members see:**
1. **Catalog** — grid/list of active rewards. Each card: icon, title, description, cost badge. "Redeem" button (disabled if insufficient points). Tapping "Redeem" shows confirmation alert with point cost.
2. **My Redemptions** — list of the member's own redemptions (pending, fulfilled, rejected) sorted by date DESC. Shows status badge + reward title + cost.

**Admins additionally see:**
3. **Pending Redemptions** — all pending redemptions from all members. Each row: member avatar + name, reward title, cost, "Fulfill" / "Reject" buttons. Same pattern as supply approval.

**Admin FAB:** "+" button to create a new reward (opens modal).

**`app/(tabs)/_layout.tsx`** — Add Rewards tab
- Icon: `gift-outline` (Ionicons)
- Position: after Shopping, before Settings
- Visible to all members (not admin-only like Settings)

### Phase 7: Settings Integration

**`app/(tabs)/settings.tsx`**
- New collapsible "Rewards management" section (admin-only)
- Lists all rewards (active + archived). Archived rewards shown dimmed with "Archived" badge.
- Edit/archive/delete actions per reward
- Or: manage rewards directly in the Rewards tab via admin FAB + edit buttons (simpler, avoids duplication). **Decision: manage in Rewards tab, not Settings.** Settings is already large.

---

## Files Modified / Created

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `Reward`, `RedemptionStatus`, `Redemption` |
| `src/data/mockSeed.ts` | Add `mockRewards`, `mockRedemptions` |
| `src/data/store.ts` | Add `rewards`, `redemptions` + setters, bump key to v4 |
| `src/api/contract.ts` | Add reward + redemption methods + input types |
| `src/api/mockBackend.ts` | Implement reward + redemption methods |
| `src/api/restBackend.ts` | Same + HTTP calls + syncAll update |
| `src/data/repositories/rewardRepo.ts` | **New** — reward CRUD + `activeRewards()` |
| `src/data/repositories/redemptionRepo.ts` | **New** — redemption ops + notifications |
| `src/data/repositories/index.ts` | Export new repos |
| `server/migrations/009_add_rewards.sql` | **New** — rewards + redemptions tables |
| `server/src/mappers.ts` | Add `RewardRow`, `RedemptionRow` + mappers |
| `server/src/routes/rewards.ts` | **New** — reward CRUD routes |
| `server/src/routes/redemptions.ts` | **New** — redemption routes |
| `server/src/index.ts` | Mount new routes |
| `src/i18n/en.json` | Add `rewards` section |
| `src/i18n/vi.json` | Add `rewards` section |
| `app/(tabs)/rewards.tsx` | **New** — Rewards screen |
| `app/(tabs)/_layout.tsx` | Add Rewards tab |

---

## Verification

1. `npm run lint` — type-check client
2. `cd server && npx tsc --noEmit` — type-check server
3. `docker compose up -d && cd server && npm run dev` — migration 009 runs
4. Create rewards via curl:
   ```bash
   curl -X POST http://localhost:3000/api/rewards \
     -H 'X-Actor-Id: m1' -H 'X-Household-Id: h1' \
     -H 'Content-Type: application/json' \
     -d '{"id":"r1","title":"Extra screen time","cost":20}'
   ```
5. Redeem via curl → verify member points decreased:
   ```bash
   curl -X POST http://localhost:3000/api/redemptions \
     -H 'X-Actor-Id: m3' -H 'X-Household-Id: h1' \
     -H 'Content-Type: application/json' \
     -d '{"rewardId":"r1"}'
   ```
6. Test in app (mock mode): browse catalog → redeem → see points drop → admin fulfills
7. Test in app (REST mode): same + verify server persists
8. Test rejection: admin rejects a pending redemption → member's points refunded
9. Test guards: insufficient points → blocked; archive reward → hidden from catalog; delete reward with redemptions → blocked
10. Test new Rewards tab appears for all members, admin FAB only for admins
