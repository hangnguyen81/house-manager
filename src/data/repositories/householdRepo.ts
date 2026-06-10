import { api } from '@/api';
import type { Household } from '@/types';

export const householdRepo = {
  list(): Household[] {
    return api.listHouseholds();
  },

  get(id: string): Household | undefined {
    return api.getHousehold(id);
  },

  create(name: string): Household {
    return api.createHousehold(name);
  },

  rename(id: string, name: string): Household {
    return api.updateHousehold(id, name);
  },

  remove(id: string): void {
    api.removeHousehold(id);
  },
};
