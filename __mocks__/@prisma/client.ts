import { PrismaClient as ActualPrismaClient, Prisma } from '@prisma/client';

const MockPrismaClient = jest.fn().mockImplementation(() => ({
  $connect: jest.fn(),
  document: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
  chunk: {
    create: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

export const PrismaNeon = jest.fn();

export default MockPrismaClient;
export { ActualPrismaClient as PrismaClient, Prisma };
