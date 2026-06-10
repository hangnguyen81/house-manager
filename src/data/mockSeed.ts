import type { Household, Member, Chore, SupplyRequest, HouseholdSettings, ChoreTemplate, Reward, Redemption } from '@/types';
import { resolveInitialLanguage } from '@/i18n/detect';

export const mockHouseholds: Household[] = [
  { id: 'h1', name: 'The Family', createdAt: '2026-06-01T00:00:00Z' },
];

export const mockMembers: Member[] = [
  { id: 'm1', householdId: 'h1', name: 'Mom', role: 'admin', color: '#E8743B', points: 0 },
  { id: 'm2', householdId: 'h1', name: 'Dad', role: 'admin', color: '#19A979', points: 0 },
  { id: 'm3', householdId: 'h1', name: 'Ava', role: 'member', color: '#945ECF', points: 0 },
  { id: 'm4', householdId: 'h1', name: 'Leo', role: 'member', color: '#1F77B4', points: 0 },
];

export const mockChores: Chore[] = [
  {
    id: 'c1',
    householdId: 'h1',
    title: 'Take out recycling',
    assigneeId: 'm4',
    createdById: 'm1',
    status: 'assigned',
    recurrence: 'weekly',
    dueDate: '2026-06-10',
    createdAt: '2026-06-09T08:00:00Z',
  },
  {
    id: 'c2',
    householdId: 'h1',
    title: 'Load dishwasher',
    assigneeId: 'm3',
    createdById: 'm1',
    status: 'in_progress',
    recurrence: 'daily',
    createdAt: '2026-06-09T08:00:00Z',
  },
  {
    id: 'c3',
    householdId: 'h1',
    title: 'Walk the dog',
    assigneeId: 'm4',
    createdById: 'm2',
    status: 'completed',
    recurrence: 'none',
    createdAt: '2026-06-08T07:00:00Z',
    completedAt: '2026-06-08T17:30:00Z',
  },
];

export const mockSupplies: SupplyRequest[] = [
  {
    id: 's1',
    householdId: 'h1',
    name: 'Milk',
    quantity: '2 cartons',
    urgency: 'urgent',
    status: 'requested',
    requestedById: 'm3',
    createdAt: '2026-06-09T07:30:00Z',
  },
  {
    id: 's2',
    householdId: 'h1',
    name: 'Dish soap',
    urgency: 'normal',
    status: 'approved',
    requestedById: 'm4',
    decidedById: 'm2',
    createdAt: '2026-06-08T19:00:00Z',
    decidedAt: '2026-06-08T20:00:00Z',
  },
  {
    id: 's3',
    householdId: 'h1',
    name: 'Energy drinks',
    urgency: 'normal',
    status: 'rejected',
    requestedById: 'm3',
    decidedById: 'm1',
    rejectionReason: 'Not this week',
    createdAt: '2026-06-07T15:00:00Z',
    decidedAt: '2026-06-07T18:00:00Z',
  },
];

export const defaultSettings: HouseholdSettings = {
  householdId: 'h1',
  rejectionVisibility: '1_week',
  language: resolveInitialLanguage(),
  theme: 'light',
  pointsDaily: 5,
  pointsWeekly: 10,
  pointsMonthly: 15,
  pointsSeasonal: 20,
};

export const mockRewards: Reward[] = [
  { id: 'r1', householdId: 'h1', title: 'Extra screen time', description: '30 minutes of extra screen time', cost: 20, icon: 'tv-outline', isActive: true, createdAt: '2026-06-01T00:00:00Z' },
  { id: 'r2', householdId: 'h1', title: 'Pick dinner', description: 'Choose what the family eats for dinner', cost: 30, icon: 'restaurant-outline', isActive: true, createdAt: '2026-06-01T00:00:00Z' },
  { id: 'r3', householdId: 'h1', title: 'Skip one chore', description: 'Skip any single assigned chore', cost: 50, icon: 'close-circle-outline', isActive: true, createdAt: '2026-06-01T00:00:00Z' },
  { id: 'r4', householdId: 'h1', title: 'Movie night pick', description: 'Choose the movie for family movie night', cost: 15, icon: 'film-outline', isActive: true, createdAt: '2026-06-01T00:00:00Z' },
];

export const mockRedemptions: Redemption[] = [];

export const mockChoreTemplates: ChoreTemplate[] = [
  // Daily (Maintenance)
  { id: 'ct1', householdId: 'h1', title: 'Making the bed', category: 'daily' },
  { id: 'ct2', householdId: 'h1', title: 'Wiping down kitchen counters', category: 'daily' },
  { id: 'ct3', householdId: 'h1', title: 'Loading/running the dishwasher', category: 'daily' },
  { id: 'ct4', householdId: 'h1', title: 'Taking out the trash', category: 'daily' },
  { id: 'ct5', householdId: 'h1', title: 'Sweeping high-traffic floors', category: 'daily' },
  // Weekly (The Reset)
  { id: 'ct6', householdId: 'h1', title: 'Vacuuming and mopping', category: 'weekly' },
  { id: 'ct7', householdId: 'h1', title: 'Cleaning bathrooms', category: 'weekly' },
  { id: 'ct8', householdId: 'h1', title: 'Changing bed sheets', category: 'weekly' },
  { id: 'ct9', householdId: 'h1', title: 'Dusting surfaces', category: 'weekly' },
  { id: 'ct10', householdId: 'h1', title: 'Wiping down appliances', category: 'weekly' },
  // Monthly (Deep Maintenance)
  { id: 'ct11', householdId: 'h1', title: 'Cleaning the microwave/oven', category: 'monthly' },
  { id: 'ct12', householdId: 'h1', title: 'Washing trash cans', category: 'monthly' },
  { id: 'ct13', householdId: 'h1', title: 'Dusting ceiling fans', category: 'monthly' },
  { id: 'ct14', householdId: 'h1', title: 'Cleaning baseboards', category: 'monthly' },
  { id: 'ct15', householdId: 'h1', title: 'Running a clean cycle on the washing machine', category: 'monthly' },
  // Seasonal (The Deep Clean)
  { id: 'ct16', householdId: 'h1', title: 'Washing windows', category: 'seasonal' },
  { id: 'ct17', householdId: 'h1', title: 'Deep-cleaning carpets', category: 'seasonal' },
  { id: 'ct18', householdId: 'h1', title: 'Sorting/purging closets', category: 'seasonal' },
  { id: 'ct19', householdId: 'h1', title: 'Cleaning gutters', category: 'seasonal' },
  { id: 'ct20', householdId: 'h1', title: 'Flipping mattresses', category: 'seasonal' },
];
