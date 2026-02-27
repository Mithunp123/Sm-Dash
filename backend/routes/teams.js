import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole, requirePermission } from '../middleware/auth.js';

const router = express.Router();

const all = (db, query, params = []) => new Promise((resolve, reject) => db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows)));
const run = (db, query, params = []) => new Promise((resolve, reject) => db.run(query, params, function (err) { if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes }); }));
const get = (db, query, params = []) => new Promise((resolve, reject) => db.get(query, params, (err, row) => err ? reject(err) : resolve(row)));

// Get all teams (Management)
router.get('/', authenticateToken, requirePermission('can_manage_teams', { allowView: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const teams = await all(db, `
      SELECT t.*, 
        COUNT(DISTINCT tm.user_id) as member_count,
        COUNT(DISTINCT ta.id) as assignment_count
      FROM teams t
      LEFT JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN team_assignments ta ON t.id = ta.team_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);
    res.json({ success: true, teams });
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get teams where user is a member
router.get('/my-teams', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const teams = await all(db, `
      SELECT t.*, 
        COUNT(DISTINCT tm.user_id) as member_count,
        COUNT(DISTINCT ta.id) as assignment_count
      FROM teams t
      INNER JOIN team_members tm ON t.id = tm.team_id
      LEFT JOIN team_assignments ta ON t.id = ta.team_id
      WHERE tm.user_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [userId]);
    res.json({ success: true, teams });
  } catch (error) {
    console.error('Get my teams error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get assignments assigned to user
router.get('/my-assignments', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const assignments = await all(db, `
      SELECT ta.*, 
        t.name as team_name,
        u1.name as assigned_to_name, u1.email as assigned_to_email,
        u2.name as assigned_by_name
      FROM team_assignments ta
      INNER JOIN teams t ON ta.team_id = t.id
      LEFT JOIN users u1 ON ta.assigned_to = u1.id
      LEFT JOIN users u2 ON ta.assigned_by = u2.id
      WHERE ta.assigned_to = ?
      ORDER BY ta.created_at DESC
    `, [userId]);
    res.json({ success: true, assignments });
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Request to join a team
router.post('/:id/request', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    // Check if team exists
    const team = await get(db, 'SELECT * FROM teams WHERE id = ?', [id]);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // Check if user is already a member
    const existingMember = await get(db, 'SELECT * FROM team_members WHERE team_id = ? AND user_id = ?', [id, userId]);
    if (existingMember) {
      return res.status(400).json({ success: false, message: 'You are already a member of this team' });
    }

    // Check if there's already a pending request
    const existingRequest = await get(db,
      'SELECT * FROM team_requests WHERE team_id = ? AND user_id = ? AND status = ?',
      [id, userId, 'pending']
    );
    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'You already have a pending request for this team' });
    }

    // Create the request
    const result = await run(db,
      'INSERT INTO team_requests (team_id, user_id, message, status) VALUES (?, ?, ?, ?)',
      [id, userId, message || null, 'pending']
    );

    const request = await get(db, `
      SELECT tr.*, u.name as user_name, u.email as user_email, t.name as team_name
      FROM team_requests tr
      JOIN users u ON tr.user_id = u.id
      JOIN teams t ON tr.team_id = t.id
      WHERE tr.id = ?
    `, [result.lastID]);

    res.json({
      success: true,
      message: 'Join request submitted. Admin will review your request.',
      request
    });
  } catch (error) {
    console.error('Request to join error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all team requests (management only)
router.get('/requests/all', authenticateToken, requirePermission('can_manage_teams', { allowView: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { status } = req.query;

    let query = `
      SELECT tr.*, 
        u.name as user_name, u.email as user_email,
        t.name as team_name,
        r.name as reviewer_name
      FROM team_requests tr
      JOIN users u ON tr.user_id = u.id
      JOIN teams t ON tr.team_id = t.id
      LEFT JOIN users r ON tr.reviewed_by = r.id
    `;
    const params = [];

    if (status) {
      query += ' WHERE tr.status = ?';
      params.push(status);
    }

    query += ' ORDER BY tr.created_at DESC';

    const requests = await all(db, query, params);
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Get team requests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Approve or reject team request (management only)
router.put('/requests/:id', authenticateToken, requirePermission('can_manage_teams', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be approved or rejected' });
    }

    // Get the request
    const request = await get(db, 'SELECT * FROM team_requests WHERE id = ?', [id]);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Request has already been reviewed' });
    }

    // Update request status
    await run(db,
      'UPDATE team_requests SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.user.id, id]
    );

    // If approved, add user to team
    if (status === 'approved') {
      // Check if user is already a member (just in case)
      const existingMember = await get(db,
        'SELECT * FROM team_members WHERE team_id = ? AND user_id = ?',
        [request.team_id, request.user_id]
      );

      if (!existingMember) {
        await run(db,
          'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
          [request.team_id, request.user_id, 'member']
        );
      }
    }

    const updated = await get(db, `
      SELECT tr.*, 
        u.name as user_name, u.email as user_email,
        t.name as team_name,
        r.name as reviewer_name
      FROM team_requests tr
      JOIN users u ON tr.user_id = u.id
      JOIN teams t ON tr.team_id = t.id
      LEFT JOIN users r ON tr.reviewed_by = r.id
      WHERE tr.id = ?
    `, [id]);

    res.json({ success: true, request: updated, message: `Request ${status} successfully` });
  } catch (error) {
    console.error('Update team request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get single team with members and assignments (management view)
router.get('/:id', authenticateToken, requirePermission('can_manage_teams', { allowView: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const team = await get(db, 'SELECT * FROM teams WHERE id = ?', [id]);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const members = await all(db, `
      SELECT tm.*, u.name, u.email, u.role as user_role
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
      ORDER BY tm.role DESC, u.name
    `, [id]);

    const assignments = await all(db, `
      SELECT ta.*, 
        u1.name as assigned_to_name, u1.email as assigned_to_email,
        u2.name as assigned_by_name
      FROM team_assignments ta
      LEFT JOIN users u1 ON ta.assigned_to = u1.id
      LEFT JOIN users u2 ON ta.assigned_by = u2.id
      WHERE ta.team_id = ?
      ORDER BY ta.created_at DESC
    `, [id]);

    res.json({ success: true, team, members, assignments });
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create team - only allow admin or office_bearer to create teams (students removed)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Team name is required' });
    }

    const user = req.user;
    // Only admin and office_bearer may create teams now
    if (!user || !['admin', 'office_bearer'].includes(user.role)) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const result = await run(db,
      'INSERT INTO teams (name, description, created_by) VALUES (?, ?, ?)',
      [name.trim(), description || null, req.user.id]
    );

    const team = await get(db, 'SELECT * FROM teams WHERE id = ?', [result.lastID]);

    // If a student created the team, automatically add them as the team leader
    try {
      if (user.role === 'student') {
        await run(db,
          'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
          [result.lastID, user.id, 'leader']
        );
      } else if (user.role === 'admin' || user.role === 'office_bearer') {
        // For management creators, also add as leader by default
        await run(db,
          'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
          [result.lastID, user.id, 'leader']
        );
      }
    } catch (memberErr) {
      console.warn('Failed to add creator as team leader:', memberErr);
    }

    res.json({ success: true, team });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update team (management only)
router.put('/:id', authenticateToken, requirePermission('can_manage_teams', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Team name is required' });
    }

    await run(db,
      'UPDATE teams SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name.trim(), description || null, id]
    );

    const team = await get(db, 'SELECT * FROM teams WHERE id = ?', [id]);
    res.json({ success: true, team });
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete team (management only)
router.delete('/:id', authenticateToken, requirePermission('can_manage_teams', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    await run(db, 'DELETE FROM teams WHERE id = ?', [id]);
    res.json({ success: true, message: 'Team deleted' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Add member to team (management only)
router.post('/:id/members', authenticateToken, requirePermission('can_manage_teams', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { user_id, role } = req.body;
    const requester = req.user;

    if (!user_id) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Check if team exists
    const team = await get(db, 'SELECT id FROM teams WHERE id = ?', [id]);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // Check permissions - only admin, office_bearer, or team leader can add members
    let canAdd = requester.role === 'admin' || requester.role === 'office_bearer';

    if (!canAdd) {
      const isLeader = await get(db,
        'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?',
        [id, requester.id, 'leader']
      );
      canAdd = !!isLeader;
    }

    if (!canAdd) {
      return res.status(403).json({ success: false, message: 'Permission denied. Only team leaders can add members.' });
    }

    // Check if user exists
    const user = await get(db, 'SELECT id FROM users WHERE id = ?', [user_id]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already a member
    const existing = await get(db, 'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?', [id, user_id]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'User is already a member of this team' });
    }

    await run(db,
      'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
      [id, user_id, role || 'member']
    );

    res.json({ success: true, message: 'Member added to team' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Remove member from team (management only)
router.delete('/:id/members/:userId', authenticateToken, requirePermission('can_manage_teams', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id, userId } = req.params;
    await run(db, 'DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [id, userId]);
    res.json({ success: true, message: 'Member removed from team' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create assignment (management only)
router.post('/:id/assignments', authenticateToken, requirePermission('can_manage_teams', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { title, description, assigned_to, due_date, priority } = req.body;
    const user = req.user;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Assignment title is required' });
    }

    // Check permissions - admin, office_bearer, or team leader can create assignments
    const team = await get(db, 'SELECT id FROM teams WHERE id = ?', [id]);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // If not admin or office_bearer, check if user is team leader
    if (user.role !== 'admin' && user.role !== 'office_bearer') {
      const isLeader = await get(db,
        'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?',
        [id, user.id, 'leader']
      );
      if (!isLeader) {
        return res.status(403).json({ success: false, message: 'Permission denied. Only team leaders can create assignments.' });
      }
    }

    const result = await run(db,
      'INSERT INTO team_assignments (team_id, title, description, assigned_to, assigned_by, due_date, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, title.trim(), description || null, assigned_to || null, req.user.id, due_date || null, priority || 'medium']
    );

    // Add tracking entry
    await run(db,
      'INSERT INTO team_assignment_tracking (assignment_id, user_id, action) VALUES (?, ?, ?)',
      [result.lastID, req.user.id, 'created']
    );

    const assignment = await get(db, `
      SELECT ta.*, 
        u1.name as assigned_to_name, u1.email as assigned_to_email,
        u2.name as assigned_by_name
      FROM team_assignments ta
      LEFT JOIN users u1 ON ta.assigned_to = u1.id
      LEFT JOIN users u2 ON ta.assigned_by = u2.id
      WHERE ta.id = ?
    `, [result.lastID]);

    res.json({ success: true, assignment });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update assignment
router.put('/:id/assignments/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { id, assignmentId } = req.params;
    const { title, description, assigned_to, due_date, priority, status } = req.body;
    const user = req.user;

    const assignment = await get(db, 'SELECT * FROM team_assignments WHERE id = ?', [assignmentId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Check permissions - only admin, office_bearer, team leader of that team, or assigned user can update
    let canUpdate = user.role === 'admin' || user.role === 'office_bearer' || assignment.assigned_to === user.id;

    if (!canUpdate && user.role !== 'admin' && user.role !== 'office_bearer') {
      const isLeader = await get(db,
        'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?',
        [id, user.id, 'leader']
      );
      canUpdate = !!isLeader;
    }

    if (!canUpdate) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      params.push(assigned_to);
    }
    if (due_date !== undefined) {
      updates.push('due_date = ?');
      params.push(due_date);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
      if (status === 'completed') {
        updates.push('completed_at = CURRENT_TIMESTAMP');
      }
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(assignmentId);

    await run(db, `UPDATE team_assignments SET ${updates.join(', ')} WHERE id = ?`, params);

    // Add tracking entry
    let action = 'updated';
    if (status === 'in_progress') action = 'started';
    else if (status === 'completed') action = 'completed';
    else if (status === 'cancelled') action = 'cancelled';

    await run(db,
      'INSERT INTO team_assignment_tracking (assignment_id, user_id, action, comment) VALUES (?, ?, ?, ?)',
      [assignmentId, user.id, action, req.body.comment || null]
    );

    const updated = await get(db, `
      SELECT ta.*, 
        u1.name as assigned_to_name, u1.email as assigned_to_email,
        u2.name as assigned_by_name
      FROM team_assignments ta
      LEFT JOIN users u1 ON ta.assigned_to = u1.id
      LEFT JOIN users u2 ON ta.assigned_by = u2.id
      WHERE ta.id = ?
    `, [assignmentId]);

    res.json({ success: true, assignment: updated });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Complete assignment with proof upload
const proofUploadDir = path.join(process.cwd(), 'public', 'uploads', 'proofs');
if (!fs.existsSync(proofUploadDir)) {
  fs.mkdirSync(proofUploadDir, { recursive: true });
}

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, proofUploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `proof-${unique}${path.extname(file.originalname)}`);
  }
});

const proofFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPG/PNG) and PDF files are allowed'));
  }
};

const proofUpload = multer({
  storage: proofStorage,
  fileFilter: proofFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

router.post('/:id/assignments/:assignmentId/complete', authenticateToken, proofUpload.single('proof'), async (req, res) => {
  try {
    const db = getDatabase();
    const { assignmentId } = req.params;
    const user = req.user;

    const assignment = await get(db, 'SELECT * FROM team_assignments WHERE id = ?', [assignmentId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Check permissions - only assigned user can complete
    if (assignment.assigned_to !== user.id && user.role !== 'admin' && user.role !== 'office_bearer') {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Proof file is required' });
    }

    const proofPath = `/uploads/proofs/${req.file.filename}`;

    // Update assignment with proof and mark as completed
    await run(db, `
      UPDATE team_assignments 
      SET status = 'completed', 
          proof_file_path = ?,
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [proofPath, assignmentId]);

    // Add tracking entry
    await run(db,
      'INSERT INTO team_assignment_tracking (assignment_id, user_id, action, comment) VALUES (?, ?, ?, ?)',
      [assignmentId, user.id, 'completed', 'Completed with proof upload']
    );

    const updated = await get(db, `
      SELECT ta.*, 
        u1.name as assigned_to_name, u1.email as assigned_to_email,
        u2.name as assigned_by_name
      FROM team_assignments ta
      LEFT JOIN users u1 ON ta.assigned_to = u1.id
      LEFT JOIN users u2 ON ta.assigned_by = u2.id
      WHERE ta.id = ?
    `, [assignmentId]);

    res.json({ success: true, assignment: updated });
  } catch (error) {
    console.error('Complete assignment error:', error);
    // Clean up uploaded file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, (err) => { if (err) console.error('Error deleting proof file:', err); });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get assignment tracking
router.get('/:id/assignments/:assignmentId/tracking', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    const { assignmentId } = req.params;
    const tracking = await all(db, `
      SELECT tat.*, u.name as user_name, u.email as user_email
      FROM team_assignment_tracking tat
      JOIN users u ON tat.user_id = u.id
      WHERE tat.assignment_id = ?
      ORDER BY tat.created_at DESC
    `, [assignmentId]);
    res.json({ success: true, tracking });
  } catch (error) {
    console.error('Get tracking error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete assignment (management only)
router.delete('/:id/assignments/:assignmentId', authenticateToken, requirePermission('can_manage_teams', { requireEdit: true }), async (req, res) => {
  try {
    const db = getDatabase();
    const { id, assignmentId } = req.params;
    const user = req.user;

    const assignment = await get(db, 'SELECT * FROM team_assignments WHERE id = ?', [assignmentId]);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    // Check permissions - only admin, office_bearer, or team leader can delete
    let canDelete = user.role === 'admin' || user.role === 'office_bearer';

    if (!canDelete) {
      const isLeader = await get(db,
        'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = ?',
        [id, user.id, 'leader']
      );
      canDelete = !!isLeader;
    }

    if (!canDelete) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    await run(db, 'DELETE FROM team_assignments WHERE id = ?', [assignmentId]);
    res.json({ success: true, message: 'Assignment deleted' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

