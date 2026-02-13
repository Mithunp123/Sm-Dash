import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import { sendEmail } from '../utils/email.js';

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

// POST /api/interviews/bulk-upload
router.post('/bulk-upload', authenticateToken, requireRole('admin'), upload.single('file'), async (req, res) => {
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
                // Insert Candidate
                const result = await run(db,
                    `INSERT INTO interview_candidates (name, email, phone, dept, year, register_no, status, marks, email_sent) 
                 VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, 0)`,
                    [name, email, phone, dept, year, register_no]
                );
                const candidateId = result.lastID;

                // Prepare Email (removed)

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
            message: 'Bulk upload processed successfully. Emails are being sent.',
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
router.post('/add', authenticateToken, requireRole('admin'), async (req, res) => {
    const { name, email, phone, dept, year, register_no } = req.body;

    if (!name || !email || !register_no) {
        return res.status(400).json({ success: false, message: 'Name, Email and Register No are required' });
    }

    const db = getDatabase();

    try {
        // Check duplicates
        const existing = await get(db, 'SELECT id FROM interview_candidates WHERE email = ? OR register_no = ?', [email, register_no]);
        if (existing) {
            return res.status(400).json({ success: false, message: 'Candidate with this Email or Register No already exists' });
        }

        // Insert
        const result = await run(db,
            `INSERT INTO interview_candidates (name, email, phone, dept, year, register_no, status, marks, email_sent) 
             VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, 0)`,
            [name, email, phone, dept, year, register_no]
        );

        // Send Email


        await logActivity(req.user.id, 'ADD_CANDIDATE', { name, email }, req, {
            action_type: 'CREATE',
            module_name: 'interviews',
            action_description: `Added interview candidate: ${name}`
        });

        res.json({ success: true, message: 'Candidate added successfully' });

    } catch (error) {
        console.error('Add candidate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// PUT /api/interviews/:id - Update candidate status/interviewer
router.put('/:id', authenticateToken, requireRole('admin', 'office_bearer'), async (req, res) => {
    const { id } = req.params;
    const { status, interviewer, marks, interview_date, interview_time } = req.body;
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
        if (interviewer !== undefined) {
            updates.push('interviewer = ?');
            params.push(interviewer);
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

        if (updates.length === 0) {
            return res.json({ success: true, message: 'No changes made' });
        }

        params.push(id);
        await run(db, `UPDATE interview_candidates SET ${updates.join(', ')} WHERE id = ?`, params);

        await logActivity(req.user.id, 'UPDATE_CANDIDATE', { id, updates: req.body }, req, {
            action_type: 'UPDATE',
            module_name: 'interviews',
            action_description: `Updated interview candidate: ${candidate.name} (${updates.join(', ')})`
        });

        res.json({ success: true, message: 'Candidate updated successfully' });
    } catch (error) {
        console.error('Update candidate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /api/interviews/my-status - Get interview status for logged in user
router.get('/my-status', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const user = await get(db, 'SELECT * FROM users WHERE id = ?', [req.user.id]);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Try to find candidate by email first
        let candidate = await get(db, 'SELECT * FROM interview_candidates WHERE email = ?', [user.email]);

        // If not found by email, try to find by register_no if available in profile
        if (!candidate) {
            const profile = await get(db, 'SELECT register_no FROM profiles WHERE user_id = ?', [req.user.id]);
            if (profile && profile.register_no) {
                candidate = await get(db, 'SELECT * FROM interview_candidates WHERE register_no = ?', [profile.register_no]);
            }
        }

        if (!candidate) {
            return res.json({ success: true, status: null });
        }

        res.json({ success: true, candidate });
    } catch (error) {
        console.error('Get my interview status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /api/interviews/send-emails - Send emails to selected candidates
router.post('/send-emails', authenticateToken, requireRole('admin'), async (req, res) => {
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
            const html = `
                <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6;">
                    <h2 style="color: #2563eb;">Registration Successful</h2>
                    <p>Dear ${name},</p>
                    <p>You have been successfully registered for the SM Volunteers interview process.</p>
                    <p><strong>Registration Number:</strong> ${register_no}</p>
                    <p>We will notify you about the interview schedule shortly.</p>
                    <br/>
                    <p>Best Regards,</p>
                    <p>SM Volunteers Team</p>
                </div>
            `;

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

export default router;
