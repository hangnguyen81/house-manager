import supertest from 'supertest';
import { createApp } from '../app';

const app = createApp();
export const request = supertest(app);

/** Standard headers for admin (m1) requests scoped to h1 */
export const adminHeaders = {
  'X-Actor-Id': 'm1',
  'X-Household-Id': 'h1',
  'Content-Type': 'application/json',
};

/** Standard headers for member (m3) requests scoped to h1 */
export const memberHeaders = {
  'X-Actor-Id': 'm3',
  'X-Household-Id': 'h1',
  'Content-Type': 'application/json',
};
