import type { EmailOtp } from "@cinch/shared";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseEmailOtp(env: { url: string; anonKey: string }): EmailOtp {
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async send(email) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (error) throw new Error(error.message);
      return { delivered: true };
    },
    async verify(email, code) {
      const { error } = await client.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      return !error;
    },
  };
}
