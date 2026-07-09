import winston from 'winston';
import path from 'path';

const getLogPath = (filename: string): string => {
  const logsDir = process.env.LOGS_DIR || path.join(__dirname, '..', '..', 'logs', 'application');
  return path.join(logsDir, filename);
};

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: () => new Date().toISOString() }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'surelm' },
  transports: [
    new winston.transports.File({
      filename: getLogPath('error.log'),
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: getLogPath('combined.log'),
      level: 'info',
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}
