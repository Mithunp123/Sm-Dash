import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';


const router = express.Router();

// Configure multer for event image uploads
const eventImagesDir = path.join(process.cwd(), 'public', 'uploads', 'events');
if (!fs.existsSync(eventImagesDir)) {
  fs.mkdirSync(eventImagesDir, { recursive: true });
}

const eventImageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, eventImagesDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `event-${unique}${path.extname(file.originalname)}`);
  }
});

const eventImageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'));
  }
};

const eventImageUpload = multer({
  storage: eventImageStorage,
  fileFilter: eventImageFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// GET all events - PUBLIC endpoint (no authentication required)
router.get('/public', async (req, res) => {
  try {
    const db = getDatabase();
    const { year, month } = req.query; // Optional filter by year and month

    let query = 'SELECT * FROM events ORDER BY date DESC';
    let params = [];

    if (year && month) {
      // SQLite: extract month with strftime('%m', date) which returns '01'..'12'
      const monthPadded = String(month).padStart(2, '0');
      query = 'SELECT * FROM events WHERE year = ? AND strftime("%m", date) = ? ORDER BY date DESC';
      params = [year, monthPadded];
    } else if (year) {
      query = 'SELECT * FROM events WHERE year = ? ORDER BY date DESC';
      params = [year];
    } else if (month) {
      const monthPadded = String(month).padStart(2, '0');
      query = 'SELECT * FROM events WHERE strftime("%m", date) = ? ORDER BY date DESC';
      params = [monthPadded];
    }

    db.all(query, params, (err, events) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      }
      res.json({ success: true, events: events || [] });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching events', error: error.message });
  }
});

// ==== SPECIAL DAYS ENDPOINTS (move to top to avoid /:id routing collisions) ====
router.get('/special-days', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    db.all('SELECT * FROM special_days ORDER BY date ASC', [], (err, rows) => {
      if (err) return res.status(500).json({ success: false, message: 'Failed to fetch special days', error: err.message });
      res.json({ success: true, specialDays: rows || [] });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching special days', error: error.message });
  }
});

router.post('/special-days', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { title, date, description } = req.body;
    if (!date) return res.status(400).json({ success: false, message: 'date is required' });
    const safeTitle = (title || 'Special Day').trim() || 'Special Day';
    db.run(
      'INSERT INTO special_days (title, date, description, created_by) VALUES (?, ?, ?, ?)',
      [safeTitle, date, description || null, req.user.id],
      function (err) {
        if (err) return res.status(500).json({ success: false, message: 'Failed to create special day', error: err.message });
        res.json({ success: true, id: this.lastID, message: 'Special day added successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating special day', error: error.message });
  }
});

router.delete('/special-days/:id', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    db.run('DELETE FROM special_days WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Failed to delete special day', error: err.message });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'Special day not found' });
      res.json({ success: true, message: 'Special day deleted successfully' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting special day', error: error.message });
  }
});

