import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

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
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Get all users (Admin only)
router.get('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDatabase();
    const users = await all(db, 'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get students list
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
  body('email').optional().isEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { name, email } = req.body;
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

    await run(db,
      `UPDATE users SET 
       name = COALESCE(?, name),
       email = COALESCE(?, email),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name || null, email || null, id]
    );

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
router.post('/add', authenticateToken, requireRole('admin'), [
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'office_bearer', 'student', 'alumni']),
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
    const existingUser = await get(db, 'SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

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

    // Automatically create profile in unified profiles table for student, office_bearer, and alumni
    if (role === 'student' || role === 'office_bearer' || role === 'alumni') {
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

// Get unified profile (works for student, office_bearer, alumni)
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
    let profile = await get(db, 'SELECT * FROM profiles WHERE user_id = ?', [userId]);
    
    // If not found in unified table, check role-specific tables for backward compatibility
    if (!profile) {
        if (user.role === 'student') {
          profile = await get(db, 'SELECT * FROM student_profiles WHERE user_id = ?', [userId]);
          // Migrate to unified table if found
          if (profile) {
            try {
              await run(db, `INSERT OR IGNORE INTO profiles (user_id, role, dept, year, phone, blood_group, gender, dob, address, photo_url, custom_fields) VALUES (?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [userId, profile.dept || null, profile.year || null, profile.phone || null, profile.blood_group || null, profile.gender || null, profile.dob || null, profile.address || null, (profile.photo_url || null), profile.custom_fields || null]);
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
              await run(db, `INSERT OR IGNORE INTO profiles (user_id, role, dept, year, phone, blood_group, gender, dob, address, photo_url, custom_fields) VALUES (?, 'office_bearer', ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
                [userId, profile.dept || null, profile.year || null, profile.phone || null, profile.blood_group || null, profile.gender || null, profile.dob || null, profile.address || null, (profile.photo_url || null), profile.custom_fields || null]);
            profile = await get(db, 'SELECT * FROM profiles WHERE user_id = ?', [userId]);
            } catch (migrateErr) {
              console.error('Error migrating office bearer profile:', migrateErr);
              // Continue with existing profile even if migration fails
            }
          }
        } else if (user.role === 'alumni') {
          // For alumni, create empty profile in unified table if not exists
          profile = await get(db, 'SELECT * FROM profiles WHERE user_id = ?', [userId]);
          if (!profile) {
            try {
            await run(db, `INSERT INTO profiles (user_id, role) VALUES (?, 'alumni')`, [userId]);
            profile = await get(db, 'SELECT * FROM profiles WHERE user_id = ?', [userId]);
            } catch (alumniErr) {
              console.error('Error creating alumni profile:', alumniErr);
          }
        }
      }
    }
    
    if (!profile) {
      return res.json({ success: true, profile: null });
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

// Update unified profile (works for student, office_bearer, alumni)
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
  body('hosteller_dayscholar').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId } = req.params;
    // authorize: allow if requester is admin OR if requester is the owner of the profile
    const requesterId = req.user?.id;
    const requesterRole = req.user?.role;
    if (requesterRole !== 'admin' && parseInt(requesterId) !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    
    let { dept, year, phone, blood_group, gender, dob, address, photo, photo_url, register_no, academic_year, father_number, hosteller_dayscholar, custom_fields } = req.body;
    const photoUrl = photo_url || photo; // Support both 'photo' and 'photo_url' for backward compatibility
    const db = getDatabase();

    // Get user role
    const user = await get(db, 'SELECT role FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Students and office bearers can update all their profile fields directly
    // No need to check profile field settings

    // Check if profile exists in unified table
    let existing = await get(db, 'SELECT id, role FROM profiles WHERE user_id = ?', [userId]);

    if (existing) {
      // Update existing profile in unified table
      await run(db,
        `UPDATE profiles SET 
         dept = ?, year = ?, phone = ?, blood_group = ?, gender = ?, dob = ?, address = ?, photo_url = ?, register_no = ?, academic_year = ?, father_number = ?, hosteller_dayscholar = ?, custom_fields = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [dept || null, year || null, phone || null, blood_group || null, gender || null, dob || null, address || null, photoUrl || null, register_no || null, academic_year || null, father_number || null, hosteller_dayscholar || null, custom_fields || null, userId]
      );
      res.json({ success: true, message: 'Profile updated successfully' });
    } else {
      // Create new profile in unified table
      await run(db,
        `INSERT INTO profiles (user_id, role, dept, year, phone, blood_group, gender, dob, address, photo_url, register_no, academic_year, father_number, hosteller_dayscholar, custom_fields)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, user.role, dept || null, year || null, phone || null, blood_group || null, gender || null, dob || null, address || null, photoUrl || null, register_no || null, academic_year || null, father_number || null, hosteller_dayscholar || null, custom_fields || null]
      );
      res.json({ success: true, message: 'Profile created successfully' });
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

export default router;

