export interface HouseholdRow {
  id: string;
  name: string;
  created_at: string;
}

export interface MemberRow {
  id: string;
  household_id: string;
  name: string;
  role: string;
  color: string;
  avatar_url: string | null;
  pin: string | null;
  points: number;
}

export interface ChoreRow {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  assignee_id: string;
  created_by_id: string;
  status: string;
  recurrence: string;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  points_override: number | null;
}

export interface ChoreTemplateRow {
  id: string;
  household_id: string;
  title: string;
  category: string;
}

export interface SupplyRow {
  id: string;
  household_id: string;
  name: string;
  quantity: string | null;
  note: string | null;
  urgency: string;
  status: string;
  requested_by_id: string;
  decided_by_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  decided_at: string | null;
  purchased_at: string | null;
}

export interface SettingsRow {
  id: number;
  household_id: string;
  rejection_visibility: string;
  shopping_time: string | null;
  language: string;
  theme: string;
  points_daily: number;
  points_weekly: number;
  points_monthly: number;
  points_seasonal: number;
}

export function rowToHousehold(r: HouseholdRow) {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
  };
}

export function rowToMember(r: MemberRow) {
  return {
    id: r.id,
    householdId: r.household_id,
    name: r.name,
    role: r.role as 'admin' | 'member',
    color: r.color,
    ...(r.avatar_url != null && { avatarUrl: r.avatar_url }),
    ...(r.pin != null && { pin: r.pin }),
    points: r.points,
  };
}

export function rowToChore(r: ChoreRow) {
  return {
    id: r.id,
    householdId: r.household_id,
    title: r.title,
    ...(r.description != null && { description: r.description }),
    assigneeId: r.assignee_id,
    createdById: r.created_by_id,
    status: r.status as 'assigned' | 'in_progress' | 'completed',
    recurrence: r.recurrence as 'none' | 'daily' | 'weekly' | 'monthly',
    ...(r.due_date != null && { dueDate: r.due_date }),
    createdAt: r.created_at,
    ...(r.completed_at != null && { completedAt: r.completed_at }),
    ...(r.points_override != null && { pointsOverride: r.points_override }),
  };
}

export function rowToTemplate(r: ChoreTemplateRow) {
  return {
    id: r.id,
    householdId: r.household_id,
    title: r.title,
    category: r.category as 'daily' | 'weekly' | 'monthly' | 'seasonal',
  };
}

export function rowToSupply(r: SupplyRow) {
  return {
    id: r.id,
    householdId: r.household_id,
    name: r.name,
    ...(r.quantity != null && { quantity: r.quantity }),
    ...(r.note != null && { note: r.note }),
    urgency: r.urgency as 'normal' | 'urgent',
    status: r.status as 'requested' | 'approved' | 'rejected' | 'purchased',
    requestedById: r.requested_by_id,
    ...(r.decided_by_id != null && { decidedById: r.decided_by_id }),
    ...(r.rejection_reason != null && { rejectionReason: r.rejection_reason }),
    createdAt: r.created_at,
    ...(r.decided_at != null && { decidedAt: r.decided_at }),
    ...(r.purchased_at != null && { purchasedAt: r.purchased_at }),
  };
}

export interface RewardRow {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  cost: number;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

export interface RedemptionRow {
  id: string;
  household_id: string;
  reward_id: string;
  reward_title: string;
  reward_cost: number;
  member_id: string;
  status: string;
  redeemed_at: string;
  decided_at: string | null;
  decided_by_id: string | null;
  rejection_reason: string | null;
}

export function rowToReward(r: RewardRow) {
  return {
    id: r.id,
    householdId: r.household_id,
    title: r.title,
    ...(r.description != null && { description: r.description }),
    cost: r.cost,
    ...(r.icon != null && { icon: r.icon }),
    isActive: r.is_active,
    createdAt: r.created_at,
  };
}

export function rowToRedemption(r: RedemptionRow) {
  return {
    id: r.id,
    householdId: r.household_id,
    rewardId: r.reward_id,
    rewardTitle: r.reward_title,
    rewardCost: r.reward_cost,
    memberId: r.member_id,
    status: r.status as 'pending' | 'fulfilled' | 'rejected',
    redeemedAt: r.redeemed_at,
    ...(r.decided_at != null && { decidedAt: r.decided_at }),
    ...(r.decided_by_id != null && { decidedById: r.decided_by_id }),
    ...(r.rejection_reason != null && { rejectionReason: r.rejection_reason }),
  };
}

export function rowToSettings(r: SettingsRow) {
  return {
    householdId: r.household_id,
    rejectionVisibility: r.rejection_visibility as 'immediate' | '1_day' | '1_week' | 'forever',
    ...(r.shopping_time != null && { shoppingTime: r.shopping_time }),
    language: r.language as 'en' | 'vi',
    theme: r.theme as 'light' | 'dark',
    pointsDaily: r.points_daily,
    pointsWeekly: r.points_weekly,
    pointsMonthly: r.points_monthly,
    pointsSeasonal: r.points_seasonal,
  };
}
