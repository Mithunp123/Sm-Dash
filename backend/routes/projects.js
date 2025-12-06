import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

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

// Multer instance for Excel uploads (kept in memory, not saved to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Get all projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const projects = await all(db, `
      SELECT p.*, u.name as coordinator_name
      FROM projects p
      LEFT JOIN users u ON p.coordinator_id = u.id
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get students assigned to a project (must come before /:id route)
router.get('/:id/students', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const students = await all(db, `
      SELECT 
        pm.user_id,
        pm.project_id,
        pm.role as member_role,
        u.name,
        u.email,
        u.role,
        sp.dept,
        sp.year
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      LEFT JOIN student_profiles sp ON u.id = sp.user_id
      WHERE pm.project_id = ?
      ORDER BY u.name
    `, [id]);
    
    res.json({ success: true, students });
  } catch (error) {
    console.error('Get project students error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Project mentee management routes (must be declared before generic :id route)
router.get('/:projectId/mentees', authenticateToken, requirePermission('can_manage_projects', { allowView: true }), async (req, res) => {
  try {
    const { projectId } = req.params;
    const db = getDatabase();

    const mentees = await all(db, `
      SELECT 
        a.*,
        u.name as volunteer_name,
        u.email as volunteer_email,
        pr.title as project_title,
        (
          SELECT update_date 
          FROM phone_mentoring_updates 
          WHERE assignment_id = a.id 
          ORDER BY update_date DESC, created_at DESC 
          LIMIT 1
        ) as last_update_date,
        (
          SELECT status 
          FROM phone_mentoring_updates 
          WHERE assignment_id = a.id 
          ORDER BY update_date DESC, created_at DESC 
          LIMIT 1
        ) as last_update_status,
        (
          SELECT COUNT(1) 
          FROM phone_mentoring_updates 
          WHERE assignment_id = a.id
        ) as total_updates,
        (
          SELECT attendance_date
          FROM phone_mentoring_attendance
          WHERE assignment_id = a.id
          ORDER BY attendance_date DESC
          LIMIT 1
        ) as last_attendance_date,
        (
          SELECT status
          FROM phone_mentoring_attendance
          WHERE assignment_id = a.id
          ORDER BY attendance_date DESC
          LIMIT 1
        ) as last_attendance_status
      FROM phone_mentoring_assignments a
      LEFT JOIN users u ON a.volunteer_id = u.id
      LEFT JOIN projects pr ON a.project_id = pr.id
      WHERE a.project_id = ?
      ORDER BY a.mentee_name COLLATE NOCASE
    `, [projectId]);

    res.json({ success: true, mentees });
  } catch (error) {
    console.error('Get project mentees error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:projectId/mentees', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      volunteer_id,
      mentee_name,
      mentee_phone,
      mentee_register_no,
      mentee_department,
      mentee_year,
      mentee_gender,
      mentee_school,
      mentee_address,
      mentee_parent_contact,
      mentee_status,
      mentee_notes
    } = req.body;

    if (!mentee_name) {
      return res.status(400).json({ success: false, message: 'Mentee name is required' });
    }
    if (!volunteer_id) {
      return res.status(400).json({ success: false, message: 'Volunteer selection is required' });
    }

    const db = getDatabase();

    // Validate project
    const project = await get(db, 'SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (volunteer_id) {
      // Ensure volunteer exists and belongs to project
      const volunteer = await get(db, 'SELECT id FROM users WHERE id = ?', [volunteer_id]);
      if (!volunteer) {
        return res.status(400).json({ success: false, message: 'Volunteer not found' });
      }
      // Auto-add volunteer to project if not already a member
      const member = await get(db, 'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, volunteer_id]);
      if (!member) {
        // Add volunteer as project member
        await run(db, 'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [projectId, volunteer_id, 'member']);
      }

      // Allow multiple mentees per volunteer (removed the check)
      // const existingAssignment = await get(db, 'SELECT id FROM phone_mentoring_assignments WHERE volunteer_id = ?', [volunteer_id]);
      // if (existingAssignment) {
      //   return res.status(400).json({ success: false, message: 'Volunteer already has a mentee assigned' });
      // }
    }

    const result = await run(db, `
      INSERT INTO phone_mentoring_assignments (
        project_id,
        volunteer_id,
        mentee_name,
        mentee_phone,
        mentee_year,
        mentee_gender,
        mentee_school,
        mentee_district,
        mentee_parent_contact,
        mentee_status,
        mentee_notes,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      projectId,
      volunteer_id || null,
      mentee_name,
      mentee_phone || null,
      mentee_year || null,
      mentee_gender || null,
      mentee_school || null,
      mentee_district || null,
      mentee_parent_contact || null,
      mentee_status || 'active',
      mentee_notes || null,
      req.user.id
    ]);

    const inserted = await get(db, 'SELECT * FROM phone_mentoring_assignments WHERE id = ?', [result.lastID]);
    res.json({ success: true, mentee: inserted });
  } catch (error) {
    console.error('Create project mentee error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:projectId/mentees/:assignmentId', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), async (req, res) => {
  try {
    const { projectId, assignmentId } = req.params;
    const {
      volunteer_id,
      mentee_name,
      mentee_phone,
      mentee_year,
      mentee_gender,
      mentee_school,
      mentee_district,
      mentee_parent_contact,
      mentee_status,
      mentee_notes
    } = req.body;

    const db = getDatabase();
    const assignment = await get(db, 'SELECT * FROM phone_mentoring_assignments WHERE id = ? AND project_id = ?', [assignmentId, projectId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    if (volunteer_id && volunteer_id !== assignment.volunteer_id) {
      const member = await get(db, 'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, volunteer_id]);
      if (!member) {
        return res.status(400).json({ success: false, message: 'Volunteer is not part of this project' });
      }
      const existingAssignment = await get(db, 'SELECT id FROM phone_mentoring_assignments WHERE volunteer_id = ?', [volunteer_id]);
      if (existingAssignment && existingAssignment.id !== Number(assignmentId)) {
        return res.status(400).json({ success: false, message: 'Volunteer already has a mentee assigned' });
      }
    }

    await run(db, `
      UPDATE phone_mentoring_assignments
      SET
        volunteer_id = COALESCE(?, volunteer_id),
        mentee_name = COALESCE(?, mentee_name),
        mentee_phone = COALESCE(?, mentee_phone),
        mentee_year = COALESCE(?, mentee_year),
        mentee_gender = COALESCE(?, mentee_gender),
        mentee_school = COALESCE(?, mentee_school),
        mentee_district = COALESCE(?, mentee_district),
        mentee_parent_contact = COALESCE(?, mentee_parent_contact),
        mentee_status = COALESCE(?, mentee_status),
        mentee_notes = COALESCE(?, mentee_notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND project_id = ?
    `, [
      volunteer_id || assignment.volunteer_id,
      mentee_name || assignment.mentee_name,
      mentee_phone ?? assignment.mentee_phone,
      mentee_year ?? assignment.mentee_year,
      mentee_gender ?? assignment.mentee_gender,
      mentee_school ?? assignment.mentee_school,
      mentee_district ?? assignment.mentee_district,
      mentee_parent_contact ?? assignment.mentee_parent_contact,
      mentee_status ?? assignment.mentee_status,
      mentee_notes ?? assignment.mentee_notes,
      assignmentId,
      projectId
    ]);

    const updated = await get(db, 'SELECT * FROM phone_mentoring_assignments WHERE id = ?', [assignmentId]);
    res.json({ success: true, mentee: updated });
  } catch (error) {
    console.error('Update project mentee error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Upload mentees from Excel
router.post('/:projectId/mentees/upload-excel', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), upload.single('file'), async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const db = getDatabase();
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    let imported = 0;
    let errors = [];

    for (const row of data) {
      try {
        const menteeName = row['Name'] || row['name'] || row['Mentee Name'];
        const mentorEmail = row['Mentor Email'] || row['mentor_email'] || row['Mentor'];
        
        if (!menteeName) {
          errors.push(`Row missing name: ${JSON.stringify(row)}`);
          continue;
        }

        let volunteerId = null;
        if (mentorEmail) {
          const mentor = await get(db, 'SELECT id FROM users WHERE email = ?', [mentorEmail]);
          if (mentor) {
            volunteerId = mentor.id;
            // Auto-add to project if not a member
            const member = await get(db, 'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, volunteerId]);
            if (!member) {
              await run(db, 'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [projectId, volunteerId, 'member']);
            }
          }
        }

        if (!volunteerId) {
          errors.push(`Mentor not found for email: ${mentorEmail} - Skipping ${menteeName}`);
          continue;
        }

        await run(db, `
          INSERT INTO phone_mentoring_assignments (
            project_id, volunteer_id, mentee_name, mentee_phone, mentee_year,
            mentee_gender, mentee_school, mentee_district, mentee_parent_contact,
            mentee_status, mentee_notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          projectId,
          volunteerId,
          menteeName,
          row['Phone'] || row['phone'] || null,
          row['Year'] || row['year'] || null,
          row['Gender'] || row['gender'] || null,
          row['School'] || row['school'] || null,
          row['District'] || row['district'] || null,
          row['Parent Contact'] || row['parent_contact'] || null,
          row['Status'] || row['status'] || 'active',
          row['Notes'] || row['notes'] || null,
          req.user.id
        ]);
        imported++;
      } catch (err) {
        errors.push(`Error importing row: ${err && err.message ? err.message : 'Unknown error'}`);
      }
    }

    res.json({ 
      success: true, 
      imported, 
      errors: errors.length > 0 ? errors : undefined,
      message: `Imported ${imported} mentees${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
    });
  } catch (error) {
    console.error('Excel upload error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:projectId/mentees/:assignmentId', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), async (req, res) => {
  try {
    const { projectId, assignmentId } = req.params;
    const db = getDatabase();

    const assignment = await get(db, 'SELECT id FROM phone_mentoring_assignments WHERE id = ? AND project_id = ?', [assignmentId, projectId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    await run(db, 'DELETE FROM phone_mentoring_assignments WHERE id = ?', [assignmentId]);
    res.json({ success: true, message: 'Mentee assignment removed' });
  } catch (error) {
    console.error('Delete project mentee error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:projectId/mentees/attendance', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { date, records } = req.body;

    if (!date || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'Date and attendance records are required' });
    }

    const allowedStatuses = new Set(['PRESENT', 'ABSENT', 'FOLLOW_UP', 'NOT_REACHABLE']);
    const db = getDatabase();

    for (const record of records) {
      if (!record.assignmentId || !allowedStatuses.has(record.status)) {
        continue;
      }

      const assignment = await get(db, 'SELECT mentee_name FROM phone_mentoring_assignments WHERE id = ? AND project_id = ?', [record.assignmentId, projectId]);
      if (!assignment) {
        continue;
      }

      await run(db, `
        INSERT INTO phone_mentoring_attendance (
          assignment_id,
          project_id,
          mentee_name,
          attendance_date,
          status,
          notes,
          recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(assignment_id, attendance_date)
        DO UPDATE SET
          status = excluded.status,
          notes = excluded.notes,
          recorded_by = excluded.recorded_by,
          updated_at = CURRENT_TIMESTAMP
      `, [
        record.assignmentId,
        projectId,
        assignment.mentee_name,
        date,
        record.status,
        record.notes || null,
        req.user.id
      ]);
    }

    res.json({ success: true, message: 'Attendance saved' });
  } catch (error) {
    console.error('Save mentee attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:projectId/mentees/:assignmentId/attendance', authenticateToken, requirePermission('can_manage_projects', { allowView: true }), async (req, res) => {
  try {
    const { projectId, assignmentId } = req.params;
    const { date } = req.query;
    const db = getDatabase();

    const assignment = await get(db, 'SELECT id FROM phone_mentoring_assignments WHERE id = ? AND project_id = ?', [assignmentId, projectId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    const params = [assignmentId];
    let where = 'WHERE assignment_id = ?';
    if (date) {
      where += ' AND attendance_date = ?';
      params.push(date);
    }

    const rows = await all(db, `
      SELECT * FROM phone_mentoring_attendance
      ${where}
      ORDER BY attendance_date DESC
    `, params);

    res.json({ success: true, attendance: rows });
  } catch (error) {
    console.error('Get mentee attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:projectId/mentees/:assignmentId/updates', authenticateToken, requirePermission('can_manage_projects', { allowView: true }), async (req, res) => {
  try {
    const { projectId, assignmentId } = req.params;
    const db = getDatabase();

    const assignment = await get(db, 'SELECT id FROM phone_mentoring_assignments WHERE id = ? AND project_id = ?', [assignmentId, projectId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    const rows = await all(db, `
      SELECT pmu.*, u.name as volunteer_name
      FROM phone_mentoring_updates pmu
      LEFT JOIN users u ON pmu.volunteer_id = u.id
      WHERE pmu.assignment_id = ?
      ORDER BY pmu.update_date DESC, pmu.created_at DESC
    `, [assignmentId]);

    res.json({ success: true, updates: rows });
  } catch (error) {
    console.error('Get mentee updates error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get project by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    const project = await get(db, `
      SELECT p.*, u.name as coordinator_name
      FROM projects p
      LEFT JOIN users u ON p.coordinator_id = u.id
      WHERE p.id = ?
    `, [id]);
    
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update project
router.put('/:id', authenticateToken, [
  body('title').optional().trim(),
  body('ngo_name').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { title, description, ngo_name, start_date, end_date, status, required_calls } = req.body;
    const db = getDatabase();

    // Check if project exists
    const project = await get(db, 'SELECT id FROM projects WHERE id = ?', [id]);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await run(db,
      `UPDATE projects SET 
       title = COALESCE(?, title),
       description = ?,
       ngo_name = ?,
       start_date = ?,
       end_date = ?,
       status = COALESCE(?, status),
       required_calls = COALESCE(?, required_calls)
       WHERE id = ?`,
      [title || null, description || null, ngo_name || null, start_date || null, end_date || null, status || null, required_calls !== undefined ? required_calls : null, id]
    );

    res.json({ success: true, message: 'Project updated successfully' });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    // Check if project exists
    const project = await get(db, 'SELECT id FROM projects WHERE id = ?', [id]);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await run(db, 'DELETE FROM projects WHERE id = ?', [id]);

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create project
router.post('/', authenticateToken, [
  body('title').notEmpty().trim(),
  body('ngo_name').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, ngo_name, start_date, end_date, status } = req.body;
    const db = getDatabase();

    const result = await run(db,
      'INSERT INTO projects (title, description, ngo_name, start_date, end_date, status, coordinator_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description || null, ngo_name || null, start_date || null, end_date || null, status || 'active', req.user.id]
    );

    res.json({ success: true, message: 'Project created successfully', id: result.lastID });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add member to project
router.post('/:projectId/members', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), [
  body('user_id').isInt()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { projectId } = req.params;
    const { user_id } = req.body;
    const db = getDatabase();

    // Check if project exists
    const project = await get(db, 'SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Check if user exists
    const user = await get(db, 'SELECT id FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already a member
    const existing = await get(db, 'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, user_id]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'User is already a member of this project' });
    }

    // Add as member
    await run(db, 'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [projectId, user_id, 'member']);

    res.json({ success: true, message: 'Member added to project successfully' });
  } catch (error) {
    console.error('Add project member error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Bulk assign students to a project
router.post('/:id/bulk-assign-students', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { studentIds } = req.body;
    const db = getDatabase();

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'studentIds must be a non-empty array' });
    }

    // Check project exists
    const project = await get(db, 'SELECT id FROM projects WHERE id = ?', [id]);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    let assignedCount = 0;
    const skipped = [];

    for (const sid of studentIds) {
      const user = await get(db, 'SELECT id, role FROM users WHERE id = ?', [sid]);
      if (!user || user.role !== 'student') {
        skipped.push({ id: sid, reason: 'User not found or not a student' });
        continue;
      }

      const existing = await get(db, 'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [id, sid]);
      if (existing) {
        skipped.push({ id: sid, reason: 'Already assigned' });
        continue;
      }

      await run(db, 'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [id, sid, 'member']);
      assignedCount++;
    }

    res.json({ success: true, assignedCount, skipped });
  } catch (error) {
    console.error('Bulk assign students error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

