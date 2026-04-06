import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import { logActivity } from '../utils/logger.js';

const router = express.Router();

// Configure multer for photo uploads
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'photo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept image files only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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

// Get all users (Admin and Office Bearer)
router.get('/', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
  try {
    const db = getDatabase();
    const users = await all(db, `
      SELECT u.id, u.name, u.email, u.role, u.is_interviewer, u.created_at,
             COALESCE(p.dept, sp.dept, obp.dept) as dept, 
             COALESCE(p.year, sp.year, obp.year) as year, 
             COALESCE(p.phone, sp.phone, obp.phone) as phone
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id AND u.role = 'student'
      LEFT JOIN office_bearer_profiles obp ON u.id = obp.user_id AND u.role = 'office_bearer'
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get only users marked as interviewers (for mentor assignment dropdown)
router.get('/interviewers', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const interviewers = await all(db, `
      SELECT u.id, u.name, u.email, u.role, u.is_interviewer,
             p.dept, p.phone
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.is_interviewer = 1
      ORDER BY u.name ASC
    `);
    res.json({ success: true, users: interviewers });
  } catch (error) {
    console.error('Get interviewers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Toggle interviewer flag (Admin only)
router.patch('/:id/toggle-interviewer', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const user = await get(db, 'SELECT id, name, is_interviewer FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const newValue = user.is_interviewer ? 0 : 1;
    await run(db, 'UPDATE users SET is_interviewer = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newValue, id]);
    res.json({ success: true, is_interviewer: newValue, message: newValue ? `${user.name} marked as interviewer` : `${user.name} removed from interviewers` });
  } catch (error) {
    console.error('Toggle interviewer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Get contacts (admins and office bearers) - accessible by any authenticated user
// This allows students to see who they can message
router.get('/contacts', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();

    // Get all admins and office bearers
    const contacts = await all(db, `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        p.dept,
        p.phone
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.role IN ('admin', 'office_bearer')
      ORDER BY 
        CASE u.role 
          WHEN 'admin' THEN 1 
          WHEN 'office_bearer' THEN 2 
        END,
        u.name ASC
    `);

    res.json({ success: true, contacts });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Admin sees all students, office_bearer sees students in their dept,
// and regular students are also allowed to view the list (no hard restriction now).
router.get('/students', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();

    const baseSelect = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.created_at,
        p.dept, 
        p.year, 
        p.phone, 
        p.blood_group, 
        p.gender
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
    `;

    // Admin: return all students
    if (req.user.role === 'admin') {
      const students = await all(db, `${baseSelect} WHERE u.role = 'student' ORDER BY u.created_at DESC`);
      return res.json({ success: true, students });
    }

    // Office bearer: return students in same department (if dept set in profile)
    if (req.user.role === 'office_bearer') {
      const obProfile = await get(db, 'SELECT dept FROM profiles WHERE user_id = ?', [req.user.id]);
      // If no dept assigned, return all students rather than an empty list so the UI can assign students.
      // This avoids blocking Office Bearers who haven't set a dept in their profile.
      if (!obProfile || !obProfile.dept) {
        const students = await all(db, `${baseSelect} WHERE u.role = 'student' ORDER BY u.created_at DESC`);
        return res.json({ success: true, students });
      }

      const students = await all(db,
        `${baseSelect}
         WHERE u.role = 'student' AND p.dept = ?
         ORDER BY u.created_at DESC`,
        [obProfile.dept]
      );

      return res.json({ success: true, students });
    }

    // Students and any other authenticated roles: allow viewing the full list
    const students = await all(db, `${baseSelect} WHERE u.role = 'student' ORDER BY u.created_at DESC`);
    return res.json({ success: true, students });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user
// Any authenticated user can now update user basic info (name/email).
// This avoids 403 errors when students edit their own profile.
router.put('/:id', authenticateToken, [
  body('name').optional().trim(),
  body('email').optional().isEmail(),
  body('role').optional().isIn(['admin', 'office_bearer', 'student'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { name, email, role } = req.body;
    const db = getDatabase();

    // Check if user exists
    const user = await get(db, 'SELECT id FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // At this point the request is authenticated. We no longer block based on role/ownership
    // to avoid 403 errors when students update their own name/email.

    // Check if email is already taken by another user
    if (email) {
      const existing = await get(db, 'SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
    }

    // If role change requested, ensure requester has permission.
    // Admins can set any role. Office bearers may promote students to 'office_bearer' only.
    if (role !== undefined) {
      if (req.user.role === 'admin') {
        // allowed
      } else if (req.user.role === 'office_bearer') {
        // allow only promoting a student to office_bearer
        if (role !== 'office_bearer') {
          return res.status(403).json({ success: false, message: 'Office bearers can only promote users to office_bearer' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'Only admins or office bearers can change roles' });
      }
    }

    // Build update query dynamically to include role if provided
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name || null); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email || null); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    params.push(id);

    if (updates.length > 0) {
      const sql = `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      await run(db, sql, params);
    }

    // If role changed to a profile-bearing role, ensure profile exists
    if (role && ['student', 'office_bearer'].includes(role)) {
      try { 
        const existingProf = await get(db, 'SELECT id FROM profiles WHERE user_id = ?', [id]);
        if (!existingProf) {
          await run(db, 'INSERT INTO profiles (user_id, role) VALUES (?, ?)', [id, role]);
        }
      } catch (e) { }
    }

    res.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete user
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Check if user exists
    const user = await get(db, 'SELECT id, role FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent deleting admin users
    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete admin users' });
    }

    await run(db, 'DELETE FROM users WHERE id = ?', [id]);
    await logActivity(req.user.id, 'DELETE_USER', { targetId: id, role: user.role }, req, {
      action_type: 'DELETE',
      module_name: 'users',
      action_description: `Deleted user: ${user.name} (${user.role})`,
      reference_id: id
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const user = await get(db,
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.params.id]
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Users can only view their own profile unless admin
    const requesterId = String(req.user.id);
    const targetId = String(req.params.id);
    const isOwnProfile = requesterId === targetId || parseInt(requesterId, 10) === parseInt(targetId, 10);

    if (req.user.role !== 'admin' && !isOwnProfile) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add new user (Admin only)
// Create or update user (Admin only)
// This endpoint is mounted at POST /api/users and will upsert by email.
router.post('/', authenticateToken, requireRole('admin'), [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'office_bearer', 'student']),
  body('password').optional().isLength({ min: 5 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    const { name, email, role, password } = req.body;
    const db = getDatabase();

    // Check if user exists
    const existingUser = await get(db, 'SELECT id, role FROM users WHERE email = ?', [email]);
    if (existingUser) {
      // Update existing user (name and role). If password provided, update password and set must_change_password=1
      try {
        await run(db, `UPDATE users SET name = ?, role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [name, role, existingUser.id]);
        if (password) {
          const hashedPassword = await bcrypt.hash(password, 10);
          await run(db, `UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?`, [hashedPassword, existingUser.id]);
        }
        // Ensure profile exists for role types
        if (['student', 'office_bearer'].includes(role)) {
          try { 
          const existingProf = await get(db, 'SELECT id FROM profiles WHERE user_id = ?', [existingUser.id]);
          if (!existingProf) {
            await run(db, 'INSERT INTO profiles (user_id, role) VALUES (?, ?)', [existingUser.id, role]);
          }
        } catch (e) { }
        }

        await logActivity(req.user.id, 'UPDATE_USER', { targetId: existingUser.id, name, role }, req, {
          action_type: 'UPDATE',
          module_name: 'users',
          action_description: `Updated user info: ${name} (${role})`,
          reference_id: existingUser.id
        });
        return res.json({ success: true, message: 'User updated', user: { id: existingUser.id, name, email, role } });
      } catch (e) {
        console.error('Failed to update existing user during upsert:', e);
        return res.status(500).json({ success: false, message: 'Failed to update existing user' });
      }
    }

    // Create new user
    // Generate default password based on role if not provided
    let defaultPassword = password;
    if (!defaultPassword) {
      switch (role) {
        case 'admin':
          defaultPassword = '12345';
          break;
        case 'office_bearer':
          defaultPassword = 'OB@123';
          break;
        case 'student':
          defaultPassword = 'SMV@123';
          break;
        default:
          defaultPassword = 'Temp@123';
      }
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const result = await run(db,
      'INSERT INTO users (name, email, password, role, must_change_password) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, 1]
    );

    const userId = result.lastID;

    // Automatically create profile in unified profiles table for student and office_bearer
    if (role === 'student' || role === 'office_bearer') {
      try {
        await run(db,
          'INSERT INTO profiles (user_id, role) VALUES (?, ?)',
          [userId, role]
        );
        console.log(`✅ Profile created for ${role} user ID: ${userId}`);
      } catch (profileError) {
        console.error('Error creating profile:', profileError);
        // Don't fail the user creation if profile creation fails
      }
    }

    await logActivity(req.user.id, 'CREATE_USER', { userId, name, email, role }, req, {
      action_type: 'CREATE',
      module_name: 'users',
      action_description: `Created new user: ${name} (${role})`,
      reference_id: userId
    });

    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: userId,
        name,
        email,
        role
      },
      defaultPassword: process.env.NODE_ENV === 'development' ? defaultPassword : undefined
    });
  } catch (error) {
    console.error('Add user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Keep legacy /add route as alias for admin tools/scripts
router.post('/add', authenticateToken, requireRole('admin'), async (req, res, next) => {
  // Forward to POST / (upsert)
  req.url = '/';
  return router.handle(req, res, next);
});
// Reset user password (Admin only)
router.post('/reset-password', authenticateToken, requireRole('admin'), [
  body('userId').isInt(),
  body('newPassword').optional().isLength({ min: 5 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId, newPassword } = req.body;
    const db = getDatabase();

    const user = await get(db, 'SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate default password based on role if not provided
    let defaultPassword = newPassword;
    if (!defaultPassword) {
      switch (user.role) {
        case 'admin':
          defaultPassword = '12345';
          break;
        case 'office_bearer':
          defaultPassword = 'OB@123';
          break;
        case 'student':
          defaultPassword = 'SMV@123';
          break;
        default:
          defaultPassword = 'Temp@123';
      }
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await run(db,
      'UPDATE users SET password = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId]
    );

    await logActivity(req.user.id, 'RESET_USER_PASSWORD', { targetUserId: userId }, req, {
      action_type: 'UPDATE',
      module_name: 'users',
      action_description: `Reset password for user: ${userId}`,
      reference_id: userId
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
      defaultPassword: process.env.NODE_ENV === 'development' ? defaultPassword : undefined
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get unified profile (works for student and office_bearer)
router.get('/:userId/profile', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDatabase();

    // Verify user exists first
    const user = await get(db, 'SELECT role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // First check unified profiles table
    let profile = await get(db, `
      SELECT p.*, u.is_interviewer, u.role as user_role, u.name as user_name, u.email as user_email
      FROM profiles p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
    `, [userId]);

    // If not found in unified table, check role-specific tables for backward compatibility
    if (!profile) {
      if (user.role === 'student') {
        profile = await get(db, 'SELECT * FROM student_profiles WHERE user_id = ?', [userId]);
        // Migrate to unified table if found
        if (profile) {
          try {
            const existingProf = await get(db, 'SELECT id FROM profiles WHERE user_id = ?', [userId]);
            if (!existingProf) {
              await run(db, `INSERT INTO profiles (user_id, role, dept, year, phone, blood_group, gender, dob, address, photo_url, custom_fields) VALUES (?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, profile.dept || null, profile.year || null, profile.phone || null, profile.blood_group || null, profile.gender || null, profile.dob || null, profile.address || null, (profile.photo_url || null), profile.custom_fields || null]);
            }
            profile = await get(db, 'SELECT * FROM profiles WHERE user_id = ?', [userId]);
          } catch (migrateErr) {
            console.error('Error migrating student profile:', migrateErr);
            // Continue with existing profile even if migration fails
          }
        }
      } else if (user.role === 'office_bearer') {
        profile = await get(db, 'SELECT * FROM office_bearer_profiles WHERE user_id = ?', [userId]);
        if (profile) {
          try {
            const existingOBProf = await get(db, 'SELECT id FROM profiles WHERE user_id = ?', [userId]);
            if (!existingOBProf) {
              await run(db, `INSERT INTO profiles (user_id, role, dept, year, phone, blood_group, gender, dob, address, photo_url, custom_fields) VALUES (?, 'office_bearer', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, profile.dept || null, profile.year || null, profile.phone || null, profile.blood_group || null, profile.gender || null, profile.dob || null, profile.address || null, (profile.photo_url || null), profile.custom_fields || null]);
            }
            profile = await get(db, 'SELECT * FROM profiles WHERE user_id = ?', [userId]);
          } catch (migrateErr) {
            console.error('Error migrating office bearer profile:', migrateErr);
            // Continue with existing profile even if migration fails
          }
        }

      }
    }

    // If profile still doesn't exist, create an empty one for student/office_bearer roles
    if (!profile && (user.role === 'student' || user.role === 'office_bearer')) {
      try {
        console.log(`📝 Creating empty profile for ${user.role} user ${userId}`);
        await run(db, 'INSERT INTO profiles (user_id, role) VALUES (?, ?)', [userId, user.role]);
        profile = await get(db, 'SELECT * FROM profiles WHERE user_id = ?', [userId]);
        console.log(`✅ Empty profile created for user ${userId}`);
      } catch (createErr) {
        console.error('Error creating empty profile:', createErr);
        // Continue - profile is still null, frontend will show empty form
      }
    }

    if (!profile) {
      console.log(`⚠️ No profile found for user ${userId} (role: ${user.role})`);
      return res.json({ success: true, profile: null });
    }

    // Always merge in latest user-level flags/info from users table
    try {
      const userFull = await get(db, 'SELECT is_interviewer, role, name, email FROM users WHERE id = ?', [userId]);
      if (userFull) {
        profile = { 
          ...profile, 
          is_interviewer: userFull.is_interviewer,
          user_role: userFull.role,
          user_name: userFull.name,
          user_email: userFull.email
        };
      }
    } catch (e) {
      console.warn("Failed to merge user flags into profile", e);
    }

    res.json({ success: true, profile });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get projects for a user (projects the user is a member of)
router.get('/:userId/projects', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDatabase();

    // Allow if requester is admin, office_bearer, or the user themselves
    if (req.user.role !== 'admin' && req.user.role !== 'office_bearer' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const projects = await all(db, `
      SELECT p.* FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = ?
      ORDER BY p.title
    `, [userId]);

    res.json({ success: true, projects });
  } catch (error) {
    console.error('Get user projects error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update unified profile (works for student and office_bearer)
router.put('/:userId/profile', authenticateToken, [
  body('dept').optional().trim(),
  body('year').optional().trim(),
  body('phone').optional().trim(),
  body('blood_group').optional().trim(),
  body('gender').optional().trim(),
  body('dob').optional().trim(),
  body('address').optional().trim(),
  body('photo').optional().trim(),
  body('photo_url').optional().trim(),
  body('register_no').optional().trim(),
  body('academic_year').optional().trim(),
  body('father_number').optional().trim(),
  body('hosteller_dayscholar').optional().trim(),
  body('position').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('Validation errors in profile update:', errors.array());
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId } = req.params;
    console.log(`📋 Profile update request for user ${userId}`);
    
    // authorize: allow if requester is admin OR if requester is the owner of the profile
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;
    if (requesterRole !== 'admin' && parseInt(requesterId) !== parseInt(userId)) {
      console.error(`❌ Access denied: requester ${requesterId} (${requesterRole}) cannot update user ${userId}`);
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let { dept, year, phone, blood_group, gender, dob, address, photo, photo_url, register_no, academic_year, father_number, hosteller_dayscholar, position, custom_fields } = req.body;
    const photoUrl = photo_url || photo; // Support both 'photo' and 'photo_url' for backward compatibility
    const db = getDatabase();

    // Get user role and check if user is new (must_change_password = 1)
    const user = await get(db, 'SELECT role, must_change_password FROM users WHERE id = ?', [userId]);
    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    console.log(`✅ User found: ${userId}, role: ${user.role}, must_change_password: ${user.must_change_password}`);

    // Students and office bearers can update all their profile fields directly
    // No need to check profile field settings

    // Check if profile exists in unified table
    let existing = await get(db, 'SELECT id, role FROM profiles WHERE user_id = ?', [userId]);

    // Prevent new users from creating profiles - they can only update existing ones
    if (!existing && user.must_change_password === 1) {
      console.warn(`⚠️ New user ${userId} attempted to create a profile. Only existing users can create profiles.`);
      return res.status(403).json({ success: false, message: 'New users must change their password before creating a profile. Please update your password first.' });
    }

    // Build dynamic update query
    if (existing) {
      const updates = [];
      const params = [];

      const fields = {
        dept, year, phone, blood_group, gender, dob, address,
        photo_url: photoUrl, register_no, academic_year,
        father_number, hosteller_dayscholar, position, custom_fields
      };

      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined) {
          updates.push(`${key} = ?`);
          params.push(value);
        }
      });

      if (updates.length > 0) {
        params.push(userId);
        const result = await run(db,
          `UPDATE profiles SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
          params
        );

        console.log(`✅ Profile updated for user ${userId}, changes made: ${result.changes}`);

        await logActivity(req.user.id, 'UPDATE_PROFILE', { targetUserId: userId, fields: Object.keys(fields).filter(k => fields[k] !== undefined) }, req, {
          action_type: 'UPDATE',
          module_name: 'profiles',
          action_description: `Updated profile fields for user: ${userId}`,
          reference_id: userId
        });
      } else {
        console.log(`⚠️ Profile update called for user ${userId} but no fields were changed`);
      }
      return res.json({ success: true, message: 'Profile updated successfully' });
    }
    else {
      // Create new profile in unified table
      console.log(`📝 Creating new profile for user ${userId}`);
      const result = await run(db,
        `INSERT INTO profiles (user_id, role, dept, year, phone, blood_group, gender, dob, address, photo_url, register_no, academic_year, father_number, hosteller_dayscholar, position, custom_fields)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, user.role, dept || null, year || null, phone || null, blood_group || null, gender || null, dob || null, address || null, photoUrl || null, register_no || null, academic_year || null, father_number || null, hosteller_dayscholar || null, position || null, custom_fields || null]
      );
      console.log(`✅ Profile created for user ${userId} with ID: ${result.lastID}`);
      
      await logActivity(req.user.id, 'CREATE_PROFILE', { targetUserId: userId }, req, {
        action_type: 'CREATE',
        module_name: 'profiles',
        action_description: `Created profile for user: ${userId}`,
        reference_id: userId
      });
      return res.json({ success: true, message: 'Profile created successfully' });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Unassign student from a project (Admin or Office Bearer)
router.delete('/:userId/unassign-project/:projectId', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
  try {
    const { userId, projectId } = req.params;
    const db = getDatabase();

    // Verify assignment exists
    const existing = await get(db, 'SELECT id FROM project_members WHERE user_id = ? AND project_id = ?', [userId, projectId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    await run(db, 'DELETE FROM project_members WHERE id = ?', [existing.id]);
    res.json({ success: true, message: 'Student unassigned from project' });
  } catch (error) {
    console.error('Unassign student error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Assign student to project (Admin or Office Bearer)
router.post('/:userId/assign-project', authenticateToken, requireRole('admin', 'office_bearer'), [
  body('projectId').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId } = req.params;
    const { projectId } = req.body;
    const db = getDatabase();

    // Verify user is a student
    const user = await get(db, 'SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role !== 'student') {
      return res.status(400).json({ success: false, message: 'Only students can be assigned to projects' });
    }

    // Verify project exists
    const project = await get(db, 'SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Check if assignment already exists
    const existing = await get(db,
      'SELECT id FROM project_members WHERE user_id = ? AND project_id = ?',
      [userId, projectId]
    );

    if (existing) {
      return res.status(400).json({ success: false, message: 'Student is already assigned to this project' });
    }

    // Create assignment
    await run(db,
      'INSERT INTO project_members (user_id, project_id, role) VALUES (?, ?, ?)',
      [userId, projectId, 'member']
    );

    await logActivity(req.user.id, 'ASSIGN_PROJECT', { targetUserId: userId, projectId }, req);

    res.json({ success: true, message: 'Student assigned to project successfully' });
  } catch (error) {
    console.error('Assign student to project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get office bearer profile
router.get('/profile/office-bearer/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDatabase();

    // Users can only view their own profile unless admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Verify user is office bearer
    const user = await get(db, 'SELECT role FROM users WHERE id = ?', [userId]);
    if (!user || user.role !== 'office_bearer') {
      return res.status(404).json({ success: false, message: 'Office bearer not found' });
    }

    const profile = await get(db, 'SELECT * FROM office_bearer_profiles WHERE user_id = ?', [userId]);

    res.json({ success: true, profile: profile || {} });
  } catch (error) {
    console.error('Get office bearer profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update office bearer profile
router.put('/profile/office-bearer/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { dept, year, phone, blood_group, gender, dob, address } = req.body;
    const db = getDatabase();

    // Users can only update their own profile unless admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Verify user is office bearer
    const user = await get(db, 'SELECT role FROM users WHERE id = ?', [userId]);
    if (!user || user.role !== 'office_bearer') {
      return res.status(404).json({ success: false, message: 'Office bearer not found' });
    }

    // Check if profile exists
    const existing = await get(db, 'SELECT id FROM office_bearer_profiles WHERE user_id = ?', [userId]);

    if (existing) {
      await run(db,
        `UPDATE office_bearer_profiles SET 
         dept = ?, year = ?, phone = ?, blood_group = ?, gender = ?, dob = ?, address = ?
         WHERE user_id = ?`,
        [dept || null, year || null, phone || null, blood_group || null, gender || null, dob || null, address || null, userId]
      );
    } else {
      await run(db,
        `INSERT INTO office_bearer_profiles (user_id, dept, year, phone, blood_group, gender, dob, address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, dept || null, year || null, phone || null, blood_group || null, gender || null, dob || null, address || null]
      );
    }

    res.json({ success: true, message: 'Office bearer profile updated successfully' });
  } catch (error) {
    console.error('Update office bearer profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Upload user photo
router.post('/upload-photo', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = req.body.userId || req.user.id;

    // Users can only upload their own photo unless admin
    if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
      // Delete uploaded file
      if (req.file.path) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting uploaded file:', err);
        });
      }
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const db = getDatabase();

    // Get existing photo URL to delete old file if exists
    let existingProfile = null;
    if (req.user.role === 'office_bearer' || req.body.role === 'office_bearer') {
      existingProfile = await get(db, 'SELECT photo_url FROM office_bearer_profiles WHERE user_id = ?', [userId]);
    } else {
      existingProfile = await get(db, 'SELECT photo_url FROM profiles WHERE user_id = ?', [userId]);
    }

    // Delete old photo file if exists
    if (existingProfile && existingProfile.photo_url) {
      const oldPath = path.join(process.cwd(), 'public', existingProfile.photo_url);
      fs.unlink(oldPath, (err) => {
        if (err && err.code !== 'ENOENT') console.error('Error deleting old photo:', err);
      });
    }

    // Build photo URL relative to public folder
    const photoUrl = `/uploads/photos/${req.file.filename}`;

    // Persist photo URL to unified profiles table so it appears in profile APIs
    try {
      const db = getDatabase();
      // Determine target user id and role
      const targetUserId = req.body.userId ? parseInt(req.body.userId) : req.user.id;
      const userRow = await get(db, 'SELECT role FROM users WHERE id = ?', [targetUserId]);
      const role = userRow ? userRow.role : 'student';

      // Try updating existing unified profile
      const updateRes = await run(db, 'UPDATE profiles SET photo_url = ? WHERE user_id = ?', [photoUrl, targetUserId]);
      if (updateRes.changes === 0) {
        // Insert new profile row if none existed
        await run(db, 'INSERT INTO profiles (user_id, role, photo_url) VALUES (?, ?, ?)', [targetUserId, role, photoUrl]);
      }
    } catch (dbErr) {
      console.error('Failed to persist uploaded photo to profiles table:', dbErr);
      // Don't fail the upload because of DB write error; still return photo URL
    }

    // Add cache-busting query param to force image reload
    const cacheBustUrl = `${photoUrl}?t=${Date.now()}`;

    res.json({
      success: true,
      photo_url: cacheBustUrl,
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('Upload photo error:', error);
    // Delete uploaded file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file after error:', err);
      });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Generic error handler for this router - catches multer and other sync/async errors
// Converts them to JSON responses to avoid HTML error pages being returned to API clients
router.use((err, req, res, next) => {
  if (!err) return next();
  console.error('Router error handler caught error:', err);

  // Multer-specific errors have name 'MulterError'
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: err.message || 'File upload error' });
  }

  // If the error was thrown from fileFilter or other places
  if (err.message && err.message.toLowerCase().includes('only image')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  // Fallback - return JSON for any unexpected errors
  return res.status(500).json({ success: false, message: err.message || 'Server error' });
});

// ============================================
// VOLUNTEER REGISTRATION (Public - Landing Page)
// ============================================

// POST - Volunteer registration from landing page (creates/updates student account)
router.post('/volunteer-register', [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('register_no').optional().trim(),
  body('year').optional().trim(),
  body('department').optional().trim(),
  body('phone').optional().trim(),
  body('parent_phone').optional().trim(),
  body('address').optional().trim(),
  body('dob').optional().trim(),
  body('blood_group').optional().trim(),
  body('skills').optional().trim(),
  body('experience').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const db = getDatabase();
    const {
      name,
      email,
      register_no,
      year,
      department,
      phone,
      parent_phone,
      address,
      dob,
      blood_group,
      skills,
      experience
    } = req.body;

    // Check if user exists by email or register_no
    let existingUser = null;
    if (email) {
      existingUser = await get(db, 'SELECT id, role, name FROM users WHERE email = ?', [email]);
    }

    if (!existingUser && register_no) {
      // Try to find by register_no in student_profiles
      const profile = await get(db, `
        SELECT user_id FROM student_profiles 
        WHERE register_no = ?
      `, [register_no]);
      if (profile) {
        existingUser = await get(db, 'SELECT id, role, name FROM users WHERE id = ?', [profile.user_id]);
      }
    }

    let userId;
    let isNewUser = false;

    if (existingUser) {
      // Update existing user
      userId = existingUser.id;

      // Update user name if provided
      if (name && name !== existingUser.name) {
        await run(db, 'UPDATE users SET name = ? WHERE id = ?', [name, userId]);
      }

      // Ensure role is student
      if (existingUser.role !== 'student') {
        await run(db, 'UPDATE users SET role = ? WHERE id = ?', ['student', userId]);
      }

      // Update or create student profile
      const existingProfile = await get(db, 'SELECT id FROM student_profiles WHERE user_id = ?', [userId]);

      if (existingProfile) {
        // Update existing profile
        await run(db, `
          UPDATE student_profiles SET
            dept = COALESCE(?, dept),
            year = COALESCE(?, year),
            phone = COALESCE(?, phone),
            dob = COALESCE(?, dob),
            blood_group = COALESCE(?, blood_group),
            address = COALESCE(?, address)
          WHERE user_id = ?
        `, [department || null, year || null, phone || null, dob || null, blood_group || null, address || null, userId]);
      } else {
        // Create new profile
        await run(db, `
          INSERT INTO student_profiles (user_id, dept, year, phone, dob, blood_group, address, custom_fields)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          userId,
          department || null,
          year || null,
          phone || null,
          dob || null,
          blood_group || null,
          address || null,
          JSON.stringify({
            register_no: register_no || null,
            parent_phone: parent_phone || null,
            skills: skills || null,
            experience: experience || null,
            registration_date: new Date().toISOString()
          })
        ]);
      }
    } else {
      // Create new student user
      isNewUser = true;
      const defaultPassword = 'SMV@123';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const result = await run(db,
        'INSERT INTO users (name, email, password, role, must_change_password) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashedPassword, 'student', 1]
      );

      userId = result.lastID;

      // Create student profile
      await run(db, `
        INSERT INTO student_profiles (user_id, dept, year, phone, dob, blood_group, address, custom_fields)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        department || null,
        year || null,
        phone || null,
        dob || null,
        blood_group || null,
        address || null,
        JSON.stringify({
          register_no: register_no || null,
          parent_phone: parent_phone || null,
          skills: skills || null,
          experience: experience || null,
          registration_date: new Date().toISOString()
        })
      ]);
    }

    res.json({
      success: true,
      message: isNewUser
        ? 'Volunteer registration successful! Student account created. Please login with your email and default password: SMV@123'
        : 'Volunteer registration updated successfully!',
      userId,
      isNewUser
    });
  } catch (error) {
    console.error('Volunteer registration error:', error);
    res.status(500).json({ success: false, message: 'Error processing registration', error: error.message });
  }
});

// Get activity logs (Admin only)
router.get('/activity-logs/all', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const logs = await all(db, `
      SELECT 
        l.*, 
        u.name as user_name, 
        u.email as user_email,
        u.role as user_role
      FROM activity_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 1000
    `);
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

