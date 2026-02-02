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
    db.run(query, params, function (err) {
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
router.get('/', authenticateToken, requirePermission('can_manage_projects', { allowView: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const userRole = req.user.role;
    const userId = req.user.id;

    // Build query with SPOC filtering
    let spocFilter = '';
    let queryParams = [];

    // SPOC: Only show assigned projects
    if (userRole === 'spoc') {
      const assignedProjectIds = await new Promise((resolve, reject) => {
        db.all(
          'SELECT project_id FROM spoc_assignments WHERE spoc_id = ? AND project_id IS NOT NULL',
          [userId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.project_id));
          }
        );
      });

      if (assignedProjectIds.length === 0) {
        // No assignments, return empty array
        return res.json({ success: true, projects: [] });
      }

      const placeholders = assignedProjectIds.map(() => '?').join(',');
      spocFilter = `AND p.id IN (${placeholders})`;
      queryParams = assignedProjectIds;
    }

    const projects = await all(db, `
      WITH LatestDates AS (
        SELECT project_id, MAX(attendance_date) as max_date
        FROM attendance_records
        GROUP BY project_id
      ),
      Stats AS (
        SELECT 
          ar.project_id,
          SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as permission_count
        FROM attendance_records ar
        JOIN LatestDates ld ON ar.project_id = ld.project_id AND ar.attendance_date = ld.max_date
        GROUP BY ar.project_id
      )
      SELECT 
        p.*, 
        u.name as coordinator_name,
        ld.max_date as last_activity,
        COALESCE(s.present_count, 0) as present_count,
        COALESCE(s.absent_count, 0) as absent_count,
        COALESCE(s.permission_count, 0) as permission_count
      FROM projects p
      LEFT JOIN users u ON p.coordinator_id = u.id
      LEFT JOIN LatestDates ld ON p.id = ld.project_id
      LEFT JOIN Stats s ON p.id = s.project_id
      WHERE 1=1 ${spocFilter}
      ORDER BY p.created_at DESC
    `, queryParams);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get students assigned to a project (must come before /:id route)
router.get('/:id/students', authenticateToken, requirePermission('can_manage_projects', { allowView: true }), async (req, res) => {
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
        p.phone as volunteer_phone,
        pr.title as project_title,
        (
          SELECT COUNT(1)
          FROM phone_mentoring_attendance pma
          WHERE pma.assignment_id = a.id AND pma.status = 'PRESENT'
        ) as total_classes,
        (
          SELECT COUNT(1)
          FROM phone_mentoring_updates pmu
          WHERE pmu.assignment_id = a.id AND pmu.status = 'CALL_DONE'
        ) as total_calls,
        (
          SELECT COUNT(1)
          FROM phone_mentoring_updates pmu
          WHERE pmu.assignment_id = a.id AND pmu.status = 'CALL_DONE' AND pmu.volunteer_id = a.volunteer_id
        ) as calls_taken_by_mentor,
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
      LEFT JOIN profiles p ON a.volunteer_id = p.user_id
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
      mentee_district,
      mentee_address,
      mentee_parent_contact,
      mentee_status,
      mentee_notes,
      expected_classes
    } = req.body;

    if (!mentee_name) {
      return res.status(400).json({ success: false, message: 'Mentee name is required' });
    }
    // volunteer_id is optional - mentor can be assigned later

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
        mentee_address,
        mentee_parent_contact,
        mentee_status,
        mentee_notes,
        expected_classes,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      projectId,
      volunteer_id || null,
      mentee_name,
      mentee_phone || null,
      mentee_year || null,
      mentee_gender || null,
      mentee_school || null,
      mentee_district || null,
      mentee_address || null,
      mentee_parent_contact || null,
      mentee_status || 'active',
      mentee_notes || null,
      expected_classes ? Number(expected_classes) : null,
      req.user.id
    ]);

    const inserted = await get(db, 'SELECT * FROM phone_mentoring_assignments WHERE id = ?', [result.lastID]);
    res.json({ success: true, mentee: inserted });
  } catch (error) {
    console.error('Create project mentee error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Bulk update routes must come BEFORE routes with :assignmentId to avoid route matching conflicts
// Bulk update expected classes for all mentees in a project
router.put('/:projectId/mentees/bulk-expected-classes', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { expected_classes } = req.body;
    const db = getDatabase();

    if (expected_classes === undefined || expected_classes === null) {
      return res.status(400).json({ success: false, message: 'expected_classes is required' });
    }

    const expectedClassesNum = expected_classes ? Number(expected_classes) : null;

    const result = await run(db, `
      UPDATE phone_mentoring_assignments
      SET expected_classes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE project_id = ?
    `, [expectedClassesNum, projectId]);

    res.json({
      success: true,
      message: `Updated expected classes to ${expectedClassesNum || 'NULL'} for all mentees in project`,
      updated: result.changes
    });
  } catch (error) {
    console.error('Bulk update expected classes error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Bulk update expected classes for ALL mentees across all projects
router.put('/mentees/bulk-expected-classes-all', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), async (req, res) => {
  try {
    const { expected_classes } = req.body;
    const db = getDatabase();

    if (expected_classes === undefined || expected_classes === null) {
      return res.status(400).json({ success: false, message: 'expected_classes is required' });
    }

    const expectedClassesNum = expected_classes ? Number(expected_classes) : null;

    const result = await run(db, `
      UPDATE phone_mentoring_assignments
      SET expected_classes = ?,
          updated_at = CURRENT_TIMESTAMP
    `, [expectedClassesNum]);

    res.json({
      success: true,
      message: `Updated expected classes to ${expectedClassesNum || 'NULL'} for all mentees across all projects`,
      updated: result.changes
    });
  } catch (error) {
    console.error('Bulk update expected classes (all) error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:projectId/mentees/:assignmentId', authenticateToken, async (req, res) => {
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
      mentee_address,
      mentee_parent_contact,
      mentee_status,
      mentee_notes,
      expected_classes
    } = req.body;

    const db = getDatabase();
    const assignment = await get(db, 'SELECT * FROM phone_mentoring_assignments WHERE id = ? AND project_id = ?', [assignmentId, projectId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    // Check permissions: Allow if user has can_manage_projects edit permission OR if user is the assigned volunteer
    const isAdmin = req.user.role === 'admin';
    const hasManagePermission = isAdmin || req.permissions?.can_manage_projects === 'edit' || req.permissions?.can_manage_projects === true;
    const isAssignedVolunteer = assignment.volunteer_id === req.user.id;

    if (!hasManagePermission && !isAssignedVolunteer) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this mentee assignment' });
    }

    // If user is not admin and trying to change volunteer_id, deny
    if (volunteer_id && volunteer_id !== assignment.volunteer_id && !hasManagePermission) {
      return res.status(403).json({ success: false, message: 'You cannot reassign mentees. Only admins can do that.' });
    }

    if (volunteer_id && volunteer_id !== assignment.volunteer_id) {
      // Ensure volunteer is added to project_members if not already a member
      const member = await get(db, 'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, volunteer_id]);
      if (!member) {
        // Auto-add volunteer to project as a member
        try {
          await run(db, 'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [projectId, volunteer_id, 'member']);
          console.log(`✅ Auto-added volunteer ${volunteer_id} to project ${projectId} as member`);
        } catch (err) {
          console.error('Failed to add volunteer to project:', err);
          // Continue anyway - the assignment will still work
        }
      }
      // Allow multiple mentees per volunteer - removed the restriction
      // A mentor can now have multiple mentees assigned
    }

    // Try to find and link mentee_user_id by matching name/phone/register_no
    // Use updated values if provided, otherwise use existing assignment values
    const searchName = mentee_name || assignment.mentee_name;
    const searchPhone = mentee_phone || assignment.mentee_phone;
    const searchRegisterNo = assignment.mentee_register_no; // register_no not in update payload

    // Always try to re-link if mentee_user_id is missing OR if volunteer_id is being assigned/updated
    // This ensures that when a mentor is assigned, we try to link the student
    let menteeUserId = assignment.mentee_user_id || null;
    const shouldRelink = !menteeUserId || (volunteer_id && volunteer_id !== assignment.volunteer_id);
    if (shouldRelink) {
      console.log('🔍 Attempting to link mentee_user_id for assignment:', {
        assignmentId,
        mentee_name: searchName,
        mentee_phone: searchPhone,
        mentee_register_no: searchRegisterNo,
        volunteer_id: volunteer_id || assignment.volunteer_id
      });

      // Strategy 1: Try exact name match
      if (searchName) {
        const nameTrimmed = searchName.trim();
        // Exact match
        const studentByName = await get(db, `
          SELECT u.id 
          FROM users u
          WHERE LOWER(TRIM(u.name)) = LOWER(TRIM(?)) AND u.role = 'student'
          LIMIT 1
        `, [nameTrimmed]);
        if (studentByName) {
          menteeUserId = studentByName.id;
          console.log('✅ Found student by exact name match:', menteeUserId);
        }

        // If not found, try name without spaces
        if (!menteeUserId) {
          const nameNoSpaces = nameTrimmed.replace(/\s+/g, '');
          const studentByNameNoSpaces = await get(db, `
            SELECT u.id 
            FROM users u
            WHERE LOWER(REPLACE(u.name, ' ', '')) = LOWER(?) AND u.role = 'student'
            LIMIT 1
          `, [nameNoSpaces]);
          if (studentByNameNoSpaces) {
            menteeUserId = studentByNameNoSpaces.id;
            console.log('✅ Found student by name (no spaces):', menteeUserId);
          }
        }

        // If still not found, try partial name match (first name or last name)
        if (!menteeUserId) {
          const nameParts = nameTrimmed.split(' ').filter(p => p.length > 2);
          for (const part of nameParts) {
            const studentByPart = await get(db, `
              SELECT u.id 
              FROM users u
              WHERE (LOWER(u.name) LIKE LOWER(?) OR LOWER(u.name) LIKE LOWER(?)) AND u.role = 'student'
              LIMIT 1
            `, [`%${part}%`, `${part}%`]);
            if (studentByPart) {
              menteeUserId = studentByPart.id;
              console.log('✅ Found student by partial name match:', menteeUserId, part);
              break;
            }
          }
        }

        // If still not found, try prefix/suffix matching (first 3-4 chars or last 3-4 chars)
        if (!menteeUserId && nameTrimmed.length >= 3) {
          const nameLower = nameTrimmed.toLowerCase();
          const prefix = nameLower.substring(0, Math.min(4, nameLower.length));
          const suffix = nameLower.substring(Math.max(0, nameLower.length - 4));

          // Try prefix match
          const studentByPrefix = await get(db, `
            SELECT u.id 
            FROM users u
            WHERE LOWER(u.name) LIKE LOWER(?) AND u.role = 'student'
            LIMIT 1
          `, [`${prefix}%`]);
          if (studentByPrefix) {
            menteeUserId = studentByPrefix.id;
            console.log('✅ Found student by name prefix match:', menteeUserId, prefix);
          }

          // Try suffix match if prefix didn't work
          if (!menteeUserId) {
            const studentBySuffix = await get(db, `
              SELECT u.id 
              FROM users u
              WHERE LOWER(u.name) LIKE LOWER(?) AND u.role = 'student'
              LIMIT 1
            `, [`%${suffix}`]);
            if (studentBySuffix) {
              menteeUserId = studentBySuffix.id;
              console.log('✅ Found student by name suffix match:', menteeUserId, suffix);
            }
          }
        }
      }

      // Strategy 2: Try by phone number
      if (!menteeUserId && searchPhone) {
        const phoneTrimmed = searchPhone.trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
        // Try exact match
        const studentByPhone = await get(db, `
          SELECT user_id as id 
          FROM profiles 
          WHERE REPLACE(REPLACE(phone, ' ', ''), '-', '') = ? AND role = 'student'
          LIMIT 1
        `, [phoneTrimmed]);
        if (studentByPhone) {
          menteeUserId = studentByPhone.id;
          console.log('✅ Found student by exact phone match:', menteeUserId);
        }

        // Try last 8-10 digits if exact match fails
        if (!menteeUserId && phoneTrimmed.length >= 8) {
          const lastDigits = phoneTrimmed.substring(Math.max(0, phoneTrimmed.length - 10));
          const studentByPhonePartial = await get(db, `
            SELECT user_id as id 
            FROM profiles 
            WHERE REPLACE(REPLACE(phone, ' ', ''), '-', '') LIKE ? AND role = 'student'
            LIMIT 1
          `, [`%${lastDigits}`]);
          if (studentByPhonePartial) {
            menteeUserId = studentByPhonePartial.id;
            console.log('✅ Found student by partial phone match (last digits):', menteeUserId);
          }
        }
      }

      // Strategy 3: Try by register number
      if (!menteeUserId && searchRegisterNo) {
        const regTrimmed = searchRegisterNo.trim();
        const studentByReg = await get(db, `
          SELECT user_id as id 
          FROM profiles 
          WHERE register_no = ? AND role = 'student'
          LIMIT 1
        `, [regTrimmed]);
        if (studentByReg) {
          menteeUserId = studentByReg.id;
          console.log('✅ Found student by register_no:', menteeUserId);
        }
      }

      // Strategy 4: If volunteer_id is set, try to find student by email username match
      if (!menteeUserId && volunteer_id) {
        const volunteer = await get(db, 'SELECT email FROM users WHERE id = ?', [volunteer_id]);
        if (volunteer?.email) {
          const emailName = volunteer.email.split('@')[0];
          if (emailName && emailName.length > 2 && searchName) {
            const studentByEmailName = await get(db, `
              SELECT u.id 
              FROM users u
              WHERE LOWER(u.name) LIKE LOWER(?) AND u.role = 'student'
              LIMIT 1
            `, [`%${emailName}%`]);
            if (studentByEmailName) {
              menteeUserId = studentByEmailName.id;
              console.log('✅ Found student by email username match:', menteeUserId);
            }
          }
        }
      }

      if (!menteeUserId) {
        console.log('⚠️ Could not find student user_id for mentee:', searchName);
      } else {
        console.log('✅ Successfully linked mentee_user_id:', menteeUserId);
      }
    } else {
      console.log('✅ Using existing mentee_user_id:', menteeUserId);
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
        mentee_address = COALESCE(?, mentee_address),
        mentee_parent_contact = COALESCE(?, mentee_parent_contact),
        mentee_status = COALESCE(?, mentee_status),
        mentee_notes = COALESCE(?, mentee_notes),
        expected_classes = COALESCE(?, expected_classes),
        mentee_user_id = ?,
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
      mentee_address ?? (assignment.mentee_address || null),
      mentee_parent_contact ?? assignment.mentee_parent_contact,
      mentee_status ?? assignment.mentee_status,
      mentee_notes ?? assignment.mentee_notes,
      expected_classes !== undefined ? (expected_classes ? Number(expected_classes) : null) : assignment.expected_classes,
      menteeUserId,
      assignmentId,
      projectId
    ]);

    const updated = await get(db, 'SELECT * FROM phone_mentoring_assignments WHERE id = ?', [assignmentId]);

    // Get volunteer name for logging
    const volunteer = updated.volunteer_id ? await get(db, 'SELECT name FROM users WHERE id = ?', [updated.volunteer_id]) : null;

    console.log('✅ Mentor assignment updated:', {
      assignmentId,
      volunteer_id: updated.volunteer_id,
      volunteer_name: volunteer?.name || 'N/A',
      mentee_user_id: updated.mentee_user_id,
      mentee_name: updated.mentee_name,
      mentee_phone: updated.mentee_phone
    });

    // If mentee_user_id was linked, log it
    if (updated.mentee_user_id) {
      const linkedStudent = await get(db, 'SELECT name, email FROM users WHERE id = ?', [updated.mentee_user_id]);
      console.log('✅ Student linked to assignment:', {
        student_id: updated.mentee_user_id,
        student_name: linkedStudent?.name,
        student_email: linkedStudent?.email
      });
    } else {
      console.log('⚠️ mentee_user_id not linked - student will need to be auto-linked on login');
    }

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
    // Normalize column names: trim whitespace for better matching
    const rawData = xlsx.utils.sheet_to_json(worksheet);
    const data = rawData.map(row => {
      const normalizedRow = {};
      for (const [key, value] of Object.entries(row)) {
        // Normalize key: trim whitespace
        const normalizedKey = key.trim();
        normalizedRow[normalizedKey] = value;
        // Also add lowercase version for case-insensitive lookup
        normalizedRow[normalizedKey.toLowerCase()] = value;
      }
      return normalizedRow;
    });

    let imported = 0;
    let errors = [];

    console.log(`[Excel Import] Starting import: ${data.length} rows to process`);

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      try {
        const menteeName = row['Name'] || row['name'] || row['Mentee Name'];
        if (!menteeName || menteeName.toString().trim() === '') {
          errors.push(`Row ${rowIndex + 1}: Missing name field`);
          console.log(`[Excel Import] Row ${rowIndex + 1}: Skipped - missing name`);
          continue;
        }

        // Mentor assignment is optional – mentees can be imported without assigning a mentor.
        // Try to resolve mentor by email first, then by name. If not found, keep volunteer_id NULL.
        let volunteerId = null;
        // Try multiple column name variations (case-insensitive, with/without spaces)
        const mentorName = (
          row['Mentor Name'] || row['mentor name'] || row['MentorName'] ||
          row['mentor_name'] || row['Mentor'] || row['mentor'] ||
          row['Mentor Name '] || row[' Mentor Name'] || ''
        ).toString().trim();
        const mentorEmail = (
          row['Mentor Email'] || row['mentor email'] || row['MentorEmail'] ||
          row['mentor_email'] || row['Email'] || row['email'] ||
          row['Mentor Email '] || row[' Mentor Email'] || ''
        ).toString().trim();

        if (mentorEmail) {
          // Try exact email match first (case-insensitive)
          const mentor = await get(db, 'SELECT id, name, email FROM users WHERE LOWER(email) = LOWER(?)', [mentorEmail]);
          if (mentor) {
            volunteerId = mentor.id;
            console.log(`[Excel Import] Matched mentor by email: ${mentorEmail} -> ${mentor.name} (ID: ${mentor.id})`);
          } else {
            // Don't treat missing mentor as an error - just log it
            console.log(`[Excel Import] Mentor email not found: ${mentorEmail} - importing ${menteeName} without mentor assignment`);
          }
        } else if (mentorName) {
          // Try multiple name matching strategies to find mentor
          let mentorByName = null;

          // Strategy 1: Exact name match (case-insensitive, trimmed)
          mentorByName = await get(db, 'SELECT id, name, email FROM users WHERE LOWER(TRIM(name)) = LOWER(?) AND role IN (?, ?)', [mentorName, 'student', 'office_bearer']);

          // Strategy 2: Name without spaces match
          if (!mentorByName) {
            const nameNoSpaces = mentorName.replace(/\s+/g, '');
            mentorByName = await get(db, 'SELECT id, name, email FROM users WHERE LOWER(REPLACE(name, " ", "")) = LOWER(?) AND role IN (?, ?)', [nameNoSpaces, 'student', 'office_bearer']);
          }

          // Strategy 3: Partial name match (contains)
          if (!mentorByName) {
            mentorByName = await get(db, 'SELECT id, name, email FROM users WHERE LOWER(TRIM(name)) LIKE LOWER(?) AND role IN (?, ?) LIMIT 1', [`%${mentorName}%`, 'student', 'office_bearer']);
          }

          // Strategy 4: Match by name parts (first name or last name)
          if (!mentorByName) {
            const nameParts = mentorName.trim().split(/\s+/).filter(p => p.length > 2);
            for (const part of nameParts) {
              mentorByName = await get(db, 'SELECT id, name, email FROM users WHERE (LOWER(name) LIKE LOWER(?) OR LOWER(name) LIKE LOWER(?)) AND role IN (?, ?) LIMIT 1', [`%${part}%`, `${part}%`, 'student', 'office_bearer']);
              if (mentorByName) break;
            }
          }

          if (mentorByName) {
            volunteerId = mentorByName.id;
            console.log(`[Excel Import] ✅ Matched mentor by name: "${mentorName}" -> Found: ${mentorByName.name} (Email: ${mentorByName.email}, ID: ${mentorByName.id})`);
          } else {
            // Don't treat missing mentor as an error - just log it
            console.log(`[Excel Import] ⚠️ Mentor name not found: "${mentorName}" - importing ${menteeName} without mentor assignment`);
          }
        }

        // If we resolved a mentor, ensure they are a project member
        if (volunteerId) {
          const member = await get(db, 'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, volunteerId]);
          if (!member) {
            await run(db, 'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)', [projectId, volunteerId, 'member']);
            console.log(`[Excel Import] Added mentor (ID: ${volunteerId}) to project ${projectId} as member`);
          }
        }

        // Parse expected_classes from Excel if provided
        const expectedClasses = row['Expected Classes'] || row['expected classes'] || row['ExpectedClasses'] ||
          row['expected_classes'] || row['Expected'] || row['expected'] || null;
        const expectedClassesNum = expectedClasses ? (Number(expectedClasses) || null) : null;

        // Try to insert with volunteer_id, but if UNIQUE constraint fails, retry with NULL
        let insertSuccess = false;
        let finalVolunteerId = volunteerId;

        try {
          await run(db, `
            INSERT INTO phone_mentoring_assignments (
              project_id, volunteer_id, mentee_name, mentee_phone, mentee_year,
              mentee_gender, mentee_school, mentee_district, mentee_parent_contact,
              mentee_status, mentee_notes, expected_classes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            expectedClassesNum,
            req.user.id
          ]);
          insertSuccess = true;
          console.log(`[Excel Import] Created mentee assignment: ${menteeName} with volunteer_id: ${volunteerId || 'NULL'}`);
        } catch (insertErr) {
          // If UNIQUE constraint error on volunteer_id, try again with NULL
          if (insertErr && insertErr.message && (
            insertErr.message.includes('UNIQUE constraint') && insertErr.message.includes('volunteer_id') ||
            insertErr.message.includes('NOT NULL constraint') && insertErr.message.includes('volunteer_id')
          )) {
            console.log(`[Excel Import] Constraint error for ${menteeName}, retrying with NULL volunteer_id...`);
            try {
              await run(db, `
                INSERT INTO phone_mentoring_assignments (
                  project_id, volunteer_id, mentee_name, mentee_phone, mentee_year,
                  mentee_gender, mentee_school, mentee_district, mentee_parent_contact,
                  mentee_status, mentee_notes, expected_classes, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                projectId,
                null, // Force NULL to avoid constraint
                menteeName,
                row['Phone'] || row['phone'] || null,
                row['Year'] || row['year'] || null,
                row['Gender'] || row['gender'] || null,
                row['School'] || row['school'] || null,
                row['District'] || row['district'] || null,
                row['Parent Contact'] || row['parent_contact'] || null,
                row['Status'] || row['status'] || 'active',
                row['Notes'] || row['notes'] || null,
                expectedClassesNum,
                req.user.id
              ]);
              insertSuccess = true;
              finalVolunteerId = null;
              console.log(`[Excel Import] Created mentee assignment: ${menteeName} without volunteer_id (constraint issue)`);
            } catch (retryErr) {
              // If retry also fails, throw the original error
              throw insertErr;
            }
          } else {
            // Re-throw if it's a different error
            throw insertErr;
          }
        }

        if (insertSuccess) {
          imported++;
        }
      } catch (err) {
        const errorMsg = err && err.message ? err.message : 'Unknown error';
        const rowNum = rowIndex + 1;
        const rowMenteeName = row['Name'] || row['name'] || row['Mentee Name'] || 'Unknown';
        errors.push(`Row ${rowNum} (${rowMenteeName}): ${errorMsg}`);
        console.error(`[Excel Import] Error importing row ${rowNum}:`, err);
        // Continue processing other rows even if one fails
      }
    }

    console.log(`[Excel Import] Completed: ${imported} imported, ${errors.length} errors out of ${data.length} total rows`);

    // Separate actual errors from mentor assignment warnings
    const actualErrors = errors.filter(e => !e.includes('Mentor not found'));
    const warnings = errors.filter(e => e.includes('Mentor not found'));

    res.json({
      success: true,
      imported,
      errors: actualErrors.length > 0 ? actualErrors : undefined,
      warnings: warnings.length,
      message: `Imported ${imported} mentees${actualErrors.length > 0 ? ` with ${actualErrors.length} errors` : ''}${warnings.length > 0 ? ` (${warnings.length} without mentor assignment)` : ''}`
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

router.get('/:projectId/mentees/:assignmentId/attendance', authenticateToken, async (req, res) => {
  try {
    const { projectId, assignmentId } = req.params;
    const { date } = req.query;
    const db = getDatabase();

    const assignment = await get(db, 'SELECT * FROM phone_mentoring_assignments WHERE id = ? AND project_id = ?', [assignmentId, projectId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    // Check permissions: Allow if user has can_manage_projects view permission OR if user is the assigned volunteer
    const hasManagePermission = req.permissions?.can_manage_projects === 'edit' || req.permissions?.can_manage_projects === 'view' || req.permissions?.can_manage_projects === true;
    const isAssignedVolunteer = assignment.volunteer_id === req.user.id;

    if (!hasManagePermission && !isAssignedVolunteer) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this mentee assignment' });
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

router.get('/:projectId/mentees/:assignmentId/updates', authenticateToken, async (req, res) => {
  try {
    const { projectId, assignmentId } = req.params;
    const db = getDatabase();

    const assignment = await get(db, 'SELECT * FROM phone_mentoring_assignments WHERE id = ? AND project_id = ?', [assignmentId, projectId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    // Check permissions: Allow if user has can_manage_projects view permission OR if user is the assigned volunteer
    const hasManagePermission = req.permissions?.can_manage_projects === 'edit' || req.permissions?.can_manage_projects === 'view' || req.permissions?.can_manage_projects === true;
    const isAssignedVolunteer = assignment.volunteer_id === req.user.id;

    if (!hasManagePermission && !isAssignedVolunteer) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this mentee assignment' });
    }
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
router.get('/:id', authenticateToken, requirePermission('can_manage_projects', { allowView: true }), async (req, res) => {
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
router.put('/:id', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), [
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
    const project = await get(db, 'SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // SPOC specific logic: Only allow editing assigned projects
    if (req.user.role === 'spoc') {
      const isAssigned = project.coordinator_id === req.user.id;
      const isMember = await get(db, 'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?', [id, req.user.id]);

      if (!isAssigned && !isMember) {
        return res.status(403).json({ success: false, message: 'Access denied: SPOC can only edit assigned projects' });
      }
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
router.delete('/:id', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), async (req, res) => {
  try {
    const { id } = req.params;

    // SPOC CANNOT delete projects
    if (req.user.role === 'spoc') {
      return res.status(403).json({ success: false, message: 'Access denied: SPOC role cannot delete projects' });
    }
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
router.post('/', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), [
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
router.post('/:id/bulk-assign-students', authenticateToken, requirePermission('can_manage_projects', { requireEdit: true }), async (req, res) => {
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

// Get mentor assigned to current student
router.get('/mentor/my-mentor', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const currentUser = req.user;
    const forceRelink = req.query.forceRelink === 'true'; // Allow force re-linking

    if (!currentUser || !currentUser.id) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    console.log('🔍 Getting mentor for student:', {
      userId: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      forceRelink: forceRelink
    });

    // First, try direct link via mentee_user_id (most reliable)
    try {
      let assignment = await get(db, `
        SELECT 
          a.*,
          u.name as volunteer_name,
          u.email as volunteer_email,
          p.phone as volunteer_phone,
          pr.title as project_title,
          (
            SELECT COUNT(1) 
            FROM phone_mentoring_updates 
            WHERE assignment_id = a.id
          ) as total_updates,
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
          ) as last_update_status
        FROM phone_mentoring_assignments a
        LEFT JOIN users u ON a.volunteer_id = u.id
        LEFT JOIN profiles p ON a.volunteer_id = p.user_id
        LEFT JOIN projects pr ON a.project_id = pr.id
        WHERE a.mentee_user_id = ? AND a.volunteer_id IS NOT NULL
        ORDER BY a.created_at DESC
        LIMIT 1
      `, [currentUser.id]);

      if (assignment && assignment.volunteer_id) {
        console.log('✅ Found assignment via mentee_user_id:', {
          id: assignment.id,
          mentee_name: assignment.mentee_name,
          volunteer_name: assignment.volunteer_name
        });
        return res.json({ success: true, mentor: assignment });
      }
    } catch (directLinkError) {
      console.log('⚠️ Direct link query failed (this is okay if mentee_user_id not set):', directLinkError.message);
    }

    // If no direct link, try matching by name/phone/register_no
    const studentProfile = await get(db, `
      SELECT phone, register_no 
      FROM profiles 
      WHERE user_id = ? AND role = 'student'
    `, [currentUser.id]);

    // First, try to find assignments in projects where the student is a member
    const studentProjects = await all(db, `
      SELECT project_id 
      FROM project_members 
      WHERE user_id = ?
    `, [currentUser.id]);

    const projectIds = studentProjects.map(p => p.project_id).filter(Boolean);

    // Build matching conditions - try multiple ways to match
    const matchConditions = [];
    const matchParams = [];

    // Match by exact name (from users table)
    if (currentUser.name) {
      const nameTrimmed = currentUser.name.trim();
      matchConditions.push('LOWER(TRIM(a.mentee_name)) = LOWER(TRIM(?))');
      matchParams.push(nameTrimmed);

      // Also try name without spaces
      const nameNoSpaces = nameTrimmed.replace(/\s+/g, '');
      if (nameNoSpaces.length >= 3) {
        matchConditions.push('LOWER(REPLACE(a.mentee_name, \' \', \'\')) = LOWER(?)');
        matchParams.push(nameNoSpaces);
      }
    }

    // Match by partial name (first name or last name)
    if (currentUser.name) {
      const nameParts = currentUser.name.trim().split(' ').filter(p => p.length > 2);
      nameParts.forEach(part => {
        matchConditions.push('a.mentee_name LIKE ?');
        matchParams.push(`%${part}%`);
      });

      // Also try first 3-4 characters
      const nameTrimmed = currentUser.name.trim();
      if (nameTrimmed.length >= 3) {
        const firstChars = nameTrimmed.substring(0, Math.min(4, nameTrimmed.length));
        matchConditions.push('LOWER(a.mentee_name) LIKE LOWER(?)');
        matchParams.push(`${firstChars}%`);
      }
    }

    // Match by phone number if available
    if (studentProfile?.phone) {
      const phone = studentProfile.phone.trim();
      matchConditions.push('(a.mentee_phone = ? OR a.mentee_phone LIKE ? OR a.mentee_phone LIKE ?)');
      matchParams.push(phone, `%${phone}%`, phone.replace(/\s+/g, ''));
    }

    // Match by register number if available
    if (studentProfile?.register_no) {
      matchConditions.push('a.mentee_register_no = ?');
      matchParams.push(studentProfile.register_no.trim());
    }

    // Also check user's email username
    if (currentUser.email) {
      const emailName = currentUser.email.split('@')[0];
      if (emailName && emailName.length > 2) {
        matchConditions.push('a.mentee_name LIKE ?');
        matchParams.push(`%${emailName}%`);
      }
    }

    if (matchConditions.length === 0) {
      return res.json({ success: false, message: 'No matching criteria found' });
    }

    const whereClause = matchConditions.join(' OR ');

    // Build project filter and parameters
    let projectFilter = '';
    const queryParams = [...matchParams];

    if (projectIds.length > 0) {
      projectFilter = `AND a.project_id IN (${projectIds.map(() => '?').join(',')})`;
      queryParams.push(...projectIds);
    }

    // Build ORDER BY clause - simplified to avoid parameter duplication
    // Priority: exact name match, then by creation date
    const allParams = [...queryParams];
    const orderByClause = 'CASE WHEN LOWER(TRIM(a.mentee_name)) = LOWER(TRIM(?)) THEN 1 ELSE 2 END, a.created_at DESC';
    allParams.push(currentUser.name?.trim() || '');

    console.log('🔍 Matching mentee for student:', {
      userId: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      phone: studentProfile?.phone,
      register_no: studentProfile?.register_no,
      projectIds: projectIds,
      conditions: matchConditions.length,
      whereParams: matchParams.length,
      projectParams: projectIds.length,
      totalParams: allParams.length
    });

    // Find mentee assignment where the student matches
    // Priority: exact name match > project member > any match
    let assignment;
    try {
      const query = `
        SELECT 
          a.*,
          u.name as volunteer_name,
          u.email as volunteer_email,
          p.phone as volunteer_phone,
          pr.title as project_title,
          (
            SELECT COUNT(1) 
            FROM phone_mentoring_updates 
            WHERE assignment_id = a.id
          ) as total_updates,
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
          ) as last_update_status
        FROM phone_mentoring_assignments a
        LEFT JOIN users u ON a.volunteer_id = u.id
        LEFT JOIN profiles p ON a.volunteer_id = p.user_id
        LEFT JOIN projects pr ON a.project_id = pr.id
        WHERE (${whereClause}) AND a.volunteer_id IS NOT NULL ${projectFilter}
        ORDER BY ${orderByClause}
        LIMIT 1
      `;

      console.log('SQL Query:', query.substring(0, 200) + '...');
      console.log('Parameters count:', allParams.length, 'Values:', allParams.slice(0, 5));

      assignment = await get(db, query, allParams);
    } catch (queryError) {
      console.error('❌ Error in main query:', queryError);
      console.error('Error message:', queryError?.message);
      console.error('Error name:', queryError?.name);
      // Don't throw - try fallback query instead
      assignment = null;
    }

    // If no assignment found with project filter, try without project filter
    if (!assignment) {
      console.log('⚠️ No assignment found in student projects, trying all projects...');
      const fallbackParams = [...matchParams, currentUser.name?.trim() || ''];
      try {
        assignment = await get(db, `
        SELECT 
          a.*,
          u.name as volunteer_name,
          u.email as volunteer_email,
          p.phone as volunteer_phone,
          pr.title as project_title,
          (
            SELECT COUNT(1) 
            FROM phone_mentoring_updates 
            WHERE assignment_id = a.id
          ) as total_updates,
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
          ) as last_update_status
        FROM phone_mentoring_assignments a
        LEFT JOIN users u ON a.volunteer_id = u.id
        LEFT JOIN profiles p ON a.volunteer_id = p.user_id
        LEFT JOIN projects pr ON a.project_id = pr.id
        WHERE (${whereClause}) AND a.volunteer_id IS NOT NULL
        ORDER BY 
          CASE WHEN LOWER(TRIM(a.mentee_name)) = LOWER(TRIM(?)) THEN 1 ELSE 2 END,
          a.created_at DESC
        LIMIT 1
      `, fallbackParams);
      } catch (fallbackError) {
        console.error('❌ Error in fallback query:', fallbackError);
        throw fallbackError;
      }
    }

    console.log('✅ Found assignment:', assignment ? {
      id: assignment.id,
      mentee_name: assignment.mentee_name,
      volunteer_name: assignment.volunteer_name,
      project_title: assignment.project_title,
      mentee_user_id: assignment.mentee_user_id
    } : 'No');

    // If assignment found but mentee_user_id is not set, try to auto-link it
    // Also try to link even if mentee_user_id is set but doesn't match current user
    // If forceRelink is true, always try to re-link
    if (assignment && assignment.volunteer_id) {
      const needsLinking = forceRelink || !assignment.mentee_user_id || assignment.mentee_user_id !== currentUser.id;
      if (needsLinking) {
        console.log('🔗 Auto-linking mentee_user_id for found assignment...', {
          currentUserId: currentUser.id,
          existingMenteeUserId: assignment.mentee_user_id,
          assignmentId: assignment.id
        });
        try {
          let linkedUserId = null;

          // Try exact name match (case-insensitive, trimmed)
          if (currentUser.name && assignment.mentee_name) {
            const name1 = currentUser.name.trim().toLowerCase().replace(/\s+/g, '');
            const name2 = assignment.mentee_name.trim().toLowerCase().replace(/\s+/g, '');
            if (name1 === name2) {
              linkedUserId = currentUser.id;
              console.log('✅ Name match found (exact):', name1, '===', name2);
            } else if (name1.includes(name2) || name2.includes(name1)) {
              linkedUserId = currentUser.id;
              console.log('✅ Name match found (partial):', name1, 'includes', name2);
            } else {
              // Try matching first name or last name (at least 3 characters)
              const name1Parts = name1.length >= 3 ? [name1.substring(0, 3), name1.substring(name1.length - 3)] : [];
              const name2Parts = name2.length >= 3 ? [name2.substring(0, 3), name2.substring(name2.length - 3)] : [];
              for (const part1 of name1Parts) {
                for (const part2 of name2Parts) {
                  if (part1 === part2 && part1.length >= 3) {
                    linkedUserId = currentUser.id;
                    console.log('✅ Name match found (substring):', part1, 'in both names');
                    break;
                  }
                }
                if (linkedUserId) break;
              }
              // Also try if one name starts with the other
              if (!linkedUserId && (name1.startsWith(name2.substring(0, Math.min(4, name2.length))) ||
                name2.startsWith(name1.substring(0, Math.min(4, name1.length))))) {
                linkedUserId = currentUser.id;
                console.log('✅ Name match found (prefix):', name1, 'vs', name2);
              }
            }
          }

          // Try phone match (normalize spaces)
          if (!linkedUserId && studentProfile?.phone && assignment.mentee_phone) {
            const phone1 = studentProfile.phone.trim().replace(/\s+/g, '');
            const phone2 = assignment.mentee_phone.trim().replace(/\s+/g, '');
            if (phone1 === phone2 || phone1.includes(phone2) || phone2.includes(phone1)) {
              linkedUserId = currentUser.id;
              console.log('✅ Phone match found:', phone1, '===', phone2);
            }
          }

          // Try register number match
          if (!linkedUserId && studentProfile?.register_no && assignment.mentee_register_no) {
            const reg1 = studentProfile.register_no.trim();
            const reg2 = assignment.mentee_register_no.trim();
            if (reg1 === reg2) {
              linkedUserId = currentUser.id;
              console.log('✅ Register number match found:', reg1);
            }
          }

          // If we found a match, update the assignment
          if (linkedUserId) {
            await run(db, `
              UPDATE phone_mentoring_assignments 
              SET mentee_user_id = ? 
              WHERE id = ?
            `, [linkedUserId, assignment.id]);
            assignment.mentee_user_id = linkedUserId;
            console.log('✅ Auto-linked mentee_user_id:', linkedUserId, 'to assignment:', assignment.id);
          } else {
            // Last resort: If assignment has a volunteer but no mentee_user_id, and we have ANY similarity, link it
            // This is for cases where names might be slightly different but it's clearly the same person
            if (assignment.volunteer_id && !assignment.mentee_user_id) {
              // Check if there's ANY similarity at all
              let hasAnySimilarity = false;

              if (currentUser.name && assignment.mentee_name) {
                const name1 = currentUser.name.trim().toLowerCase();
                const name2 = assignment.mentee_name.trim().toLowerCase();
                // Check if any word in name1 appears in name2 or vice versa
                const words1 = name1.split(/\s+/).filter(w => w.length >= 2);
                const words2 = name2.split(/\s+/).filter(w => w.length >= 2);
                for (const word1 of words1) {
                  if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
                    hasAnySimilarity = true;
                    break;
                  }
                }
                // Also check first 2-3 characters
                if (!hasAnySimilarity && name1.length >= 2 && name2.length >= 2) {
                  if (name1.substring(0, 2) === name2.substring(0, 2)) {
                    hasAnySimilarity = true;
                  }
                }
              }

              // If phone numbers are similar (last 6 digits match)
              if (!hasAnySimilarity && studentProfile?.phone && assignment.mentee_phone) {
                const phone1 = studentProfile.phone.trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
                const phone2 = assignment.mentee_phone.trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
                if (phone1.length >= 6 && phone2.length >= 6) {
                  const last1 = phone1.substring(phone1.length - 6);
                  const last2 = phone2.substring(phone2.length - 6);
                  if (last1 === last2) {
                    hasAnySimilarity = true;
                  }
                }
              }

              // If we have any similarity, link it (aggressive linking)
              if (hasAnySimilarity) {
                await run(db, `
                  UPDATE phone_mentoring_assignments 
                  SET mentee_user_id = ? 
                  WHERE id = ?
                `, [currentUser.id, assignment.id]);
                assignment.mentee_user_id = currentUser.id;
                console.log('✅ Auto-linked mentee_user_id (aggressive):', currentUser.id, 'to assignment:', assignment.id, 'based on similarity');
              } else {
                console.log('⚠️ Could not auto-link: No matching criteria found');
              }
            } else {
              console.log('⚠️ Could not auto-link: No matching criteria found');
            }
          }
        } catch (linkError) {
          console.error('⚠️ Error auto-linking mentee_user_id:', linkError);
        }
      }
    }

    // Ultra fallback: manually iterate through all assignments
    // This is the last resort - check ALL assignments with volunteers
    // Only do this if we haven't found a linked assignment yet
    if (!assignment || !assignment.volunteer_id) {
      console.log('🔄 Trying ultra fallback: iterating through all assignments...');
      console.log('📋 Current user info:', {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        phone: studentProfile?.phone,
        register_no: studentProfile?.register_no
      });

      try {
        const allAssignments = await all(db, `
          SELECT 
            a.*,
            u.name as volunteer_name,
            u.email as volunteer_email,
            p.phone as volunteer_phone,
            pr.title as project_title,
            (
              SELECT COUNT(1) 
              FROM phone_mentoring_updates 
              WHERE assignment_id = a.id
            ) as total_updates,
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
            ) as last_update_status
          FROM phone_mentoring_assignments a
          LEFT JOIN users u ON a.volunteer_id = u.id
          LEFT JOIN profiles p ON a.volunteer_id = p.user_id
          LEFT JOIN projects pr ON a.project_id = pr.id
          WHERE a.volunteer_id IS NOT NULL
        `);

        for (const ass of allAssignments) {
          // Check if this assignment matches the current user
          let matches = false;
          let matchReason = '';

          console.log('🔍 Checking assignment:', {
            id: ass.id,
            mentee_name: ass.mentee_name,
            mentee_phone: ass.mentee_phone,
            mentee_register_no: ass.mentee_register_no,
            volunteer_name: ass.volunteer_name,
            mentee_user_id: ass.mentee_user_id
          });

          // Match by name (very flexible matching)
          if (currentUser.name && ass.mentee_name) {
            const name1 = currentUser.name.trim().toLowerCase().replace(/\s+/g, '');
            const name2 = ass.mentee_name.trim().toLowerCase().replace(/\s+/g, '');
            if (name1 === name2) {
              matches = true;
              matchReason = 'exact name match';
            } else if (name1.includes(name2) || name2.includes(name1)) {
              matches = true;
              matchReason = 'partial name match (contains)';
            } else {
              // Try matching first 3-4 characters or last 3-4 characters
              const minLen = Math.min(name1.length, name2.length, 3);
              if (minLen >= 3) {
                const prefix1 = name1.substring(0, Math.min(4, name1.length));
                const prefix2 = name2.substring(0, Math.min(4, name2.length));
                const suffix1 = name1.substring(Math.max(0, name1.length - 4));
                const suffix2 = name2.substring(Math.max(0, name2.length - 4));
                if (prefix1 === prefix2 || suffix1 === suffix2) {
                  matches = true;
                  matchReason = 'prefix/suffix name match';
                }
              }
              // Also try if names share at least 3 consecutive characters
              if (!matches && name1.length >= 3 && name2.length >= 3) {
                for (let i = 0; i <= name1.length - 3; i++) {
                  const substr = name1.substring(i, i + 3);
                  if (name2.includes(substr)) {
                    matches = true;
                    matchReason = 'shared substring name match';
                    break;
                  }
                }
              }
            }
            if (matches) {
              console.log('✅ Ultra fallback: Name match found (' + matchReason + '):', name1, 'vs', name2);
            }
          }

          // Match by phone
          if (!matches && studentProfile?.phone && ass.mentee_phone) {
            const phone1 = studentProfile.phone.trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
            const phone2 = ass.mentee_phone.trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
            if (phone1 === phone2) {
              matches = true;
              matchReason = 'exact phone match';
            } else if (phone1.length >= 8 && phone2.length >= 8) {
              // Try last 8-10 digits (most phone numbers have country code)
              const last1 = phone1.substring(Math.max(0, phone1.length - 10));
              const last2 = phone2.substring(Math.max(0, phone2.length - 10));
              if (last1 === last2 || last1.includes(last2) || last2.includes(last1)) {
                matches = true;
                matchReason = 'partial phone match (last digits)';
              }
            }
            if (matches) {
              console.log('✅ Ultra fallback: Phone match found (' + matchReason + '):', phone1, 'vs', phone2);
            }
          }

          // Match by register number
          if (!matches && studentProfile?.register_no && ass.mentee_register_no) {
            const reg1 = studentProfile.register_no.trim();
            const reg2 = ass.mentee_register_no.trim();
            if (reg1 === reg2) {
              matches = true;
              matchReason = 'register number match';
              console.log('✅ Ultra fallback: Register number match found');
            }
          }

          // If no exact match but we have a volunteer assigned, try very loose matching
          if (!matches && ass.volunteer_id && !ass.mentee_user_id) {
            // Try very loose name matching - just check if any part of the name matches
            if (currentUser.name && ass.mentee_name) {
              const name1 = currentUser.name.trim().toLowerCase();
              const name2 = ass.mentee_name.trim().toLowerCase();
              const words1 = name1.split(/\s+/).filter(w => w.length >= 2);
              const words2 = name2.split(/\s+/).filter(w => w.length >= 2);

              // Check if any word matches
              for (const word1 of words1) {
                if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
                  matches = true;
                  matchReason = 'loose word match';
                  break;
                }
              }

              // Check first 2 characters
              if (!matches && name1.length >= 2 && name2.length >= 2) {
                if (name1.substring(0, 2) === name2.substring(0, 2)) {
                  matches = true;
                  matchReason = 'first 2 chars match';
                }
              }
            }

            // Try loose phone matching - last 6 digits
            if (!matches && studentProfile?.phone && ass.mentee_phone) {
              const phone1 = studentProfile.phone.trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
              const phone2 = ass.mentee_phone.trim().replace(/\s+/g, '').replace(/[^0-9]/g, '');
              if (phone1.length >= 6 && phone2.length >= 6) {
                const last1 = phone1.substring(phone1.length - 6);
                const last2 = phone2.substring(phone2.length - 6);
                if (last1 === last2) {
                  matches = true;
                  matchReason = 'last 6 phone digits match';
                }
              }
            }
          }

          if (matches) {
            // Update mentee_user_id and return
            await run(db, `
              UPDATE phone_mentoring_assignments 
              SET mentee_user_id = ? 
              WHERE id = ?
            `, [currentUser.id, ass.id]);

            ass.mentee_user_id = currentUser.id;
            console.log('✅ Found match via ultra fallback and linked:', {
              assignmentId: ass.id,
              menteeName: ass.mentee_name,
              volunteerName: ass.volunteer_name,
              matchReason: matchReason
            });
            return res.json({ success: true, mentor: ass });
          }
        }

        console.log('⚠️ Ultra fallback: No matching assignment found after checking', allAssignments.length, 'assignments');

        // Final fallback: If there's only ONE assignment with a volunteer and no mentee_user_id, link it
        // This is for cases where the admin assigned a mentor but the name doesn't match at all
        const unlinkedAssignments = allAssignments.filter(a => a.volunteer_id && !a.mentee_user_id);
        if (unlinkedAssignments.length === 1) {
          const singleAssignment = unlinkedAssignments[0];
          console.log('🔗 Final fallback: Found single unlinked assignment, linking it:', {
            assignmentId: singleAssignment.id,
            menteeName: singleAssignment.mentee_name,
            volunteerName: singleAssignment.volunteer_name
          });
          await run(db, `
            UPDATE phone_mentoring_assignments 
            SET mentee_user_id = ? 
            WHERE id = ?
          `, [currentUser.id, singleAssignment.id]);
          singleAssignment.mentee_user_id = currentUser.id;
          return res.json({ success: true, mentor: singleAssignment });
        } else if (unlinkedAssignments.length > 1) {
          // If multiple unlinked assignments, try to find the best match
          console.log('🔍 Final fallback: Found', unlinkedAssignments.length, 'unlinked assignments, trying to find best match...');
          for (const unlinked of unlinkedAssignments) {
            // Check if there's ANY similarity at all
            let hasSimilarity = false;

            if (currentUser.name && unlinked.mentee_name) {
              const name1 = currentUser.name.trim().toLowerCase();
              const name2 = unlinked.mentee_name.trim().toLowerCase();
              // Check if any single character matches at the start
              if (name1.length > 0 && name2.length > 0 && name1[0] === name2[0]) {
                hasSimilarity = true;
              }
              // Check if any word matches
              const words1 = name1.split(/\s+/);
              const words2 = name2.split(/\s+/);
              for (const w1 of words1) {
                if (words2.some(w2 => w2.includes(w1) || w1.includes(w2))) {
                  hasSimilarity = true;
                  break;
                }
              }
            }

            if (hasSimilarity) {
              console.log('✅ Final fallback: Found assignment with similarity, linking:', {
                assignmentId: unlinked.id,
                menteeName: unlinked.mentee_name
              });
              await run(db, `
                UPDATE phone_mentoring_assignments 
                SET mentee_user_id = ? 
                WHERE id = ?
              `, [currentUser.id, unlinked.id]);
              unlinked.mentee_user_id = currentUser.id;
              return res.json({ success: true, mentor: unlinked });
            }
          }
        }
      } catch (ultraError) {
        console.error('❌ Ultra fallback error:', ultraError);
      }
    }

    // If we still don't have an assignment, return error
    if (!assignment || !assignment.volunteer_id) {
      res.json({ success: false, message: 'No mentor assigned. The mentee name, phone, or register number may not match your profile. Please contact the administrator to link your account.' });
    }
  } catch (error) {
    console.error('❌ Get my mentor error:', error);
    const errorMessage = error?.message || 'Unknown server error';
    console.error('Error details:', {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name
    });
    res.status(500).json({
      success: false,
      message: 'Server error while fetching mentor information',
      error: errorMessage
    });
  }
});

export default router;