// GET all events with OD status for a student (if provided)
router.get('/', authenticateToken, requirePermission('can_manage_events', { allowView: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { year, month } = req.query; // Optional filter by year and month
    const userRole = req.user.role;
    const userId = req.user.id;

    // SPOC: Get assigned event IDs
    let spocEventFilter = '';
    let spocEventIds = [];

    if (userRole === 'spoc') {
      const assignments = await new Promise((resolve, reject) => {
        db.all(
          'SELECT event_id FROM spoc_event_assignments WHERE spoc_id = ?',
          [userId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows.map(r => r.event_id));
          }
        );
      });

      if (assignments.length === 0) {
        return res.json({ success: true, events: [] });
      }

      spocEventIds = assignments;
      const placeholders = spocEventIds.map(() => '?').join(',');
      spocEventFilter = `AND e.id IN (${placeholders})`;
    }

    let query;
    let params = [];

    if (year && month) {
      // SQLite: extract month with strftime('%m', date) which returns '01'..'12'
      const monthPadded = String(month).padStart(2, '0');
      query = `
        SELECT e.*, 
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'od') as od_count,
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'absent') as absent_count,
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'permission') as permission_count
        FROM events e 
        WHERE e.year = ? AND strftime("%m", e.date) = ? ${spocEventFilter}
        ORDER BY e.date DESC
      `;
      params = [year, monthPadded, ...spocEventIds];
    } else if (year) {
      query = `
        SELECT e.*, 
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'od') as od_count,
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'absent') as absent_count,
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'permission') as permission_count
        FROM events e 
        WHERE e.year = ? ${spocEventFilter}
        ORDER BY e.date DESC
      `;
      params = [year, ...spocEventIds];
    } else if (month) {
      const monthPadded = String(month).padStart(2, '0');
      query = `
        SELECT e.*, 
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'od') as od_count,
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'absent') as absent_count,
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'permission') as permission_count
        FROM events e 
        WHERE strftime("%m", e.date) = ? ${spocEventFilter}
        ORDER BY e.date DESC
      `;
      params = [monthPadded, ...spocEventIds];
    } else {
      // Default query if no filters
      query = `
        SELECT e.*, 
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'od') as od_count,
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'absent') as absent_count,
        (SELECT COUNT(*) FROM event_od WHERE event_id = e.id AND status = 'permission') as permission_count
        FROM events e 
        WHERE 1=1 ${spocEventFilter}
        ORDER BY e.date DESC
      `;
      params = spocEventIds;
    }

    db.all(query, params, (err, events) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      }

      // If user is student, get their OD status for each event
      if (req.user.role === 'student') {
        db.all(
          'SELECT event_id, status FROM event_od WHERE user_id = ?',
          [req.user.id],
          (err, odRecords) => {
            if (err) {
              return res.status(500).json({ success: false, message: 'Database error', error: err.message });
            }

            const odMap = {};
            odRecords.forEach(record => {
              odMap[record.event_id] = record.status;
            });

            events.forEach(e => {
              e.student_status = odMap[e.id] || null;
            });

            res.json({ success: true, events });
          }
        );
      } else {
        res.json({ success: true, events });
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching events', error: error.message });
  }
});

// GET events for a user (by membership)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { userId } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Allow user to see their own events, admin can see anyone's
    if (requesterRole !== 'admin' && requesterId !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    db.all(`
      SELECT e.* FROM events e
      JOIN event_members em ON em.event_id = e.id
      WHERE em.user_id = ?
      ORDER BY e.date DESC
    `, [userId], (err, events) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Server error', error: err.message });
      }
      res.json({ success: true, events: events || [] });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET OD history for a student (student can see their own, admin can see any)
// MUST come before generic /:id route
router.get('/student-od/:userId', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { userId } = req.params;
    const requesterId = req.user.id;
    const requesterRole = req.user.role;

    // Allow student to see their own OD, admin can see anyone's
    if (requesterRole !== 'admin' && requesterId !== parseInt(userId)) {
      return res.status(403).json({ success: false, message: 'Cannot view other student OD history' });
    }

    db.all(
      `SELECT e.id as event_id, e.title, e.date, eo.status
       FROM event_od eo
       JOIN events e ON eo.event_id = e.id
       WHERE eo.user_id = ?
       ORDER BY e.date DESC`,
      [userId],
      (err, records) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        }

        // Calculate counts
        const odCount = records.filter(r => r.status === 'od').length;
        const absentCount = records.filter(r => r.status === 'absent').length;
        const permissionCount = records.filter(r => r.status === 'permission').length;

        res.json({
          success: true,
          odCount,
          absentCount,
          permissionCount,
          totalMarked: records.length,
          records
        });
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching OD history', error: error.message });
  }
});

