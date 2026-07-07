import { db } from "../db";

export interface WorkflowContext {
  id: string;
  workflowId: string;
  workflowType: "query" | "issuance" | "document";
  status: "pending" | "running" | "completed" | "failed";
  input: Record<string, unknown>;
  intermediateResults: Record<string, unknown>;
  finalOutput?: Record<string, unknown>;
  agentsExecuted: string[];
  errors: Array<{ agent: string; error: string }>;
  timestamps: {
    created: string;
    started?: string;
    completed?: string;
  };
}

export async function createContext(
  workflowId: string,
  type: "query" | "issuance" | "document",
  input: Record<string, unknown>
): Promise<WorkflowContext> {
  const existing = await db.orchestrationLog.findUnique({
    where: { workflowId },
  });

  if (existing) {
    return {
      id: existing.id,
      workflowId: existing.workflowId,
      workflowType: existing.type as any,
      status: "pending",
      input: existing.input as Record<string, unknown>,
      intermediateResults: {},
      agentsExecuted: [],
      errors: [],
      timestamps: {
        created: existing.createdAt.toISOString(),
      },
    };
  }

  const context = await db.orchestrationLog.create({
    data: {
      workflowId,
      type: type,
      input,
      status: "pending",
      intermediateResults: {},
      agentsExecuted: [],
      errors: [],
      timestamps: {
        created: new Date().toISOString(),
      },
    },
  });

  return {
    id: context.id,
    workflowId: context.workflowId,
    workflowType: type,
    status: "pending",
    input,
    intermediateResults: {},
    agentsExecuted: [],
    errors: [],
    timestamps: {
      created: context.createdAt.toISOString(),
    },
  };
}

export async function updateContext(
  workflowId: string,
  updates: Partial<{
    status: WorkflowContext["status"];
    intermediateResults: Record<string, unknown>;
    finalOutput: Record<string, unknown>;
    agentsExecuted: string[];
    errors: Array<{ agent: string; error: string }>;
    timestamps: {
      started?: string;
      completed?: string;
    };
  }>
): Promise<WorkflowContext | null> {
  const context = await db.orchestrationLog.findUnique({
    where: { workflowId },
  });

  if (!context) return null;

  const updated = await db.orchestrationLog.update({
    where: { workflowId },
    data: {
      status: updates.status,
      input: context.input,
      intermediateResults:
        updates.intermediateResults ?? context.intermediateResults,
      finalOutput: updates.finalOutput ?? context.finalOutput,
      agentsExecuted: [...new Set([...context.agentsExecuted, ...(updates.agentsExecuted || [])])],
      errors: [...(context.errors || []), ...(updates.errors || [])],
    },
  });

  return {
    id: updated.id,
    workflowId: updated.workflowId,
    workflowType: updated.type as any,
    status: updated.status as any,
    input: updated.input as Record<string, unknown>,
    intermediateResults: updated.intermediateResults as Record<string, unknown>,
    finalOutput: updated.finalOutput ? (updated.finalOutput as Record<string, unknown>) : undefined,
    agentsExecuted: updated.agentsExecuted,
    errors: updated.errors || [],
    timestamps: {
      created: updated.createdAt.toISOString(),
      started: context.completedAt?.toISOString(),
      completed: updated.completedAt?.toISOString(),
    },
  };
}

export async function getContext(workflowId: string): Promise<WorkflowContext | null> {
  const context = await db.orchestrationLog.findUnique({
    where: { workflowId },
  });

  if (!context) return null;

  return {
    id: context.id,
    workflowId: context.workflowId,
    workflowType: context.type as any,
    status: context.status as any,
    input: context.input as Record<string, unknown>,
    intermediateResults: context.intermediateResults as Record<string, unknown>,
    finalOutput: context.finalOutput ? (context.finalOutput as Record<string, unknown>) : undefined,
    agentsExecuted: context.agentsExecuted,
    errors: context.errors || [],
    timestamps: {
      created: context.createdAt.toISOString(),
      started: context.completedAt?.toISOString(),
      completed: context.completedAt?.toISOString(),
    },
  };
}

export async function logAgentExecution(
  workflowId: string,
  agentName: string,
  status: "pending" | "running" | "success" | "failed",
  input?: Record<string, unknown>,
  output?: Record<string, unknown>,
  latencyMs?: number
): Promise<void> {
  await db.orchestrationAgentLog.create({
    data: {
      workflowId,
      agent: agentName,
      status,
      input: input ?? null,
      output: output ?? null,
      latencyMs: latencyMs ?? null,
    },
  });
}
