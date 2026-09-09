/**
 * Hand-written until `supabase gen types` is linked.
 * Keep in sync with supabase/migrations.
 */
export type UserStatus = "active" | "suspended" | "self_excluded" | "deleted";

export type DbUser = {
  id: string;
  email: string;
  phone_e164: string | null;
  status: UserStatus;
  created_at: string;
};

export type DbProfile = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  timezone: string;
  score: number;
  current_streak: number;
  longest_streak: number;
};

export type Database = {
  public: {
    Tables: {
      users: { Row: DbUser };
      profiles: { Row: DbProfile };
    };
  };
};
