// Lightweight id generator for mock data. Swap for server-issued ids once a
// backend exists (or use expo-crypto's randomUUID).
export function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
