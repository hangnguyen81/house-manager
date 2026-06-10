/**
 * API entry point — exports the active backend.
 * Set EXPO_PUBLIC_USE_REST_BACKEND=true in .env to use the real Express backend.
 */
import { mockBackend } from './mockBackend';
import { restBackend } from './restBackend';
import type { ApiBackend } from './contract';

const USE_REST = process.env.EXPO_PUBLIC_USE_REST_BACKEND === 'true';

export const api: ApiBackend = USE_REST ? restBackend : mockBackend;
export { syncAll } from './restBackend';
export { USE_REST };
export type { ApiBackend } from './contract';
