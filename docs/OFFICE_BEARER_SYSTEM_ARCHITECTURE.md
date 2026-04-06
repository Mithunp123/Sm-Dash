# SM Volunteers - Office Bearer System Architecture

## 1. ROLE-PERMISSION MAPPING

### Office Bearer Roles Hierarchy

```
TIER 1 (Full Access)
├── President → All features
└── Vice President → All features

TIER 2 (Department Access)
├── Secretary → People, Projects, Meetings, Teams
└── Joint Secretary → People, Meetings (limited edit)

TIER 3 (Finance)
├── Treasurer → Finance, Reports, Billing
└── Joint Treasurer → Finance (view only), Reports (view only)

TIER 0 (Student - No Role)
└── Student → Events, Tasks, Announcements, Attendance, Teams
```

### Permission Matrix

```
Feature                 | President | VP | Secretary | Joint Sec | Treasurer | Jt Treasurer | Student
------------------------|-----------|----|-----------|-----------|-----------|--------------|---------
Dashboard               | ✓         | ✓  | ✓         | ✓         | ✓         | ✓            | ✓
My Profile              | ✓         | ✓  | ✓         | ✓         | ✓         | ✓            | ✓
Manage Users            | ✓         | ✓  | ✗         | ✗         | ✗         | ✗            | ✗
Manage Office Bearers   | ✓         | ✓  | ✗         | ✗         | ✗         | ✗            | ✗
People Management       | ✓         | ✓  | ✓         | ✓ (view)  | ✗         | ✗            | ✗
Projects                | ✓         | ✓  | ✓ (edit)  | ✓ (view)  | ✗         | ✗            | ✗
Meetings                | ✓         | ✓  | ✓ (edit)  | ✓ (view)  | ✗         | ✗            | ✗
Teams                   | ✓         | ✓  | ✓         | ✓         | ✗         | ✗            | ✓
Events                  | ✓         | ✓  | ✓         | ✓         | ✓         | ✓            | ✓
Finance                 | ✓         | ✓  | ✗         | ✗         | ✓         | ✓ (view)     | ✗
Reports                 | ✓         | ✓  | ✗         | ✗         | ✓         | ✓ (view)     | ✗
Announcements           | ✓         | ✓  | ✓         | ✓         | ✓         | ✓            | ✓
Attendance              | ✓         | ✓  | ✓         | ✓         | ✗         | ✗            | ✓
Activity Logs           | ✓         | ✓  | ✗         | ✗         | ✗         | ✗            | ✗
```

---

## 2. DATABASE SCHEMA

### Users Table (existing)
```sql
users {
  id: INT PRIMARY KEY
  name: VARCHAR
  email: VARCHAR UNIQUE
  role: ENUM('student', 'office_bearer', 'admin') -- DEFAULT 'student'
  must_change_password: BOOLEAN
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
}
```

### Office Bearers Table (new)
```sql
office_bearers {
  id: INT PRIMARY KEY
  user_id: INT UNIQUE NOT NULL -- Only one role per user
  position: ENUM(
    'President',
    'Vice President',
    'Secretary',
    'Joint Secretary',
    'Treasurer',
    'Joint Treasurer'
  ) UNIQUE NOT NULL -- Only one user per role
  assigned_date: TIMESTAMP
  term_end_date: DATE (optional)
  is_active: BOOLEAN DEFAULT TRUE
  created_at: TIMESTAMP
  updated_at: TIMESTAMP
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  UNIQUE KEY (position) -- Enforce one user per role
}
```

### Role Permissions Table (helper)
```sql
role_permissions {
  id: INT PRIMARY KEY
  position: VARCHAR(50)
  feature: VARCHAR(100)
  permission_level: ENUM('view', 'edit', 'delete', 'create')
  created_at: TIMESTAMP
  
  UNIQUE KEY (position, feature)
}
```

### Activity Logs (new - for auditing)
```sql
activity_logs {
  id: INT PRIMARY KEY
  user_id: INT
  action: VARCHAR(100)
  entity_type: VARCHAR(50) -- 'office_bearer', 'project', etc.
  entity_id: INT
  before_value: JSON
  after_value: JSON
  timestamp: TIMESTAMP
  ip_address: VARCHAR(45)
  
  FOREIGN KEY (user_id) REFERENCES users(id)
}
```

---

## 3. FRONTEND IMPLEMENTATION

### User Role Detection Logic

