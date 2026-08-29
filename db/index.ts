import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type DrizzleDatabaseBinding = Parameters<typeof drizzle>[0];

export function getDb() {
  const runtimeEnv = env as { DB?: DrizzleDatabaseBinding };

  if (!runtimeEnv.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Configure a `DB` binding in the account workspace runtime before using the database.",
    );
  }

  return drizzle(runtimeEnv.DB, { schema });
}
