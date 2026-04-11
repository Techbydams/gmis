// ============================================================
// GMIS — Notifications Utility
// Handles push notification registration + local class reminders
// Both push (Expo/FCM/APNs) and local scheduled notifications
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import * as Notifications from "expo-notifications";
import * as Device        from "expo-device";
import { Platform }       from "react-native";

// ── Foreground notification behaviour ─────────────────────
// Show alerts, play sound and update badge even when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ── Android notification channels ─────────────────────────
export async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;

  // General school notifications (results, fees, approvals)
  await Notifications.setNotificationChannelAsync("gmis-general", {
    name:              "School Notifications",
    importance:        Notifications.AndroidImportance.HIGH,
    vibrationPattern:  [0, 250, 250, 250],
    lightColor:        "#2d6cff",
    description:       "Results, fee updates, admin announcements",
  });

  // Class reminders — MAX importance so it sounds like an alarm
  await Notifications.setNotificationChannelAsync("gmis-reminders", {
    name:              "Class Reminders",
    importance:        Notifications.AndroidImportance.MAX,
    vibrationPattern:  [0, 500, 300, 500],
    lightColor:        "#2d6cff",
    sound:             "default",
    description:       "Reminds you before lectures start",
    bypassDnd:         true,   // override Do-Not-Disturb for class alarms
  });

  // Chat messages
  await Notifications.setNotificationChannelAsync("gmis-chat", {
    name:             "Chat Messages",
    importance:       Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 100, 100, 100],
    lightColor:       "#2d6cff",
    description:      "Direct messages and group chat",
  });
}

// ── Push notification registration ────────────────────────
// Returns the Expo push token string, or null if permission denied
// or running in a simulator.
export async function registerForPushNotifications(): Promise<string | null> {
  // Simulators cannot receive push notifications
  if (!Device.isDevice) {
    console.log("[GMIS] Push notifications unavailable on simulator/emulator.");
    return null;
  }

  // Set up Android channels first
  await setupAndroidChannels();

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert:   true,
        allowBadge:   true,
        allowSound:   true,
        allowCriticalAlerts: false,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[GMIS] Push notification permission denied.");
    return null;
  }

  try {
    // You must replace this with your real EAS project ID from app.json
    // once you run `eas init`. Until then, local notifications still work.
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch (err) {
    // getExpoPushTokenAsync fails without a valid projectId — local
    // scheduled notifications still work perfectly fine.
    console.log("[GMIS] Could not obtain Expo push token:", err);
    return null;
  }
}

// ── Class reminder scheduling ──────────────────────────────
type Day = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

const DAY_INDEX: Record<Day | "sunday", number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/** Returns the next Date a given weekday + time will occur. */
function nextOccurrence(dayOfWeek: Day, timeStr: string): Date {
  const targetDay = DAY_INDEX[dayOfWeek];
  const now       = new Date();
  const todayDay  = now.getDay();

  let daysAhead = targetDay - todayDay;
  if (daysAhead < 0) daysAhead += 7;

  const [h, m] = timeStr.split(":").map(Number);

  const target = new Date(now);
  target.setDate(now.getDate() + daysAhead);
  target.setHours(h, m, 0, 0);

  // If target is within the next 10 minutes or already passed, push to next week
  if (target.getTime() - now.getTime() <= 10 * 60 * 1000) {
    target.setDate(target.getDate() + 7);
  }

  return target;
}

/**
 * Schedule a local notification N minutes before a class.
 * Returns the notification identifier (used to cancel later).
 */
export async function scheduleClassReminder(opts: {
  entryId:    string;
  courseCode: string;
  courseName: string;
  venue:      string | null;
  dayOfWeek:  Day;
  startTime:  string;   // "HH:MM" or "HH:MM:SS"
  minutesBefore?: number;
}): Promise<string | null> {
  const { entryId, courseCode, courseName, venue, dayOfWeek, startTime, minutesBefore = 10 } = opts;

  const classTime    = nextOccurrence(dayOfWeek, startTime.slice(0, 5));
  const reminderTime = new Date(classTime.getTime() - minutesBefore * 60 * 1000);

  if (reminderTime <= new Date()) return null;

  try {
    const notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${courseCode} in ${minutesBefore} min`,
        body:  `${courseName}${venue ? ` · ${venue}` : ""}`,
        sound: "default",
        data:  { type: "class_reminder", entryId },
        ...(Platform.OS === "android" && { channelId: "gmis-reminders" }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });
    return notifId;
  } catch (err) {
    console.warn("[GMIS] Could not schedule reminder:", err);
    return null;
  }
}

/** Cancel a previously scheduled class reminder. */
export async function cancelClassReminder(notifId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {
    // Silently ignore — may have already fired
  }
}

/** Cancel ALL scheduled GMIS notifications. */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/** Return how many scheduled notifications are currently pending. */
export async function getPendingReminderCount(): Promise<number> {
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  return pending.length;
}
