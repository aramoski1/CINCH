import type { RuntimeSnapshot } from "@cinch/shared";
import { createClient } from "@supabase/supabase-js";

const ROW_ID = "store";

export function createRuntimeSnapshot(env: { url: string; serviceRoleKey: string }): RuntimeSnapshot {
  const client = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async load() {
      const { data, error } = await client
        .from("cinch_runtime")
        .select("payload")
        .eq("id", ROW_ID)
        .maybeSingle();
      if (error) {
        if (isMissingTable(error.message)) return null;
        throw new Error(error.message);
      }
      const payload = data?.payload;
      return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    },
    async save(payload) {
      const { error } = await client.from("cinch_runtime").upsert({
        id: ROW_ID,
        payload,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        if (isMissingTable(error.message)) return;
        throw new Error(error.message);
      }
    },
  };
}

function isMissingTable(message: string): boolean {
  return /cinch_runtime/i.test(message) && /schema cache|does not exist|could not find/i.test(message);
}
