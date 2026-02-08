import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Ensure mentoring uploads directory exists
const uploadsDir = path.join(path.resolve(__dirname, '..'), 'public', 'uploads', 'mentoring');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Debug middleware for all requests
router.use((req, res, next) => {
  if (req.method === 'DELETE') {
    console.log(`[ROUTER DEBUG] Incoming DELETE request - Path: ${req.path}, Full URL: ${req.originalUrl}`);
  }
  next();
});

// Handle OPTIONS for CORS preflight
router.options('/mentees/:assignmentId/attendance/:attendanceId', (req, res) => {
  console.log(`[OPTIONS] Preflight request for DELETE`);
  res.sendStatus(200);
});

// Configure multer for optional attachment (voice note or screenshot)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `mentoring_${userId}_${safeBase}_${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow common image and audio formats for screenshots and voice notes
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and audio files are allowed as attachments'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const getVolunteerAssignment = async (db, assignmentId, volunteerId) => {
  return await get(
    db,
    `
      SELECT 
        a.*,
        pr.title as project_title
      FROM phone_mentoring_assignments a
      LEFT JOIN projects pr ON a.project_id = pr.id
      WHERE a.id = ? AND a.volunteer_id = ?
    `,
    [assignmentId, volunteerId]
  );
};

// Get mentee assignment for current volunteer (legacy single assignment support)
router.get('/my-assignment', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const assignments = await all(
      db,
      `
        SELECT 
          pma.*,
          pr.title as project_title
        FROM phone_mentoring_assignments pma
        LEFT JOIN projects pr ON pma.project_id = pr.id
        WHERE pma.volunteer_id = ?
        ORDER BY pma.mentee_name COLLATE NOCASE
      `,
      [req.user.id]
    );

    // Auto-fill volunteer name from users table
    const volunteerName = req.user.name;

    res.json({
      success: true,
      assignment: assignments?.[0] || null,
      assignments: assignments || [],
      volunteer: {
        id: req.user.id,
        name: volunteerName
      }
    });
  } catch (error) {
    console.error('Get mentoring assignment error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Detailed list of mentees for the current volunteer
router.get('/my-mentees', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const mentees = await all(
      db,
      `
        SELECT 
          a.*,
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
            SELECT attendance_date
            FROM phone_mentoring_attendance pma
            WHERE pma.assignment_id = a.id
            ORDER BY attendance_date DESC
            LIMIT 1
          ) as last_attendance_date,
          (
            SELECT status
            FROM phone_mentoring_attendance pma
            WHERE pma.assignment_id = a.id
            ORDER BY attendance_date DESC
            LIMIT 1
          ) as last_attendance_status,
          (
            SELECT update_date
            FROM phone_mentoring_updates pmu
            WHERE pmu.assignment_id = a.id
            ORDER BY update_date DESC, pmu.created_at DESC
            LIMIT 1
          ) as last_update_date,
          (
            SELECT status
            FROM phone_mentoring_updates pmu
            WHERE pmu.assignment_id = a.id
            ORDER BY update_date DESC, pmu.created_at DESC
            LIMIT 1
          ) as last_update_status
        FROM phone_mentoring_assignments a
        LEFT JOIN projects pr ON a.project_id = pr.id
        WHERE a.volunteer_id = ?
        ORDER BY a.created_at DESC, a.mentee_name COLLATE NOCASE
      `,
      [req.user.id]
    );

    res.json({ success: true, mentees });
  } catch (error) {
    console.error('Get volunteer mentees error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Volunteer creates a daily mentoring update (with optional attachment)
router.post(
  '/',
  authenticateToken,
  upload.single('attachment'),
  async (req, res) => {
    try {
      const db = getDatabase();

      const { status, explanation, attempts, mentee_name, date, assignment_id: assignmentIdRaw, project_id: projectIdRaw } = req.body;
      const assignmentId = assignmentIdRaw ? parseInt(assignmentIdRaw, 10) : null;
      const projectId = projectIdRaw ? parseInt(projectIdRaw, 10) : null;

      if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required' });
      }

      const allowedStatuses = ['CALL_DONE', 'NOT_CALLED', 'STUDENT_NOT_PICKED', 'CALL_PENDING'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value' });
      }

      // Derive date (YYYY-MM-DD). If not provided, use today.
      const today = new Date();
      const normalizedDate =
        date ||
        today.toISOString().slice(0, 10); // YYYY-MM-DD

      // Resolve assignment/project context so we can auto-fill mentee details
      let selectedAssignment = null;
      if (assignmentId) {
        selectedAssignment = await getVolunteerAssignment(db, assignmentId, req.user.id);
      }

      if (!selectedAssignment && projectId) {
        selectedAssignment = await get(
          db,
          'SELECT * FROM phone_mentoring_assignments WHERE project_id = ? AND volunteer_id = ?',
          [projectId, req.user.id]
        );
      }

      if (!selectedAssignment) {
        selectedAssignment = await get(
          db,
          'SELECT * FROM phone_mentoring_assignments WHERE volunteer_id = ?',
          [req.user.id]
        );
      }

      const finalAssignmentId = selectedAssignment?.id || assignmentId || null;
      const finalProjectId = selectedAssignment?.project_id || projectId || null;

      // Resolve mentee name
      let finalMenteeName = mentee_name;
      if (!finalMenteeName) {
        finalMenteeName = selectedAssignment?.mentee_name || 'Not Assigned';
      }

      const attachmentPath = req.file ? `/uploads/mentoring/${req.file.filename}` : null;

      await run(
        db,
        `INSERT INTO phone_mentoring_updates (
          volunteer_id,
          volunteer_name,
          mentee_name,
          update_date,
          status,
          explanation,
          attempts,
          attachment_path,
          assignment_id,
          project_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          req.user.name,
          finalMenteeName,
          normalizedDate,
          status,
          explanation || null,
          attempts ? parseInt(attempts, 10) || null : null,
          attachmentPath,
          finalAssignmentId,
          finalProjectId
        ]
      );

      res.json({ success: true, message: 'Phone mentoring update saved successfully' });
    } catch (error) {
      console.error('Create mentoring update error:', error);
      res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
  }
);

// Mentor saves attendance for their mentee (with optional call recording)
router.post('/mentees/:assignmentId/attendance', authenticateToken, upload.single('call_recording'), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { status, notes, date } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const db = getDatabase();
    const assignment = await get(
      db,
      `
        SELECT a.*, pr.title as project_title
        FROM phone_mentoring_assignments a
        LEFT JOIN projects pr ON a.project_id = pr.id
        WHERE a.id = ?
      `,
      [assignmentId]
    );

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    // Check authorization: Allow if user is the volunteer OR is admin/has permission
    if (assignment.volunteer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to record attendance for this mentee' });
    }

    const attendanceDate = date || new Date().toISOString().slice(0, 10);
    const callRecordingPath = req.file ? `/uploads/mentoring/${req.file.filename}` : null;

    // Check if record already exists
    const existing = await get(
      db,
      `SELECT id FROM phone_mentoring_attendance WHERE assignment_id = ? AND attendance_date = ?`,
      [assignment.id, attendanceDate]
    );

    if (existing) {
      // Update existing record
      await run(
        db,
        `
          UPDATE phone_mentoring_attendance
          SET status = ?, notes = ?, call_recording_path = ?, recorded_by = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [status, notes || null, callRecordingPath, req.user.id, existing.id]
      );
    } else {
      // Insert new record
      await run(
        db,
        `
          INSERT INTO phone_mentoring_attendance (
            assignment_id,
            project_id,
            mentee_name,
            attendance_date,
            status,
            notes,
            call_recording_path,
            recorded_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          assignment.id,
          assignment.project_id || null,
          assignment.mentee_name,
          attendanceDate,
          status,
          notes || null,
          callRecordingPath,
          req.user.id
        ]
      );
    }

    res.json({ success: true, message: 'Attendance saved' });
  } catch (error) {
    console.error('Save mentee attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Mentor updates attendance for their mentee
router.put('/mentees/:assignmentId/attendance/:attendanceId', authenticateToken, upload.single('call_recording'), async (req, res) => {
  try {
    const { assignmentId, attendanceId } = req.params;
    const { status, notes, date } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const db = getDatabase();
    const assignment = await get(
      db,
      `
        SELECT a.*, pr.title as project_title
        FROM phone_mentoring_assignments a
        LEFT JOIN projects pr ON a.project_id = pr.id
        WHERE a.id = ?
      `,
      [assignmentId]
    );

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    // Check authorization
    if (assignment.volunteer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to update attendance for this mentee' });
    }

    // Verify attendance belongs to this assignment
    const existing = await get(db, 'SELECT * FROM phone_mentoring_attendance WHERE id = ? AND assignment_id = ?', [attendanceId, assignmentId]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const attendanceDate = date || existing.attendance_date;
    const callRecordingPath = req.file ? `/uploads/mentoring/${req.file.filename}` : existing.call_recording_path;

    await run(
      db,
      `
        UPDATE phone_mentoring_attendance
        SET status = ?,
            notes = ?,
            call_recording_path = ?,
            attendance_date = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND assignment_id = ?
      `,
      [status, notes || null, callRecordingPath, attendanceDate, attendanceId, assignmentId]
    );

    res.json({ success: true, message: 'Attendance updated' });
  } catch (error) {
    console.error('Update mentee attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// DELETE attendance record
router.delete('/mentees/:assignmentId/attendance/:attendanceId', (req, res) => {
  const { assignmentId, attendanceId } = req.params;
  const attendId = parseInt(attendanceId);
  const db = getDatabase();

  db.run('DELETE FROM phone_mentoring_attendance WHERE id = ?', [attendId], function(err) {
    if (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ success: false, message: 'Delete failed: ' + err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }
    
    res.json({ success: true, message: 'Attendance deleted' });
  });
});

// Mentor views attendance history for their mentee
router.get('/mentees/:assignmentId/attendance', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { date } = req.query;
    const db = getDatabase();
    
    // First verify the assignment exists and belongs to this volunteer
    const assignment = await get(
      db,
      `
        SELECT a.*, pr.title as project_title
        FROM phone_mentoring_assignments a
        LEFT JOIN projects pr ON a.project_id = pr.id
        WHERE a.id = ?
      `,
      [assignmentId]
    );
    
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    // Check authorization: Allow if user is the volunteer OR is admin/has permission
    if (assignment.volunteer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this attendance' });
    }

    const params = [assignmentId];
    let where = 'WHERE assignment_id = ?';
    if (date) {
      where += ' AND attendance_date = ?';
      params.push(date);
    }

    const rows = await all(
      db,
      `
        SELECT *
        FROM phone_mentoring_attendance
        ${where}
        ORDER BY attendance_date DESC
      `,
      params
    );

    res.json({ success: true, attendance: rows });
  } catch (error) {
    console.error('Get mentee attendance history error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Admin/Manager views all attendance records
router.get('/attendance', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    
    const rows = await all(
      db,
      `
        SELECT 
          pma.id,
          pma.assignment_id,
          pma.project_id,
          pma.mentee_name,
          pma.attendance_date,
          pma.status,
          pma.notes,
          pma.call_recording_path,
          pa.volunteer_id,
          u.name as volunteer_name,
          pr.title as project_title
        FROM phone_mentoring_attendance pma
        LEFT JOIN phone_mentoring_assignments pa ON pma.assignment_id = pa.id
        LEFT JOIN users u ON pa.volunteer_id = u.id
        LEFT JOIN projects pr ON pma.project_id = pr.id
        ORDER BY pma.attendance_date DESC
      `
    );

    res.json({ success: true, attendance: rows });
  } catch (error) {
    console.error('Get all attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Mentor views update history for their mentee
router.get('/mentees/:assignmentId/updates', authenticateToken, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const db = getDatabase();
    const assignment = await get(
      db,
      `
        SELECT a.*, pr.title as project_title
        FROM phone_mentoring_assignments a
        LEFT JOIN projects pr ON a.project_id = pr.id
        WHERE a.id = ?
      `,
      [assignmentId]
    );

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Mentee assignment not found' });
    }

    // Check authorization
    if (assignment.volunteer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to view updates for this mentee' });
    }

    const rows = await all(
      db,
      `
        SELECT pmu.*
        FROM phone_mentoring_updates pmu
        WHERE pmu.assignment_id = ?
        ORDER BY pmu.update_date DESC, pmu.created_at DESC
      `,
      [assignmentId]
    );

    res.json({ success: true, updates: rows });
  } catch (error) {
    console.error('Get mentee updates error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Admin: list all attendance records with optional filters
router.get(
  '/attendance',
  authenticateToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = getDatabase();
      const { date, volunteerId, status, projectId, assignmentId } = req.query;

      const conditions = [];
      const params = [];

      if (date) {
        conditions.push('pma.attendance_date = ?');
        params.push(date);
      }
      if (volunteerId) {
        conditions.push('ass.volunteer_id = ?');
        params.push(parseInt(volunteerId, 10));
      }
      if (status) {
        conditions.push('pma.status = ?');
        params.push(status);
      }
      if (projectId) {
        conditions.push('pma.project_id = ?');
        params.push(parseInt(projectId, 10));
      }
      if (assignmentId) {
        conditions.push('pma.assignment_id = ?');
        params.push(parseInt(assignmentId, 10));
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await all(
        db,
        `
          SELECT 
            pma.*,
            ass.volunteer_id,
            u.name as volunteer_name,
            p.dept as volunteer_dept,
            p.year as volunteer_year,
            ass.mentee_department,
            ass.mentee_year,
            ass.mentee_school,
            ass.mentee_parent_contact,
            ass.mentee_address,
            ass.mentee_notes,
            pr.title as project_title
          FROM phone_mentoring_attendance pma
          LEFT JOIN phone_mentoring_assignments ass ON pma.assignment_id = ass.id
          LEFT JOIN users u ON ass.volunteer_id = u.id
          LEFT JOIN profiles p ON u.id = p.user_id
          LEFT JOIN projects pr ON pma.project_id = pr.id
          ${whereClause}
          ORDER BY pma.attendance_date DESC, pma.created_at DESC
        `,
        params
      );

      res.json({ success: true, attendance: rows });
    } catch (error) {
      console.error('List attendance records error:', error);
      res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
  }
);

// Admin: list all mentoring updates with optional filters
router.get(
  '/updates',
  authenticateToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const db = getDatabase();
      const { date, volunteerId, status, projectId, assignmentId } = req.query;

      const conditions = [];
      const params = [];

      if (date) {
        conditions.push('pmu.update_date = ?');
        params.push(date);
      }
      if (volunteerId) {
        conditions.push('pmu.volunteer_id = ?');
        params.push(parseInt(volunteerId, 10));
      }
      if (status) {
        conditions.push('pmu.status = ?');
        params.push(status);
      }
      if (projectId) {
        conditions.push('pmu.project_id = ?');
        params.push(parseInt(projectId, 10));
      }
      if (assignmentId) {
        conditions.push('pmu.assignment_id = ?');
        params.push(parseInt(assignmentId, 10));
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await all(
        db,
        `
          SELECT 
            pmu.*,
            u.id as volunteer_id,
            u.name as volunteer_name,
            p.dept as volunteer_dept,
            p.year as volunteer_year,
            ass.mentee_department,
            ass.mentee_year as mentee_year,
            ass.mentee_status,
            ass.mentee_school,
            ass.mentee_parent_contact,
            ass.mentee_address,
            ass.mentee_notes,
            pr.title as project_title
          FROM phone_mentoring_updates pmu
          LEFT JOIN users u ON pmu.volunteer_id = u.id
          LEFT JOIN profiles p ON u.id = p.user_id
          LEFT JOIN phone_mentoring_assignments ass ON pmu.assignment_id = ass.id
          LEFT JOIN projects pr ON pmu.project_id = pr.id
          ${whereClause}
          ORDER BY pmu.update_date DESC, pmu.created_at DESC
        `,
        params
      );

      res.json({ success: true, updates: rows });
    } catch (error) {
      console.error('List mentoring updates error:', error);
      res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
  }
);

export default router;


