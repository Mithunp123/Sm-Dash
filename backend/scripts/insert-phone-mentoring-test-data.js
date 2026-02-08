import { getDatabase } from '../database/init.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'file:/';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const run = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const insertTestData = async () => {
  try {
    const db = getDatabase();
    console.log('📋 Inserting test phone mentoring data...');

    // Get first volunteer user (role = 'volunteer' or similar)
    const volunteer = await get(
      db,
      `SELECT id, name FROM users WHERE role IN ('volunteer', 'staff', 'admin') LIMIT 1`
    );

    if (!volunteer) {
      console.log('❌ No volunteer user found. Please create a volunteer user first.');
      process.exit(1);
    }

    console.log(`✅ Found volunteer: ${volunteer.name} (ID: ${volunteer.id})`);

    // Get a project
    const project = await get(db, `SELECT id, title FROM projects LIMIT 1`);
    if (!project) {
      console.log('❌ No project found. Please create a project first.');
      process.exit(1);
    }

    console.log(`✅ Found project: ${project.title} (ID: ${project.id})`);

    // Insert test phone mentoring assignment
    const assignmentResult = await run(
      db,
      `
        INSERT INTO phone_mentoring_assignments 
        (volunteer_id, project_id, mentee_name, mentee_phone, mentee_register_no, mentee_department, mentee_year, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        volunteer.id,
        project.id,
        'Test Mentee Student',
        '9876543210',
        'REG001',
        'CSE',
        '1st Year',
        volunteer.id
      ]
    );

    const assignmentId = assignmentResult.lastID;
    console.log(`✅ Created assignment with ID: ${assignmentId}`);

    // Insert sample attendance records
    const attendanceData = [
      {
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days ago
        status: 'PRESENT',
        notes: 'Discussed learning goals'
      },
      {
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days ago
        status: 'PRESENT',
        notes: 'Covered basic concepts'
      },
      {
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days ago
        status: 'ABSENT',
        notes: 'Student was unavailable'
      },
      {
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 day ago
        status: 'PRESENT',
        notes: 'Completed assignment review'
      }
    ];

    for (const record of attendanceData) {
      await run(
        db,
        `
          INSERT INTO phone_mentoring_attendance 
          (assignment_id, project_id, mentee_name, attendance_date, status, notes, recorded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          assignmentId,
          project.id,
          'Test Mentee Student',
          record.date,
          record.status,
          record.notes,
          volunteer.id
        ]
      );
      console.log(`✅ Inserted attendance record for ${record.date}: ${record.status}`);
    }

    console.log('\n✅ Test data inserted successfully!');
    console.log(`📌 Assignment ID: ${assignmentId}`);
    console.log(`📌 Volunteer ID: ${volunteer.id}`);
    console.log(`📌 You can now use this assignment ID to view attendance history.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error inserting test data:', error);
    process.exit(1);
  }
};

insertTestData();
