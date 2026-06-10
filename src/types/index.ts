// Domain types for the Household Manager.
// These shapes are intentionally backend-agnostic so a real API can return them unchanged.

export interface Household {
  id: string;
  name: string;
  createdAt: string; // ISO datetime
}

export type Role = 'admin' | 'member';

export interface Member {
  id: string;
  householdId: string; // Household.id
  name: string;
  role: Role;
  color: string; // avatar fallback color (hex)
  avatarUrl?: string;
  pin?: string; // optional 4-digit PIN for local auth
  points: number; // accumulated reward points
}

// MVP: no review gate ("done is done"). 'submitted' is reserved for a future toggle.
export type ChoreStatus = 'assigned' | 'in_progress' | 'completed';

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Chore {
  id: string;
  householdId: string;
  title: string;
  description?: string;
  assigneeId: string; // Member.id
  createdById: string; // admin who created it
  status: ChoreStatus;
  recurrence: Recurrence;
  dueDate?: string; // ISO date (YYYY-MM-DD)
  createdAt: string; // ISO datetime
  completedAt?: string; // ISO datetime
  notificationId?: string; // local notification ID for due date reminder
  pointsOverride?: number; // override category default points for this chore
}

// Chore templates — the household's catalog of chores, grouped by frequency.
export type ChoreCategory = 'daily' | 'weekly' | 'monthly' | 'seasonal';

export interface ChoreTemplate {
  id: string;
  householdId: string;
  title: string;
  category: ChoreCategory;
}

export type SupplyStatus = 'requested' | 'approved' | 'rejected' | 'purchased';
export type Urgency = 'normal' | 'urgent';

export interface SupplyRequest {
  id: string;
  householdId: string;
  name: string; // "Milk"
  quantity?: string; // "2 cartons" — free text for MVP
  note?: string;
  urgency: Urgency;
  status: SupplyStatus;
  requestedById: string; // any member
  decidedById?: string; // admin who approved/rejected
  rejectionReason?: string;
  createdAt: string;
  decidedAt?: string; // when approved/rejected — drives the rejection-archive window
  purchasedAt?: string;
}

// ── Rewards ─────────────────────────────────────────────────────────────────

export interface Reward {
  id: string;
  householdId: string;
  title: string;
  description?: string;
  cost: number; // points required
  icon?: string; // Ionicons name, default 'gift-outline'
  isActive: boolean;
  createdAt: string; // ISO datetime
}

export type RedemptionStatus = 'pending' | 'fulfilled' | 'rejected';

export interface Redemption {
  id: string;
  householdId: string;
  rewardId: string;
  rewardTitle: string; // denormalized
  rewardCost: number; // denormalized — cost at time of redemption
  memberId: string;
  status: RedemptionStatus;
  redeemedAt: string; // ISO datetime
  decidedAt?: string;
  decidedById?: string;
  rejectionReason?: string;
}

export type Language = 'en' | 'vi'; // MVP languages; 'en' is default + fallback

export type RejectionVisibility = 'immediate' | '1_day' | '1_week' | 'forever';

export type ThemeMode = 'light' | 'dark';

export interface HouseholdSettings {
  householdId: string;
  rejectionVisibility: RejectionVisibility; // default '1_week'
  shoppingTime?: string; // optional ISO datetime; reserved for the future edit-time gate
  language: Language;
  theme: ThemeMode;
  pointsDaily: number;
  pointsWeekly: number;
  pointsMonthly: number;
  pointsSeasonal: number;
}
