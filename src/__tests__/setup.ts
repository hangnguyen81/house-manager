import { vi } from 'vitest';

// Mock AsyncStorage (React Native native module)
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
  },
}));

// Mock expo-notifications (React Native native module)
vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: vi.fn(() => Promise.resolve('mock-notif-id')),
  cancelScheduledNotificationAsync: vi.fn(() => Promise.resolve()),
  requestPermissionsAsync: vi.fn(() => Promise.resolve({ status: 'granted' })),
  setNotificationHandler: vi.fn(),
}));

// Mock expo-localization
vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en' }],
}));

// Mock react-native (only Platform needed by notifications util)
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));
