import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { body, validationResult } from 'express-validator';
import { firestore } from '../firebaseAdmin.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
} from '../repositories/userRepository.js';
import { authenticateToken } from '../middleware/auth.js';
import { ensureDefaultAdmin } from '../bootstrap/ensureDefaultAdmin.js';

const router = express.Router();

const JWT_SECRET =
  process.env.JWT_SECRET ||
  'your-super-secret-jwt-key-change-this-in-production';

ensureDefaultAdmin().catch((err) => {
  console.error('Failed to ensure default admin user at startup', err);
});

const buildUserResponse = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  mustChangePassword: !!user.mustChangePassword,
});

const issueToken = (user) =>
  jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );

// Development helper to inspect admin state
router.get('/test-admin', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res
      .status(403)
      .json({ success: false, message: 'Not available in production' });
  }

  const adminEmail = 'smvolunteers@ksrct.ac.in'.toLowerCase().trim();
  const usersSnapshot = await firestore.collection('users').get();
  const allUsers = usersSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  const admin = allUsers.find(
    (u) => u.email?.toLowerCase().trim() === adminEmail,
  );

  res.json({
    success: true,
    adminExists: !!admin,
    admin: admin || null,
    allUsers,
    testEmail: adminEmail,
  });
});

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Please provide a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors
          .array()
          .map((err) => err.msg)
          .join(', ');
        return res.status(400).json({
          success: false,
          message: errorMessages || 'Validation failed',
          errors: errors.array(),
        });
      }

      const { email, password } = req.body;
      const user = await findUserByEmail(email);

      if (!user) {
        return res
          .status(401)
          .json({ success: false, message: 'Invalid email or password' });
      }

      const isValidPassword = await bcrypt.compare(
        password,
        user.passwordHash || '',
      );

      if (!isValidPassword) {
        return res
          .status(401)
          .json({ success: false, message: 'Invalid email or password' });
      }

      const token = issueToken(user);

      res.json({
        success: true,
        token,
        user: buildUserResponse(user),
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
);

// Google OAuth start
router.get('/google', (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const scope = encodeURIComponent('openid email profile');
  const redirectUri = `${
    process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`
  }/auth/google/callback`;
  const state = req.query.state || '';

  if (!googleClientId) {
    return res
      .status(500)
      .send('Google OAuth is not configured on the server');
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${googleClientId}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&scope=${scope}&prompt=consent&access_type=offline&state=${encodeURIComponent(
    state,
  )}`;
  res.redirect(authUrl);
});

// Google OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const state = req.query.state || '';
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const serverUrl =
      process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${serverUrl}/auth/google/callback`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (!code) return res.status(400).send('Missing code');
    if (!googleClientId || !googleClientSecret)
      return res.status(500).send('Google OAuth not configured');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: String(code),
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenJson = await tokenRes.json();
    if (!tokenJson.id_token) {
      console.error('Google token response', tokenJson);
      return res.status(500).send('Failed to obtain ID token from Google');
    }

    const decoded = jwt.decode(tokenJson.id_token);
    const email = decoded?.email;
    const name = decoded?.name || decoded?.given_name || 'Google User';
    const emailVerified = decoded?.email_verified;

    if (!email || !emailVerified) {
      return res
        .status(400)
        .send('Google account email not available or not verified');
    }

    let user = await findUserByEmail(email);

    if (!user) {
      const roleFromState =
        state &&
        ['admin', 'student', 'office_bearer', 'alumni'].includes(String(state))
          ? String(state)
          : 'student';
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const hashed = await bcrypt.hash(randomPassword, 10);

      user = await createUser({
        name,
        email,
        role: roleFromState,
        passwordHash: hashed,
        mustChangePassword: false,
      });
      console.log('Created user via Google OAuth:', user.email);
    }

    const token = issueToken(user);

    const redirectTo = new URL(frontendUrl);
    redirectTo.searchParams.set('token', token);
    redirectTo.searchParams.set('role', user.role);
    return res.redirect(redirectTo.toString());
  } catch (err) {
    console.error('Google OAuth callback error', err);
    return res.status(500).send('Authentication failed');
  }
});

// Change password
router.post(
  '/change-password',
  authenticateToken,
  [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 5 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;
      const user = await findUserById(req.user.id);

      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user?.passwordHash || '',
      );

      if (!isValidPassword) {
        return res
          .status(401)
          .json({ success: false, message: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await updateUser(req.user.id, {
        passwordHash: hashedPassword,
        mustChangePassword: false,
      });

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },
);

// Forgot password (OTP placeholder)
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email } = req.body;
      const user = await findUserByEmail(email);

      if (!user) {
        return res.json({
          success: true,
          message: 'If the email exists, an OTP has been sent',
        });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`OTP for ${email}: ${otp}`);

      res.json({
        success: true,
        message: 'OTP generated (check console in development)',
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },
);

// Reset password
router.post(
  '/reset-password',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }),
    body('newPassword').isLength({ min: 5 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email, otp, newPassword } = req.body;

      if (process.env.NODE_ENV !== 'development' && otp !== '123456') {
        return res.status(400).json({ success: false, message: 'Invalid OTP' });
      }

      const user = await findUserByEmail(email);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await updateUser(user.id, {
        passwordHash: hashedPassword,
        mustChangePassword: false,
      });

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },
);

export default router;

