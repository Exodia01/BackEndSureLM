import { config } from 'dotenv';
import path from 'path';

export const loadEnv = () => {
  const envPath = path.join(__dirname, '..', 'config', '.env');
  config({ path: envPath });
};

export default { loadEnv };