```typescript
// lib/roleUtils.ts

interface UserWithRole {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'office_bearer' | 'admin';
  office_bearer_position?: string;
}

// Get effective user role/permissions
export function getEffectiveRole(user: UserWithRole) {
  if (user.role === 'admin') return 'admin';
  if (user.role === 'office_bearer') return user.office_bearer_position;
  return 'student';
}

// Check permission
export function hasPermission(user: UserWithRole, feature: string, action: 'view' | 'edit' | 'delete' | 'create' = 'view'): boolean {
  const role = getEffectiveRole(user);
  
  const permissions: Record<string, Record<string, string[]>> = {
    'President': { view: ['all'], edit: ['all'], delete: ['all'], create: ['all'] },
    'Vice President': { view: ['all'], edit: ['all'], delete: ['all'], create: ['all'] },
    'Secretary': { view: ['people', 'projects', 'meetings'], edit: ['projects', 'meetings'], delete: [], create: ['meetings', 'projects'] },
    'Joint Secretary': { view: ['people', 'meetings'], edit: [], delete: [], create: [] },
    'Treasurer': { view: ['finance', 'reports'], edit: ['finance'], delete: [], create: ['finance'] },
    'Joint Treasurer': { view: ['finance', 'reports'], edit: [], delete: [], create: [] },
    'student': { view: ['events', 'teams', 'announcements', 'attendance'], edit: ['profile'], delete: [], create: [] },
    'admin': { view: ['all'], edit: ['all'], delete: ['all'], create: ['all'] },
  };

  const rolePerms = permissions[role] || permissions['student'];
  const allFeatures = rolePerms[action] || [];
  
  return allFeatures.includes('all') || allFeatures.includes(feature);
}

// Get sidebar menu based on role
export function getSidebarMenuForRole(role: string) {
  const menus: Record<string, string[]> = {
    'President': ['dashboard', 'manage-users', 'manage-office-bearers', 'people', 'projects', 'meetings', 'finance', 'reports', 'teams', 'events', 'announcements'],
    'Vice President': ['dashboard', 'manage-users', 'manage-office-bearers', 'people', 'projects', 'meetings', 'finance', 'reports', 'teams', 'events', 'announcements'],
    'Secretary': ['dashboard', 'people', 'projects', 'meetings', 'teams', 'events', 'announcements'],
    'Joint Secretary': ['dashboard', 'people', 'meetings', 'events', 'announcements'],
    'Treasurer': ['dashboard', 'finance', 'reports', 'events', 'announcements'],
    'Joint Treasurer': ['dashboard', 'finance', 'reports', 'events', 'announcements'],
    'student': ['dashboard', 'teams', 'events', 'announcements', 'attendance'],
    'admin': ['all'],
  };
  
  return menus[role] || menus['student'];
}
```

### Dynamic Sidebar Implementation

```typescript
// components/Sidebar.tsx

export function getSidebarMenuCategories(user: UserWithRole): MenuCategory[] {
  const effectiveRole = getEffectiveRole(user);
  
  if (effectiveRole === 'admin') {
    return getAllAdminMenus();
  }
  
  if (user.role === 'office_bearer') {
    return getOfficeBearerMenus(effectiveRole);
  }
  
  return getStudentMenus();
}

function getOfficeBearerMenus(position: string): MenuCategory[] {
  const baseMenu = [
    { category: 'Dashboard', items: [{ label: 'Overview', path: '/office-bearer' }] }
  ];
  
  if (position === 'President' || position === 'Vice President') {
    return [
      ...baseMenu,
      { category: 'Management', items: [
        { label: 'Manage Users', path: '/admin/users' },
        { label: 'Manage Office Bearers', path: '/admin/office-bearers' }
      ]},
      { category: 'Finance', items: [
        { label: 'Finance', path: '/admin/finance' },
        { label: 'Reports', path: '/admin/reports' }
      ]},
      // ... all other menus
    ];
  }
  
  if (position === 'Secretary' || position === 'Joint Secretary') {
    return [
      ...baseMenu,
      { category: 'People', items: [{ label: 'Manage People', path: '/admin/people' }] },
      { category: 'Projects', items: [{ label: 'Projects', path: '/admin/projects' }] },
      { category: 'Meetings', items: [{ label: 'Meetings', path: '/admin/meetings' }] }
    ];
  }
  
  if (position === 'Treasurer' || position === 'Joint Treasurer') {
    return [
      ...baseMenu,
      { category: 'Finance', items: [
        { label: 'Finance', path: '/admin/finance' },
        { label: 'Reports', path: '/admin/reports' }
      ]}
    ];
  }
  
  return baseMenu;
}
```

---

## 4. BACKEND VALIDATION

### Express Middleware

