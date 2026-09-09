import type { EmailOtp } from "@cinch/shared";
import { createClient } from "@supabase/supabase-js";

function displayNameOf(user: { user_metadata?: Record<string, unknown> }): string | undefined {
  const value = user.user_metadata?.display_name;
  return typeof value === "string" ? value : undefined;
}

export function createSupabaseEmailOtp(env: { url: string; anonKey: string }): EmailOtp {
  const client = createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: "implicit",
    },
  });
  return {
    async send(email, redirectTo) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
        },
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
    async consumeLink(input) {
      if (input.accessToken) {
        const { data, error } = await client.auth.getUser(input.accessToken);
        if (error || !data.user?.email) return null;
        return { email: data.user.email, displayName: displayNameOf(data.user) };
      }
      if (input.tokenHash) {
        const type = (input.type === "signup" || input.type === "magiclink" || input.type === "email"
          ? input.type
          : "email") as "signup" | "magiclink" | "email";
        const { data, error } = await client.auth.verifyOtp({
          token_hash: input.tokenHash,
          type,
        });
        if (error || !data.user?.email) return null;
        return { email: data.user.email, displayName: displayNameOf(data.user) };
      }
      return null;
    },
  };
}
