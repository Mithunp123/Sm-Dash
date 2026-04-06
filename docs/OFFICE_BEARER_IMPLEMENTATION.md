# Office Bearer System - Implementation Guide

## Quick Start

### 1. Database Migration

```sql
-- Create office_bearers table
CREATE TABLE IF NOT EXISTS office_bearers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  position ENUM(
    'President',
    'Vice President',
    'Secretary',
    'Joint Secretary',
    'Treasurer',
    'Joint Treasurer'
  ) NOT NULL UNIQUE,
  assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  term_end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_active (is_active),
  INDEX idx_position (position)
);

-- Create role_permissions reference table
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  position VARCHAR(50) NOT NULL,
  feature VARCHAR(100) NOT NULL,
  permission_level ENUM('view', 'edit', 'delete', 'create') DEFAULT 'view',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY (position, feature),
  INDEX idx_position (position)
);

-- Seed role permissions
INSERT INTO role_permissions (position, feature, permission_level) VALUES
-- President (All access)
('President', 'all', 'edit'),

-- Vice President (All access)
('Vice President', 'all', 'edit'),

-- Secretary
('Secretary', 'people', 'view'),
('Secretary', 'people', 'edit'),
('Secretary', 'projects', 'view'),
('Secretary', 'projects', 'edit'),
('Secretary', 'meetings', 'view'),
('Secretary', 'meetings', 'edit'),
('Secretary', 'teams', 'view'),
('Secretary', 'teammates', 'edit'),

-- Joint Secretary
('Joint Secretary', 'people', 'view'),
('Joint Secretary', 'meetings', 'view'),

-- Treasurer
('Treasurer', 'finance', 'view'),
('Treasurer', 'finance', 'edit'),
('Treasurer', 'reports', 'view'),

-- Joint Treasurer
('Joint Treasurer', 'finance', 'view'),
('Joint Treasurer', 'reports', 'view'),

-- Student
('student', 'events', 'view'),
('student', 'teams', 'view'),
('student', 'announcements', 'view'),
('student', 'attendance', 'view'),
('student', 'profile', 'edit');

-- Create activity_logs table (optional - for auditing)
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id INT,
  before_value JSON,
  after_value JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_timestamp (user_id, timestamp),
  INDEX idx_action (action)
);
```

---

## 2. Backend Setup

### Create Role Service

```typescript
// backend/services/roleService.ts

import db from '@/database';

export class RoleService {
  /**
   * Get office bearer by user ID
   */
  static async getOfficeBearer(userId: number) {
    const [result] = await db.query(
      'SELECT * FROM office_bearers WHERE user_id = ? AND is_active = 1',
      [userId]
    );
    return result[0] || null;
  }

  /**
   * Get all active office bearers
   */
  static async getAllOfficeBearers() {
    const [results] = await db.query(`
      SELECT ob.*, u.name, u.email
      FROM office_bearers ob
      JOIN users u ON ob.user_id = u.id
      WHERE ob.is_active = 1
      ORDER BY FIELD(ob.position, 
        'President', 'Vice President', 'Secretary', 'Joint Secretary', 'Treasurer', 'Joint Treasurer')
    `);
    return results;
  }

  /**
   * Assign role to user
   */
  static async assignRole(userId: number, position: string) {
    // Validate position
    const validPositions = [
      'President', 'Vice President', 'Secretary', 'Joint Secretary', 'Treasurer', 'Joint Treasurer'
    ];
    
    if (!validPositions.includes(position)) {
      throw new Error('Invalid position');
    }

    // Check if role already assigned to someone else
    const [existing] = await db.query(
      'SELECT * FROM office_bearers WHERE position = ? AND is_active = 1',
      [position]
    );
    
    if (existing.length > 0) {
      throw new Error(`${position} role already assigned to user ${existing[0].user_id}`);
    }

    // Check if user already has a role
    const [userHasRole] = await db.query(
      'SELECT * FROM office_bearers WHERE user_id = ? AND is_active = 1',
      [userId]
    );
    
    if (userHasRole.length > 0) {
      throw new Error('User already has an ongoing office bearer role');
    }

    // Insert office bearer record
    const [result] = await db.query(
      'INSERT INTO office_bearers (user_id, position, assigned_date) VALUES (?, ?, NOW())',
      [userId, position]
    );

    // Update user role
    await db.query(
      'UPDATE users SET role = ? WHERE id = ?',
      ['office_bearer', userId]
    );

    return { id: result.insertId, user_id: userId, position };
  }

  /**
   * Update office bearer role
   */
  static async updateRole(bearerId: number, newPosition: string | null) {
    const [current] = await db.query(
      'SELECT * FROM office_bearers WHERE id = ?',
      [bearerId]
    );

    if (!current.length) {
      throw new Error('Office bearer not found');
    }

    if (newPosition === null) {
      // Remove role
      await db.query('UPDATE office_bearers SET is_active = 0 WHERE id = ?', [bearerId]);
      await db.query('UPDATE users SET role = ? WHERE id = ?', ['student', current[0].user_id]);
      return { success: true, message: 'Role removed' };
    }

    // Check if new position available
    const [taken] = await db.query(
      'SELECT * FROM office_bearers WHERE position = ? AND id != ? AND is_active = 1',
      [newPosition, bearerId]
    );

    if (taken.length > 0) {
      throw new Error(`${newPosition} role already assigned`);
    }

    await db.query(
      'UPDATE office_bearers SET position = ? WHERE id = ?',
      [newPosition, bearerId]
    );

    return { success: true, message: 'Role updated' };
  }

  /**
   * Get user permissions
   */
  static async getUserPermissions(userId: number) {
    const bearer = await this.getOfficeBearer(userId);
    
    let position = 'student';
    if (bearer) {
      position = bearer.position;
    }

    const [permissions] = await db.query(
      'SELECT feature, permission_level FROM role_permissions WHERE position = ?',
      [position]
    );

    return permissions;
  }

  /**
   * Check if user has permission
   */
  static async hasPermission(userId: number, feature: string, action: string = 'view'): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    // Check for 'all' access
    const allAccess = permissions.find((p: any) => p.feature === 'all' && (p.permission_level === action || p.permission_level === 'edit'));
    if (allAccess) return true;

    // Check specific feature
    const hasFeature = permissions.find((p: any) => 
      p.feature === feature && 
      (p.permission_level === action || p.permission_level === 'edit' || p.permission_level === 'view')
    );

    return !!hasFeature;
  }
}
```

