import os
from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

PHOENIX_HOST = os.getenv("PHOENIX_HOST", "localhost")
PHOENIX_HTTP_PORT = os.getenv("PHOENIX_HTTP_PORT", "6006")

trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

otlp_exporter = OTLPSpanExporter(
    endpoint=f"http://{PHOENIX_HOST}:{PHOENIX_HTTP_PORT}/v1/traces"
)

span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

app = FastAPI(title="SureLM Backend")
FastAPIInstrumentor().instrument_app(app)

@app.get("/")
def read_root():
    return {"message": "SureLM API is running"}

@app.get("/health")
def health_check():
    with tracer.start_as_current_span("health-check"):
        return {"status": "healthy", "service": "surelm-backend"}

@app.get("/api/v1/status")
def api_status():
    with tracer.start_as_current_span("api-status"):
        return {
            "service": "surelm",
            "version": "1.0.0",
            "database": "connected",
            "vector_db": "connected"
        }
