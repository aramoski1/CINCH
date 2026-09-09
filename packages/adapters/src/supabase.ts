import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export function createAnonClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createServiceClient(env: SupabaseEnv): SupabaseClient {
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
