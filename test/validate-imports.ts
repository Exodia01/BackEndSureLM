// Quick validation of imports
process.env.DATABASE_URL = 'postgresql://admin:localpg2024@localhost:5432/surelm';
import('./integration/setup.js').then(() => console.log('[✓] Imports OK')).catch(e => { console.error(e); process.exit(1); });