### Create Routes

```typescript
// backend/routes/officeBearer.ts

import express from 'express';
import { RoleService } from '@/services/roleService';
import { requireAuth } from '@/middleware/auth';
import { requirePermission } from '@/middleware/roleMiddleware';

const router = express.Router();

/**
 * GET /api/office-bearers
 * Get all active office bearers
 */
router.get(
  '/office-bearers',
  requireAuth,
  requirePermission('manage-office-bearers', 'view'),
  async (req, res) => {
    try {
      const bearers = await RoleService.getAllOfficeBearers();
      res.json({
        success: true,
        office_bearers: bearers
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/office-bearers/:userId
 * Get office bearer by user ID
 */
router.get(
  '/office-bearers/:userId',
  requireAuth,
  async (req, res) => {
    try {
      const bearer = await RoleService.getOfficeBearer(parseInt(req.params.userId));
      res.json({
        success: true,
        office_bearer: bearer
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/office-bearers
 * Assign role to user
 */
router.post(
  '/office-bearers',
  requireAuth,
  requirePermission('manage-office-bearers', 'create'),
  async (req, res) => {
    try {
      const { user_id, position } = req.body;

      if (!user_id || !position) {
        return res.status(400).json({ error: 'user_id and position required' });
      }

      const bearer = await RoleService.assignRole(user_id, position);

      res.json({
        success: true,
        message: `${position} assigned successfully`,
        office_bearer: bearer
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * PUT /api/office-bearers/:id
 * Update or remove role
 */
router.put(
  '/office-bearers/:id',
  requireAuth,
  requirePermission('manage-office-bearers', 'edit'),
  async (req, res) => {
    try {
      const { position } = req.body;
      const result = await RoleService.updateRole(parseInt(req.params.id), position);

      res.json(result);
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/permissions/:userId
 * Get user permissions
 */
router.get(
  '/permissions/:userId',
  requireAuth,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const permissions = await RoleService.getUserPermissions(userId);

      res.json({
        success: true,
        permissions
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
```

### Update Auth Types

```typescript
// backend/middleware/auth.ts

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string;
        role: 'student' | 'office_bearer' | 'admin';
        office_bearer_position?: string;
      };
    }
  }
}

export async function attachUserInfo(req: any, res: any, next: any) {
  if (req.user) {
    if (req.user.role === 'office_bearer') {
      const bearer = await RoleService.getOfficeBearer(req.user.id);
      if (bearer) {
        req.user.office_bearer_position = bearer.position;
      }
    }
  }
  next();
}
```

---

## 3. Frontend Implementation

### Create Role Hook

