import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init.js';
import { promisify } from 'util';
import { logActivity } from '../utils/logger.js';


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
    // allow token in header or query parameter for file downloads
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      token = authHeader.split(' ')[1];
    }
    if (!token && req.query && req.query.token) {
      token = req.query.token;
    }

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
      logActivity(req.user.id, 'UNAUTHORIZED_ACCESS', { path: req.originalUrl || req.path, requiredRoles: roles, userRole: req.user.role }, req, {
        action_type: 'SECURITY',
        module_name: 'auth',
        action_description: `Unauthorized access attempt to ${req.originalUrl || req.path}`
      });
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

      // Permission system disabled - Admins and Office Bearers have full access
      // All other authenticated users are allowed (permission checks removed)
      if (req.user.role === 'admin' || req.user.role === 'office_bearer') {
        return next();
      }

      // For other roles (spoc, student, etc.), allow access (permission checks removed)
      // SPOC and other role-specific restrictions are handled at route level if needed
      return next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ success: false, message: 'Server error during permission check' });
    }
  };
};

// Helper function to check if SPOC is assigned to a project
export const isSPOCAssignedToProject = async (spocId, projectId) => {
  try {
    const db = getDatabase();
    const assignment = await get(
      db,
      'SELECT id FROM spoc_assignments WHERE spoc_id = ? AND project_id = ?',
      [spocId, projectId]
    );
    return !!assignment;
  } catch (error) {
    console.error('Error checking SPOC project assignment:', error);
    return false;
  }
};

// Helper function to check if SPOC is assigned to an event
export const isSPOCAssignedToEvent = async (spocId, eventId) => {
  try {
    const db = getDatabase();
    const assignment = await get(
      db,
      'SELECT id FROM spoc_assignments WHERE spoc_id = ? AND event_id = ?',
      [spocId, eventId]
    );
    return !!assignment;
  } catch (error) {
    console.error('Error checking SPOC event assignment:', error);
    return false;
  }
};

// Helper function to get SPOC's assigned project IDs
export const getSPOCAssignedProjectIds = async (spocId) => {
  try {
    const db = getDatabase();
    const assignments = await all(
      db,
      'SELECT project_id FROM spoc_assignments WHERE spoc_id = ? AND project_id IS NOT NULL',
      [spocId]
    );
    return assignments.map(a => a.project_id);
  } catch (error) {
    console.error('Error getting SPOC project assignments:', error);
    return [];
  }
};

// Helper function to get SPOC's assigned event IDs
export const getSPOCAssignedEventIds = async (spocId) => {
  try {
    const db = getDatabase();
    const assignments = await all(
      db,
      'SELECT event_id FROM spoc_assignments WHERE spoc_id = ? AND event_id IS NOT NULL',
      [spocId]
    );
    return assignments.map(a => a.event_id);
  } catch (error) {
    console.error('Error getting SPOC event assignments:', error);
    return [];
  }
};

const all = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};


