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
    
    console.log('🔍 Testing Phone Mentoring Data\n');
    
    // Check assignments
    const assignments = await all(
      db,
      `SELECT id, volunteer_id, mentee_name, project_id FROM phone_mentoring_assignments LIMIT 5`
    );
    console.log(`📌 Assignments: ${assignments.length} found`);
    assignments.forEach(a => {
      console.log(`   - ID: ${a.id}, Volunteer: ${a.volunteer_id}, Mentee: ${a.mentee_name}, Project: ${a.project_id}`);
    });
    
    // Check attendance
    if (assignments.length > 0) {
      const attendance = await all(
        db,
        `SELECT id, assignment_id, attendance_date, status FROM phone_mentoring_attendance WHERE assignment_id = ? LIMIT 5`,
        [assignments[0].id]
      );
      console.log(`\n📌 Attendance for Assignment ${assignments[0].id}: ${attendance.length} records`);
      attendance.forEach(a => {
        console.log(`   - Date: ${a.attendance_date}, Status: ${a.status}`);
      });
    }
    
    // Check updates
    if (assignments.length > 0) {
      const updates = await all(
        db,
        `SELECT id, assignment_id, update_date, status FROM phone_mentoring_updates WHERE assignment_id = ? LIMIT 5`,
        [assignments[0].id]
      );
      console.log(`\n📌 Updates for Assignment ${assignments[0].id}: ${updates.length} records`);
      updates.forEach(u => {
        console.log(`   - Date: ${u.update_date}, Status: ${u.status}`);
      });
    }
    
    console.log('\n✅ Data test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

testPhoneMentoringData();
