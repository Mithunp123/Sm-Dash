import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init.js';

(async()=>{
  const db = getDatabase();
  const hash = await bcrypt.hash('password123', 10);
  try {
    await db.run('UPDATE users SET password=? WHERE id=1', [hash]);
    console.log('✅ Admin password updated to password123');
  } catch(err) {
    console.error('Error updating password', err);
  }
  process.exit(0);
})();