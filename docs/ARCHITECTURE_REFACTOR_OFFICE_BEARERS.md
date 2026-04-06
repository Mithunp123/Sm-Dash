# SM Volunteers Dashboard - Role-Based Architecture Refactor

## Executive Summary

This document outlines the complete refactoring of the SM Volunteers Dashboard from a simple admin/user role system to a sophisticated Office Bearer role-based access control (RBAC) system.

**Key Principles:**
- All users default to "student" role
- Office Bearer status is additive (VP has all permissions of President)
- Single-person-per-role enforcement (one President, one Secretary, etc.)
- Frontend UI renders based on effective role
- Backend validates all permissions (no URL bypass attacks)

---

## 1. Architecture Overview

### Current State
```
Users Table:
┌─────────────────────────┐
│ id | name | email | role │  ← Simple: admin/student
└─────────────────────────┘
```

### Target State
```
Users Table (unchanged):
┌──────────────────────────────────────────┐
│ id | name | email | role (always=student) │
└──────────────────────────────────────────┘
         ↓ join
Office Bearers Table (NEW):
┌─────────────────────────────────────────┐
│ id | user_id | position | assigned_date │  ← one per role
└─────────────────────────────────────────┘
```

---

## 2. Database Design

### 2.1 Users Table (Existing - Modify)

```sql
ALTER TABLE users MODIFY COLUMN role ENUM('student', 'office_bearer') DEFAULT 'student';
-- Note: Remove 'admin' role - admins now use President/VP office bearer roles
```

### 2.2 Office Bearers Table (NEW)

```sql
CREATE TABLE office_bearers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  position ENUM(
    'President',
    'Vice President', 
    'Secretary',
    'Joint Secretary',
    'Treasurer',
    'Joint Treasurer'
  ) NOT NULL UNIQUE,
  assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  term_end_date DATE NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_position (position),  -- Enforce: only one user per role
  INDEX idx_user (user_id),
  INDEX idx_active (is_active)
);
```

### 2.3 Role Permissions Reference Table (NEW)

```sql
CREATE TABLE role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  position VARCHAR(50) NOT NULL,
  feature VARCHAR(100) NOT NULL,
  permission_level ENUM('view', 'create', 'edit', 'delete') DEFAULT 'view',
  
  UNIQUE KEY uk_position_feature (position, feature),
  INDEX idx_position (position)
);

-- Seed permissions
INSERT INTO role_permissions (position, feature, permission_level) VALUES
-- President (all access)
('President', 'all', 'edit'),

-- Vice President (all access)
('Vice President', 'all', 'edit'),

-- Secretary (People, Projects, Meetings)
('Secretary', 'people', 'edit'),
('Secretary', 'projects', 'edit'),
('Secretary', 'meetings', 'edit'),
('Secretary', 'teams', 'view'),

-- Joint Secretary (viewing only)
('Joint Secretary', 'people', 'view'),
('Joint Secretary', 'meetings', 'view'),

-- Treasurer (Finance & Reports)
('Treasurer', 'finance', 'edit'),
('Treasurer', 'reports', 'view'),
('Treasurer', 'billing', 'view'),

-- Joint Treasurer (Finance read-only)
('Joint Treasurer', 'finance', 'view'),
('Joint Treasurer', 'reports', 'view');
```

### 2.4 Activity Logs Table (Optional - for audit trail)

```sql
CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id INT,
  before_value JSON,
  after_value JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_timestamp (user_id, timestamp),
  INDEX idx_action (action)
);
```

---

## 3. Backend Implementation

### 3.1 Role Service (Node.js/Express)

**File:** `backend/services/roleService.js`

