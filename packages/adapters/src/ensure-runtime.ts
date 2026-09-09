import fs from "node:fs";
import { Client } from "pg";

const SQL = `
create table if not exists public.cinch_runtime (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.cinch_runtime enable row level security;
drop policy if exists cinch_runtime_none on public.cinch_runtime;
create policy cinch_runtime_none on public.cinch_runtime
  for all using (false) with check (false);
`;

export async function ensureRuntimeTable(connectionString: string): Promise<void> {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(SQL);
  } finally {
    await client.end();
  }
}

export async function ensureRuntimeTableFromFile(
  connectionString: string,
  filePath: string,
): Promise<void> {
  const sql = fs.readFileSync(filePath, "utf8");
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}