// Event members management (admin only) - MUST come before generic /:id route
router.get('/:id/members', authenticateToken, requirePermission('can_manage_events', { allowView: true }), (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    db.all(
      `SELECT em.user_id, u.name as user_name, u.email as user_email, p.dept as department, p.year, p.photo_url, em.joined_at, 'assigned' as source
       FROM event_members em
       JOIN users u ON em.user_id = u.id
       LEFT JOIN profiles p ON u.id = p.user_id
       WHERE em.event_id = ?
       ORDER BY user_name`,
      [id],
      (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
        res.json({ success: true, members: rows });
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching members', error: error.message });
  }
});

router.post('/:id/members', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'userIds array required' });
    }
    const placeholders = userIds.map(() => '(?, ?)').join(',');
    const params = [];
    userIds.forEach((uid) => { params.push(id, uid); });
    const sql = `INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES ${placeholders}`;
    db.run(sql, params, function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      res.json({ success: true, added: this.changes });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding members', error: error.message });
  }
});

router.post('/:id/members/by-email', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { emails } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, message: 'emails array required' });
    }

    const normalized = emails
      .filter(email => typeof email === 'string' && email.trim() !== '')
      .map(email => email.trim().toLowerCase());

    if (normalized.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid emails provided' });
    }

    const placeholders = normalized.map(() => '?').join(',');
    db.all(`SELECT id, email FROM users WHERE lower(email) IN (${placeholders})`, normalized, (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      }

      if (!rows || rows.length === 0) {
        return res.status(404).json({ success: false, message: 'No matching users found for provided emails' });
      }

      const userIds = rows.map(row => row.id);
      const insertPlaceholders = userIds.map(() => '(?, ?)').join(',');
      const params = [];
      userIds.forEach((uid) => { params.push(id, uid); });
      const sql = `INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES ${insertPlaceholders}`;
      db.run(sql, params, function (insertErr) {
        if (insertErr) {
          return res.status(500).json({ success: false, message: 'Database error', error: insertErr.message });
        }
        const addedEmails = rows.map(row => row.email);
        const missingEmails = normalized.filter(email => !addedEmails.includes(email));
        res.json({
          success: true,
          added: this.changes,
          matchedEmails: addedEmails,
          missingEmails
        });
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding members by email', error: error.message });
  }
});

router.delete('/:id/members/:userId', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), (req, res) => {
  try {
    const db = getDatabase();
    const { id, userId } = req.params;
    db.run('DELETE FROM event_members WHERE event_id = ? AND user_id = ?', [id, userId], function (err) {
      if (err) return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'Member not found' });
      res.json({ success: true, message: 'Member removed' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error removing member', error: error.message });
  }
});

// MARK OD for a student - requires edit permission
// MUST come before generic /:id route
router.post('/:eventId/od', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), (req, res) => {
  try {
    const db = getDatabase();
    const { eventId } = req.params;
    const { userId, status } = req.body; // status: 'od' or 'absent' or 'permission'

    if (!userId || !status || !['od', 'absent', 'permission'].includes(status)) {
      return res.status(400).json({ success: false, message: "userId and status (od/absent/permission) are required" });
    }

    // Check if record exists
    db.get('SELECT id FROM event_od WHERE event_id = ? AND user_id = ?', [eventId, userId], (err, existing) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      }

      if (existing) {
        // Update existing record
        db.run(
          'UPDATE event_od SET status = ? WHERE event_id = ? AND user_id = ?',
          [status, eventId, userId],
          async function (err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to update OD', error: err.message });
            }
            await logActivity(req.user.id, 'MARK_OD', { eventId, userId, status }, req, {
              action_type: 'UPDATE',
              module_name: 'events',
              action_description: `Updated OD status for user ${userId} to ${status}`,
              reference_id: eventId
            });
            res.json({ success: true, message: 'OD status updated successfully' });
          }
        );
      } else {
        // Insert new record
        db.run(
          'INSERT INTO event_od (event_id, user_id, status) VALUES (?, ?, ?)',
          [eventId, userId, status],
          async function (err) {
            if (err) {
              return res.status(500).json({ success: false, message: 'Failed to mark OD', error: err.message });
            }
            await logActivity(req.user.id, 'MARK_OD', { eventId, userId, status }, req, {
              action_type: 'CREATE',
              module_name: 'events',
              action_description: `Marked OD status for user ${userId} as ${status}`,
              reference_id: eventId
            });
            res.json({ success: true, message: 'OD marked successfully' });
          }
        );
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error marking OD', error: error.message });
  }
});

