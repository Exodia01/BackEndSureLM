import { db } from '../lib/db.js';

try {
  if (!process.env.DATABASE_URL) {
    console.log('OK - no DATABASE_URL set');
    process.exit(0);
  }
  const result = await db.$queryRaw`SELECT 1 as x`;
  console.log('OK', result);
} catch (error) {
  console.error('Error:', error.message);
}
