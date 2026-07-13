import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("[db] DATABASE_URL not set");
}

let adapter: PrismaPg | null = null;
let client: PrismaClient | null = null;

function createPrismaClient() {
  adapter = new PrismaPg({
    connectionString: DATABASE_URL,
  });
  client = new PrismaClient({ adapter });
  return client;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export function getAdapter() {
  return adapter;
}

export function getRawClient() {
  return client;
}