// REMOVE OD record - requires edit permission
// MUST come before generic /:id route
router.delete('/:eventId/od/:userId', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), (req, res) => {
  try {
    const db = getDatabase();
    const { eventId, userId } = req.params;

    db.run('DELETE FROM event_od WHERE event_id = ? AND user_id = ?', [eventId, userId], function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to remove OD', error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'OD record not found' });
      }
      res.json({ success: true, message: 'OD record removed successfully' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error removing OD', error: error.message });
  }
});

// ============================================
// STUDENT EVENT REGISTRATION ENDPOINTS
// MUST come BEFORE /:id route to avoid route conflicts
// ============================================

// GET - Get student's registered events
router.get('/my-registrations', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    const registrations = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          er.id as registration_id,
          er.registration_type,
          er.status,
          er.registered_at,
          er.notes,
          e.id as event_id,
          e.title,
          e.description,
          e.date,
          e.year,
          e.image_url
        FROM event_registrations er
        JOIN events e ON er.event_id = e.id
        WHERE er.user_id = ?
        ORDER BY e.date DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json({ success: true, registrations });
  } catch (error) {
    console.error('Get my registrations error:', error);
    res.status(500).json({ success: false, message: 'Error fetching registrations', error: error.message });
  }
});

// GET - Get all active events for students (with registration status)
router.get('/active', authenticateToken, requireRole('student'), async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    // Get all events with registration status
    const events = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          e.*,
          (SELECT COUNT(*) FROM event_volunteers WHERE event_id = e.id) +
          (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) as current_volunteers,
          er.id as registration_id,
          er.registration_type,
          er.status as registration_status,
          er.registered_at
        FROM events e
        LEFT JOIN event_registrations er ON e.id = er.event_id AND er.user_id = ?
        WHERE e.date >= date('now')
        ORDER BY e.date ASC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json({ success: true, events });
  } catch (error) {
    console.error('Get active events error:', error);
    res.status(500).json({ success: false, message: 'Error fetching events', error: error.message });
  }
});

// GET single event with OD details - GENERIC ROUTE (comes after specific routes)
router.get('/:id', authenticateToken, requirePermission('can_manage_events', { allowView: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // safety guard to avoid treating special route as event id
    if (id === 'special-days' || id === 'my-registrations' || id === 'active') {
      return res.status(404).json({ success: false, message: 'Invalid event ID' });
    }

    db.get('SELECT * FROM events WHERE id = ?', [id], (err, event) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Database error', error: err.message });
      }
      if (!event) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }

      // Get OD records for this event
      db.all(
        `SELECT e.id as event_od_id, e.user_id, e.status, u.name, u.email
         FROM event_od e
         JOIN users u ON e.user_id = u.id
         WHERE e.event_id = ?
         ORDER BY u.name`,
        [id],
        (err, odRecords) => {
          if (err) {
            return res.status(500).json({ success: false, message: 'Database error', error: err.message });
          }
          res.json({ success: true, event, odRecords });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching event', error: error.message });
  }
});

// Update event title only (used from finance settings)
router.put('/:id/title', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    db.run(
      'UPDATE events SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, id],
      async function (err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Failed to update event title', error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ success: false, message: 'Event not found' });
        }
        await logActivity(req.user.id, 'UPDATE_EVENT_TITLE', { id, title }, req, {
          action_type: 'UPDATE',
          module_name: 'events',
          action_description: `Updated event title to: ${title}`,
          reference_id: id
        });
        res.json({ success: true, message: 'Event name updated successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating event title', error: error.message });
  }
});


