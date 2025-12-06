import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init.js';
import { promisify } from 'util';

const get = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production');
    
    const db = getDatabase();
    const user = await get(db, 'SELECT id, email, role, name FROM users WHERE id = ?', [decoded.userId]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    next();
  };
};

export const requirePermission = (permissionKey, { requireEdit = false, allowView = true } = {}) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (req.user.role === 'admin') {
        return next();
      }

      const db = getDatabase();
      const permission = await get(db, 'SELECT * FROM permissions WHERE user_id = ?', [req.user.id]);

      if (!permission) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const baseAllowed = permission[permissionKey] === 1;
      const viewAllowed = permission[`${permissionKey}_view`] === 1;
      const editAllowed = permission[`${permissionKey}_edit`] === 1;

      let hasAccess = false;
      if (requireEdit) {
        hasAccess = editAllowed || baseAllowed;
      } else if (allowView) {
        hasAccess = viewAllowed || baseAllowed;
      } else {
        hasAccess = baseAllowed;
      }

      if (!hasAccess) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  };
};

