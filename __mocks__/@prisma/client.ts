import { PrismaClient as ActualPrismaClient, Prisma } from '@prisma/client';
import { vi } from 'vitest';

const MockPrismaClient = vi.fn().mockImplementation(() => ({
  $connect: vi.fn(),
  document: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  chunk: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

export const PrismaNeon = vi.fn();

export default MockPrismaClient;
export { ActualPrismaClient as PrismaClient, Prisma };