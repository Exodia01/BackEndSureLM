import { db } from "./db";

async function testConnection() {
  console.log("Testing database connection...");
  try {
    await db.$connect();
    console.log("✓ Database connected successfully");
    
    const result = await db.$queryRaw`SELECT current_database(), version()`;
    console.log(`Database: ${result[0].current_database}`);
    
    await db.$disconnect();
    console.log("✓ Database disconnected cleanly");
  } catch (error) {
    console.error("✗ Connection test failed:", error);
    process.exit(1);
  }
}

testConnection();
