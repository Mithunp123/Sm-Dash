import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { logActivity } from '../utils/logger.js';

const router = express.Router();

// Test endpoint to check admin user (development only)
router.get('/test-admin', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ success: false, message: 'Not available in production' });
  }

  try {
    const db = getDatabase();
    const adminEmail = 'smvolunteers@ksrct.ac.in'.toLowerCase().trim();

    const allUsers = await new Promise((resolve, reject) => {
      db.all('SELECT id, email, role, name FROM users', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const admin = allUsers.find(u => u.email.toLowerCase().trim() === adminEmail);

    res.json({
      success: true,
      adminExists: !!admin,
      admin: admin || null,
      allUsers: allUsers,
      testEmail: adminEmail
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const get = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
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

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg).join(', ');
      return res.status(400).json({
        success: false,
        message: errorMessages || 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const db = getDatabase();

    // Normalize email (lowercase, trim) for comparison
    const normalizedEmail = email.toLowerCase().trim();

    // Find user - try multiple methods to ensure we find the user
    let user = null;

    // Method 1: Direct match with normalized email
    user = await get(db, 'SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    // Method 2: Case-insensitive match
    if (!user) {
      const allUsers = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM users', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      user = allUsers.find(u => u.email.toLowerCase().trim() === normalizedEmail);
    }

    if (!user) {
      console.log(`❌ Login failed: User not found for email: ${email}`);
      console.log(`   Searched for: ${normalizedEmail}`);

      // Debug: List all users in database (development only)
      if (process.env.NODE_ENV === 'development') {
        const allUsers = await new Promise((resolve, reject) => {
          db.all('SELECT id, email, role FROM users', [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });
        console.log('   Available users in database:', allUsers);
      }

      await logActivity(null, 'LOGIN_FAILED', { email, reason: 'User not found' }, req);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Debug log
    console.log(`🔐 Login attempt for user: ${user.email}, role: ${user.role}`);

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.log(`❌ Login failed: Invalid password for email: ${email}`);
      await logActivity(user.id, 'LOGIN_FAILED', { email, reason: 'Invalid password' }, req);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    console.log(`✅ Login successful for user: ${user.email}`);

    // Fetch user photo from profiles table
    let photo_url = null;
    try {
      const profile = await get(db, 'SELECT photo_url FROM profiles WHERE user_id = ?', [user.id]);
      if (profile && profile.photo_url) {
        photo_url = profile.photo_url;
      }
    } catch (profileErr) {
      // If profiles table doesn't exist or query fails, continue without photo
      console.log('Could not fetch user photo:', profileErr.message);
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    await logActivity(user.id, 'LOGIN_SUCCESS', { email: user.email, role: user.role }, req);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.must_change_password === 1,
        photo_url: photo_url
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user role by email (for auto-selecting role in login)
router.post('/get-role-by-email', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;
    const db = getDatabase();

    // Normalize email (lowercase, trim) for comparison
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const user = await get(db, 'SELECT role FROM users WHERE email = ?', [normalizedEmail]);

    if (!user) {
      // Don't reveal if user exists for security - just return null role
      return res.json({ success: true, role: null });
    }

    res.json({ success: true, role: user.role });
  } catch (error) {
    console.error('Get role by email error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Google OAuth Configuration
import { OAuth2Client } from 'google-auth-library';

const getOAuthClient = () => {
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
  const REDIRECT_URI = `${SERVER_URL}/auth/google/callback`;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('❌ Google OAuth config missing locations: CLIENT_ID or CLIENT_SECRET');
    return null;
  }

  return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
};

// Google OAuth start - redirects user to Google consent screen
router.get('/google', (req, res) => {
  try {
    const client = getOAuthClient();
    if (!client) {
      return res.status(500).json({ success: false, message: 'Server misconfigured: Missing Google Credentials' });
    }

    const authorizeUrl = client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ],
      prompt: 'consent',
      state: 'some_random_state_string' // In production, generate a random string and store in session to prevent CSRF
    });

    console.log('🔄 Initiating Google OAuth Flow...');

    // Debug credential loading (safely)
    const secret = process.env.GOOGLE_CLIENT_SECRET || '';
    console.log(`Debug: Client ID loaded: ${!!process.env.GOOGLE_CLIENT_ID}`);
    console.log(`Debug: Secret loaded: ${secret.length > 5 ? secret.substring(0, 4) + '...' : 'NO/SHORT'}`);
    console.log(`Debug: Callback URI: ${process.env.SERVER_URL}/auth/google/callback`);

    res.redirect(authorizeUrl);
  } catch (error) {
    console.error('Generarte Auth URL Error:', error);
    res.status(500).send('Authentication Error');
  }
});

// Google OAuth callback - exchanges code for tokens and signs in the user
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:9000';

  // Helper to redirect with error
  const redirectError = (msg) => {
    console.error(`❌ OAuth Failure: ${msg}`);
    const u = new URL(`${frontendUrl}/login`);
    u.searchParams.set('error', msg);
    return res.redirect(u.toString());
  };

  if (!code) return redirectError('No authorization code received from Google');

  try {
    const client = getOAuthClient();
    if (!client) return redirectError('Server configuration error');

    // 1. Exchange code for tokens
    console.log('🔄 Exchanging code for tokens...');
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // 2. Verify ID Token and get user profile
    console.log('🔄 Verifying ID Token...');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, email_verified, picture } = payload;

    if (!email_verified) return redirectError('Google email not verified');

    console.log(`✅ Google Auth Success for: ${email}`);

    // 3. Database Logic
    const db = getDatabase();

    // Find user
    let user = await get(db, 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);

    if (!user) {
      console.log(`❌ Google Login Rejected: User with email ${email} not found in database.`);
      return redirectError('Unauthorized access. Your email is not registered in the system.');
    } else {
      // Update existing user photo optional?
      try {
        // Optionally update the profile photo if it changed, but for now just logging
        // await run(db, 'UPDATE profiles SET photo_url = ? WHERE user_id = ?', [picture, user.id]);
      } catch (e) {
        // ignore
      }
    }

    // 4. Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // 5. Redirect to Frontend
    const successUrl = new URL(`${frontendUrl}/login`); // Redirect to login page first to handle token parsing
    successUrl.searchParams.set('token', token);
    successUrl.searchParams.set('role', user.role);

    console.log('🚀 Redirecting to frontend with token');
    res.redirect(successUrl.toString());

  } catch (error) {
    console.error('Detailed OAuth Error:', error);
    // Extract meaningful error message
    const errMsg = error.message || 'Unknown authentication error';

    // Check for common errors
    if (errMsg.includes('invalid_grant')) {
      return redirectError('Invalid or expired login session. Please try again.');
    }
    if (errMsg.includes('redirect_uri_mismatch')) {
      return redirectError('Server configuration error (Redirect URI Mismatch)');
    }

    return redirectError(`Authentication failed: ${errMsg}`);
  }
});

// Change Password
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 5 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const db = getDatabase();

    const user = await get(db, 'SELECT * FROM users WHERE id = ?', [req.user.id]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      console.log(`❌ Password change failed: Invalid current password for user ${user.email}`);
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Check if new password is same as old password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({ success: false, message: 'New password must be different from current password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateResult = await run(db,
      'UPDATE users SET password = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    if (updateResult.changes === 0) {
      console.error(`❌ Password update failed: No rows updated for user ${user.email}`);
      return res.status(500).json({ success: false, message: 'Failed to update password' });
    }

    console.log(`✅ Password changed successfully for user ${user.email}`);

    // Verify the update
    const updatedUser = await get(db, 'SELECT password FROM users WHERE id = ?', [req.user.id]);
    const verifyNewPassword = await bcrypt.compare(newPassword, updatedUser.password);
    if (!verifyNewPassword) {
      console.error(`❌ Password verification failed after update for user ${user.email}`);
      return res.status(500).json({ success: false, message: 'Password update verification failed' });
    }

    await logActivity(req.user.id, 'PASSWORD_CHANGED', { email: user.email }, req);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

import { generateOTP, getOTPExpiry } from '../utils/otp.js';
import { sendEmail, getOTPEmailTemplate } from '../utils/email.js';

// ... existing imports ...

// Forgot Password - Generate OTP
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email } = req.body;
    const db = getDatabase();

    // Check if user exists
    const user = await get(db, 'SELECT id FROM users WHERE email = ?', [email]);
    if (!user) {
      // Security: Don't reveal if user exists
      return res.json({ success: true, message: 'If the email exists, an OTP has been sent.' });
    }

    // Generate secure 6-digit OTP
    const otp = generateOTP();
    const expiresAt = getOTPExpiry(10); // 10 minutes expiry

    // Save to database
    try {
      await run(db, `INSERT INTO password_resets (email, otp, used, expires_at) VALUES (?, ?, 0, ?)`, [email, otp, expiresAt]);
    } catch (dbErr) {
      console.error('Database error saving OTP:', dbErr);
      return res.status(500).json({ success: false, message: 'Server error generating OTP' });
    }

    // Send Email
    const emailHtml = getOTPEmailTemplate(otp);
    const emailed = await sendEmail(email, 'Password Reset Code - SM Volunteers', emailHtml);

    // Logging for Debug/Development
    console.log(`🔐 OTP generated for ${email}: ${otp}`);
    if (!emailed) {
      console.warn(`⚠ Failed to send OTP email to ${email}`);
    }

    res.json({
      success: true,
      message: emailed ? 'OTP sent successfully to your email.' : 'OTP generated but email failed (check logs/dev mode).',
      // Return OTP in response ONLY in development for easier testing
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Verify OTP
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isString().isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, otp } = req.body;
    const db = getDatabase();
    const nowIso = new Date().toISOString();

    // Check for valid, unused, non-expired OTP
    const record = await get(db,
      'SELECT * FROM password_resets WHERE email = ? AND otp = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
      [email, otp, nowIso]
    );

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    res.json({ success: true, message: 'OTP verified successfully' });

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reset Password
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isString().isLength({ min: 6, max: 6 }),
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, otp, newPassword } = req.body;
    const db = getDatabase();
    const nowIso = new Date().toISOString();

    // Verify OTP again (in case verify-otp wasn't called or strictly required)
    const record = await get(db,
      'SELECT * FROM password_resets WHERE email = ? AND otp = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1',
      [email, otp, nowIso]
    );

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    // Find user
    const user = await get(db, 'SELECT id FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update User Password
    await run(db,
      'UPDATE users SET password = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, user.id]
    );

    // Mark OTP as used
    await run(db, 'UPDATE password_resets SET used = 1 WHERE id = ?', [record.id]);

    res.json({ success: true, message: 'Password has been reset successfully. You can now login.' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

