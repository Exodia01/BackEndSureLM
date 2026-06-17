import { PrismaClient } from "@prisma/client";

// Always check at runtime - environment should be set before this module is imported
const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL || "postgresql://admin:[REDACTED-CREDENTIAL]@localhost:5432/surelm";
  return new PrismaClient();
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export async function dbHealthCheck(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}