```javascript
const db = require('../database');
const logger = require('../utils/logger');

class RoleService {
  /**
   * Get the effective role of a user
   * Returns: 'student' | office_bearer_position | null
   */
  static async getEffectiveRole(userId) {
    try {
      // Check if user has an office bearer role
      const [results] = await db.query(
        `SELECT position FROM office_bearers 
         WHERE user_id = ? AND is_active = 1`,
        [userId]
      );

      if (results.length > 0) {
        return results[0].position; // e.g., 'Secretary'
      }
      
      return 'student'; // Default role
    } catch (error) {
      logger.error(`[RoleService] Failed to get effective role for user ${userId}:`, error);
      return 'student'; // Safe default
    }
  }

  /**
   * Get all office bearers (current assignments)
   */
  static async getAllOfficeBearers() {
    try {
      const [results] = await db.query(`
        SELECT 
          ob.id,
          ob.position,
          ob.user_id,
          ob.assigned_date,
          u.name,
          u.email
        FROM office_bearers ob
        JOIN users u ON ob.user_id = u.id
        WHERE ob.is_active = 1
        ORDER BY FIELD(ob.position, 
          'President', 'Vice President', 'Secretary', 'Joint Secretary', 'Treasurer', 'Joint Treasurer')
      `);
      return results;
    } catch (error) {
      logger.error('[RoleService] Failed to fetch office bearers:', error);
      throw error;
    }
  }

  /**
   * Assign an office bearer role to a user
   * Validates: no duplicate roles, user doesn't already have a role
   */
  static async assignRole(userId, position) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Validate position
      const validPositions = [
        'President', 'Vice President', 'Secretary', 'Joint Secretary', 'Treasurer', 'Joint Treasurer'
      ];
      
      if (!validPositions.includes(position)) {
        throw new Error(`Invalid position: ${position}`);
      }

      // Check if role is already assigned
      const [existing] = await connection.query(
        `SELECT user_id FROM office_bearers WHERE position = ? AND is_active = 1`,
        [position]
      );
      
      if (existing.length > 0) {
        throw new Error(
          `${position} is already assigned to user ${existing[0].user_id}. ` +
          `Remove existing assignment first.`
        );
      }

      // Check if user already has a role
      const [userRoles] = await connection.query(
        `SELECT position FROM office_bearers WHERE user_id = ? AND is_active = 1`,
        [userId]
      );
      
      if (userRoles.length > 0) {
        throw new Error(
          `User ${userId} already has role: ${userRoles[0].position}. ` +
          `Remove existing role first.`
        );
      }

      // Insert new office bearer record
      const [result] = await connection.query(
        `INSERT INTO office_bearers (user_id, position) VALUES (?, ?)`,
        [userId, position]
      );

      // Update user's role field
      await connection.query(
        `UPDATE users SET role = 'office_bearer' WHERE id = ?`,
        [userId]
      );

      await connection.commit();

      logger.info(`[RoleService] Assigned ${position} to user ${userId}`);
      
      return {
        id: result.insertId,
        user_id: userId,
        position,
        assigned_date: new Date().toISOString()
      };

    } catch (error) {
      await connection.rollback();
      logger.error(`[RoleService] Failed to assign role:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Update an office bearer's role
   * Can promote to different role or remove entirely
   */
  static async updateRole(bearerId, newPosition) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get current assignment
      const [current] = await connection.query(
        `SELECT user_id, position FROM office_bearers WHERE id = ?`,
        [bearerId]
      );

      if (current.length === 0) {
        throw new Error('Office bearer not found');
      }

      const userId = current[0].user_id;
      const oldPosition = current[0].position;

      if (newPosition === null) {
        // Remove role - revert user to student
        await connection.query(
          `UPDATE office_bearers SET is_active = 0 WHERE id = ?`,
          [bearerId]
        );
        
        await connection.query(
          `UPDATE users SET role = 'student' WHERE id = ?`,
          [userId]
        );

        logger.info(`[RoleService] Removed ${oldPosition} from user ${userId}`);
        
        return { success: true, message: 'Role removed' };
      }

      // Validate new position
      const validPositions = [
        'President', 'Vice President', 'Secretary', 'Joint Secretary', 'Treasurer', 'Joint Treasurer'
      ];
      
      if (!validPositions.includes(newPosition)) {
        throw new Error(`Invalid position: ${newPosition}`);
      }

      // Check if new position is available
      const [taken] = await connection.query(
        `SELECT user_id FROM office_bearers 
         WHERE position = ? AND id != ? AND is_active = 1`,
        [newPosition, bearerId]
      );

      if (taken.length > 0) {
        throw new Error(`${newPosition} is already assigned to user ${taken[0].user_id}`);
      }

      // Update position
      await connection.query(
        `UPDATE office_bearers SET position = ? WHERE id = ?`,
        [newPosition, bearerId]
      );

      logger.info(`[RoleService] Updated user ${userId} from ${oldPosition} to ${newPosition}`);

      await connection.commit();

      return { success: true, message: 'Role updated' };

    } catch (error) {
      await connection.rollback();
      logger.error(`[RoleService] Failed to update role:`, error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Check if user has permission for a feature
   */
  static async hasPermission(userId, feature, action = 'view') {
    try {
      const role = await this.getEffectiveRole(userId);

      // Check for 'all' permission
      const [results] = await db.query(
        `SELECT permission_level FROM role_permissions 
         WHERE position = ? AND feature = 'all'`,
        [role]
      );

      if (results.length > 0) {
        const maxPerm = this.getPermissionLevel(results[0].permission_level);
        if (maxPerm >= this.getPermissionLevel(action)) {
          return true;
        }
      }

      // Check specific feature
      const [featureResults] = await db.query(
        `SELECT permission_level FROM role_permissions 
         WHERE position = ? AND feature = ?`,
        [role, feature]
      );

      if (featureResults.length === 0) {
        return false; // No permission
      }

      const permLevel = this.getPermissionLevel(featureResults[0].permission_level);
      const actionLevel = this.getPermissionLevel(action);

      return permLevel >= actionLevel;

    } catch (error) {
      logger.error(`[RoleService] Failed to check permission:`, error);
      return false; // Deny by default
    }
  }

  /**
   * Get numeric representation of permission level
   * view (1) -> create (2) -> edit (3) -> delete (4)
   */
  static getPermissionLevel(level) {
    const levels = {
      'view': 1,
      'create': 2,
      'edit': 3,
      'delete': 4
    };
    return levels[level] || 0;
  }
}

module.exports = RoleService;
```

### 3.2 Authentication Middleware

**File:** `backend/middleware/auth.js` (Updated)

```javascript
const jwt = require('jsonwebtoken');
const RoleService = require('../services/roleService');
const logger = require('../utils/logger');

/**
 * Attach user info to request (including effective role)
 */
async function attachUserInfo(req, res, next) {
  if (req.user) {
    // Fetch effective role for this user
    req.user.effectiveRole = await RoleService.getEffectiveRole(req.user.id);
    
    if (req.user.effectiveRole !== 'student') {
      logger.debug(`User ${req.user.id} has effective role: ${req.user.effectiveRole}`);
    }
  }
  next();
}

/**
 * Middleware: Require permission for a feature
 * Usage: router.get('/finance', requirePermission('finance', 'view'), handler)
 */
function requirePermission(feature, action = 'view') {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const hasAccess = await RoleService.hasPermission(req.user.id, feature, action);
    
    if (!hasAccess) {
      logger.warn(
        `User ${req.user.id} (${req.user.effectiveRole}) denied access to ${feature}:${action}`
      );
      return res.status(403).json({ 
        success: false, 
        error: 'You do not have permission to access this resource' 
      });
    }

    next();
  };
}

