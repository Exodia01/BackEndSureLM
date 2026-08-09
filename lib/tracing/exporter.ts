import { BasicTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { Resource } from "@opentelemetry/resources";

const ATTR_SERVICE_NAME = "service.name";
const ATTR_SERVICE_VERSION = "service.version";

const otlpEndpoint = process.env.OPENTELEMETRY_EXPORTER_OTLP_ENDPOINT || "http://localhost:4317/v1/traces";
const serviceName = process.env.PHOENIX_PROJECT_NAME || "surelm-platform";

export async function initPhoenixExporter() {
  const exporter = new OTLPTraceExporter({
    url: otlpEndpoint,
  });

  const provider = new BasicTracerProvider({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: "1.0.0",
    }),
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));

  return {
    exporter,
    provider,
  };
}