```typescript
// frontend/hooks/useRole.ts

import { useEffect, useState } from 'react';
import { auth } from '@/lib/auth';

const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  'President': {
    view: ['all'],
    edit: ['all'],
    delete: ['all'],
    create: ['all']
  },
  'Vice President': {
    view: ['all'],
    edit: ['all'],
    delete: ['all'],
    create: ['all']
  },
  'Secretary': {
    view: ['people', 'projects', 'meetings', 'teams', 'events'],
    edit: ['projects', 'meetings'],
    delete: [],
    create: ['meetings', 'projects']
  },
  'Joint Secretary': {
    view: ['people', 'meetings', 'events'],
    edit: [],
    delete: [],
    create: []
  },
  'Treasurer': {
    view: ['finance', 'reports', 'events'],
    edit: ['finance'],
    delete: [],
    create: ['finance']
  },
  'Joint Treasurer': {
    view: ['finance', 'reports', 'events'],
    edit: [],
    delete: [],
    create: []
  },
  'student': {
    view: ['events', 'teams', 'announcements', 'attendance', 'profile'],
    edit: ['profile'],
    delete: [],
    create: []
  },
  'admin': {
    view: ['all'],
    edit: ['all'],
    delete: ['all'],
    create: ['all']
  }
};

export function useRole() {
  const [role, setRole] = useState<string>('student');
  const [position, setPosition] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.getUser();
    if (user) {
      setRole(user.role || 'student');
    }
    setLoading(false);
  }, []);

  const hasPermission = (feature: string, action: 'view' | 'edit' | 'delete' | 'create' = 'view'): boolean => {
    const effectiveRole = position || role;
    const permissions = ROLE_PERMISSIONS[effectiveRole] || ROLE_PERMISSIONS['student'];
    const allowed = permissions[action] || [];

    return allowed.includes('all') || allowed.includes(feature);
  };

  const getMenuItems = () => {
    const effectiveRole = position || role;

    if (role === 'admin') return 'admin';
    if (role === 'office_bearer') return effectiveRole;
    return 'student';
  };

  return {
    role,
    position,
    loading,
    hasPermission,
    getMenuItems,
    isAdmin: role === 'admin',
    isOfficBearer: role === 'office_bearer'
  };
}
```

### Update Sidebar Menus

```typescript
// frontend/components/Sidebar.tsx - Simplified excerpt

const getMenusForRole = (effectiveRole: string): MenuCategory[] => {
  const baseMenus: Record<string, MenuCategory[]> = {
    'admin': [
      { category: 'Admin', items: [
        { label: 'Dashboard', path: '/admin' },
        { label: 'Manage Users', path: '/admin/users' },
        { label: 'Manage Office Bearers', path: '/admin/office-bearers' },
        { label: 'Activity Logs', path: '/admin/activity-logs' }
      ]},
      // ... other menus
    ],
    'President': [
      { category: 'Dashboard', items: [{ label: 'Overview', path: '/office-bearer' }] },
      { category: 'Management', items: [
        { label: 'Manage Users', path: '/admin/users' },
        { label: 'Manage Office Bearers', path: '/admin/office-bearers' }
      ]},
      // ... all menus
    ],
    'Vice President': [ /* same as President */ ],
    'Secretary': [
      { category: 'Dashboard', items: [{ label: 'Dashboard', path: '/office-bearer' }] },
      { category: 'People', items: [{ label: 'Manage People', path: '/admin/people' }] },
      { category: 'Projects', items: [{ label: 'Projects', path: '/admin/projects' }] },
      { category: 'Meetings', items: [{ label: 'Meetings', path: '/admin/meetings' }] }
    ],
    'Treasurer': [
      { category: 'Dashboard', items: [{ label: 'Dashboard', path: '/office-bearer' }] },
      { category: 'Finance', items: [
        { label: 'Finance', path: '/admin/finance' },
        { label: 'Reports', path: '/admin/reports' }
      ]}
    ],
    'student': [
      { category: 'Dashboard', items: [{ label: 'Dashboard', path: '/student' }] },
      { category: 'Activities', items: [
        { label: 'Events', path: '/student/events' },
        { label: 'Teams', path: '/student/teams' }
      ]}
    ]
  };

  return baseMenus[effectiveRole] || baseMenus['student'];
};
```

---

## 4. Integration Steps

### Step 1: Run Database Migration
```bash
mysql -u root -p < office_bearer_migration.sql
```

### Step 2: Install Service
- Copy `roleService.ts` to `backend/services/`
- Import in relevant controllers

### Step 3: Update Routes
- Add office bearer routes to main router
- Import `RoleService`

### Step 4: Update Sidebar
- Replace menu logic with new role-based system
- Test all roles

### Step 5: Test Permissions
- Test each role's access
- Verify URL bypass prevention
- Test permission errors

---

## 5. Environment Variables

```env
# Add to .env
ROLE_CHECK_ENABLED=true
LOG_ROLE_CHANGES=true
ENFORCE_UNIQUE_ROLES=true
```

---

## 6. Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| User sees admin menu after logout | Clear browser cache, verify token removal |
| Duplicate roles in database | Check unique key on `office_bearers.position` |
| Permission denied on valid route | Verify role_permissions table has entry |
| UI doesn't update after role change | Refresh page or clear redux/local state |
| URL bypass to restricted page | Verify backend middleware is applied |

