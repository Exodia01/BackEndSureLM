const TRACE_ID_HEADER = 'x-request-trace-id';

export interface RequestContext {
  traceId: string;
  userId?: string;
  userAgent?: string;
  ipHash?: string;
}

let currentContext: RequestContext | null = null;

export function generateTraceId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function getTraceId(): string {
  if (currentContext) {
    return currentContext.traceId;
  }
  return generateTraceId();
}

export function createContext(traceId?: string): RequestContext {
  const context: RequestContext = {
    traceId: traceId || generateTraceId(),
  };
  
  currentContext = context;
  return context;
}

export function setUserId(userId: string): void {
  if (currentContext) {
    currentContext.userId = userId;
  }
}

export function setUserAgent(userAgent: string): void {
  if (currentContext) {
    currentContext.userAgent = userAgent;
  }
}

export function resetContext(): void {
  currentContext = null;
}

export function getOrGenerateContext(): RequestContext {
  if (!currentContext) {
    return createContext();
  }
  return currentContext;
}
