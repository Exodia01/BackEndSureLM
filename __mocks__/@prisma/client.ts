jest.mock('@prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    \ = jest.fn();
    document = { create: jest.fn(), deleteMany: jest.fn() };
    chunk = { create: jest.fn(), deleteMany: jest.fn() };
  },
  PrismaNeon: class MockPrismaNeon {},
  version: '7.4.1'
}));