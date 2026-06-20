import { ensureCollection, healthCheck } from "../lib/retrieval/vector/index";

async function testVectorStorage() {
  console.log("Testing Qdrant connectivity...");
  
  try {
    const healthy = await healthCheck();
    console.log(`Qdrant health check: ${healthy ? "OK" : "FAILED"}`);
    
    if (healthy) {
      // Test collection creation
      console.log("\nTesting vector storage setup...");
      await ensureCollection("policies", 768);
      console.log("✓ Collection 'policies' ready");
      
      // Verify it exists
      const response = await fetch("http://localhost:6333/collections/policies");
      if (response.ok) {
        const data = await response.json();
        console.log(`\n✓ Collection created with ${data.result.vectors.params.size} dimensions`);
      }
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testVectorStorage();