router.post('/', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), eventImageUpload.single('image'), (req, res) => {
  try {
    const db = getDatabase();
    const { title, description, date, year, is_special_day, image_url, max_volunteers, volunteer_registration_deadline, finance_enabled } = req.body;

    console.log('📸 Event creation - File uploaded:', !!req.file, 'Image URL provided:', !!image_url);
    if (req.file) {
      console.log('📸 Uploaded file:', req.file.filename, 'Size:', req.file.size);
    }

    if (!title || !date || !year) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting file:', err); });
      }
      return res.status(400).json({ success: false, message: 'Title, date, and year are required' });
    }

    // If image was uploaded, use the uploaded file path, otherwise use provided image_url
    let finalImageUrl = null;
    if (req.file) {
      // Priority: Use uploaded file
      finalImageUrl = `/uploads/events/${req.file.filename}`;
      console.log('✅ Using uploaded file:', finalImageUrl);
    } else if (image_url && image_url.trim() !== '' && !image_url.startsWith('data:')) {
      // Only use image_url if it's not a base64 data URL (i.e., it's an existing URL)
      finalImageUrl = image_url;
      console.log('✅ Using provided image_url:', finalImageUrl);
    } else {
      console.log('ℹ️ No image provided');
    }

    db.run(
      `INSERT INTO events (title, description, date, year, is_special_day, image_url, max_volunteers, volunteer_registration_deadline, finance_enabled, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [title, description || null, date, year, is_special_day ? 1 : 0, finalImageUrl, max_volunteers || null, volunteer_registration_deadline || null, finance_enabled ? 1 : 0, req.user.id],
      async function (err) {
        if (err) {
          // Clean up uploaded file on error
          if (req.file) {
            fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting file:', err); });
          }
          return res.status(500).json({ success: false, message: 'Failed to create event', error: err.message });
        }
        await logActivity(req.user.id, 'CREATE_EVENT', { title, date, finance_enabled }, req, {
          action_type: 'CREATE',
          module_name: 'events',
          action_description: `Created event: ${title}${finance_enabled ? ' (Finance enabled)' : ''}`,
          reference_id: this.lastID
        });
        res.json({ success: true, id: this.lastID, message: 'Event created successfully' });
      }
    );
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting file:', err); });
    }
    res.status(500).json({ success: false, message: 'Error creating event', error: error.message });
  }
});

// UPDATE event
router.put('/:id', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), eventImageUpload.single('image'), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { title, description, date, year, is_special_day, image_url, max_volunteers, volunteer_registration_deadline, finance_enabled } = req.body;

    // Get existing event to delete old image if new one is uploaded
    const existingEvent = await new Promise((resolve, reject) => {
      db.get('SELECT image_url FROM events WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // If new image uploaded, use it; otherwise keep existing or use provided image_url
    let finalImageUrl = image_url;
    if (req.file) {
      // Delete old image if exists
      if (existingEvent && existingEvent.image_url) {
        const oldPath = path.join(process.cwd(), 'public', existingEvent.image_url);
        fs.unlink(oldPath, (err) => { if (err && err.code !== 'ENOENT') console.error('Error deleting old image:', err); });
      }
      finalImageUrl = `/uploads/events/${req.file.filename}`;
    } else if ((!image_url || image_url === '') && existingEvent) {
      // Keep existing image if no new image and no image_url provided (or empty string)
      finalImageUrl = existingEvent.image_url || '';
    } else if (image_url) {
      // Use provided image_url (could be empty string to remove image)
      finalImageUrl = image_url;
    }

    db.run(
      `UPDATE events SET title = ?, description = ?, date = ?, year = ?, is_special_day = ?, image_url = ?, max_volunteers = ?, volunteer_registration_deadline = ?, finance_enabled = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [title, description, date, year, is_special_day ? 1 : 0, finalImageUrl, max_volunteers || null, volunteer_registration_deadline || null, finance_enabled ? 1 : 0, id],
      async function (err) {
        if (err) {
          // Clean up uploaded file on error
          if (req.file) {
            fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting file:', err); });
          }
          return res.status(500).json({ success: false, message: 'Failed to update event', error: err.message });
        }
        if (this.changes === 0) {
          // Clean up uploaded file if event not found
          if (req.file) {
            fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting file:', err); });
          }
          return res.status(404).json({ success: false, message: 'Event not found' });
        }
        await logActivity(req.user.id, 'UPDATE_EVENT', { id, title, finance_enabled }, req, {
          action_type: 'UPDATE',
          module_name: 'events',
          action_description: `Updated event: ${title}${finance_enabled ? ' (Finance enabled)' : ''}`,
          reference_id: id
        });
        res.json({ success: true, message: 'Event updated successfully' });
      }
    );
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting file:', err); });
    }
    res.status(500).json({ success: false, message: 'Error updating event', error: error.message });
  }
});

