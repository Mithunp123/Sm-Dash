import express from 'express';
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

// Base attendance route (GET /api/attendance)
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { userId } = req.query;
    // Special case: Students can always see their own attendance
    if (req.user.role === 'student' && userId && parseInt(userId) === req.user.id) {
      return next();
    }
    // Otherwise, check for can_manage_attendance permission
    requirePermission('can_manage_attendance', { allowView: true })(req, res, next);
  } catch (error) {
    next(error);
  }
}, async (req, res) => {
  try {
    const { meetingId, userId } = req.query;
    const db = getDatabase();

    let query = `
      SELECT 
        a.*,
        u.name as user_name,
        u.email as user_email,
        sp.dept as user_dept,
        sp.year as user_year,
        sp.phone as user_phone,
        m.title as meeting_title,
        m.date as meeting_date,
        m.location as meeting_location
      FROM attendance a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles sp ON u.id = sp.user_id
      LEFT JOIN meetings m ON a.meeting_id = m.id
      WHERE 1 = 1
    `;
    const params = [];

    if (meetingId) {
      query += ' AND a.meeting_id = ?';
      params.push(meetingId);
    }
    if (userId) {
      query += ' AND a.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY a.marked_at DESC';

    const attendance = await all(db, query, params);
    res.json({ success: true, attendance });
  } catch (error) {
    console.error('Attendance base route error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get student's projects with overall attendance
router.get('/student/projects/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDatabase();

    // Get all projects the user is assigned to (either as member or has attendance records)
    const projects = await all(db, `
      SELECT 
        p.*,
        COALESCE(COUNT(DISTINCT ar.id), 0) as total_records,
        COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) as present_count,
        COALESCE(SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END), 0) as absent_count,
        COALESCE(SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END), 0) as late_count
      FROM projects p
      INNER JOIN (
        SELECT DISTINCT project_id 
        FROM project_members 
        WHERE user_id = ?
        UNION
        SELECT DISTINCT project_id 
        FROM attendance_records 
        WHERE user_id = ?
      ) user_projects ON p.id = user_projects.project_id
      LEFT JOIN attendance_records ar ON p.id = ar.project_id AND ar.user_id = ?
      GROUP BY p.id
      ORDER BY p.start_date DESC
    `, [userId, userId, userId]);

    res.json({ success: true, projects });
  } catch (error) {
    console.error('Get student projects error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get date-wise attendance for a project
router.get('/project/:projectId/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { startDate, endDate } = req.query;
    const db = getDatabase();

    let query = `
      SELECT ar.* FROM attendance_records ar
      WHERE ar.project_id = ? AND ar.user_id = ?
    `;
    const params = [projectId, userId];

    if (startDate) {
      query += ' AND ar.attendance_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND ar.attendance_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY ar.attendance_date DESC';

    const records = await all(db, query, params);
    res.json({ success: true, records });
  } catch (error) {
    console.error('Get attendance records error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark attendance for a specific date
router.post('/project/:projectId/mark', authenticateToken, requirePermission('can_manage_attendance', { requireEdit: true }), [
  body('userId').isInt(),
  body('attendance_date').isISO8601(),
  body('status').isIn(['present', 'absent', 'late'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { projectId } = req.params;
    const { userId, attendance_date, status, notes } = req.body;
    const db = getDatabase();

    // Check if project exists
    const project = await get(db, 'SELECT id FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    // Check if user is part of project
    const member = await get(db, `
      SELECT id FROM project_members WHERE project_id = ? AND user_id = ?
    `, [projectId, userId]);

    if (!member) {
      return res.status(403).json({ success: false, message: 'User is not a member of this project' });
    }

    // Check for existing record
    const existing = await get(db, `
      SELECT id FROM attendance_records 
      WHERE project_id = ? AND user_id = ? AND attendance_date = ?
    `, [projectId, userId, attendance_date]);

    let result;
    if (existing) {
      result = await run(db, `
        UPDATE attendance_records SET
        status = ?,
        notes = ?,
        marked_by = ?,
        marked_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, notes || null, req.user.id, existing.id]);
    } else {
      result = await run(db, `
        INSERT INTO attendance_records (project_id, user_id, attendance_date, status, notes, marked_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [projectId, userId, attendance_date, status, notes || null, req.user.id]);
    }

    res.json({ success: true, message: 'Attendance marked successfully', id: result.lastID });
  } catch (error) {
    console.error('Mark attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get project attendance records grouped by date
router.get('/project/:projectId/records', authenticateToken, requirePermission('can_manage_attendance', { allowView: true }), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { date } = req.query;
    const db = getDatabase();

    let query = `
      SELECT 
        ar.id,
        ar.project_id,
        ar.user_id,
        ar.attendance_date,
        ar.status,
        ar.notes,
        ar.marked_at,
        u.name as user_name,
        u.email as user_email,
        sp.dept as user_dept,
        sp.year as user_year
      FROM attendance_records ar
      JOIN users u ON ar.user_id = u.id
      LEFT JOIN profiles sp ON u.id = sp.user_id
      WHERE ar.project_id = ?
    `;
    const params = [projectId];

    if (date) {
      query += ' AND ar.attendance_date = ?';
      params.push(date);
    }

    query += ' ORDER BY ar.attendance_date DESC, ar.marked_at DESC';

    const records = await all(db, query, params);
    res.json({ success: true, records });
  } catch (error) {
    console.error('Get project attendance records error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update project attendance record
router.put('/project/records/:id', authenticateToken, requirePermission('can_manage_attendance', { requireEdit: true }), [
  body('status').optional().isIn(['present', 'absent', 'late']),
  body('notes').optional().trim(),
  body('attendance_date').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { status, notes, attendance_date } = req.body;
    const db = getDatabase();

    const existing = await get(db, 'SELECT id FROM attendance_records WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes || null);
    }
    if (attendance_date) {
      updates.push('attendance_date = ?');
      params.push(attendance_date);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('marked_at = CURRENT_TIMESTAMP');
    params.push(id);

    await run(db, `UPDATE attendance_records SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Attendance record updated successfully' });
  } catch (error) {
    console.error('Update project attendance record error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete project attendance record
router.delete('/project/records/:id', authenticateToken, requirePermission('can_manage_attendance', { requireEdit: true }), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const existing = await get(db, 'SELECT id FROM attendance_records WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    await run(db, 'DELETE FROM attendance_records WHERE id = ?', [id]);
    res.json({ success: true, message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Delete project attendance record error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get attendance records for a specific meeting
router.get('/meeting/:meetingId/records', authenticateToken, requirePermission('can_manage_attendance', { allowView: true }), async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { date } = req.query;
    const db = getDatabase();

    let query = `
      SELECT 
        a.id,
        a.meeting_id,
        a.user_id,
        a.status,
        a.notes,
        a.marked_at,
        u.name as user_name,
        u.email as user_email,
        sp.dept as user_dept,
        sp.year as user_year
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles sp ON u.id = sp.user_id
      WHERE a.meeting_id = ?
    `;
    const params = [meetingId];

    if (date) {
      // Assuming marked_at or another column stores the date. 
      // The meeting itself has a date, but attendance might be multi-day (unlikely for meetings but good to handle).
      // If the attendance table doesn't have a date column, we use DATE(marked_at).
      query += ' AND DATE(a.marked_at) = ?';
      params.push(date);
    }

    query += ' ORDER BY a.marked_at DESC';

    const records = await all(db, query, params);
    res.json({ success: true, records });
  } catch (error) {
    console.error('Get meeting attendance records error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark attendance for meetings (POST /api/attendance)
router.post('/', authenticateToken, requirePermission('can_manage_attendance', { requireEdit: true }), [
  body('meetingId').isInt(),
  body('userId').isInt(),
  body('status').isIn(['present', 'absent', 'late']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { meetingId, userId, status, notes } = req.body;
    const db = getDatabase();

    const meeting = await get(db, 'SELECT id FROM meetings WHERE id = ?', [meetingId]);
    if (!meeting) {
      return res.status(404).json({ success: false, message: 'Meeting not found' });
    }

    const user = await get(db, 'SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check for existing record
    const existing = await get(db, `
      SELECT id FROM attendance 
      WHERE meeting_id = ? AND user_id = ?
    `, [meetingId, userId]);

    let result;
    if (existing) {
      result = await run(db, `
        UPDATE attendance SET
        status = ?,
        notes = ?,
        marked_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, notes || null, existing.id]);
    } else {
      result = await run(db, `
        INSERT INTO attendance (meeting_id, user_id, status, notes, marked_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [meetingId, userId, status, notes || null]);
    }

    res.json({ success: true, message: 'Attendance marked successfully', id: result.lastID || meetingId });
  } catch (error) {
    console.error('Mark meeting attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update meeting attendance
router.put('/:id', authenticateToken, requirePermission('can_manage_attendance', { requireEdit: true }), [
  body('status').optional().isIn(['present', 'absent', 'late']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { status, notes } = req.body;
    const db = getDatabase();

    const existing = await get(db, 'SELECT id FROM attendance WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('marked_at = CURRENT_TIMESTAMP');

    params.push(id);

    await run(db, `UPDATE attendance SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Attendance updated successfully' });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete meeting attendance
router.delete('/:id', authenticateToken, requirePermission('can_manage_attendance', { requireEdit: true }), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const existing = await get(db, 'SELECT id FROM attendance WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    await run(db, 'DELETE FROM attendance WHERE id = ?', [id]);
    res.json({ success: true, message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Delete attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get student's events with event attendance
router.get('/student/events/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const db = getDatabase();

    // Get all events the user is assigned to
    const events = await all(db, `
      SELECT 
        e.*,
        COALESCE(COUNT(DISTINCT ea.id), 0) as total_records,
        COALESCE(SUM(CASE WHEN ea.status = 'present' THEN 1 ELSE 0 END), 0) as present_count,
        COALESCE(SUM(CASE WHEN ea.status = 'absent' THEN 1 ELSE 0 END), 0) as absent_count,
        COALESCE(SUM(CASE WHEN ea.status = 'late' THEN 1 ELSE 0 END), 0) as late_count
      FROM events e
      INNER JOIN event_members em ON e.id = em.event_id
      LEFT JOIN event_attendance ea ON e.id = ea.event_id AND ea.user_id = ?
      WHERE em.user_id = ?
      GROUP BY e.id
      ORDER BY e.date DESC
    `, [userId, userId]);

    res.json({ success: true, events });
  } catch (error) {
    console.error('Get student events error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// Get attendance records for an event
router.get('/event/:eventId/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    const db = getDatabase();

    const records = await all(db, `
      SELECT 
        ea.*,
        u.name as marked_by_name
      FROM event_attendance ea
      LEFT JOIN users u ON ea.marked_by = u.id
      WHERE ea.event_id = ? AND ea.user_id = ?
      ORDER BY ea.marked_at DESC
    `, [eventId, userId]);

    res.json({ success: true, records });
  } catch (error) {
    console.error('Get event attendance records error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mark event attendance
router.post('/event/:eventId/mark', authenticateToken, requirePermission('can_manage_attendance', { requireEdit: true }), [
  body('userId').isInt(),
  body('status').isIn(['present', 'absent', 'late'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { eventId } = req.params;
    const { userId, status, notes } = req.body;
    const db = getDatabase();

    // Check if user is a member of the event
    const member = await get(db, 'SELECT id FROM event_members WHERE event_id = ? AND user_id = ?', [eventId, userId]);
    if (!member) {
      return res.status(404).json({ success: false, message: 'User is not a member of this event' });
    }

    // Check if already marked today
    const today = new Date().toISOString().split('T')[0];
    const existing = await get(db, `
      SELECT id FROM event_attendance 
      WHERE event_id = ? AND user_id = ? AND DATE(marked_at) = ?
    `, [eventId, userId, today]);

    if (existing) {
      // Update existing record
      await run(db, `
        UPDATE event_attendance 
        SET status = ?, notes = ?, marked_at = CURRENT_TIMESTAMP, marked_by = ?
        WHERE id = ?
      `, [status, notes || null, req.user.id, existing.id]);

      return res.json({ success: true, message: 'Event attendance updated' });
    }

    // Create new attendance record
    const result = await run(db, `
      INSERT INTO event_attendance (event_id, user_id, status, notes, marked_by)
      VALUES (?, ?, ?, ?, ?)
    `, [eventId, userId, status, notes || null, req.user.id]);

    res.json({ success: true, message: 'Event attendance marked', id: result.lastID });
  } catch (error) {
    console.error('Mark event attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update event attendance record
router.put('/event/records/:id', authenticateToken, requirePermission('can_manage_attendance', { requireEdit: true }), [
  body('status').optional().isIn(['present', 'absent', 'late']),
  body('notes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { status, notes } = req.body;
    const db = getDatabase();

    const existing = await get(db, 'SELECT id FROM event_attendance WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push('marked_at = CURRENT_TIMESTAMP');
    params.push(id);

    await run(db, `UPDATE event_attendance SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Attendance record updated successfully' });
  } catch (error) {
    console.error('Update event attendance record error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete event attendance record
router.delete('/event/records/:id', authenticateToken, requirePermission('can_manage_attendance', { requireEdit: true }), async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();

    const existing = await get(db, 'SELECT id FROM event_attendance WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    await run(db, 'DELETE FROM event_attendance WHERE id = ?', [id]);
    res.json({ success: true, message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Delete event attendance record error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get saved dates for a project
router.get('/project/:projectId/dates', authenticateToken, requirePermission('can_manage_attendance', { allowView: true }), async (req, res) => {
  try {
    const { projectId } = req.params;
    const db = getDatabase();

    const dates = await all(db, `
      SELECT 
        attendance_date as date,
        COUNT(*) as count
      FROM attendance_records
      WHERE project_id = ?
      GROUP BY attendance_date
      ORDER BY attendance_date DESC
    `, [projectId]);

    res.json({ success: true, dates });
  } catch (error) {
    console.error('Get project dates error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get saved dates for a meeting
router.get('/meeting/:meetingId/dates', authenticateToken, requirePermission('can_manage_attendance', { allowView: true }), async (req, res) => {
  try {
    const { meetingId } = req.params;
    const db = getDatabase();

    const dates = await all(db, `
      SELECT 
        DATE(marked_at) as date,
        COUNT(*) as count
      FROM attendance
      WHERE meeting_id = ?
      GROUP BY DATE(marked_at)
      ORDER BY date DESC
    `, [meetingId]);

    res.json({ success: true, dates });
  } catch (error) {
    console.error('Get meeting dates error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get saved dates for an event
router.get('/event/:eventId/dates', authenticateToken, requirePermission('can_manage_attendance', { allowView: true }), async (req, res) => {
  try {
    const { eventId } = req.params;
    const db = getDatabase();

    const dates = await all(db, `
      SELECT 
        DATE(marked_at) as date,
        COUNT(*) as count
      FROM event_attendance
      WHERE event_id = ?
      GROUP BY DATE(marked_at)
      ORDER BY date DESC
    `, [eventId]);

    res.json({ success: true, dates });
  } catch (error) {
    console.error('Get event dates error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get meeting attendance records by date
router.get('/meeting/:meetingId/records', authenticateToken, requirePermission('can_manage_attendance', { allowView: true }), async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { date } = req.query;
    const db = getDatabase();

    let query = `
      SELECT 
        a.id,
        a.user_id,
        a.status,
        a.notes,
        a.marked_at,
        DATE(a.marked_at) as attendance_date,
        u.name as user_name,
        sp.dept as user_dept,
        sp.year as user_year
      FROM attendance a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN profiles sp ON u.id = sp.user_id
      WHERE a.meeting_id = ?
    `;
    const params = [meetingId];

    if (date) {
      query += ' AND DATE(a.marked_at) = ?';
      params.push(date);
    }

    query += ' ORDER BY a.marked_at DESC';

    const records = await all(db, query, params);
    res.json({ success: true, records });
  } catch (error) {
    console.error('Get meeting records error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get event attendance records by date
router.get('/event/:eventId/records', authenticateToken, requirePermission('can_manage_attendance', { allowView: true }), async (req, res) => {
  try {
    const { eventId } = req.params;
    const { date } = req.query;
    const db = getDatabase();

    let query = `
      SELECT 
        ea.id,
        ea.user_id,
        ea.status,
        ea.notes,
        ea.marked_at,
        DATE(ea.marked_at) as attendance_date,
        u.name as user_name,
        sp.dept as user_dept,
        sp.year as user_year
      FROM event_attendance ea
      JOIN users u ON ea.user_id = u.id
      LEFT JOIN profiles sp ON u.id = sp.user_id
      WHERE ea.event_id = ?
    `;
    const params = [eventId];

    if (date) {
      query += ' AND DATE(ea.marked_at) = ?';
      params.push(date);
    }

    query += ' ORDER BY ea.marked_at DESC';

    const records = await all(db, query, params);
    res.json({ success: true, records });
  } catch (error) {
    console.error('Get event records error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get student details with attendance history for a project
router.get('/student/:studentId/project/:projectId/details', authenticateToken, async (req, res, next) => {
  const { studentId } = req.params;
  if (parseInt(studentId) === req.user.id) return next();
  requirePermission('can_manage_attendance', { allowView: true })(req, res, next);
}, async (req, res) => {
  try {
    const { studentId, projectId } = req.params;
    const db = getDatabase();

    // Get student basic info
    const student = await get(db, `
      SELECT 
        u.id,
        u.name,
        u.email,
        sp.dept,
        sp.year,
        sp.phone,
        NULL as roll_no
      FROM users u
      LEFT JOIN profiles sp ON u.id = sp.user_id
      WHERE u.id = ?
    `, [studentId]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get attendance history
    const history = await all(db, `
      SELECT 
        id,
        attendance_date,
        status,
        notes,
        marked_at
      FROM attendance_records
      WHERE user_id = ? AND project_id = ?
      ORDER BY attendance_date DESC, marked_at DESC
    `, [studentId, projectId]);

    res.json({
      success: true,
      student: {
        ...student,
        status_history: history
      }
    });
  } catch (error) {
    console.error('Get student project details error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get student details with attendance history for a meeting
router.get('/student/:studentId/meeting/:meetingId/details', authenticateToken, async (req, res, next) => {
  const { studentId } = req.params;
  if (parseInt(studentId) === req.user.id) return next();
  requirePermission('can_manage_attendance', { allowView: true })(req, res, next);
}, async (req, res) => {
  try {
    const { studentId, meetingId } = req.params;
    const db = getDatabase();

    // Get student basic info
    const student = await get(db, `
      SELECT 
        u.id,
        u.name,
        u.email,
        sp.dept,
        sp.year,
        sp.phone,
        NULL as roll_no
      FROM users u
      LEFT JOIN profiles sp ON u.id = sp.user_id
      WHERE u.id = ?
    `, [studentId]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get attendance history
    const history = await all(db, `
      SELECT 
        id,
        DATE(marked_at) as attendance_date,
        status,
        notes,
        marked_at
      FROM attendance
      WHERE user_id = ? AND meeting_id = ?
      ORDER BY marked_at DESC
    `, [studentId, meetingId]);

    res.json({
      success: true,
      student: {
        ...student,
        status_history: history
      }
    });
  } catch (error) {
    console.error('Get student meeting details error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get student details with attendance history for an event
router.get('/student/:studentId/event/:eventId/details', authenticateToken, async (req, res, next) => {
  const { studentId } = req.params;
  if (parseInt(studentId) === req.user.id) return next();
  requirePermission('can_manage_attendance', { allowView: true })(req, res, next);
}, async (req, res) => {
  try {
    const { studentId, eventId } = req.params;
    const db = getDatabase();

    // Get student basic info
    const student = await get(db, `
      SELECT 
        u.id,
        u.name,
        u.email,
        sp.dept,
        sp.year,
        sp.phone,
        NULL as roll_no
      FROM users u
      LEFT JOIN profiles sp ON u.id = sp.user_id
      WHERE u.id = ?
    `, [studentId]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get attendance history
    const history = await all(db, `
      SELECT 
        id,
        DATE(marked_at) as attendance_date,
        status,
        notes,
        marked_at
      FROM event_attendance
      WHERE user_id = ? AND event_id = ?
      ORDER BY marked_at DESC
    `, [studentId, eventId]);

    res.json({
      success: true,
      student: {
        ...student,
        status_history: history
      }
    });
  } catch (error) {
    console.error('Get student event details error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get student details with all attendance history
router.get('/student/:studentId/details', authenticateToken, async (req, res, next) => {
  const { studentId } = req.params;
  if (parseInt(studentId) === req.user.id) return next();
  requirePermission('can_manage_attendance', { allowView: true })(req, res, next);
}, async (req, res) => {
  try {
    const { studentId } = req.params;
    const db = getDatabase();

    // Get student basic info
    const student = await get(db, `
      SELECT 
        u.id,
        u.name,
        u.email,
        sp.dept,
        sp.year,
        sp.phone,
        NULL as roll_no
      FROM users u
      LEFT JOIN profiles sp ON u.id = sp.user_id
      WHERE u.id = ?
    `, [studentId]);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Get all attendance history (projects, meetings, events)
    const projectHistory = await all(db, `
      SELECT 
        id,
        attendance_date,
        status,
        notes,
        marked_at,
        'project' as type
      FROM attendance_records
      WHERE user_id = ?
      ORDER BY attendance_date DESC, marked_at DESC
    `, [studentId]);

    const meetingHistory = await all(db, `
      SELECT 
        id,
        DATE(marked_at) as attendance_date,
        status,
        notes,
        marked_at,
        'meeting' as type
      FROM attendance
      WHERE user_id = ?
      ORDER BY marked_at DESC
    `, [studentId]);

    const eventHistory = await all(db, `
      SELECT 
        id,
        DATE(marked_at) as attendance_date,
        status,
        notes,
        marked_at,
        'event' as type
      FROM event_attendance
      WHERE user_id = ?
      ORDER BY marked_at DESC
    `, [studentId]);

    const allHistory = [...projectHistory, ...meetingHistory, ...eventHistory]
      .sort((a, b) => new Date(b.attendance_date) - new Date(a.attendance_date));

    res.json({
      success: true,
      student: {
        ...student,
        status_history: allHistory
      }
    });
  } catch (error) {
    console.error('Get student details error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get best performers across events in a date range
// Query parameters: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), limit
// Returns list of users with total_events, present_count, percent
router.get('/best-performers', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const limit = parseInt(req.query.limit || '10', 10) || 10;
    const db = getDatabase();

    const params = [];
    let dateFilter = '';
    if (startDate) {
      dateFilter += ' AND DATE(e.date) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      dateFilter += ' AND DATE(e.date) <= ?';
      params.push(endDate);
    }

    const rows = await all(db, `
      SELECT
        ea.user_id,
        u.name,
        u.email,
        COUNT(*) as total_events,
        SUM(CASE WHEN ea.status = 'present' THEN 1 ELSE 0 END) as present_count
      FROM event_attendance ea
      JOIN events e ON ea.event_id = e.id
      JOIN users u ON ea.user_id = u.id
      WHERE 1 = 1 ${dateFilter}
      GROUP BY ea.user_id
      HAVING total_events > 0
      ORDER BY (present_count * 1.0 / total_events) DESC, present_count DESC
      LIMIT ?
    `, [...params, limit]);

    const result = rows.map(r => ({
      user_id: r.user_id,
      name: r.name,
      email: r.email,
      total_events: r.total_events,
      present_count: r.present_count,
      percent: r.total_events ? Math.round((r.present_count / r.total_events) * 100) : 0
    }));

    res.json({ success: true, performers: result });
  } catch (error) {
    console.error('Get best performers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;