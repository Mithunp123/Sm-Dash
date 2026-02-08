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

const checkIds = async () => {
  try {
    const db = getDatabase();
    
    console.log('📊 Checking attendance record IDs...\n');
    
    const rows = await all(
      db,
      `SELECT id, assignment_id, mentee_name, attendance_date, status FROM phone_mentoring_attendance ORDER BY id DESC`
    );
    
    console.log(`Found ${rows.length} attendance records:\n`);
    rows.forEach((row, i) => {
      console.log(`${i + 1}. ID: ${row.id} | AssignmentID: ${row.assignment_id} | Mentee: ${row.mentee_name} | Date: ${row.attendance_date} | Status: ${row.status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

checkIds();
