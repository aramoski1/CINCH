import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";
import { ensureRuntimeTable } from "@cinch/adapters";

loadDotenv({ path: resolve(process.cwd(), ".env.local") });
loadDotenv({ path: resolve(process.cwd(), "../../.env") });

const direct = process.env.DIRECT_URL;
const pooled = process.env.DATABASE_URL;
if (!direct && !pooled) {
  throw new Error("DIRECT_URL or DATABASE_URL is missing");
}
try {
  await ensureRuntimeTable(direct ?? pooled!);
} catch {
  await ensureRuntimeTable(pooled ?? direct!);
}
