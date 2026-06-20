import { db } from "../lib/db";

async function debugFTS() {
  console.log("=== FTS DEBUG ===");
  
  const query = "waiting period";
  
  try {
    // Test 1: Raw SQL via $queryRaw (like postgres.ts does)
    const results = await db.$queryRaw`
      SELECT 
        c.id as chunk_id,
        c.content,
        ts_rank(to_tsvector('english', coalesce(c.content, '')), plainto_tsquery('english', ${query})) as score
      FROM "Chunk" c
      WHERE to_tsvector('english', coalesce(c.content, '')) @@ plainto_tsquery('english', ${query})
      ORDER BY score DESC
      LIMIT 10
    `;
    
    console.log("\n=== Raw Query Results ===");
    console.log("Type:", typeof results);
    console.log("Is Array?", Array.isArray(results));
    console.log("Count:", results.length);
    if (results && results.length > 0) {
      console.log("First result:", JSON.stringify(results[0], null, 2));
    }
    
    // Test 2: Check actual query text being sent
    console.log("\n=== Query Construction Check ===");
    const queryString = `plainto_tsquery('english', ${query})`;
    console.log("Query string passed to tsquery:", queryString);
    
    // Test 3: Check if content has the exact phrase
    const sample = await db.$queryRaw`
      SELECT id, LEFT(content, 100) as snippet 
      FROM "Chunk" 
      WHERE LOWER(content) LIKE LOWER(${`%${query}%`})
      LIMIT 3
    `;
    console.log("\n=== Direct Text Match (LIKE) ===");
    console.log("Found in content:", sample.length);
    
  } catch (error: any) {
    console.error("Error:", error.message);
    if (error.stack) console.error(error.stack);
  } finally {
    await db.$disconnect();
  }
}

debugFTS();
