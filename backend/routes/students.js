import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logActivity } from '../utils/logger.js';

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
        // Note: mysql wrapper in init.js handles db.run to return { lastID, changes }
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

// POST /api/students/bulk-upload
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

        // Default password 'SMV@123' hashed
        const hashedPassword = await bcrypt.hash('SMV@123', 10);

        for (const row of data) {
            // Extract values using original keys found in map
            const name = row[normalizedHeaders['name']];
            const email = row[normalizedHeaders['email']];
            const phone = row[normalizedHeaders['phone']];
            const dept = row[normalizedHeaders['department']];
            const year = row[normalizedHeaders['year']];
            const register_no = row[normalizedHeaders['register_no']];
            const academic_year = row[normalizedHeaders['academic_year']] || null;
            const dob = row[normalizedHeaders['dob']] || null;
            const gender = row[normalizedHeaders['gender']] || null;
            const blood_group = row[normalizedHeaders['blood_group']] || null;
            const father_number = row[normalizedHeaders['father_number']] || null;
            const hosteller_dayscholar = row[normalizedHeaders['hosteller_dayscholar']] || null;
            const address = row[normalizedHeaders['address']] || null;

            // Basic validation
            if (!email || !register_no || !name) {
                skippedCount++;
                skippedDetails.push({ email: email || 'N/A', reason: 'Missing name, email or register_no' });
                continue;
            }

            // Check for duplicate Email in users
            const existingEmail = await get(db, 'SELECT id FROM users WHERE email = ?', [email]);
            if (existingEmail) {
                skippedCount++;
                skippedDetails.push({ email, reason: 'Duplicate Email (User exists)' });
                continue;
            }

            // Check for duplicate Register No in profiles
            const existingRegNo = await get(db, 'SELECT id FROM profiles WHERE register_no = ?', [register_no]);
            if (existingRegNo) {
                skippedCount++;
                skippedDetails.push({ register_no, reason: 'Duplicate Register No' });
                continue;
            }

            try {
                // 1. Insert User
                const userResult = await run(db,
                    'INSERT INTO users (name, email, password, role, must_change_password) VALUES (?, ?, ?, ?, ?)',
                    [name, email, hashedPassword, 'student', 1]
                );
                const userId = userResult.lastID;

                // 2. Insert Profile with Interview Defaults
                await run(db,
                    `INSERT INTO profiles (
                    user_id, role, dept, year, phone, register_no, 
                    interview_status, interview_marks, mentor_id,
                    academic_year, dob, gender, blood_group, father_number, hosteller_dayscholar, address
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, 'student', dept, year, phone, register_no, 'Pending', null, null,
                     academic_year, dob, gender, blood_group, father_number, hosteller_dayscholar, address]
                );

                // Log creation
                await logActivity(req.user.id, 'CREATE_USER_BULK', { userId, name, email }, req, {
                    action_type: 'CREATE',
                    module_name: 'students',
                    action_description: `Bulk created student: ${name}`,
                    reference_id: userId
                });

                successCount++;

            } catch (err) {
                console.error('Row insert error:', err);
                skippedCount++;
                skippedDetails.push({ email, reason: 'Database Error: ' + err.message });
            }
        }

        await logActivity(req.user.id, 'BULK_UPLOAD_COMPLETE', {
            total: data.length,
            success: successCount,
            skipped: skippedCount
        }, req);

        res.json({
            success: true,
            message: 'Bulk upload processed successfully',
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

export default router;
