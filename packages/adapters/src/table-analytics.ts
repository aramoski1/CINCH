import type { Analytics, ErrorReporter, FlagProvider } from "@cinch/shared";

export type TableWriter = {
  insert(table: string, row: Record<string, unknown>): Promise<void>;
  flagRow(key: string): Promise<{ enabled: boolean; rollout_pct: number } | null>;
};

export function createTableAnalytics(write: TableWriter): Analytics {
  return {
    async track(userId, event, props) {
      await write.insert("analytics_events", {
        user_id: userId,
        event,
        props: props ?? {},
        occurred_at: new Date().toISOString(),
      });
    },
  };
}

export function createTableErrorReporter(write: TableWriter): ErrorReporter {
  return {
    async capture({ level, message, context }) {
      await write.insert("error_events", {
        level,
        message,
        context: context ?? {},
        occurred_at: new Date().toISOString(),
      });
    },
  };
}

export function createTableFlags(write: TableWriter): FlagProvider {
  return {
    async enabled(key) {
      const row = await write.flagRow(key);
      return row?.enabled === true;
    },
  };
}
