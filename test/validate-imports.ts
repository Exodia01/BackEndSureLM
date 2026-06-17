// Quick validation of imports
process.env.DATABASE_URL = 'postgresql://admin:[REDACTED-CREDENTIAL]@localhost:5432/surelm';
import('./integration/setup.ts').then(() => console.log('[✓] Imports OK')).catch(e => { console.error(e); process.exit(1); });