```typescript
// middleware/roleMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import { auth } from '@/lib/auth';

interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    office_bearer_position?: string;
  };
}

export function requirePermission(feature: string, action: string = 'view') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Check role-based access
      const hasAccess = await checkPermission(user.id, user.role, feature, action);
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

async function checkPermission(userId: number, userRole: string, feature: string, action: string): Promise<boolean> {
  if (userRole === 'admin') return true;
  
  if (userRole === 'office_bearer') {
    const obRecord = await db.query('SELECT position FROM office_bearers WHERE user_id = ? AND is_active = 1', [userId]);
    if (!obRecord.length) return false;
    
    const position = obRecord[0].position;
    const permissions = getRolePermissions(position);
    
    return validatePermission(permissions, feature, action);
  }
  
  // Student access
  const studentPerms = getRolePermissions('student');
  return validatePermission(studentPerms, feature, action);
}

function getRolePermissions(position: string): Record<string, string[]> {
  const perms: Record<string, Record<string, string[]>> = {
    'President': { view: ['all'], edit: ['all'], delete: ['all'], create: ['all'] },
    'Vice President': { view: ['all'], edit: ['all'], delete: ['all'], create: ['all'] },
    'Secretary': { view: ['people', 'projects', 'meetings', 'teams'], edit: ['projects', 'meetings'], create: ['meetings', 'projects'] },
    'Joint Secretary': { view: ['people', 'meetings'], edit: [], create: [] },
    'Treasurer': { view: ['finance', 'reports'], edit: ['finance'], create: ['finance'] },
    'Joint Treasurer': { view: ['finance', 'reports'], edit: [], create: [] },
    'student': { view: ['events', 'teams', 'announcement', 'attendance'], edit: [], create: [] },
  };
  
  return perms[position] || perms['student'];
}

function validatePermission(perms: Record<string, string[]>, feature: string, action: string): boolean {
  const allowed = perms[action] || [];
  return allowed.includes('all') || allowed.includes(feature);
}
```

### API Endpoints

```typescript
// routes/officeBearer.ts

// Get all office bearers
router.get('/office-bearers', requirePermission('manage-office-bearers', 'view'), async (req, res) => {
  const bearers = await db.query(`
    SELECT ob.*, u.name, u.email
    FROM office_bearers ob
    JOIN users u ON ob.user_id = u.id
    WHERE ob.is_active = 1
  `);
  
  res.json({ success: true, office_bearers: bearers });
});

// Assign office bearer role
router.post('/office-bearers', requirePermission('manage-office-bearers', 'create'), async (req, res) => {
  const { user_id, position } = req.body;
  
  // Validate position
  const validPositions = ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Treasurer', 'Joint Treasurer'];
  if (!validPositions.includes(position)) {
    return res.status(400).json({ error: 'Invalid position' });
  }
  
  // Check if role already assigned to someone else
  const existing = await db.query('SELECT * FROM office_bearers WHERE position = ? AND is_active = 1', [position]);
  if (existing.length > 0) {
    return res.status(400).json({ error: `${position} role already assigned to ${existing[0].user_id}` });
  }
  
  // Check if user already has a role
  const userHasRole = await db.query('SELECT * FROM office_bearers WHERE user_id = ? AND is_active = 1', [user_id]);
  if (userHasRole.length > 0) {
    return res.status(400).json({ error: 'User already has an office bearer role' });
  }
  
  // Assign role
  const result = await db.query(
    'INSERT INTO office_bearers (user_id, position, assigned_date, is_active) VALUES (?, ?, NOW(), 1)',
    [user_id, position]
  );
  
  // Update user role
  await db.query('UPDATE users SET role = ? WHERE id = ?', ['office_bearer', user_id]);
  
  // Log activity
  logActivity(req.user.id, 'ASSIGN_OFFICE_BEARER', 'office_bearer', result.insertId, null, { user_id, position });
  
  res.json({ success: true, message: `${position} assigned successfully` });
});

// Change/Remove office bearer role
router.put('/office-bearers/:id', requirePermission('manage-office-bearers', 'edit'), async (req, res) => {
  const { id } = req.params;
  const { position } = req.body;
  
  // Get current role
  const current = await db.query('SELECT * FROM office_bearers WHERE id = ?', [id]);
  if (!current.length) return res.status(404).json({ error: 'Office bearer not found' });
  
  if (position === null) {
    // Remove role
    await db.query('UPDATE office_bearers SET is_active = 0 WHERE id = ?', [id]);
    await db.query('UPDATE users SET role = ? WHERE id = ?', ['student', current[0].user_id]);
    
    logActivity(req.user.id, 'REMOVE_OFFICE_BEARER', 'office_bearer', id, current[0], null);
    return res.json({ success: true, message: 'Office bearer role removed' });
  }
  
  // Check if new position taken
  const taken = await db.query('SELECT * FROM office_bearers WHERE position = ? AND id != ? AND is_active = 1', [position, id]);
  if (taken.length > 0) {
    return res.status(400).json({ error: `${position} role already assigned` });
  }
  
  // Update role
  await db.query('UPDATE office_bearers SET position = ? WHERE id = ?', [position, id]);
  
  logActivity(req.user.id, 'UPDATE_OFFICE_BEARER', 'office_bearer', id, current[0], { position });
  res.json({ success: true, message: 'Role updated successfully' });
});
```

