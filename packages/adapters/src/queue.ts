import type { Queue } from "@cinch/shared";

type Job = { id: string; name: string; payload: unknown; runAt: Date; key?: string };

export function createMemoryQueue(): Queue & { jobs: Job[] } {
  const jobs: Job[] = [];
  return {
    jobs,
    async schedule(name, payload, runAt, opts) {
      const id = opts?.key ?? `${name}:${runAt.toISOString()}:${jobs.length}`;
      if (opts?.key && jobs.some((j) => j.key === opts.key)) return opts.key;
      jobs.push({ id, name, payload, runAt, key: opts?.key });
      return id;
    },
    async cancel(jobId) {
      const i = jobs.findIndex((j) => j.id === jobId);
      if (i >= 0) jobs.splice(i, 1);
    },
  };
}

export async function createPgBossQueue(connectionString: string, schema: string): Promise<Queue> {
  const { default: PgBoss } = await import("pg-boss");
  const boss = new PgBoss({ connectionString, schema });
  await boss.start();
  return {
    async schedule(name, payload, runAt, opts) {
      const id = await boss.send(name, payload as object, {
        startAfter: runAt,
        singletonKey: opts?.key,
      });
      return id ?? `${name}:${runAt.toISOString()}`;
    },
    async cancel(jobId) {
      await boss.cancel("cinch", jobId);
    },
  };
}
