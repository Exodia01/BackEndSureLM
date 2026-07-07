import { traceOperation, getTracer } from "./lib/tracing/phoenix";

async function main() {
  console.log("Testing Phoenix tracing...");
  
  const tracer = await getTracer();
  console.log("Tracer initialized:", tracer);

  const result = await traceOperation("test-operation", async (span) => {
    if (span) {
      span.setAttribute("test.attribute", "value");
    }
    return { success: true, message: "Tracing test completed" };
  });

  console.log("Result:", result);
  console.log("Trace should be visible in Phoenix at http://localhost:6007");
}

main().catch(console.error);
