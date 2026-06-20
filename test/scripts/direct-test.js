console.log("Starting...");
process.env.DATABASE_URL = "postgresql://admin:[REDACTED-CREDENTIAL]@localhost:5432/surelm";

try {
  const { PrismaClient } = require("@prisma/client");
  const { PrismaNeon } = require("@prisma/adapter-neon");
  
  console.log("Imported dependencies...");
  
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  });
  
  console.log("Created adapter...");
  
  const prisma = new PrismaClient({ adapter });
  
  console.log("Created client...");
  
  async function test() {
    try {
      const result = await prisma.$queryRaw`SELECT 1 as x`;
      console.log("OK:", result);
    } catch (err) {
      console.error("Error:", err.message);
      console.error("Stack:", err.stack);
    } finally {
      await prisma.$disconnect();
    }
  }
  
  test();
} catch (err) {
  console.error("Setup error:", err.message);
}
