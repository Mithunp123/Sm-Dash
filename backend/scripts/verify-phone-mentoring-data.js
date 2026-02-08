import { getDatabase } from '../database/init.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const all = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const testPhoneMentoringData = async () => {
  try {
    const db = getDatabase();
    
    console.log('🔍 Testing Phone Mentoring Test Data\n');
    
    // Check attendance for assignment 2 (Arjun Kumar)
    const attendance = await all(
      db,
      `SELECT id, assignment_id, attendance_date, status, notes FROM phone_mentoring_attendance WHERE assignment_id = 2 ORDER BY attendance_date DESC`
    );
    console.log(`📌 Attendance for Assignment 2 (Arjun Kumar): ${attendance.length} records`);
    attendance.forEach(a => {
      console.log(`   - ${a.attendance_date}: ${a.status} | ${a.notes}`);
    });
    
    // Check updates for assignment 2
    const updates = await all(
      db,
      `SELECT id, assignment_id, update_date, status, explanation FROM phone_mentoring_updates WHERE assignment_id = 2 ORDER BY update_date DESC`
    );
    console.log(`\n📌 Updates for Assignment 2 (Arjun Kumar): ${updates.length} records`);
    updates.forEach(u => {
      console.log(`   - ${u.update_date}: ${u.status} | ${u.explanation}`);
    });
    
    console.log('\n✅ Data test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

testPhoneMentoringData();
