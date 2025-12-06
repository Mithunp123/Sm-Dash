import { initDatabase } from '../database/init.js';
import dotenv from 'dotenv';

dotenv.config();

(async () => {
  try {
    console.log('🔄 Initializing database...');
    await initDatabase();
    console.log('✅ Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
})();

