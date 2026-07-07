import { trace, SpanKind } from "@opentelemetry/api";
import { PhoenixSpanExporter } from "./exporter";

const phoenixEndpoint = process.env.PHOENIX_ENDPOINT || "http://localhost:6007";
const projectName = process.env.PHOENIX_PROJECT_NAME || "surelm-platform";

export const tracer = trace.getTracer(projectName);

export async function initPhoenixExporter() {
  return new PhoenixSpanExporter({
    endpoint: phoenixEndpoint,
    serviceName: projectName,
  });
}

export type TraceOptions = {
  spanName?: string;
  kind?: SpanKind;
  attributes?: Record<string, string | number>;
};

export async function traceOperation<T>(
  name: string,
  operation: (span?: import("@opentelemetry/api").Span) => Promise<T>,
  options: TraceOptions = {}
): Promise<T> {
  const { spanName, kind = SpanKind.INTERNAL, attributes = {} } = options;
  const finalSpanName = spanName || name;

  try {
    const span = tracer.startSpan(finalSpanName, {
      kind,
      attributes,
    });

    const result = await operation(span);

    span.setStatus({ code: 0 });
    span.end();

    return result;
  } catch (error) {
    const span = tracer.startActiveSpan(finalSpanName, { kind, attributes }, (span) => {
      span.setStatus({ 
        code: 2, 
        message: (error as Error).message 
      });
      span.end();
    });

    throw error;
  }
}

export function addTraceAttributes(span: import("@opentelemetry/api").Span, attributes: Record<string, string | number>) {
  Object.entries(attributes).forEach(([key, value]) => {
    span.setAttribute(key, value);
  });
}
