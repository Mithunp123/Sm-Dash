import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';
import { sendEmail } from '../utils/email.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Multer setup for CSV/XLSX files
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'application/vnd.ms-excel',
            'application/csv'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only .xlsx and .csv files are allowed!'), false);
        }
    }
});

// Helper functions for MySQL/SQLite compatibility
const run = async (db, query, params = []) => {
    if (db && typeof db.execute === 'function') {
        const [result] = await db.execute(query, params);
        return { lastID: result.insertId, changes: result.affectedRows };
    }
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
};

const get = async (db, query, params = []) => {
    if (db && typeof db.execute === 'function') {
        const [rows] = await db.execute(query, params);
        return rows[0];
    }
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const all = async (db, query, params = []) => {
    if (db && typeof db.execute === 'function') {
        const [rows] = await db.execute(query, params);
        return rows;
    }
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

// Email template for interview results
const getInterviewResultTemplate = (name, isSelected) => {
    const baseTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .result-box { padding: 20px; border-radius: 8px; margin: 20px 0; }
                .selected { background: #d4edda; border-left: 4px solid #28a745; }
                .rejected { background: #f8d7da; border-left: 4px solid #dc3545; }
                .btn { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>SM Volunteers - Interview Result</h1>
                </div>
                <div class="content">
                    <p>Dear <strong>{{name}}</strong>,</p>
                    ${isSelected ? `
                        <div class="result-box selected">
                            <h2 style="color: #28a745; margin: 0;">🎉 Congratulations!</h2>
                            <p>We are thrilled to have you selected for SM Volunteers! Your performance impressed our evaluation team.</p>
                            <p><strong>Next Steps:</strong> Please check your email for further instructions and onboarding details.</p>
                        </div>
                    ` : `
                        <div class="result-box rejected">
                            <h2 style="color: #dc3545; margin: 0;">Application Update</h2>
                            <p>Thank you for your interest in joining SM Volunteers. After careful evaluation, we regret to inform you that we cannot move forward with your application at this time.</p>
                            <p>We appreciate your enthusiasm and encourage you to apply again in the future!</p>
                        </div>
                    `}
                    <p>Best regards,<br><strong>SM Volunteers Team</strong></p>
                </div>
                <div class="footer">
                    <p>&copy; 2024 SM Volunteers, K.S.Rangasamy College of Technology. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return baseTemplate.replace(/{{name}}/g, name);
};

// ============================================
// DEPARTMENTS & YEARS METADATA
// ============================================
router.get('/departments', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        
        // First try to get departments from interview_candidates
        const candidateDepts = await all(db, 
            `SELECT DISTINCT dept 
             FROM interview_candidates 
             WHERE dept IS NOT NULL AND dept != '' 
             ORDER BY dept ASC`
        );
        
        // Then get from student_profiles
        const profileDepts = await all(db,
            `SELECT DISTINCT dept 
             FROM student_profiles 
             WHERE dept IS NOT NULL AND dept != '' 
             ORDER BY dept ASC`
        );
        
        // Combine and deduplicate
        const allDepts = new Set();
        candidateDepts?.forEach(d => allDepts.add(d.dept));
        profileDepts?.forEach(d => allDepts.add(d.dept));
        
        // Default departments if none found in DB
        const defaultDepts = [
            'IT', 'CSE', 'ECE', 'Mech', 'Civil', 'EEE', 'Chemical',
            'Biomedical', 'Science', 'Management'
        ];
        
        const deptList = allDepts.size > 0 
            ? Array.from(allDepts).sort() 
            : defaultDepts;
        
        res.json({ success: true, departments: deptList });
    } catch (error) {
        console.error('Get departments error:', error);
        res.json({ 
            success: true, 
            departments: ['IT', 'CSE', 'ECE', 'Mech', 'Civil', 'EEE', 'Chemical', 'Biomedical', 'Science', 'Management']
        });
    }
});

router.get('/years', authenticateToken, async (req, res) => {
    try {
        // Years are standardized as I, II, III, IV
        const years = ['I', 'II', 'III', 'IV'];
        res.json({ success: true, years });
    } catch (error) {
        console.error('Get years error:', error);
        res.json({ success: true, years: ['I', 'II', 'III', 'IV'] });
    }
});

// ============================================
// 1. ADD CANDIDATE (Manual)
// ============================================
router.post('/candidates', [
    authenticateToken,
    (req, res, next) => {
        if (['admin', 'office_bearer'].includes(req.user.role)) return next();
        return res.status(403).json({ success: false, message: 'Management access required' });
    },
    body('name').notEmpty().trim(),
    body('department').notEmpty(),
    body('year').notEmpty(),
    body('phone').notEmpty().trim().isString(),
    body('email').isEmail().normalizeEmail()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    let { name, department, year, phone, email } = req.body;
    
    // Clean phone number - remove non-digits
    phone = phone.replace(/\D/g, '');
    if (phone.length > 10 && phone.startsWith('91')) {
        phone = phone.substring(2);
    }
    
    if (phone.length !== 10) {
        return res.status(400).json({
            success: false,
            message: 'Phone number must be 10 digits'
        });
    }

    try {
        const db = getDatabase();

        // Check for duplicates (phone OR email)
        const existing = await get(db,
            'SELECT id FROM interview_candidates WHERE phone = ? OR email = ?',
            [phone, email]
        );

        if (existing) {
            // Update existing candidate instead of failing
            await run(db,
                `UPDATE interview_candidates 
                 SET name = ?, department = ?, year = ?, phone = ?, email = ?
                 WHERE id = ?`,
                [name, department, year, phone, email, existing.id]
            );
            return res.json({
                success: true,
                message: 'Candidate details updated (already existed)'
            });
        }

        // Validate phone and email format
        // Redundant phone check removed, it's already handled above

        if (!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Insert candidate with default status 'pending'
        // Auto-generate register_no if not provided
        const register_no = `REG${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        const result = await run(db,
            `INSERT INTO interview_candidates 
            (name, email, phone, dept, year, register_no, status, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [name, email, phone, department, year, register_no]
        );

        await logActivity(req.user.id, 'ADD_CANDIDATE', { name, email }, req, {
            action_type: 'CREATE',
            module_name: 'interviews',
            action_description: `Added interview candidate: ${name}`
        });

        res.json({
            success: true,
            message: 'Candidate added successfully',
            candidateId: result.lastID
        });

    } catch (error) {
        console.error('Add candidate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// 2. BULK UPLOAD CANDIDATES (CSV/XLSX)
// ============================================
router.post('/bulk-upload', authenticateToken, (req, res, next) => {
        if (['admin', 'office_bearer'].includes(req.user.role)) return next();
        return res.status(403).json({ success: false, message: 'Management access required' });
    }, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    if (!['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/vnd.ms-excel', 'application/csv'].includes(req.file.mimetype)) {
        return res.status(400).json({ success: false, message: 'Only CSV and XLSX files are allowed' });
    }

    const db = getDatabase();

    try {
        let data = [];

        if (req.file.mimetype === 'text/csv' || req.file.mimetype === 'application/csv') {
            const lines = req.file.buffer.toString().split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            
            for (let i = 1; i < lines.length; i++) {
                if (lines[i].trim() === '') continue;
                const values = lines[i].split(',').map(v => v.trim());
                const row = {};
                headers.forEach((header, idx) => {
                    row[header] = values[idx];
                });
                data.push(row);
            }
        } else {
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            data = xlsx.utils.sheet_to_json(sheet);
        }

        if (!data.length) {
            return res.status(400).json({ success: false, message: 'File is empty' });
        }

        // Normalize headers
        const normalizedHeaders = {};
        Object.keys(data[0]).forEach(key => {
            normalizedHeaders[key.trim().toLowerCase()] = key;
        });

        const requiredColumns = ['name', 'department', 'year', 'phone', 'email'];
        const missingColumns = requiredColumns.filter(col => !normalizedHeaders[col]);

        if (missingColumns.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required columns: ${missingColumns.join(', ')}`
            });
        }

        let successCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        const details = {
            skipped: [],
            failed: []
        };

        for (const row of data) {
            const name = row[normalizedHeaders['name']]?.trim();
            const email = row[normalizedHeaders['email']]?.trim().toLowerCase();
            const phone = row[normalizedHeaders['phone']]?.trim();
            const dept = row[normalizedHeaders['department']]?.trim();
            const year = row[normalizedHeaders['year']]?.trim();

            // Validation
            if (!name || !email || !phone || !dept || !year) {
                failedCount++;
                details.failed.push({
                    row: `${name || 'N/A'} (${email || 'N/A'})`,
                    reason: 'Missing required fields'
                });
                continue;
            }

            // Validate phone (10 digits)
            if (!/^\d{10}$/.test(phone)) {
                failedCount++;
                details.failed.push({
                    email,
                    reason: 'Invalid phone format (must be 10 digits)'
                });
                continue;
            }

            // Validate email
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                failedCount++;
                details.failed.push({
                    email,
                    reason: 'Invalid email format'
                });
                continue;
            }

            // Check for duplicates (SKIP without error - graceful handling)
            const existing = await get(db,
                'SELECT id FROM interview_candidates WHERE phone = ? OR email = ?',
                [phone, email]
            );

            if (existing) {
                skippedCount++;
                details.skipped.push({
                    email,
                    phone,
                    reason: 'Duplicate (phone or email already exists)'
                });
                continue;
            }

            // Insert candidate
            try {
                // Auto-generate register_no
                const register_no = `REG${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                
                await run(db,
                    `INSERT INTO interview_candidates 
                    (name, email, phone, dept, year, register_no, status, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
                    [name, email, phone, dept, year, register_no]
                );
                successCount++;
            } catch (err) {
                failedCount++;
                details.failed.push({
                    email,
                    reason: 'Database error: ' + err.message
                });
            }
        }

        await logActivity(req.user.id, 'BULK_UPLOAD_CANDIDATES', {
            total: data.length,
            success: successCount,
            skipped: skippedCount,
            failed: failedCount
        }, req, {
            action_type: 'CREATE',
            module_name: 'interviews',
            action_description: `Bulk uploaded candidates (${successCount} added, ${skippedCount} skipped, ${failedCount} failed)`
        });

        res.json({
            success: true,
            message: 'Bulk upload completed',
            stats: {
                total: data.length,
                added: successCount,
                skipped: skippedCount,
                failed: failedCount
            },
            details: details
        });

    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ============================================
// 3. DOWNLOAD SAMPLE CSV
// ============================================
router.get('/sample', (req, res) => {
    const sample = `Name,Department,Year,Phone,Email
Naren,IT,2,9751673398,naren@gmail.com
Arun,IT,2,9876543210,arun@gmail.com
Priya,CSE,3,9988776655,priya@gmail.com`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="candidates_sample.csv"');
    res.send(sample);
});

// ============================================
// 4. LIST CANDIDATES (Role-based access)
// ============================================
router.get('/candidates', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        let query = `SELECT * FROM interview_candidates`;
        const params = [];

        // Role-based access control
        if (req.user.role === 'admin' || req.user.role === 'office_bearer') {
            // Admin and office bearer see all candidates
            query += ` ORDER BY created_at DESC`;
        } else if (req.user.role === 'mentor' || req.user.is_interviewer) {
            // Mentor or flagged interviewer sees ONLY assigned candidates
            query += ` WHERE assigned_mentor_id = ? OR interviewer_id = ? ORDER BY created_at DESC`;
            params.push(req.user.id, req.user.id);
        } else {
            // Other roles cannot access
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const candidates = await all(db, query, params);

        res.json({
            success: true,
            candidates: candidates || []
        });

    } catch (error) {
        console.error('List candidates error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// 5. GET SINGLE CANDIDATE (Role-based)
// ============================================
router.get('/candidates/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const candidate = await get(db,
            'SELECT * FROM interview_candidates WHERE id = ?',
            [req.params.id]
        );

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Access control: Admin, office bearer, or assigned mentor/interviewer
        if (req.user.role === 'admin' || req.user.role === 'office_bearer') {
            // Admin and office bearer can access
        } else if ((req.user.role === 'mentor' || req.user.is_interviewer) && (candidate.assigned_mentor_id === req.user.id || candidate.interviewer_id === req.user.id)) {
            // Mentor/Interviewer can access only if assigned
        } else {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        res.json({ success: true, candidate });

    } catch (error) {
        console.error('Get candidate error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// 6. ASSIGN MENTOR TO CANDIDATE (Admin only)
// ============================================
router.post('/candidates/:id/assign-mentor', [
    authenticateToken,
    (req, res, next) => {
        if (['admin', 'office_bearer'].includes(req.user.role)) return next();
        return res.status(403).json({ success: false, message: 'Management access required' });
    },
    body('mentor_id').isInt()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { mentor_id } = req.body;

    try {
        const db = getDatabase();

        // Verify candidate exists
        const candidate = await get(db,
            'SELECT * FROM interview_candidates WHERE id = ?',
            [req.params.id]
        );

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Verify mentor exists and has role='mentor' or admin
        const mentor = await get(db,
            "SELECT id, name, email FROM users WHERE id = ? AND (role = 'mentor' OR role = 'admin')",
            [mentor_id]
        );

        if (!mentor) {
            return res.status(400).json({ success: false, message: 'Invalid mentor (must have mentor role)' });
        }

        // Update assignment
        await run(db,
            `UPDATE interview_candidates 
            SET assigned_mentor_id = ?, status = 'assigned' 
            WHERE id = ?`,
            [mentor_id, req.params.id]
        );

        // Send email to mentor about the assignment
        try {
            const mentorEmailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                        .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; }
                        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                        .candidate-card { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
                        .label { font-weight: bold; color: #667eea; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>New Interview Assignment</h1>
                        </div>
                        <div class="content">
                            <p>Dear <strong>${mentor.name}</strong>,</p>
                            <p>You have been assigned a new candidate for evaluation.</p>
                            
                            <div class="candidate-card">
                                <p><span class="label">Candidate Name:</span> ${candidate.name}</p>
                                <p><span class="label">Email:</span> ${candidate.email}</p>
                                <p><span class="label">Phone:</span> ${candidate.phone}</p>
                                <p><span class="label">Department:</span> ${candidate.dept}</p>
                                <p><span class="label">Year:</span> ${candidate.year}</p>
                            </div>

                            <p>Please evaluate this candidate on:</p>
                            <ul>
                                <li>Technical Skills (0-10)</li>
                                <li>Communication (0-10)</li>
                                <li>Problem Solving (0-10)</li>
                            </ul>

                            <p><strong>Note:</strong> Total score of 15+ will result in selection, below 15 will be rejection.</p>
                            <p>Please log in to the portal to submit your evaluation.</p>

                            <p>Best regards,<br><strong>SM Volunteers Team</strong></p>
                        </div>
                        <div class="footer">
                            <p>&copy; 2024 SM Volunteers, K.S.Rangasamy College of Technology. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            await sendEmail(
                mentor.email,
                'New Interview Candidate Assignment - SM Volunteers',
                mentorEmailHtml
            );
        } catch (emailErr) {
            console.error('Email to mentor error:', emailErr);
            // Don't fail the assignment if email fails
        }

        await logActivity(req.user.id, 'ASSIGN_MENTOR', {
            candidateId: req.params.id,
            mentorId: mentor_id
        }, req, {
            action_type: 'UPDATE',
            module_name: 'interviews',
            action_description: `Assigned mentor ${mentor.name} to candidate ${candidate.name}`
        });

        res.json({
            success: true,
            message: `Candidate assigned to ${mentor.name}. Email notification sent to mentor.`
        });

    } catch (error) {
        console.error('Assign mentor error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// 7. ENTER MARKS (Mentor only, for assigned candidates)
// ============================================
router.post('/candidates/:id/marks', [
    authenticateToken,
    body('technical').isFloat({ min: 0, max: 10 }),
    body('communication').isFloat({ min: 0, max: 10 }),
    body('problem_solving').isFloat({ min: 0, max: 10 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { technical, communication, problem_solving } = req.body;

    try {
        const db = getDatabase();

        // Get candidate
        const candidate = await get(db,
            'SELECT * FROM interview_candidates WHERE id = ?',
            [req.params.id]
        );

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Access control: Only assigned mentor can enter marks
        if (req.user.role !== 'admin' && candidate.assigned_mentor_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Unauthorized (not assigned mentor)' });
        }

        // Calculate total
        const total = parseFloat(technical) + parseFloat(communication) + parseFloat(problem_solving);

        // Determine result based on total (>=15 = selected, <15 = rejected)
        const status = total >= 15 ? 'selected' : 'rejected';

        // Update marks
        await run(db,
            `UPDATE interview_candidates 
            SET technical = ?, communication = ?, problem_solving = ?, total = ?, status = ?
            WHERE id = ?`,
            [technical, communication, problem_solving, total, status, req.params.id]
        );

        // Get updated candidate
        const updatedCandidate = await get(db,
            'SELECT * FROM interview_candidates WHERE id = ?',
            [req.params.id]
        );

        // Send auto email
        try {
            const htmlContent = getInterviewResultTemplate(updatedCandidate.name, status === 'selected');
            await sendEmail(
                updatedCandidate.email,
                'Interview Result - SM Volunteers',
                htmlContent
            );
        } catch (emailErr) {
            console.error('Email send error:', emailErr);
            // Don't fail the entire operation if email fails
        }

        await logActivity(req.user.id, 'ENTER_MARKS', {
            candidateId: req.params.id,
            technical,
            communication,
            problem_solving,
            total,
            status
        }, req, {
            action_type: 'UPDATE',
            module_name: 'interviews',
            action_description: `Entered marks for ${candidate.name} (Total: ${total}, Status: ${status})`
        });

        res.json({
            success: true,
            message: `Marks submitted. Result: ${status.toUpperCase()}. Email sent to candidate.`,
            candidate: updatedCandidate
        });

    } catch (error) {
        console.error('Enter marks error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// 8. GET CANDIDATES FOR MENTOR/INTERVIEWER
// ============================================
router.get('/my-candidates', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();

        // Allow admin, office_bearer, mentors, and users flagged as interviewers
        const isPrivileged = req.user.role === 'admin' || req.user.role === 'office_bearer' || req.user.role === 'mentor' || req.user.is_interviewer;

        if (!isPrivileged) {
            // Fallback: check if any candidates are directly assigned to this user in the DB
            // (handles case where is_interviewer flag wasn't synced after assignment)
            const assignedCheck = await all(db,
                `SELECT id FROM interview_candidates WHERE interviewer_id = ? OR assigned_mentor_id = ? LIMIT 1`,
                [req.user.id, req.user.id]
            );

            if (!assignedCheck || assignedCheck.length === 0) {
                return res.status(403).json({ success: false, message: 'Only interviewers can access this' });
            }

            // Auto-fix: set is_interviewer flag so future requests work correctly
            await run(db, 'UPDATE users SET is_interviewer = 1 WHERE id = ?', [req.user.id]);
        }

        const candidates = await all(db,
            `SELECT * FROM interview_candidates 
            WHERE assigned_mentor_id = ? OR interviewer_id = ?
            ORDER BY status, created_at DESC`,
            [req.user.id, req.user.id]
        );

        res.json({ success: true, candidates: candidates || [] });

    } catch (error) {
        console.error('Get candidate assignments error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// 9. GET DASHBOARD STATS
// ============================================
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        let query = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned,
                SUM(CASE WHEN status = 'selected' THEN 1 ELSE 0 END) as selected,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'interviewed' THEN 1 ELSE 0 END) as interviewed,
                SUM(CASE WHEN status = 'waitlisted' THEN 1 ELSE 0 END) as waitlisted
            FROM interview_candidates
        `;
        const params = [];

        if (req.user.role === 'mentor' || req.user.is_interviewer) {
            query += ` WHERE assigned_mentor_id = ? OR interviewer_id = ?`;
            params.push(req.user.id, req.user.id);
        } else if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const stats = await get(db, query, params);

        res.json({ success: true, stats: stats || {} });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// 10. GET AVAILABLE MENTORS (For admin assignment)
// ============================================
router.get('/mentors/list', authenticateToken, (req, res, next) => {
        if (['admin', 'office_bearer'].includes(req.user.role)) return next();
        return res.status(403).json({ success: false, message: 'Management access required' });
    }, async (req, res) => {
    try {
        const db = getDatabase();
        const mentors = await all(db,
            "SELECT id, name, email FROM users WHERE role = 'mentor' OR role = 'admin' ORDER BY name"
        );

        res.json({ success: true, mentors: mentors || [] });

    } catch (error) {
        console.error('Get mentors error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// Get INTERVIEWERS (flagged users)
// ============================================
router.get('/interviewers', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const interviewers = await all(db,
            "SELECT id, name, email FROM users WHERE is_interviewer = 1 OR role = 'mentor' OR role = 'admin' ORDER BY name"
        );

        res.json({ success: true, users: interviewers || [] });

    } catch (error) {
        console.error('Get interviewers error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============================================
// 11. UPDATE CANDIDATE (Admin only)
// ============================================
router.put('/candidates/:id', authenticateToken, async (req, res) => {
    try {
        const db = getDatabase();
        const candidateId = req.params.id;
        
        // Get existing candidate first
        const candidate = await get(db,
            'SELECT * FROM interview_candidates WHERE id = ?',
            [candidateId]
        );

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Authorization: Allow admin, office_bearer, or the assigned interviewer/mentor
        // Check DB directly because the JWT token may have a stale is_interviewer flag
        const isAdmin = req.user.role === 'admin';
        const isOfficeBearerRole = req.user.role === 'office_bearer';
        const isAssignedDirectly =
            candidate.interviewer_id === req.user.id ||
            candidate.assigned_mentor_id === req.user.id;
        // Also check DB flag as fallback
        const dbUser = await get(db, 'SELECT is_interviewer FROM users WHERE id = ?', [req.user.id]);
        const isInterviewerInDb = dbUser && dbUser.is_interviewer === 1;
        const isAssignedInterviewer = (req.user.is_interviewer || isInterviewerInDb) && isAssignedDirectly;

        if (!isAdmin && !isOfficeBearerRole && !isAssignedInterviewer && !isAssignedDirectly) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this candidate' });
        }

        const {
            name,
            email,
            phone,
            department,
            register_no,
            interviewer_id,
            interviewer,
            interviewer_email,
            marks,
            attendance,
            status,
            interview_date,
            interview_time
        } = req.body;

        // Build update query dynamically
        const updateFields = [];
        const updateValues = [];

        if (name !== undefined) {
            updateFields.push('name = ?');
            updateValues.push(name);
        }
        if (email !== undefined) {
            updateFields.push('email = ?');
            updateValues.push(email);
        }
        if (phone !== undefined) {
            updateFields.push('phone = ?');
            updateValues.push(phone);
        }
        if (department !== undefined) {
            updateFields.push('dept = ?');
            updateValues.push(department);
        }
        if (register_no !== undefined) {
            updateFields.push('register_no = ?');
            updateValues.push(register_no);
        }
        if (interviewer_id !== undefined) {
            updateFields.push('interviewer_id = ?');
            updateValues.push(interviewer_id);

            // Automatically set the is_interviewer flag for the assigned user
            if (interviewer_id !== null) {
                await run(db, 'UPDATE users SET is_interviewer = 1 WHERE id = ?', [interviewer_id]);
            }
        }
        if (interviewer !== undefined) {
            updateFields.push('interviewer = ?');
            updateValues.push(interviewer);
        }
        if (interviewer_email !== undefined) {
            updateFields.push('interviewer_email = ?');
            updateValues.push(interviewer_email);
        }
        if (marks !== undefined) {
            updateFields.push('marks = ?');
            updateValues.push(marks);
        }
        if (attendance !== undefined) {
            updateFields.push('attendance = ?');
            updateValues.push(attendance);
        }
        if (status !== undefined) {
            updateFields.push('status = ?');
            updateValues.push(status);
        }
        if (interview_date !== undefined) {
            updateFields.push('interview_date = ?');
            updateValues.push(interview_date);
        }
        if (interview_time !== undefined) {
            updateFields.push('interview_time = ?');
            updateValues.push(interview_time);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        // Add candidate ID to values
        updateValues.push(candidateId);

        // Execute update
        const query = `UPDATE interview_candidates SET ${updateFields.join(', ')} WHERE id = ?`;
        await run(db, query, updateValues);

        // Get updated candidate
        const updatedCandidate = await get(db,
            'SELECT * FROM interview_candidates WHERE id = ?',
            [candidateId]
        );

        await logActivity(req.user.id, 'UPDATE_CANDIDATE', { candidateId }, req, {
            action_type: 'UPDATE',
            module_name: 'interviews',
            action_description: `Updated interview candidate: ${candidate.name}`
        });

        res.json({
            success: true,
            message: 'Candidate updated successfully',
            candidate: updatedCandidate
        });

    } catch (error) {
        console.error('Update candidate error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ============================================
// 12. DELETE CANDIDATE (Admin only)
// ============================================
router.delete('/candidates/:id', authenticateToken, (req, res, next) => {
        if (['admin', 'office_bearer'].includes(req.user.role)) return next();
        return res.status(403).json({ success: false, message: 'Management access required' });
    }, async (req, res) => {
    try {
        const db = getDatabase();
        const candidateId = req.params.id;

        // Get candidate first
        const candidate = await get(db,
            'SELECT * FROM interview_candidates WHERE id = ?',
            [candidateId]
        );

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Candidate not found' });
        }

        // Delete candidate
        await run(db,
            'DELETE FROM interview_candidates WHERE id = ?',
            [candidateId]
        );

        await logActivity(req.user.id, 'DELETE_CANDIDATE', { candidateId }, req, {
            action_type: 'DELETE',
            module_name: 'interviews',
            action_description: `Deleted interview candidate: ${candidate.name}`
        });

        res.json({
            success: true,
            message: 'Candidate deleted successfully'
        });

    } catch (error) {
        console.error('Delete candidate error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

export default router;
