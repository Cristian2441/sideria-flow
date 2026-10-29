import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

export const contract = contractFromJson<Contract>(contractJson);

function createDb() {
  return postgres({
    contract,
    url: process.env["DATABASE_URL"]!,
  });
}

export type AppDb = ReturnType<typeof createDb>;

// Singleton pattern for Next.js hot reload in development
const globalForDb = globalThis as unknown as {
  dbInstance: AppDb | undefined;
};

export const db: AppDb = globalForDb.dbInstance ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalForDb.dbInstance = db;
}
