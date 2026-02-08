import { getDatabase, initDatabase } from '../database/init.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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

const run = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const createTestData = async () => {
  try {
    console.log('🔄 Initializing database...');
    await initDatabase();
    console.log('✅ Database initialized');

    const db = getDatabase();
    console.log('📋 Creating test data for phone mentoring...\n');

    // Step 1: Find or create a volunteer user
    console.log('Step 1: Finding volunteer user...');
    let volunteer = await get(
      db,
      `SELECT * FROM users WHERE role IN ('volunteer', 'admin') LIMIT 1`
    );

    if (!volunteer) {
      console.log('❌ No volunteer found. Please create a volunteer user first.');
      process.exit(1);
    }
    console.log(`✅ Found volunteer: ${volunteer.name} (ID: ${volunteer.id})\n`);

    // Step 2: Find or create a project
    console.log('Step 2: Finding project...');
    let project = await get(db, `SELECT * FROM projects LIMIT 1`);

    if (!project) {
      console.log('⚠️ No project found. Creating test project...');
      const projectResult = await run(
        db,
        `INSERT INTO projects (title, description, status) VALUES (?, ?, ?)`,
        ['Phone Mentoring - Test Project', 'Test project for phone mentoring', 'active']
      );
      project = await get(db, `SELECT * FROM projects WHERE id = ?`, [projectResult.lastID]);
      console.log(`✅ Created project: ${project.title} (ID: ${project.id})\n`);
    } else {
      console.log(`✅ Found project: ${project.title} (ID: ${project.id})\n`);
    }

    // Step 3: Check existing assignments
    console.log('Step 3: Checking existing assignments...');
    const existingAssignments = await all(
      db,
      `SELECT * FROM phone_mentoring_assignments WHERE volunteer_id = ?`,
      [volunteer.id]
    );
    console.log(`Found ${existingAssignments.length} existing assignments\n`);

    // Step 4: Create test assignments if needed
    let testAssignments = [];
    if (existingAssignments.length === 0) {
      console.log('Step 4: Creating test assignments...');
      const menteeNames = [
        'Arjun Kumar',
        'Divya Sharma',
        'Priya Patel'
      ];

      for (let i = 0; i < menteeNames.length; i++) {
        const result = await run(
          db,
          `
            INSERT INTO phone_mentoring_assignments 
            (volunteer_id, project_id, mentee_name, mentee_phone, mentee_register_no, 
             mentee_department, mentee_year, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            volunteer.id,
            project.id,
            menteeNames[i],
            `9876543${100 + i}`,
            `REG${String(i + 1).padStart(3, '0')}`,
            'CSE',
            `${2 + i} Year`,
            volunteer.id
          ]
        );
        testAssignments.push({ id: result.lastID, name: menteeNames[i] });
        console.log(`✅ Created assignment: ${menteeNames[i]} (ID: ${result.lastID})`);
      }
      console.log();
    } else {
      testAssignments = existingAssignments.map(a => ({ id: a.id, name: a.mentee_name }));
    }

    // Step 5: Create test attendance records
    console.log('Step 5: Creating test attendance records...');
    for (const assignment of testAssignments.slice(0, 1)) { // Just for first mentee
      const attendanceDates = [
        { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'PRESENT', notes: 'Discussed learning goals' },
        { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'PRESENT', notes: 'Covered basic concepts' },
        { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'ABSENT', notes: 'Student was unavailable' },
        { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'PRESENT', notes: 'Completed assignment review' }
      ];

      for (const record of attendanceDates) {
        try {
          // Check if record already exists
          const existing = await get(
            db,
            `SELECT id FROM phone_mentoring_attendance WHERE assignment_id = ? AND attendance_date = ?`,
            [assignment.id, record.date]
          );

          if (existing) {
            // Update existing record
            await run(
              db,
              `
                UPDATE phone_mentoring_attendance
                SET status = ?, notes = ?, recorded_by = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `,
              [record.status, record.notes, volunteer.id, existing.id]
            );
          } else {
            // Insert new record
            await run(
              db,
              `
                INSERT INTO phone_mentoring_attendance 
                (assignment_id, project_id, mentee_name, attendance_date, status, notes, recorded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
              [
                assignment.id,
                project.id,
                assignment.name,
                record.date,
                record.status,
                record.notes,
                volunteer.id
              ]
            );
          }
          console.log(`  ✅ ${record.date}: ${record.status}`);
        } catch (err) {
          console.log(`  ⚠️ ${record.date}: Error - ${err.message.substring(0, 50)}`);
        }
      }
    }

    // Step 6: Create test mentoring updates
    console.log('\nStep 6: Creating test mentoring updates...');
    for (const assignment of testAssignments.slice(0, 1)) { // Just for first mentee
      const updates = [
        { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'CALL_DONE', explanation: 'Mathematics basics' },
        { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'CALL_DONE', explanation: 'Problem solving techniques' },
        { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], status: 'CALL_DONE', explanation: 'Advanced concepts' }
      ];

      for (const update of updates) {
        try {
          await run(
            db,
            `
              INSERT INTO phone_mentoring_updates 
              (volunteer_id, volunteer_name, mentee_name, assignment_id, project_id, update_date, status, explanation, attempts)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              volunteer.id,
              volunteer.name,
              assignment.name,
              assignment.id,
              project.id,
              update.date,
              update.status,
              update.explanation,
              1
            ]
          );
          console.log(`  ✅ ${update.date}: ${update.status} - ${update.explanation}`);
        } catch (err) {
          console.log(`  ⚠️ ${update.date}: Error - ${err.message.substring(0, 50)}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST DATA CREATED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📌 Test Information:');
    console.log(`  Volunteer: ${volunteer.name} (ID: ${volunteer.id})`);
    console.log(`  Project: ${project.title} (ID: ${project.id})`);
    console.log(`  Assignments Created: ${testAssignments.length}`);
    console.log(`  Sample Assignment ID: ${testAssignments[0].id} (${testAssignments[0].name})`);
    console.log('\n💡 Next Steps:');
    console.log(`  1. Login as ${volunteer.email || 'the volunteer'}`);
    console.log('  2. Go to Phone Mentoring page');
    console.log(`  3. You should see "${testAssignments[0].name}" in the mentee list`);
    console.log('  4. Record or view attendance for this mentee');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test data:', error);
    process.exit(1);
  }
};

createTestData();
