import { db } from "../db";
import { Prisma } from "@prisma/client";

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

function toInputJson(value: unknown): Prisma.InputJsonValue {
  if (value === null) return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  if (value === undefined) return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
  if (Array.isArray(value)) return value.map(toInputJson) as Prisma.InputJsonValue;
  if (typeof value === "object") {
    const obj: Record<string, Prisma.InputJsonValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      obj[k] = toInputJson(v);
    }
    return obj as Prisma.InputJsonValue;
  }
  return value as Prisma.InputJsonValue;
}

function fromJsonValue<T>(value: Prisma.JsonValue | null | undefined, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as T;
  }
  return fallback;
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
      workflowType: existing.type as WorkflowContext["workflowType"],
      status: "pending",
      input: fromJsonValue(existing.input, {}),
      intermediateResults: fromJsonValue(existing.intermediateResults, {}),
      agentsExecuted: fromJsonValue(existing.agentsExecuted, []),
      errors: fromJsonValue(existing.errors, []),
      timestamps: {
        created: existing.createdAt.toISOString(),
      },
    };
  }

  const context = await db.orchestrationLog.create({
    data: {
      workflowId,
      type,
      input: toInputJson(input),
      status: "pending",
      intermediateResults: Prisma.JsonNull,
      agentsExecuted: [],
      errors: Prisma.JsonNull,
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
      input: toInputJson(context.input),
      intermediateResults: updates.intermediateResults !== undefined
        ? toInputJson(updates.intermediateResults)
        : undefined,
      finalOutput: updates.finalOutput !== undefined
        ? toInputJson(updates.finalOutput)
        : undefined,
      agentsExecuted: updates.agentsExecuted !== undefined
        ? [...new Set([...fromJsonValue(context.agentsExecuted, []), ...(updates.agentsExecuted || [])])]
        : undefined,
      errors: updates.errors !== undefined
        ? [...fromJsonValue(context.errors, []), ...(updates.errors || [])]
        : undefined,
    },
  });

  return {
    id: updated.id,
    workflowId: updated.workflowId,
    workflowType: updated.type as WorkflowContext["workflowType"],
    status: updated.status as WorkflowContext["status"],
    input: fromJsonValue(updated.input, {}),
    intermediateResults: fromJsonValue(updated.intermediateResults, {}),
    finalOutput: updated.finalOutput !== null ? fromJsonValue(updated.finalOutput, undefined) : undefined,
    agentsExecuted: fromJsonValue(updated.agentsExecuted, []),
    errors: fromJsonValue(updated.errors, []),
    timestamps: {
      created: updated.createdAt.toISOString(),
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
    workflowType: context.type as WorkflowContext["workflowType"],
    status: context.status as WorkflowContext["status"],
    input: fromJsonValue(context.input, {}),
    intermediateResults: fromJsonValue(context.intermediateResults, {}),
    finalOutput: context.finalOutput !== null ? fromJsonValue(context.finalOutput, undefined) : undefined,
    agentsExecuted: fromJsonValue(context.agentsExecuted, []),
    errors: fromJsonValue(context.errors, []),
    timestamps: {
      created: context.createdAt.toISOString(),
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
      input: input !== undefined ? toInputJson(input) : Prisma.JsonNull,
      output: output !== undefined ? toInputJson(output) : Prisma.JsonNull,
      latencyMs: latencyMs ?? null,
    },
  });
}