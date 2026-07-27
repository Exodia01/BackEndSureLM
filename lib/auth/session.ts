import { PrismaClient } from "@prisma/client";

const SESSION_CACHE = new Map<string, any>();

export async function createSession(
  userId: string,
  keycloakUserId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
) {
  return await createSessionWithPKCE(
    userId,
    keycloakUserId,
    accessToken,
    refreshToken,
    expiresAt,
    "",
    ""
  );
}

export async function createSessionWithPKCE(
  userId: string,
  keycloakUserId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date,
  codeVerifier: string,
  state: string
) {
  try {
    const prisma = new PrismaClient();
    const session = await prisma.session.create({
      data: {
        userId,
        keycloakUserId,
        accessToken,
        refreshToken,
        codeVerifier,
        state,
        expiresAt,
      },
    });
    return session;
  } catch (error: any) {
    console.error("Failed to create session in database:", error);
    throw new Error("Database unavailable");
  }
}

export async function getSession(keycloakUserId: string) {
  try {
    const prisma = new PrismaClient();
    const session = await prisma.session.findUnique({
      where: { keycloakUserId },
    });

    if (!session || new Date() > session.expiresAt) {
      return null;
    }

    return session;
  } catch (error: any) {
    console.error("Failed to get session from database:", error);
    return null;
  }
}

export async function updateSession(
  keycloakUserId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
) {
  try {
    const prisma = new PrismaClient();
    const session = await prisma.session.update({
      where: { keycloakUserId },
      data: {
        accessToken,
        refreshToken,
        expiresAt,
      },
    });

    return session;
  } catch (error: any) {
    console.error("Failed to update session in database:", error);
    throw new Error("Database unavailable");
  }
}

export async function deleteSession(keycloakUserId: string) {
  try {
    const prisma = new PrismaClient();
    await prisma.session.delete({
      where: { keycloakUserId },
    });
  } catch (error: any) {
    console.error("Failed to delete session from database:", error);
    throw new Error("Database unavailable");
  }
}