// DELETE event
router.delete('/:id', authenticateToken, requirePermission('can_manage_events', { requireEdit: true }), (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    db.run('DELETE FROM events WHERE id = ?', [id], async function (err) {
      if (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete event', error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, message: 'Event not found' });
      }
      // Also delete OD records for this event
      db.run('DELETE FROM event_od WHERE event_id = ?', [id], (err) => {
        if (err) {
          console.error('Error deleting OD records:', err);
        }
      });
      await logActivity(req.user.id, 'DELETE_EVENT', { id }, req, {
        action_type: 'DELETE',
        module_name: 'events',
        action_description: `Deleted event ID: ${id}`,
        reference_id: id
      });
      res.json({ success: true, message: 'Event deleted successfully' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting event', error: error.message });
  }
});

// POST - Register as volunteer for an event (public endpoint, no auth required)
router.post('/:id/volunteers', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, department, year, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone number are required' });
    }

    // Validate event exists and get event details
    const event = await new Promise((resolve, reject) => {
      db.get('SELECT id, max_volunteers, volunteer_registration_deadline FROM events WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Check if registration deadline has passed
    if (event.volunteer_registration_deadline) {
      const deadline = new Date(event.volunteer_registration_deadline);
      const now = new Date();
      if (now > deadline) {
        return res.status(400).json({
          success: false,
          message: 'Volunteer registration deadline has passed. Registration is closed.',
          deadlinePassed: true
        });
      }
    }

    // Check if volunteer count limit reached
    if (event.max_volunteers) {
      const currentCount = await new Promise((resolve, reject) => {
        // Count both external volunteers and internal registrations
        db.get(`
          SELECT 
            (SELECT COUNT(*) FROM event_volunteers WHERE event_id = ?) +
            (SELECT COUNT(*) FROM event_registrations WHERE event_id = ?) as count
        `, [id, id], (err, row) => {
          if (err) reject(err);
          else resolve(row?.count || 0);
        });
      });

      if (currentCount >= event.max_volunteers) {
        return res.status(400).json({
          success: false,
          message: `Volunteer registration is full. Maximum ${event.max_volunteers} volunteers allowed.`,
          limitReached: true,
          currentCount,
          maxVolunteers: event.max_volunteers
        });
      }
    }

    // Check if volunteer already registered for this event (by phone number)
    const normalizedPhone = phone.trim().replace(/[^0-9]/g, '');
    const existingVolunteer = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, name, phone FROM event_volunteers WHERE event_id = ? AND phone = ?',
        [id, normalizedPhone],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingVolunteer) {
      return res.status(400).json({
        success: false,
        message: 'You have already registered for this event. Each person can register only once per event.',
        alreadyRegistered: true
      });
    }

    // Insert volunteer registration
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO event_volunteers (event_id, name, department, year, phone) VALUES (?, ?, ?, ?, ?)',
        [id, name.trim(), department?.trim() || null, year?.trim() || null, normalizedPhone],
        function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        }
      );
    });

    res.json({
      success: true,
      message: 'Volunteer registration submitted successfully',
      volunteerId: result.lastID
    });
  } catch (error) {
    console.error('Event volunteer registration error:', error);
    res.status(500).json({ success: false, message: 'Error registering volunteer', error: error.message });
  }
});

