import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

console.log("[db.ts] DATABASE_URL from env:", DATABASE_URL);
console.log("[db.ts] DATABASE_URL type:", typeof DATABASE_URL);

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
