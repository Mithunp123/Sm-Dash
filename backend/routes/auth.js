import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';

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
    db.run(query, params, function(err) {
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
      
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Debug log
    console.log(`🔐 Login attempt for user: ${user.email}, role: ${user.role}`);

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.log(`❌ Login failed: Invalid password for email: ${email}`);
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    console.log(`✅ Login successful for user: ${user.email}`);

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.must_change_password === 1
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

// Google OAuth start - redirects user to Google consent screen
router.get('/google', (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const scope = encodeURIComponent('openid email profile');
  const redirectUri = (process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`) + '/auth/google/callback';
  const state = req.query.state || '';

  if (!googleClientId) {
    return res.status(500).json({ 
      success: false,
      message: 'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID in backend/.env' 
    });
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&prompt=consent&access_type=offline&state=${encodeURIComponent(state)}`;
  res.redirect(authUrl);
});

// Google OAuth callback - exchanges code for tokens and signs in the user
router.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const state = req.query.state || '';
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = serverUrl + '/auth/google/callback';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!code) return res.status(400).send('Missing code');
    if (!googleClientId || !googleClientSecret) return res.status(500).send('Google OAuth not configured');

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenJson = await tokenRes.json();
    if (!tokenJson.id_token) {
      console.error('Google token response', tokenJson);
      return res.status(500).send('Failed to obtain ID token from Google');
    }

    // Decode the ID token to get user info
    const decoded = jwt.decode(tokenJson.id_token);
    const email = decoded?.email;
    const name = decoded?.name || decoded?.given_name || 'Google User';
    const emailVerified = decoded?.email_verified;

    if (!email || !emailVerified) {
      return res.status(400).send('Google account email not available or not verified');
    }

    // Find or create user in database
    const db = getDatabase();

    let user = await get(db, 'SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);

    if (!user) {
      // Create a new user with default role (student) unless state provided with role
  const roleFromState = (state && ['admin','student','office_bearer','alumni'].includes(String(state))) ? String(state) : 'student';
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashed = await bcrypt.hash(randomPassword, 10);

      const insertRes = await run(db, `INSERT INTO users (name, email, password, role, must_change_password) VALUES (?, ?, ?, ?, ?)`, [name, email, hashed, roleFromState, 0]);
      user = await get(db, 'SELECT * FROM users WHERE id = ?', [insertRes.lastID]);
      console.log('Created user via Google OAuth:', user.email);
    }

    // Issue JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Redirect back to frontend with token and role
    const redirectTo = new URL(frontendUrl);
    redirectTo.searchParams.set('token', token);
    redirectTo.searchParams.set('role', user.role);
    return res.redirect(redirectTo.toString());
  } catch (err) {
    console.error('Google OAuth callback error', err);
    return res.status(500).send('Authentication failed');
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

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await run(db, 
      'UPDATE users SET password = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, req.user.id]
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Forgot Password - Generate OTP (simplified version)
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

    const user = await get(db, 'SELECT id FROM users WHERE email = ?', [email]);

    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ success: true, message: 'If the email exists, an OTP has been sent' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In production, store OTP in database with expiration and send via email
    // For now, we'll just return it (not secure, but for development)
    console.log(`OTP for ${email}: ${otp}`);

    res.json({ 
      success: true, 
      message: 'OTP generated (check console in development)',
      // Remove this in production
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Reset Password with OTP
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }),
  body('newPassword').isLength({ min: 5 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, otp, newPassword } = req.body;
    const db = getDatabase();

    // In production, verify OTP from database
    // For now, we'll accept any 6-digit OTP in development
    if (process.env.NODE_ENV !== 'development' && otp !== '123456') {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    const user = await get(db, 'SELECT id FROM users WHERE email = ?', [email]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await run(db, 
      'UPDATE users SET password = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, user.id]
    );

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;