// GET - Get all volunteers registered for an event (admin and office bearer)
router.get('/:id/volunteers', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Validate event exists
    const event = await new Promise((resolve, reject) => {
      db.get('SELECT id, title FROM events WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Get all volunteers for this event (both external and internal)
    const volunteers = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, name, department, year, phone, created_at, 'external' as source, NULL as photo_url, NULL as notes FROM event_volunteers WHERE event_id = ?
         UNION
         SELECT er.id, u.name, p.dept as department, p.year, p.phone, er.registered_at as created_at, 'internal' as source, p.photo_url, er.notes
         FROM event_registrations er
         JOIN users u ON er.user_id = u.id
         LEFT JOIN profiles p ON u.id = p.user_id
         WHERE er.event_id = ? AND er.registration_type = 'volunteer'
         ORDER BY created_at DESC`,
        [id, id],
        (err, rows) => {
          if (err) reject(err);
          else {
            // Post-process internal volunteers to use notes data if profile data is missing
            const processedRows = (rows || []).map(row => {
              if (row.source === 'internal' && row.notes) {
                try {
                  const notesData = JSON.parse(row.notes);
                  // Use values from notes if profile fields are empty/null
                  return {
                    ...row,
                    name: row.name || notesData.name,
                    department: row.department || notesData.department || notesData.dept,
                    year: row.year || notesData.year,
                    phone: row.phone || notesData.phone,
                    regNo: notesData.regNo // Additional info from notes
                  };
                } catch (e) {
                  return row;
                }
              }
              return row;
            });
            resolve(processedRows);
          }
        }
      );
    });

    res.json({
      success: true,
      event: { id: event.id, title: event.title },
      volunteers: volunteers,
      count: volunteers.length
    });
  } catch (error) {
    console.error('Get event volunteers error:', error);
    res.status(500).json({ success: false, message: 'Error fetching volunteers', error: error.message });
  }
});

// PUT - Update a volunteer registration (admin and office bearer)
router.put('/:eventId/volunteers/:volunteerId', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
  try {
    const db = getDatabase();
    const { eventId, volunteerId } = req.params;
    const { name, department, year, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone number are required' });
    }

    // Check if volunteer exists
    const volunteer = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM event_volunteers WHERE id = ? AND event_id = ?', [volunteerId, eventId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!volunteer) {
      return res.status(404).json({ success: false, message: 'Volunteer not found' });
    }

    // Check if phone number is already used by another volunteer for this event
    const normalizedPhone = phone.trim().replace(/[^0-9]/g, '');
    const existingVolunteer = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM event_volunteers WHERE event_id = ? AND phone = ? AND id != ?',
        [eventId, normalizedPhone, volunteerId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existingVolunteer) {
      return res.status(400).json({
        success: false,
        message: 'Another volunteer with this phone number already exists for this event'
      });
    }

    // Update volunteer
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE event_volunteers SET name = ?, department = ?, year = ?, phone = ? WHERE id = ? AND event_id = ?',
        [name.trim(), department?.trim() || null, year?.trim() || null, normalizedPhone, volunteerId, eventId],
        function (err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    res.json({
      success: true,
      message: 'Volunteer updated successfully'
    });
  } catch (error) {
    console.error('Update volunteer error:', error);
    res.status(500).json({ success: false, message: 'Error updating volunteer', error: error.message });
  }
});

// DELETE - Delete a volunteer registration (admin and office bearer)
router.delete('/:eventId/volunteers/:volunteerId', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
  try {
    const db = getDatabase();
    const { eventId, volunteerId } = req.params;

    // Check if volunteer exists
    const volunteer = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM event_volunteers WHERE id = ? AND event_id = ?', [volunteerId, eventId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!volunteer) {
      return res.status(404).json({ success: false, message: 'Volunteer not found' });
    }

    // Delete volunteer
    const result = await new Promise((resolve, reject) => {
      db.run('DELETE FROM event_volunteers WHERE id = ? AND event_id = ?', [volunteerId, eventId], function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });

    res.json({
      success: true,
      message: 'Volunteer deleted successfully'
    });
  } catch (error) {
    console.error('Delete volunteer error:', error);
    res.status(500).json({ success: false, message: 'Error deleting volunteer', error: error.message });
  }
});

// ============================================
// STUDENT EVENT REGISTRATION ENDPOINTS
// ============================================

// POST - Student/OB registers for an event
router.post('/:id/register', authenticateToken, requireRole('student', 'office_bearer'), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userId = req.user.id;
    const { registration_type = 'volunteer', notes } = req.body;

    // Validate event exists and is active
    const event = await new Promise((resolve, reject) => {
      db.get('SELECT id, title, date, max_volunteers, volunteer_registration_deadline FROM events WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Check if registration deadline has passed
    if (event.volunteer_registration_deadline) {
      const deadline = new Date(event.volunteer_registration_deadline);
      const now = new Date();
      if (now > deadline) {
        return res.status(400).json({
          success: false,
          message: 'Volunteer registration deadline has passed. Registration is closed.',
          deadlinePassed: true
        });
      }
    }

    // Check if volunteer count limit reached
    if (event.max_volunteers) {
      const currentCount = await new Promise((resolve, reject) => {
        // Count both external volunteers and internal registrations
        db.get(`
          SELECT 
            (SELECT COUNT(*) FROM event_volunteers WHERE event_id = ?) +
            (SELECT COUNT(*) FROM event_registrations WHERE event_id = ?) as count
        `, [id, id], (err, row) => {
          if (err) reject(err);
          else resolve(row?.count || 0);
        });
      });

      if (currentCount >= event.max_volunteers) {
        return res.status(400).json({
          success: false,
          message: `Registration is full. Maximum ${event.max_volunteers} volunteers allowed.`,
          limitReached: true,
          currentCount,
          maxVolunteers: event.max_volunteers
        });
      }
    }

    // Check if already registered
    const existing = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM event_registrations WHERE event_id = ? AND user_id = ?',
        [id, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already registered for this event'
      });
    }

    // Create registration
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO event_registrations (event_id, user_id, registration_type, notes) VALUES (?, ?, ?, ?)',
        [id, userId, registration_type, notes || null],
        function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        }
      );
    });

    res.json({
      success: true,
      message: 'Successfully registered for event',
      registrationId: result.lastID
    });
  } catch (error) {
    console.error('Event registration error:', error);
    res.status(500).json({ success: false, message: 'Error registering for event', error: error.message });
  }
});

// GET - Get event registrations (Admin, Office Bearer, or assigned SPOC)
router.get('/:id/registrations', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;

    // Validate event exists
    const event = await new Promise((resolve, reject) => {
      db.get('SELECT id, title FROM events WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // SPOC: Check if assigned to this event
    if (userRole === 'spoc') {
      const isAssigned = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM spoc_event_assignments WHERE event_id = ? AND spoc_id = ?',
          [id, userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(!!row);
          }
        );
      });

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not assigned to this event'
        });
      }
    } else if (userRole !== 'admin' && userRole !== 'office_bearer') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Insufficient permissions'
      });
    }

    // Get registrations with student details
    const registrations = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          er.id,
          er.registration_type,
          er.status,
          er.registered_at,
          er.notes,
          u.id as user_id,
          u.name,
          u.email,
          p.dept as department,
          p.year,
          p.phone,
          p.photo_url
        FROM event_registrations er
        JOIN users u ON er.user_id = u.id
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE er.event_id = ?
        ORDER BY er.registered_at DESC`,
        [id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.json({
      success: true,
      event: { id: event.id, title: event.title },
      registrations,
      count: registrations.length
    });
  } catch (error) {
    console.error('Get event registrations error:', error);
    res.status(500).json({ success: false, message: 'Error fetching registrations', error: error.message });
  }
});

export default router;
