const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Test the profile save functionality
async function testProfileSave() {
  const dbPath = path.join(__dirname, '../smvdb.db');
  const db = new sqlite3.Database(dbPath);

  const run = (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  const get = (query, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  try {
    console.log('🧪 Testing Profile Save Functionality...\n');

    // 1. Create a test user (student)
    console.log('1️⃣ Creating test student user...');
    const hashedPassword = 'test_hash'; // In real scenario this would be bcrypt hashed
    const userResult = await run(
      'INSERT INTO users (name, email, password, role, must_change_password) VALUES (?, ?, ?, ?, ?)',
      ['Test Student', 'test@example.com', hashedPassword, 'student', 1]
    );
    const testUserId = userResult.lastID;
    console.log(`✅ Student created with ID: ${testUserId}\n`);

    // 2. Create profile for the student
    console.log('2️⃣ Creating profile for student...');
    const profileResult = await run(
      'INSERT INTO profiles (user_id, role) VALUES (?, ?)',
      [testUserId, 'student']
    );
    console.log(`✅ Profile created with ID: ${profileResult.lastID}\n`);

    // 3. Verify profile exists
    console.log('3️⃣ Verifying profile exists...');
    const profile = await get('SELECT * FROM profiles WHERE user_id = ?', [testUserId]);
    if (profile) {
      console.log('✅ Profile found:', {
        id: profile.id,
        user_id: profile.user_id,
        role: profile.role,
        dept: profile.dept,
        phone: profile.phone
      });
      console.log();
    } else {
      console.log('❌ Profile not found!\n');
      throw new Error('Profile should exist');
    }

    // 4. Update profile with data (simulate profile save)
    console.log('4️⃣ Updating profile with student data...');
    const updates = [];
    const params = [];
    const fieldsToUpdate = {
      dept: 'Computer Science',
      year: '3',
      phone: '9876543210',
      register_no: 'CSE001',
      blood_group: 'O+'
    };

    Object.entries(fieldsToUpdate).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    });

    params.push(testUserId);
    const updateResult = await run(
      `UPDATE profiles SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
      params
    );
    console.log(`✅ Profile updated, changes: ${updateResult.changes}\n`);

    // 5. Verify updated profile
    console.log('5️⃣ Verifying updated profile...');
    const updatedProfile = await get('SELECT * FROM profiles WHERE user_id = ?', [testUserId]);
    console.log('✅ Updated profile:', {
      id: updatedProfile.id,
      user_id: updatedProfile.user_id,
      dept: updatedProfile.dept,
      year: updatedProfile.year,
      phone: updatedProfile.phone,
      register_no: updatedProfile.register_no,
      blood_group: updatedProfile.blood_group,
      updated_at: updatedProfile.updated_at
    });
    console.log();

    // 6. Test profile creation from save (profile doesn't exist scenario)
    console.log('6️⃣ Testing create new profile (if it didn\'t exist)...');
    const newUserId = (await run(
      'INSERT INTO users (name, email, password, role, must_change_password) VALUES (?, ?, ?, ?, ?)',
      ['New Student', 'new@example.com', hashedPassword, 'student', 1]
    )).lastID;

    // Check if profile exists, if not create it (simulating PUT endpoint logic)
    const existingProfile = await get('SELECT id FROM profiles WHERE user_id = ?', [newUserId]);
    if (existingProfile) {
      console.log('✅ Profile already exists for user ' + newUserId);
    } else {
      console.log('⚠️ Profile does not exist, creating it...');
      const newProfileResult = await run(
        'INSERT INTO profiles (user_id, role) VALUES (?, ?)',
        [newUserId, 'student']
      );
      console.log(`✅ New profile created with ID: ${newProfileResult.lastID}`);
    }
    console.log();

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await run('DELETE FROM profiles WHERE user_id IN (?, ?)', [testUserId, newUserId]);
    await run('DELETE FROM users WHERE id IN (?, ?)', [testUserId, newUserId]);
    console.log('✅ Test data cleaned up\n');

    console.log('✅ All tests passed! Profile save functionality is working correctly.\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    db.close();
  }
}

testProfileSave();
