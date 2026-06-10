/**
 * API contract — the interface any backend must implement.
 * The mock backend uses the Zustand store; a real backend would use fetch/axios.
 * Repos delegate to this interface, so swapping backends requires no screen changes.
 */
import type {
  Household,
  Member,
  Role,
  Chore,
  Recurrence,
  ChoreTemplate,
  ChoreCategory,
  SupplyRequest,
  Urgency,
  HouseholdSettings,
  Reward,
  Redemption,
} from '@/types';

// ── Members ──────────────────────────────────────────────────────────────────

export interface CreateMemberInput {
  name: string;
  role: Role;
  color: string;
  avatarUrl?: string;
}

export interface UpdateMemberInput {
  name?: string;
  role?: Role;
  color?: string;
  avatarUrl?: string;
}

// ── Chores ───────────────────────────────────────────────────────────────────

export interface CreateChoreInput {
  title: string;
  assigneeId: string;
  description?: string;
  dueDate?: string;
  recurrence?: Recurrence;
  pointsOverride?: number;
}

export interface UpdateChoreInput {
  title?: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  recurrence?: Recurrence;
  pointsOverride?: number;
}

// ── Chore Templates ──────────────────────────────────────────────────────────

export interface CreateChoreTemplateInput {
  title: string;
  category: ChoreCategory;
}

export interface UpdateChoreTemplateInput {
  title?: string;
  category?: ChoreCategory;
}

// ── Supplies ─────────────────────────────────────────────────────────────────

export interface FlagSupplyInput {
  name: string;
  quantity?: string;
  note?: string;
  urgency?: Urgency;
}

export interface UpdateSupplyInput {
  name?: string;
  quantity?: string;
  note?: string;
  urgency?: Urgency;
}

// ── Rewards ─────────────────────────────────────────────────────────────────

export interface CreateRewardInput {
  title: string;
  description?: string;
  cost: number;
  icon?: string;
}

export interface UpdateRewardInput {
  title?: string;
  description?: string;
  cost?: number;
  icon?: string;
}

// ── The Backend Interface ────────────────────────────────────────────────────

export interface ApiBackend {
  // Households
  listHouseholds(): Household[];
  getHousehold(id: string): Household | undefined;
  createHousehold(name: string): Household;
  updateHousehold(id: string, name: string): Household;
  removeHousehold(id: string): void;

  // Members
  listMembers(): Member[];
  getMember(id: string): Member | undefined;
  createMember(actorId: string, input: CreateMemberInput): Member;
  updateMember(actorId: string, id: string, input: UpdateMemberInput): Member;
  removeMember(actorId: string, id: string): void;
  setMemberPin(id: string, pin: string | undefined): Member;
  verifyMemberPin(id: string, pin: string): boolean;
  adjustMemberPoints(actorId: string, memberId: string, delta: number): Member;

  // Chores
  listChores(): Chore[];
  getChore(id: string): Chore | undefined;
  createChore(actorId: string, input: CreateChoreInput): Chore;
  updateChore(actorId: string, id: string, input: UpdateChoreInput): Chore;
  startChore(actorId: string, id: string): Chore;
  completeChore(actorId: string, id: string): { completed: Chore; spawned?: Chore; pointsAwarded: number };
  reopenChore(actorId: string, id: string): Chore;
  removeChore(actorId: string, id: string): void;

  // Chore Templates
  listChoreTemplates(): ChoreTemplate[];
  createChoreTemplate(actorId: string, input: CreateChoreTemplateInput): ChoreTemplate;
  updateChoreTemplate(actorId: string, id: string, input: UpdateChoreTemplateInput): ChoreTemplate;
  removeChoreTemplate(actorId: string, id: string): void;

  // Supplies
  listSupplies(): SupplyRequest[];
  getSupply(id: string): SupplyRequest | undefined;
  flagSupply(actorId: string, input: FlagSupplyInput): SupplyRequest;
  editSupply(id: string, input: UpdateSupplyInput): SupplyRequest;
  cancelSupply(id: string): void;
  approveSupply(actorId: string, id: string): SupplyRequest;
  rejectSupply(actorId: string, id: string, reason?: string): SupplyRequest;
  unapproveSupply(actorId: string, id: string): SupplyRequest;
  markSupplyPurchased(actorId: string, id: string): SupplyRequest;

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

  // Settings
  getSettings(): HouseholdSettings;
  updateSettings(patch: Partial<HouseholdSettings>): HouseholdSettings;
}