---

## 5. FRONTEND UI STRUCTURE

### Manage Office Bearers Page

```tsx
// pages/ManageOfficeBearers.tsx

const ManageOfficeBearers = () => {
  const [bearers, setBearers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedUser, setSelectedUser] = useState('');

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
    loadAvailableUsers();
  }, []);

  const loadOfficeBearers = async () => {
    const res = await fetch('/api/office-bearers', {
      headers: { Authorization: `Bearer ${auth.getToken()}` }
    });
    const data = await res.json();
    setBearers(data.office_bearers);
  };

  const assignBearer = async () => {
    await fetch('/api/office-bearers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.getToken()}`
      },
      body: JSON.stringify({
        user_id: selectedUser,
        position: selectedPosition
      })
    });
    loadOfficeBearers();
    loadAvailableUsers();
  };

  const removeBearer = async (id: number) => {
    await fetch(`/api/office-bearers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.getToken()}`
      },
      body: JSON.stringify({ position: null })
    });
    loadOfficeBearers();
    loadAvailableUsers();
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Manage Office Bearers</h1>

      {/* Assignment Card */}
      <Card>
        <CardHeader>
          <CardTitle>Assign New Office Bearer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Select value={selectedPosition} onValueChange={setSelectedPosition}>
              <SelectTrigger>
                <SelectValue placeholder="Select Position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map(pos => (
                  <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select Student" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map(user => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={assignBearer}>Assign</Button>
          </div>
        </CardContent>
      </Card>

      {/* Office Bearers List */}
      <Card>
        <CardHeader>
          <CardTitle>Current Office Bearers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Assigned Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bearers.map(bearer => (
                <TableRow key={bearer.id}>
                  <TableCell className="font-bold text-primary">{bearer.position}</TableCell>
                  <TableCell>{bearer.name}</TableCell>
                  <TableCell>{bearer.email}</TableCell>
                  <TableCell>{new Date(bearer.assigned_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeBearer(bearer.id)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## 6. IMPLEMENTATION CHECKLIST

### Phase 1: Database & Backend
- [ ] Create `office_bearers` table
- [ ] Create `role_permissions` table
- [ ] Create `activity_logs` table
- [ ] Add `office_bearer_position` field fetch in user queries
- [ ] Create role middleware
- [ ] Create office bearer API endpoints
- [ ] Add validation for duplicate roles
- [ ] Implement permission checks on all endpoints

### Phase 2: Frontend
- [ ] Create role utility functions
- [ ] Update Sidebar component with role-based menus
- [ ] Update Dashboard based on user role
- [ ] Create Manage Office Bearers page
- [ ] Update permission checks for form visibility
- [ ] Add role badges to user profiles

### Phase 3: Integration
- [ ] Update existing routes with role checks
- [ ] Add permission guards to sensitive operations
- [ ] Create admin logs dashboard
- [ ] Add role transition UI
- [ ] Test all role scenarios

### Phase 4: Security
- [ ] Validate permissions on every API call
- [ ] Prevent direct URL access bypasses
- [ ] Log all role changes
- [ ] Rate limit role assignment
- [ ] Add password requirement for role changes

---

## 7. TESTING SCENARIOS

```
Test Case 1: Assign President
├── Admin assigns student as President
├── Verify user can access all features
├── Verify sidebar shows full menu
└── Verify can manage office bearers

Test Case 2: Role Conflict
├── Try to assign second President
└── Should fail with error

Test Case 3: Permission Boundary
├── Secretary tries to access Finance
└── Should be denied

Test Case 4: Role Removal
├── Remove office bearer role
├── Verify user reverts to student
└── Verify access restricted

Test Case 5: URL Bypass
├── Try direct navigation to restricted page
├── Should redirect with 403
└── Should log attempt
```

---

## 8. NOTES

- **Scalability**: Role permissions stored in database for easy expansion
- **Auditing**: All role changes logged with timestamps and changed values
- **Security**: Frontend checks are for UX; backend is the authority
- **Flexibility**: Easy to modify positions and permissions without code changes
- **Maintainability**: Centralized permission logic makes debugging easier
