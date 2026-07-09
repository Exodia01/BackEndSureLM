import { createContext, generateTraceId, getTraceId, resetContext, setUserId, setUserAgent } from './traceId';
import { maskEmail, maskIncome, maskPhone, maskPii } from './maskData';

export const loggerMiddleware = {
  traceId: generateTraceId,
  createContext,
  getTraceId,
  resetContext,
  setUserId,
  setUserAgent,
};

export const piiMasking = {
  maskEmail,
  maskIncome,
  maskPhone,
  maskPii,
};
