import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import { sendEmail, getInterviewEmailTemplate, getInterviewOutcomeTemplate, getInterviewAssignmentTemplate } from '../utils/email.js';

const router = express.Router();

// Multer setup for Excel files (in-memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'text/csv' ||
            file.mimetype === 'application/vnd.ms-excel'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only .xlsx and .csv files are allowed!'), false);
        }
    }
});

// Helper function to run DB queries with Promise wrapper
const run = (db, query, params = []) => {
    if (process.env.DB_TYPE === 'mysql') {
        return db.run(query, params);
    }
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

const get = (db, query, params = []) => {
    if (process.env.DB_TYPE === 'mysql') {
        return db.get(query, params);
    }
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const all = (db, query, params = []) => {
    if (process.env.DB_TYPE === 'mysql') {
        return db.all(query, params);
    }
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const applyTemplateVars = (text, vars) => {
    if (text === undefined || text === null) return '';
    let out = String(text);
    // Only required variables for this module
    for (const [key, value] of Object.entries(vars)) {
        const safeValue = value === undefined || value === null ? '' : String(value);
        out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), safeValue);
    }
    return out;
};

const wrapBodyAsHtml = (body) => {
    // If admin provides HTML, keep it. Otherwise treat as plain text.
    if (!body) return '';
    const s = String(body);
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(s);
    if (looksLikeHtml) return s;
    const escaped = s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    return `<div>${escaped.replace(/\n/g, '<br/>')}</div>`;
};

// GET /api/interviews - List all candidates
router.get('/', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    try {
        const db = getDatabase();
        const candidates = await all(db, 'SELECT * FROM interview_candidates ORDER BY created_at DESC');
        res.json({ success: true, candidates });
    } catch (error) {
        console.error('Get candidates error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/interviews/interviewers - List all assigned interviewers (only interviewers with assigned candidates)
router.get('/interviewers', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    try {
        const db = getDatabase();
        // Get distinct interviewers from candidates who have been assigned interviewers
        const interviewers = await all(db,
            `SELECT DISTINCT u.id, u.name, u.email
             FROM users u
             WHERE u.id IN (
                SELECT DISTINCT interviewer_id FROM interview_candidates WHERE interviewer_id IS NOT NULL
             )
             ORDER BY u.name ASC`,
            []
        );
        res.json({ success: true, interviewers: interviewers || [] });
    } catch (error) {
        console.error('Get interviewers error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/interviews/bulk-upload
router.post('/bulk-upload', authenticateToken, requireRole('admin', 'office_bearer'), upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const db = getDatabase();
    // Required columns in Excel
    const validColumns = ['name', 'email', 'phone', 'department', 'year', 'register_no'];

    try {
        // Read buffer
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // Convert to JSON
        const data = xlsx.utils.sheet_to_json(sheet);

        if (!data.length) {
            return res.status(400).json({ success: false, message: 'File is empty' });
        }

        // Validate headers (check first row keys)
        const firstRow = data[0];
        const normalizedHeaders = {};
        Object.keys(firstRow).forEach(key => {
            normalizedHeaders[key.trim().toLowerCase()] = key;
        });

        const missingColumns = validColumns.filter(col => !normalizedHeaders[col]);

        if (missingColumns.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required columns: ${missingColumns.join(', ')}. Found: ${Object.keys(normalizedHeaders).join(', ')}`
            });
        }

        let successCount = 0;
        let skippedCount = 0;
        const skippedDetails = [];
        const successfulCandidates = [];

        for (const row of data) {
            // Extract values using original keys found in map
            const name = row[normalizedHeaders['name']];
            const email = row[normalizedHeaders['email']];
            const phone = row[normalizedHeaders['phone']];
            const dept = row[normalizedHeaders['department']];
            const year = row[normalizedHeaders['year']];
            const register_no = row[normalizedHeaders['register_no']];

            // Basic validation
            if (!email || !register_no || !name) {
                skippedCount++;
                skippedDetails.push({ email: email || 'N/A', reason: 'Missing name, email or register_no' });
                continue;
            }

            // Check for duplicate Email in interview_candidates (allow duplicates if different year? No, unique per candidate generally)
            const existingEmail = await get(db, 'SELECT id FROM interview_candidates WHERE email = ?', [email]);
            if (existingEmail) {
                skippedCount++;
                skippedDetails.push({ email, reason: 'Duplicate Email (Candidate exists)' });
                continue;
            }

            // Check for duplicate Register No in interview_candidates
            const existingRegNo = await get(db, 'SELECT id FROM interview_candidates WHERE register_no = ?', [register_no]);
            if (existingRegNo) {
                skippedCount++;
                skippedDetails.push({ register_no, reason: 'Duplicate Register No' });
                continue;
            }

            try {
                // Find user by email to link user_id
                const user = await get(db, 'SELECT id FROM users WHERE LOWER(TRIM(email)) = ?', [email.trim().toLowerCase()]);
                const userId = user ? user.id : null;

                // Insert Candidate
                const result = await run(db,
                    `INSERT INTO interview_candidates (name, email, phone, dept, year, register_no, status, marks, email_sent, user_id) 
                 VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?)`,
                    [name, email, phone, dept, year, register_no, userId]
                );
                const candidateId = result.lastID;

                // Email will be sent manually by admin via the email management panel
                // No auto email send - email_sent field defaults to 0 (false)

                successfulCandidates.push({ name, email });
                successCount++;

            } catch (err) {
                console.error('Row insert error:', err);
                skippedCount++;
                skippedDetails.push({ email, reason: 'Database Error: ' + err.message });
            }
        }

        // Send emails in background (or await if critical, user said "trigger mail", implies importance)
        // To ensure response is fast, maybe fire and forget? But user might want to know if mails failed.
        // Let's await them for now as batch size is likely manageable.


        await logActivity(req.user.id, 'BULK_UPLOAD_CANDIDATES', {
            total: data.length,
            success: successCount,
            skipped: skippedCount
        }, req, {
            action_type: 'CREATE',
            module_name: 'interviews',
            action_description: `Bulk uploaded ${successCount} candidates`,
        });

        res.json({
            success: true,
            message: 'Bulk upload processed successfully. Emails can be sent manually from the admin email management panel.',
            stats: {
                total: data.length,
                success: successCount,
                skipped: skippedCount,
                skippedDetails // Frontend can display this list
            }
        });

    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({ success: false, message: 'Server error processing file: ' + error.message });
    }
});

// POST /api/interviews/add - Add single candidate
router.post('/add', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    const { name, email, phone, dept, year, register_no, role = 'volunteer' } = req.body;

    if (!name || !email || !register_no) {
        return res.status(400).json({ success: false, message: 'Name, Email and Register No are required' });
    }

    if (!['volunteer', 'office_bearer'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role. Must be volunteer or office_bearer' });
    }

    const db = getDatabase();

    try {
        // Check duplicates
        const existing = await get(db, 'SELECT id FROM interview_candidates WHERE email = ? OR register_no = ?', [email, register_no]);
        if (existing) {
            return res.status(400).json({ success: false, message: 'Candidate with this Email or Register No already exists' });
        }

        // Find user by email to link user_id
        const user = await get(db, 'SELECT id FROM users WHERE LOWER(TRIM(email)) = ?', [email.trim().toLowerCase()]);
        const userId = user ? user.id : null;

        // Insert
        const result = await run(db,
            `INSERT INTO interview_candidates (name, email, phone, dept, year, register_no, status, marks, email_sent, role, user_id) 
             VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, ?)`,
            [name, email, phone, dept, year, register_no, role, userId]
        );

        const candidateId = result.lastID;

        // Email will be sent manually by admin via the email management panel
        // No auto email send - email_sent field defaults to 0 (false)

        await logActivity(req.user.id, 'ADD_CANDIDATE', { name, email }, req, {
            action_type: 'CREATE',
            module_name: 'interviews',
            action_description: `Added interview candidate: ${name}`
        });

        res.json({ success: true, message: 'Candidate added successfully. Email can be sent manually from the admin email management panel.' });

    } catch (error) {
        console.error('Add candidate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUT /api/interviews/:id - Update candidate status/interviewer
router.put('/:id', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    const { id } = req.params;

    const { status, interviewer, interviewer_email, interviewer_id, marks, interview_date, interview_time, remarks, decision, role, attendance, name, email, phone, dept, year, register_no } = req.body;
    const db = getDatabase();

    try {
        const candidate = await get(db, 'SELECT * FROM interview_candidates WHERE id = ?', [id]);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        const updates = [];
        const params = [];

        if (status) {
            updates.push('status = ?');
            params.push(status);
        }
        let interviewerInfo = null;

        if (interviewer_id !== undefined) {
            const interviewerIdParsed = parseInt(interviewer_id, 10) || null;
            updates.push('interviewer_id = ?');
            params.push(interviewerIdParsed);

            if (interviewerIdParsed) {
                interviewerInfo = await get(db, 'SELECT name, email FROM users WHERE id = ?', [interviewerIdParsed]);
                // If interviewer is being assigned and no explicit status provided, mark candidate as assigned
                if (status === undefined) {
                    updates.push('status = ?');
                    params.push('assigned');
                }
            }
        }

        if (interviewer !== undefined) {
            updates.push('interviewer = ?');
            params.push(interviewer);
        } else if (interviewerInfo && interviewerInfo.name) {
            updates.push('interviewer = ?');
            params.push(interviewerInfo.name);
        }

        if (interviewer_email !== undefined) {
            updates.push('interviewer_email = ?');
            params.push(interviewer_email ? interviewer_email.toLowerCase().trim() : interviewer_email);
        } else if (interviewerInfo && interviewerInfo.email) {
            updates.push('interviewer_email = ?');
            params.push(interviewerInfo.email.toLowerCase().trim());
        }

        if (marks !== undefined) {
            updates.push('marks = ?');
            params.push(marks);
        }
        if (interview_date !== undefined) {
            updates.push('interview_date = ?');
            params.push(interview_date);
        }
        if (interview_time !== undefined) {
            updates.push('interview_time = ?');
            params.push(interview_time);
        }
        if (remarks !== undefined) {
            updates.push('remarks = ?');
            params.push(remarks);
        }
        if (decision !== undefined) {
            updates.push('decision = ?');
            params.push(decision);
        }
        if (role !== undefined) {
            if (!['volunteer', 'office_bearer'].includes(role)) {
                return res.status(400).json({ success: false, message: 'Invalid role. Must be "volunteer" or "office_bearer"' });
            }
            updates.push('role = ?');
            params.push(role);
        }
        if (attendance !== undefined) {
            if (!['present', 'absent'].includes(attendance)) {
                return res.status(400).json({ success: false, message: 'Invalid attendance. Must be "present" or "absent"' });
            }
            updates.push('attendance = ?');
            params.push(attendance);
        }
        if (email !== undefined) { updates.push('email = ?'); params.push(email); }
        if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
        if (dept !== undefined) { updates.push('dept = ?'); params.push(dept); }
        if (year !== undefined) { updates.push('year = ?'); params.push(year); }
        if (register_no !== undefined) { updates.push('register_no = ?'); params.push(register_no); }

        // If email is being updated and user_id is not set, try to find user
        if (email !== undefined && !candidate.user_id) {
            const user = await get(db, 'SELECT id FROM users WHERE LOWER(TRIM(email)) = ?', [email.trim().toLowerCase()]);
            if (user) {
                updates.push('user_id = ?');
                params.push(user.id);
            }
        }

        if (!updates.length) {
            return res.json({ success: true, message: 'No changes made' });
        }

        const assignmentChanged = (mentor_id !== undefined || interviewer_email !== undefined);
        const scheduleChanged = (interview_date !== undefined || interview_time !== undefined);

        params.push(id);
        await run(db, `UPDATE interview_candidates SET ${updates.join(', ')} WHERE id = ?`, params);

        // If an interviewer has been assigned, ensure the assigned interviewer user is flagged for interviewer access
        if (interviewer_id !== undefined && interviewer_id !== null) {
            try {
                await run(db, 'UPDATE users SET is_interviewer = 1 WHERE id = ?', [interviewer_id]);
            } catch (err) {
                console.error('Failed to mark interviewer as interviewer:', err.message);
            }
        }
        if (interviewer_email !== undefined && interviewer_email) {
            try {
                await run(db, 'UPDATE users SET is_interviewer = 1 WHERE email = ?', [interviewer_email]);
            } catch (err) {
                console.error('Failed to mark interviewer email as interviewer:', err.message);
            }
        }

        // (No assignment/schedule emails by default; only selected final result emails are sent from submit-marks)

        // log activity if user object exists
        if (req.user && req.user.id) {
            await logActivity(req.user.id, 'UPDATE_CANDIDATE', { id, updates: req.body }, req, {
                action_type: 'UPDATE',
                module_name: 'interviews',
                action_description: `Updated interview candidate: ${candidate.name} (${updates.join(', ')})`
            });
        }

        res.json({ success: true, message: 'Candidate updated successfully' });
    } catch (error) {
        console.error('Update candidate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/interviews/my-status - Get interview status for logged in user
router.get('/my-status', authenticateToken, async (req, res) => {
    try {
        if (!req.user?.is_interviewer) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const db = getDatabase();
        const user = await get(db, 'SELECT * FROM users WHERE id = ?', [req.user.id]);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Normalize user details for robust matching
        const userEmail = (user.email || '').trim().toLowerCase();
        const userName = (user.name || '').trim().toLowerCase();

        let candidate = null;

        // First, try direct user_id match (most reliable)
        if (req.user.id) {
            candidate = await get(db, 'SELECT * FROM interview_candidates WHERE user_id = ?', [req.user.id]);
        }

        // If not found by user_id, try email
        if (!candidate && userEmail) {
            candidate = await get(db, 'SELECT * FROM interview_candidates WHERE LOWER(TRIM(email)) = ?', [userEmail]);
        }

        // If not found by email, try to find by register_no from profile
        if (!candidate) {
            const profile = await get(db, 'SELECT register_no FROM profiles WHERE user_id = ?', [req.user.id]);
            if (profile && profile.register_no) {
                candidate = await get(db, 'SELECT * FROM interview_candidates WHERE register_no = ?', [profile.register_no]);
            }
        }

        // If still not found, try by name (in case email/register_no mismatch)
        if (!candidate && userName) {
            candidate = await get(db, 'SELECT * FROM interview_candidates WHERE LOWER(TRIM(name)) = ?', [userName]);
        }

        if (!candidate) {
            return res.json({ success: true, status: null });
        }

        // Normalize status for display
        if (!candidate.status) {
            candidate.status = 'pending';
        }

        res.json({ success: true, candidate });
    } catch (error) {
        console.error('Get my interview status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/interviews/my-candidates - Get candidates assigned to current mentor
router.get('/my-candidates', authenticateToken, async (req, res) => {
    try {
        if (!req.user?.is_interviewer) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const db = getDatabase();
        const user = await get(db, 'SELECT * FROM users WHERE id = ?', [req.user.id]);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get all candidates assigned to this interviewer (by interviewer_id or interviewer_email)
        const candidates = await all(db,
            `SELECT * FROM interview_candidates 
             WHERE (interviewer_id = ?
               OR LOWER(interviewer_email) = LOWER(TRIM(?))
               OR LOWER(interviewer) = LOWER(TRIM(?)))
               AND status != 'completed'
             ORDER BY created_at DESC`,
            [req.user.id, user.email || '', user.name || '']
        );

        res.json({ success: true, candidates: candidates || [] });
    } catch (error) {
        console.error('Get my candidates error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/interviews/send-emails - Send emails to selected candidates
router.post('/send-emails', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    const { candidateIds } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No candidates selected' });
    }

    const db = getDatabase();
    let sentCount = 0;

    try {
        // Fetch candidates details
        // SQLite doesn't support convenient array params for IN clause easily without placeholder gen
        const placeholders = candidateIds.map(() => '?').join(',');
        const candidates = await all(db, `SELECT * FROM interview_candidates WHERE id IN (${placeholders})`, candidateIds);

        for (const candidate of candidates) {
            const { id, name, email, register_no } = candidate;

            const subject = "Interview Process Registration - SM Volunteers";
            const html = getInterviewEmailTemplate(name, register_no);

            try {
                const sent = await sendEmail(email, subject, html);
                if (sent) {
                    await run(db, 'UPDATE interview_candidates SET email_sent = 1 WHERE id = ?', [id]);
                    sentCount++;
                }
            } catch (err) {
                console.error(`Failed to send email to ${email}:`, err);
            }
        }

        await logActivity(req.user.id, 'SEND_EMAILS', { count: sentCount, candidateIds }, req, {
            action_type: 'UPDATE',
            module_name: 'interviews',
            action_description: `Sent interview registration emails to ${sentCount} candidates`
        });

        res.json({ success: true, message: `Emails sent successfully to ${sentCount} candidates`, sentCount });

    } catch (error) {
        console.error('Send emails error:', error);
        res.status(500).json({ success: false, message: 'Server error sending emails' });
    }
});

// POST /api/interviews/:id/submit-marks - Submit interview marks by mentor
router.post('/:id/submit-marks', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    const { id } = req.params;
    const { marks, remarks, decision } = req.body;

    const db = getDatabase();

    try {
        const candidate = await get(db, 'SELECT * FROM interview_candidates WHERE id = ?', [id]);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Check if mentor has permission to submit marks for this candidate
        if (candidate.mentor_id !== req.user.id && candidate.interviewer_email !== req.user.email && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'You do not have permission to submit marks for this candidate' });
        }

        const isAbsentSubmission = candidate.attendance === 'absent' || decision === 'retake' || decision === 'absent';

        // For present submissions, apply auto decision from marks when not explicitly provided
        let resolvedDecision = decision;

        if (!isAbsentSubmission) {
            if (marks === undefined || marks === null) {
                return res.status(400).json({ success: false, message: 'Marks are required for present candidates' });
            }

            // Validate marks
            const marksNum = parseFloat(marks);
            if (isNaN(marksNum) || marksNum < 0 || marksNum > 10) {
                return res.status(400).json({ success: false, message: 'Marks must be between 0 and 10' });
            }

            if (!resolvedDecision) {
                if (marksNum <= 5) resolvedDecision = 'rejected';
                else if (marksNum <= 7) resolvedDecision = 'waitlisted';
                else resolvedDecision = 'selected';
            }
        }

        if (isAbsentSubmission) {
            resolvedDecision = 'retake';
        }

        // Update candidate with marks, remarks, decision, and set status to completed
        const updates = ['status = ?'];
        const params = ['completed'];

        if (marks !== undefined && marks !== null) {
            updates.push('marks = ?');
            params.push(parseFloat(marks) || null);
        }

        if (remarks !== undefined) {
            updates.push('remarks = ?');
            params.push(remarks || null);
        }

        if (resolvedDecision !== undefined) {
            updates.push('decision = ?');
            params.push((resolvedDecision === 'absent' ? 'retake' : resolvedDecision) || null);
        }

        // Ensure absent submission sets attendance explicitly in DB
        if (isAbsentSubmission) {
            updates.push('attendance = ?');
            params.push('absent');
        }

        params.push(id);

        await run(db,
            `UPDATE interview_candidates 
             SET ${updates.join(', ')} 
             WHERE id = ?`,
            params
        );

        await logActivity(req.user.id, 'SUBMIT_INTERVIEW_MARKS', { id, marks, decision: resolvedDecision }, req, {
            action_type: 'UPDATE',
            module_name: 'interviews',
            action_description: `Submitted interview marks (${isAbsentSubmission ? 'ABSENT / RETAKE' : (marks + '/10')}) for candidate: ${candidate.name}`
        });

        // No auto email send for outcomes
        // Admin can send result emails manually from the email management panel

        res.json({ success: true, message: 'Interview marks submitted successfully' });
    } catch (error) {
        console.error('Submit marks error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// DELETE /api/interviews/:id - remove candidate
router.delete('/:id', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDatabase();
        const candidate = await get(db, 'SELECT * FROM interview_candidates WHERE id = ?', [id]);
        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }
        await run(db, 'DELETE FROM interview_candidates WHERE id = ?', [id]);
        if (req.user && req.user.id) {
            await logActivity(req.user.id, 'DELETE_CANDIDATE', { id }, req, {
                action_type: 'DELETE',
                module_name: 'interviews',
                action_description: `Deleted interview candidate: ${candidate.name}`
            });
        }
        res.json({ success: true, message: 'Candidate deleted successfully' });
    } catch (error) {
        console.error('Delete candidate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ======================== ADMIN EMAIL MANAGEMENT ENDPOINTS ========================

// GET /api/interviews/admin/email-candidates - Get all candidates for email management
router.get('/admin/email-candidates', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    try {
        const db = getDatabase();
        const { type = 'registration' } = req.query; // registration/outcome OR selected/rejected

        // Manual outcome email logs use email_logs (keyed by candidate.user_id + type)
        if (type === 'selected' || type === 'rejected') {
            const decisionType = type;
            const candidates = await all(
                db,
                `
                SELECT
                  ic.id,
                  ic.name,
                  ic.email,
                  ic.user_id,
                  ic.decision,
                  ic.status,
                  COALESCE(el.status, 'pending') AS email_status,
                  el.sent_at
                FROM interview_candidates ic
                LEFT JOIN email_logs el
                  ON el.user_id = ic.user_id
                 AND el.type = ?
                WHERE ic.status = 'completed'
                  AND ic.decision = ?
                ORDER BY ic.created_at DESC
                `,
                [decisionType, decisionType]
            );

            res.json({
                success: true,
                candidates: (candidates || []).map((c) => ({
                    ...c,
                    already_sent: c.email_status === 'sent'
                })),
                emailType: decisionType
            });
            return;
        }

        // Legacy behavior (registration/outcome template-based)
        let candidates;
        if (type === 'outcome') {
            candidates = await all(db,
                `SELECT id, name, email, marks, decision, status, email_sent, created_at
                 FROM interview_candidates
                 WHERE status = 'completed'
                 ORDER BY created_at DESC`
            );
        } else {
            candidates = await all(db,
                `SELECT id, name, email, dept, year, register_no, status, email_sent, created_at
                 FROM interview_candidates
                 ORDER BY created_at DESC`
            );
        }

        res.json({
            success: true,
            candidates: candidates || [],
            emailType: type
        });
    } catch (error) {
        console.error('Get email candidates error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/interviews/admin/preview-email - Get email preview
router.post('/admin/preview-email', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    try {
        const { candidateId, emailType = 'registration', type, subject, body } = req.body;

        if (!candidateId) {
            return res.status(400).json({ success: false, message: 'Candidate ID required' });
        }

        const db = getDatabase();
        const candidate = await get(db, 'SELECT * FROM interview_candidates WHERE id = ?', [candidateId]);

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        let finalSubject = '';
        let html = '';

        // Manual compose with {{name}} and {{email}}
        const hasManualCompose = (subject && String(subject).trim()) || (body && String(body).trim());
        if (hasManualCompose) {
            const vars = { name: candidate.name, email: candidate.email };
            finalSubject = applyTemplateVars(subject || '', vars).trim() || 'Interview Update - SM Volunteers';
            const replacedBody = applyTemplateVars(body || '', vars);
            html = wrapBodyAsHtml(replacedBody);
        } else if (emailType === 'outcome') {
            // Outcome email preview (legacy template)
            finalSubject = candidate.decision === 'selected'
                ? '🎉 Congratulations! You are Selected'
                : `Interview Result - ${candidate.decision || 'Pending'}`;

            html = getInterviewOutcomeTemplate({
                name: candidate.name,
                decision: candidate.decision || 'pending',
                interviewerName: candidate.interviewer || '',
                interviewDate: candidate.interview_date || '',
                interviewTime: candidate.interview_time || '',
                marks: candidate.marks || '',
                decisionLink: `${process.env.FRONTEND_URL || 'http://localhost:9000'}/my-interview`,
            });
        } else {
            // Registration email preview (legacy template)
            finalSubject = "Interview Process Registration - SM Volunteers";
            html = getInterviewEmailTemplate(candidate.name, candidate.register_no);
        }

        res.json({
            success: true,
            preview: {
                email: candidate.email,
                name: candidate.name,
                subject: finalSubject,
                html,
                emailType: type || emailType
            }
        });
    } catch (error) {
        console.error('Preview email error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/interviews/admin/send-outcome-emails - Send outcome emails (manual selected/rejected flow)
router.post('/admin/send-outcome-emails', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    try {
        const { candidateIds, emailType = 'outcome', type, subject, body } = req.body;

        if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No candidates selected' });
        }

        const db = getDatabase();
        const targetType = type === 'selected' || type === 'rejected' ? type : null;

        const useEmailLogs = !!targetType;

        let sentCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        const placeholders = candidateIds.map(() => '?').join(',');
        const candidates = await all(
            db,
            `SELECT * FROM interview_candidates WHERE id IN (${placeholders})`,
            candidateIds
        );

        for (const candidate of candidates) {
            try {
                const { id, name, email, decision, marks, interview_date, interview_time, interviewer, user_id, register_no } = candidate;

                if (useEmailLogs) {
                    if (candidate.status !== 'completed' || decision !== targetType) {
                        skippedCount++;
                        continue;
                    }
                    if (!user_id) {
                        failedCount++;
                        continue;
                    }

                    // Already sent?
                    const existing = await get(
                        db,
                        'SELECT status FROM email_logs WHERE user_id = ? AND type = ?',
                        [user_id, targetType]
                    );
                    if (existing?.status === 'sent') {
                        skippedCount++;
                        continue;
                    }

                    const vars = { name, email };
                    const hasManualCompose = (subject && String(subject).trim()) || (body && String(body).trim());

                    const finalSubject = hasManualCompose
                        ? applyTemplateVars(subject || '', vars).trim() || `Interview Update - SM Volunteers`
                        : (decision === 'selected'
                            ? '🎉 Congratulations! You are Selected'
                            : `Interview Result - ${decision || 'Pending'}`);

                    const finalHtml = hasManualCompose
                        ? wrapBodyAsHtml(applyTemplateVars(body || '', vars))
                        : getInterviewOutcomeTemplate({
                            name,
                            decision: decision || 'pending',
                            interviewerName: interviewer || '',
                            interviewDate: interview_date || '',
                            interviewTime: interview_time || '',
                            marks: marks || '',
                            decisionLink: `${process.env.FRONTEND_URL || 'http://localhost:9000'}/my-interview`,
                        });

                    // Ensure log row exists (pending)
                    if (!existing) {
                        await run(
                            db,
                            'INSERT INTO email_logs (user_id, type, status, sent_at) VALUES (?, ?, ?, ?)',
                            [user_id, targetType, 'pending', null]
                        );
                    } else {
                        await run(
                            db,
                            'UPDATE email_logs SET status = ?, sent_at = NULL WHERE user_id = ? AND type = ?',
                            ['pending', user_id, targetType]
                        );
                    }

                    const sent = await sendEmail(email, finalSubject, finalHtml);
                    if (sent) {
                        await run(
                            db,
                            'UPDATE email_logs SET status = ?, sent_at = CURRENT_TIMESTAMP WHERE user_id = ? AND type = ?',
                            ['sent', user_id, targetType]
                        );
                        sentCount++;
                    } else {
                        // Keep as pending
                        failedCount++;
                    }
                } else {
                    // Legacy fallback: existing template-based flow
                    let legacySubject = '';
                    let legacyHtml = '';

                    if (emailType === 'outcome') {
                        legacySubject = decision === 'selected'
                            ? '🎉 Congratulations! You are Selected'
                            : `Interview Result - ${decision || 'Pending'}`;

                        legacyHtml = getInterviewOutcomeTemplate({
                            name,
                            decision: decision || 'pending',
                            interviewerName: interviewer || '',
                            interviewDate: interview_date || '',
                            interviewTime: interview_time || '',
                            marks: marks || '',
                            decisionLink: `${process.env.FRONTEND_URL || 'http://localhost:9000'}/my-interview`,
                        });
                    } else {
                        legacySubject = "Interview Process Registration - SM Volunteers";
                        legacyHtml = getInterviewEmailTemplate(name, register_no);
                    }

                    // Skip if already sent registration emails (legacy behavior)
                    if (candidate.email_sent && emailType === 'registration') {
                        skippedCount++;
                        continue;
                    }

                    const sent = await sendEmail(email, legacySubject, legacyHtml);
                    if (sent) {
                        await run(db, 'UPDATE interview_candidates SET email_sent = 1 WHERE id = ?', [id]);
                        sentCount++;
                    } else {
                        failedCount++;
                    }
                }
            } catch (err) {
                console.error(`Failed to send email for candidate id=${candidate?.id}:`, err);
                failedCount++;
            }
        }

        await logActivity(
            req.user.id,
            'SEND_OUTCOME_EMAILS_MANUAL',
            { sentCount, skippedCount, failedCount, candidateIds, type: targetType || emailType },
            req,
            {
                action_type: 'UPDATE',
                module_name: 'interviews',
                action_description: `Manual email send (${targetType || emailType}) - sent=${sentCount}, skipped=${skippedCount}, failed=${failedCount}`
            }
        );

        res.json({
            success: true,
            sentCount,
            skippedCount,
            failedCount
        });
    } catch (error) {
        console.error('Send outcome emails error:', error);
        res.status(500).json({ success: false, message: 'Server error sending emails' });
    }
});

export default router;