module.exports = {
  attachUserInfo,
  requirePermission
};
```

### 3.3 Routes - Office Bearer Management

**File:** `backend/routes/officeBearer.js`

```javascript
const express = require('express');
const RoleService = require('../services/roleService');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/office-bearers
 * Requires: full access (President/VP) or admin
 */
router.get('/office-bearers', requireAuth, requirePermission('office-bearers', 'view'), async (req, res) => {
  try {
    const bearers = await RoleService.getAllOfficeBearers();
    res.json({
      success: true,
      office_bearers: bearers
    });
  } catch (error) {
    logger.error('[GET /office-bearers]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/office-bearers
 * Assign a role to a user
 * Body: { user_id: number, position: string }
 */
router.post('/office-bearers', requireAuth, requirePermission('office-bearers', 'create'), async (req, res) => {
  try {
    const { user_id, position } = req.body;

    if (!user_id || !position) {
      return res.status(400).json({ 
        success: false, 
        error: 'user_id and position are required' 
      });
    }

    const bearer = await RoleService.assignRole(user_id, position);
    res.json({
      success: true,
      message: `${position} assigned to user ${user_id}`,
      office_bearer: bearer
    });
  } catch (error) {
    logger.error('[POST /office-bearers]', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/office-bearers/:id
 * Update or remove an office bearer role
 * Body: { position: string | null }  (null to remove)
 */
router.put('/office-bearers/:id', requireAuth, requirePermission('office-bearers', 'edit'), async (req, res) => {
  try {
    const { position } = req.body;
    const bearerId = parseInt(req.params.id);

    if (isNaN(bearerId)) {
      return res.status(400).json({ success: false, error: 'Invalid bearer ID' });
    }

    const result = await RoleService.updateRole(bearerId, position);
    res.json(result);
  } catch (error) {
    logger.error('[PUT /office-bearers/:id]', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/office-bearers/:id
 * Remove an office bearer role (sets is_active = 0)
 */
router.delete('/office-bearers/:id', requireAuth, requirePermission('office-bearers', 'delete'), async (req, res) => {
  try {
    const bearerId = parseInt(req.params.id);

    if (isNaN(bearerId)) {
      return res.status(400).json({ success: false, error: 'Invalid bearer ID' });
    }

    const result = await RoleService.updateRole(bearerId, null);
    res.json(result);
  } catch (error) {
    logger.error('[DELETE /office-bearers/:id]', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/:id/role
 * Get effective role for a user
 */
router.get('/user/:id/role', requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const role = await RoleService.getEffectiveRole(userId);
    
    res.json({
      success: true,
      user_id: userId,
      effective_role: role
    });
  } catch (error) {
    logger.error('[GET /user/:id/role]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/permissions/:userId
 * Get all permissions for a user
 */
router.get('/permissions/:userId', requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const role = await RoleService.getEffectiveRole(userId);
    
    // Query permissions for this role
    const db = require('../database');
    const [permissions] = await db.query(
      `SELECT feature, permission_level FROM role_permissions WHERE position = ? ORDER BY feature`,
      [role]
    );

    res.json({
      success: true,
      user_id: userId,
      effective_role: role,
      permissions
    });
  } catch (error) {
    logger.error('[GET /permissions/:userId]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
```

### 3.4 Update Existing Routes with Permission Checks

**Example: Finance Route**

```javascript
// Before (old code)
router.get('/finance', requireAuth, async (req, res) => {
  // No permission check - anyone can access!
  const finance = await getFinance();
  res.json(finance);
});

// After (with permission check)
router.get('/finance', 
  requireAuth, 
  requirePermission('finance', 'view'),  // ← Add this
  async (req, res) => {
    const finance = await getFinance();
    res.json(finance);
  }
);

// For edit operations
router.post('/finance', 
  requireAuth, 
  requirePermission('finance', 'create'),  // ← Add this
  async (req, res) => {
    const result = await createFinanceEntry(req.body);
    res.json(result);
  }
);
```

---

## 4. Frontend Implementation

### 4.1 Role Hook (React)

**File:** `frontend/hooks/useRole.ts`

```typescript
import { useEffect, useState } from 'react';
import { auth } from '@/lib/auth';

const ROLE_HIERARCHY = {
  'President': 10,
  'Vice President': 9,
  'Secretary': 7,
  'Joint Secretary': 5,
  'Treasurer': 4,
  'Joint Treasurer': 3,
  'student': 1
};

const ROLE_PERMISSIONS = {
  'President': {
    view: ['all'],
    create: ['all'],
    edit: ['all'],
    delete: ['all']
  },
  'Vice President': {
    view: ['all'],
    create: ['all'],
    edit: ['all'],
    delete: ['all']
  },
  'Secretary': {
    view: ['people', 'projects', 'meetings', 'teams', 'events', 'announcements'],
    create: ['meetings', 'projects'],
    edit: ['meetings', 'projects'],
    delete: []
  },
  'Joint Secretary': {
    view: ['people', 'meetings', 'events', 'announcements'],
    create: [],
    edit: [],
    delete: []
  },
  'Treasurer': {
    view: ['finance', 'reports', 'events', 'announcements'],
    create: ['finance'],
    edit: ['finance'],
    delete: []
  },
  'Joint Treasurer': {
    view: ['finance', 'reports', 'announcements'],
    create: [],
    edit: [],
    delete: []
  },
  'student': {
    view: ['events', 'teams', 'announcements', 'attendance', 'profile', 'messages'],
    create: ['messages'],
    edit: ['profile'],
    delete: []
  }
};

export const useRole = () => {
  const [role, setRole] = useState<string>('student');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const user = auth.getUser();
        if (user?.id) {
          const res = await fetch(
            `${import.meta.env.VITE_API_URL}/user/${user.id}/role`,
            {
              headers: {
                'Authorization': `Bearer ${auth.getToken()}`
              }
            }
          );
          
          if (res.ok) {
            const data = await res.json();
            setRole(data.effective_role || 'student');
          }
        }
      } catch (error) {
        console.error('Failed to fetch role:', error);
        setRole('student');
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, []);

  const hasPermission = (feature: string, action: string = 'view'): boolean => {
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['student'];
    const allowed = permissions[action] || [];

    return allowed.includes('all') || allowed.includes(feature);
  };

  const canViewFeature = (feature: string): boolean => hasPermission(feature, 'view');
  const canEditFeature = (feature: string): boolean => hasPermission(feature, 'edit');
  const canDeleteFeature = (feature: string): boolean => hasPermission(feature, 'delete');

  const getHierarchyLevel = (): number => {
    return ROLE_HIERARCHY[role] || 1;
  };

  const isPresident = (): boolean => role === 'President';
  const isVicePresident = (): boolean => role === 'Vice President';
  const isSuperAdmin = (): boolean => isPresident() || isVicePresident();

  return {
    role,
    loading,
    hasPermission,
    canViewFeature,
    canEditFeature,
    canDeleteFeature,
    getHierarchyLevel,
    isPresident,
    isVicePresident,
    isSuperAdmin
  };
};
```

### 4.2 Dynamic Sidebar Generation

**File:** `frontend/components/Sidebar.tsx` (Updated)

```typescript
const { canViewFeature } = useRole();

const getMenuCategories = (): MenuCategory[] => {
  const allMenus: Record<string, MenuCategory[]> = {
    base: [
      {
        category: "Dashboard",
        items: [
          { icon: LayoutDashboard, label: "Overview", path: "/" }
        ]
      }
    ],
    student: [
      {
        category: "Activities",
        items: [
          { icon: Calendar, label: "Events", path: "/events", feature: 'events' },
          { icon: UsersRound, label: "Teams", path: "/teams", feature: 'teams' },
          { icon: Megaphone, label: "Announcements", path: "/announcements", feature: 'announcements' }
        ]
      }
    ],
    secretary: [
      {
        category: "Management",
        items: [
          { icon: Users, label: "People", path: "/people", feature: 'people' },
          { icon: Briefcase, label: "Projects", path: "/projects", feature: 'projects' },
          { icon: Calendar, label: "Meetings", path: "/meetings", feature: 'meetings' }
        ]
      }
    ],
    treasurer: [
      {
        category: "Finance",
        items: [
          { icon: BarChart3, label: "Finance", path: "/finance", feature: 'finance' },
          { icon: FileBarChart, label: "Reports", path: "/reports", feature: 'reports' }
        ]
      }
    ],
    admin: [
      {
        category: "Administration",
        items: [
          { icon: Users, label: "Manage Users", path: "/admin/users" },
          { icon: Users, label: "Office Bearers", path: "/admin/office-bearers" },
          { icon: Settings, label: "Settings", path: "/admin/settings" }
        ]
      }
    ]
  };

  // Start with base menus
  let activeMenus = [...allMenus.base];

  // Add role-specific menus
  if (role === 'President' || role === 'Vice President') {
    // Full access
    Object.entries(allMenus).forEach(([key, menus]) => {
      if (key !== 'base') {
        activeMenus.push(...menus);
      }
    });
  } else if (role === 'Secretary') {
    activeMenus.push(...allMenus.secretary);
    activeMenus.push(...allMenus.student);
  } else if (role === 'Treasurer') {
    activeMenus.push(...allMenus.treasurer);
    activeMenus.push(...allMenus.student);
  } else {
    // Default student
    activeMenus.push(...allMenus.student);
  }

  // Filter by feature permissions
  return activeMenus.map(category => ({
    ...category,
    items: category.items.filter(item =>
      !item.feature || canViewFeature(item.feature)
    )
  })).filter(category => category.items.length > 0);
};
```

---

## 5. Migration Strategy

### Phase 1: Database Setup (1-2 hours)

```bash
# 1. Create new tables
mysql < migrations/add_office_bearers.sql

# 2. Backup existing data
mysqldump sm_volunteers users > backup_users.sql

# 3. Verify migration
SELECT COUNT(*) FROM office_bearers;
SELECT COUNT(*) FROM role_permissions;
```

### Phase 2: Backend Implementation (4-8 hours)

1. Add `RoleService` to backend
2. Update middleware with `attachUserInfo`
3. Add `requirePermission` checks to routes
4. Deploy backend changes

### Phase 3: Frontend Updates (4-6 hours)

1. Add `useRole` hook
2. Update Sidebar with dynamic menu generation
3. Add UI guards to sensitive features
4. Update permission checks in components

### Phase 4: Data Migration (1-2 hours)

```sql
-- Convert existing admins to President role
INSERT INTO office_bearers (user_id, position)
SELECT id, 'President'
FROM users
WHERE role = 'admin'
LIMIT 1;  -- Only first admin

-- Keep others as students
UPDATE users SET role = 'student' WHERE role != 'office_bearer';
```

### Phase 5: Testing & Rollout (2-4 hours)

1. Test all roles on staging
2. Verify permission denials (404 attempts)
3. Gradual rollout: 10% → 50% → 100%
4. Monitor error logs

---

## 6. Safety Checks & URL Bypass Prevention

### Backend Validation Checklist

```javascript
// ✓ Every sensitive endpoint MUST have requirePermission
// ✓ Frontend UI hiding is NOT security - backend must validate
// ✓ Check role on EVERY request (not just login)
// ✓ Deny by default, allow only what's explicitly permitted

// Example: Safe Finance Endpoint
router.get('/api/finance', 
  requireAuth,  // User must be logged in
  requirePermission('finance', 'view'),  // User must have permission
  (req, res) => {
    // Safe to proceed
    const data = getFinanceData(req.user.id);
    res.json(data);
  }
);

// Unsafe - would allow bypass:
router.get('/api/finance', requireAuth, (req, res) => {
  // NO PERMISSION CHECK - anyone can access!
  res.json(getFinanceData());
});
```

### Testing URL Bypasses

```bash
# Test 1: Direct Finance API access (should fail if not Treasurer)
curl -H "Authorization: Bearer STUDENT_TOKEN" \
  http://localhost:3000/api/finance

# Expected: 403 Forbidden

# Test 2: Verify role is fetched on each request
# Login as student, promote to Secretary, check access
# Should immediately have Secretary permissions (not cached)
```

---

## 7. UI Structure - Manage Office Bearers Page

**File:** `frontend/pages/ManageOfficeBearers.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

const ManageOfficeBearers = () => {
  const [bearers, setBearers] = useState([]);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [loading, setLoading] = useState(true);

  const positions = [
    'President',
    'Vice President',
    'Secretary',
    'Joint Secretary',
    'Treasurer',
    'Joint Treasurer'
  ];

  useEffect(() => {
    loadOfficeBearers();
    loadUsers();
  }, []);

  const loadOfficeBearers = async () => {
    try {
      const res = await fetch('/api/office-bearers', {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) setBearers(data.office_bearers);
    } catch (error) {
      toast.error('Failed to load office bearers');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });
      const data = await res.json();
      if (data.success) setUsers(data.users);
    } catch (error) {
      toast.error('Failed to load users');
    }
  };

  const handleAssignRole = async () => {
    if (!newUser || !newPosition) {
      toast.error('Select both user and position');
      return;
    }

    try {
      const res = await fetch('/api/office-bearers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.getToken()}`
        },
        body: JSON.stringify({
          user_id: parseInt(newUser),
          position: newPosition
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`${newPosition} assigned!`);
        setNewUser('');
        setNewPosition('');
        loadOfficeBearers();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to assign role');
    }
  };

  const handleRemoveRole = async (bearerId) => {
    if (!confirm('Remove this role assignment?')) return;

    try {
      const res = await fetch(`/api/office-bearers/${bearerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${auth.getToken()}` }
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Role removed');
        loadOfficeBearers();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Failed to remove role');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Manage Office Bearers</h1>

      {/* Assignment Form */}
      <div className="grid grid-cols-3 gap-4 mb-6 p-4 border rounded-lg">
        <Select value={newUser} onValueChange={setNewUser}>
          <SelectTrigger>
            <SelectValue placeholder="Select User" />
          </SelectTrigger>
          <SelectContent>
            {users.filter(u => !bearers.some(b => b.user_id === u.id)).map(u => (
              <SelectItem key={u.id} value={u.id.toString()}>
                {u.name} ({u.email})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={newPosition} onValueChange={setNewPosition}>
          <SelectTrigger>
            <SelectValue placeholder="Select Position" />
          </SelectTrigger>
          <SelectContent>
            {positions.map(p => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleAssignRole}>Assign Role</Button>
      </div>

      {/* Current Assignments */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Position</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Assigned Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bearers.map(bearer => (
            <TableRow key={bearer.id}>
              <TableCell className="font-semibold">{bearer.position}</TableCell>
              <TableCell>{bearer.name}</TableCell>
              <TableCell>{bearer.email}</TableCell>
              <TableCell>{new Date(bearer.assigned_date).toLocaleDateString()}</TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemoveRole(bearer.id)}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ManageOfficeBearers;
```

---

## 8. Configuration & Environment

### Backend `.env`

```env
# Role-based access control
ENABLE_RBAC=true
ENFORCE_UNIQUE_ROLES=true
LOG_PERMISSION_DENIALS=true
DEFAULT_ROLE=student
```

### Frontend `.env`

```env
VITE_ENABLE_PERMISSION_CHECKS=true
VITE_HIDE_RESTRICTED_FEATURES=true
VITE_SYNC_ROLE_ON_MOUNT=true
```

---

## 9. Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| User still sees old menu after role change | Frontend cache | Clear localStorage, refresh page |
| Username not updating in header | Event not dispatched | Verify `profileUpdated` event fires |
| "You don't have permission" error  | Missing permission check in DB | Run seeding script for `role_permissions` |
| Two users with same role | UNIQUE constraint failed | Check database constraint, verify deletion worked |
| Role permission not applied | Backend cache | Restart server, clear connection pool |

---

## 10. Deployment Checklist

- [ ] Database migration applied (office_bearers table created)
- [ ] role_permissions table seeded with all role/feature combinations
- [ ] Backend RoleService implemented and tested
- [ ] requirePermission middleware added to all sensitive routes
- [ ] Frontend useRole hook implemented
- [ ] Sidebar dynamically filters by permissions
- [ ] ManageOfficeBearers page functional
- [ ] URL bypass tests passed (403 for unauthorized access)
- [ ] Role changes immediately reflected (no caching)
- [ ] Staging environment tested with all role combinations
- [ ] Database backups created
- [ ] Monitoring alerts set up for permission denials
- [ ] Documentation updated for developers
- [ ] Team trained on new permission model

---

## 11. Future Enhancements

1. **Role Expiration**: Add `term_end_date` validation
2. **Audit Trail**: Log all role changes to `activity_logs`
3. **Role Delegation**: Allow President to delegate temporarily
4. **Groups**: Create role groups (e.g., "Finance Committee")
5. **Claims-Based**: Use JWT claims for role info (faster checks)
6. **API Rate Limiting**: Different limits per role
7. **Feature Flags**: Toggle features per role dynamically

---

## 12. Quick Reference

### For Developers

**Add permission to a route:**
```javascript
router.post('/api/finance', 
  requireAuth, 
  requirePermission('finance', 'create'),
  handler
);
```

**Check permission in frontend:**
```typescript
const { canViewFeature } = useRole();
if (!canViewFeature('finance')) return <AccessDenied />;
```

**Get user's effective role:**
```javascript
const role = await RoleService.getEffectiveRole(userId);
// Returns: 'President' | 'Secretary' | ... | 'student'
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-06  
**Architecture Lead:** Senior Software Architect  
**Status:** Ready for Implementation
