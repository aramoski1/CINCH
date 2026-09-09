import { Expo } from "expo-server-sdk";
import type { Notifier } from "@cinch/shared";

export function createExpoNotifier(input: {
  getPushToken: (userId: string) => Promise<string | null>;
  recordInApp: (userId: string, template: string, data: Record<string, unknown>) => Promise<void>;
}): Notifier {
  const expo = new Expo();
  return {
    async send({ userId, channel, template, data }) {
      if (channel === "sms") {
        return { delivered: false, providerId: "share-sheet" };
      }
      await input.recordInApp(userId, template, data);
      if (channel !== "push") return { delivered: true, providerId: "in_app" };
      const token = await input.getPushToken(userId);
      if (!token || !Expo.isExpoPushToken(token)) {
        return { delivered: true, providerId: "in_app_only" };
      }
      const tickets = await expo.sendPushNotificationsAsync([
        { to: token, title: "Cinch", body: template.replaceAll("_", " "), data },
      ]);
      const ticket = tickets[0];
      if (!ticket) return { delivered: false };
      return { delivered: ticket.status === "ok", providerId: "id" in ticket ? ticket.id : undefined };
    },
  };
}
