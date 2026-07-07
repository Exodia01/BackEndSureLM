import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { Resource } from "@opentelemetry/resources";

const otlpEndpoint = process.env.OPENTELEMETRY_EXPORTER_OTLP_ENDPOINT || "http://localhost:4317/v1/traces";
const serviceName = process.env.PHOENIX_PROJECT_NAME || "surelm-platform";

async function main() {
  const exporter = new OTLPTraceExporter({
    url: otlpEndpoint,
  });

  const provider = new BasicTracerProvider({
    resource: new Resource({
      [Symbol.for("service.name")]: serviceName,
      [Symbol.for("service.version")]: "1.0.0",
    }),
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));

  const tracer = provider.getTracer(serviceName);

  const span = tracer.startSpan("test-span-manual");
  span.setAttribute("test.attribute", "value");
  span.setStatus({ code: 0 });
  span.end();

  console.log("Span ended, flushing...");
  
  await provider.forceFlush();
  await exporter.shutdown();

  console.log("Done. Check http://localhost:6007 for traces.");
}

main().catch(console.error);
