import { PrismaClient } from "@/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Prisma 7 requires the Neon adapter to be passed directly to PrismaClient
function createPrismaClient() {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL!,
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
