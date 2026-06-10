import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Request permission for local notifications. Call once at app startup. */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Schedule a local notification for a chore due date.
 * Fires at 9 AM on the due date (or immediately if already past).
 */
export async function scheduleChoreReminder(choreId: string, title: string, dueDate: string): Promise<string | null> {
  const trigger = new Date(`${dueDate}T09:00:00`);
  // Don't schedule if the date is in the past
  if (trigger.getTime() <= Date.now()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📋 Chore reminder',
      body: title,
      data: { type: 'chore', choreId },
    },
    trigger: { date: trigger, type: Notifications.SchedulableTriggerInputTypes.DATE },
  });
  return id;
}

/** Cancel a previously scheduled notification. */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/** Send an immediate local notification (for supply approvals/rejections). */
export async function sendInstantNotification(title: string, body: string, data?: Record<string, string>): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: null, // immediate
  });
}
