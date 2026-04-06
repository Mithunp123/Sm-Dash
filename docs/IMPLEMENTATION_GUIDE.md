# Office Bearer RBAC Implementation - Integration Guide

## Overview

This guide walks through integrating the new Role-Based Access Control (RBAC) system for office bearers with your existing SM Volunteers Dashboard.

## Files Created

### Backend
- ✅ `backend/migrations/04_office_bearers_system.sql` - Database schema
- ✅ `backend/services/roleService.js` - Core role management service  
- ✅ `backend/middleware/roleMiddleware.js` - Permission validation middleware
- ✅ `backend/routes/officeBearer.js` - REST API endpoints

### Frontend
- ✅ `frontend/hooks/useRole.ts` - Role permission hook
- ✅ `frontend/src/pages/ManageOfficeBearers.tsx` - Office bearer management UI

## Integration Steps

### Step 1: Database Migration

```bash
# SSH into your database server or use MySQL client
cd backend

# Apply migration
mysql -u root -p your_database_name < migrations/04_office_bearers_system.sql

# Verify
mysql -u root -p your_database_name -e "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('office_bearers', 'role_permissions', 'activity_logs');"
```

### Step 2: Update Backend Server.js

**File:** `backend/server.js`

```javascript
// Add these imports near the top
const { attachEffectiveRole, requirePermission } = require('./middleware/roleMiddleware');
const officeBearer Routes = require('./routes/officeBearer');

// In your middleware setup (after authentication middleware):
app.use(attachEffectiveRole); // Attach role to every request

// Register routes
app.use('/api', officeBearerRoutes);

// Example: Add permission check to existing route
// Before:
app.get('/api/finance', requireAuth, financeController);

// After:
app.get('/api/finance', requireAuth, requirePermission('finance', 'view'), financeController);
```

### Step 3: Update Frontend App Routes

**File:** `frontend/src/App.tsx` (or similar routing file)

```typescript
import ManageOfficeBearers from '@/pages/ManageOfficeBearers';

// Add to your routes
{
  path: '/admin/office-bearers',
  element: <ManageOfficeBearers />
}
```

### Step 4: Update Frontend Sidebar

**File:** `frontend/src/components/Sidebar.tsx`

Import the new hook:
```typescript
import useRole from '@/hooks/useRole';
```

Use it in your sidebar to conditionally render menu items:
```typescript
const { canViewFeature, isSuperAdmin } = useRole();

// In your menu rendering:
{canViewFeature('office-bearers') && (
  { icon: Users, label: "Office Bearers", path: "/admin/office-bearers" }
)}
```

### Step 5: Test the System

#### Backend API Testing

```bash
# 1. Get all office bearers
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/office-bearers

# 2. Get user's effective role
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/user/1/role

# 3. Get user permissions
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/permissions/1

# 4. Assign a role (requires President/VP token)
curl -X POST http://localhost:3000/api/office-bearers \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": 5, "position": "Secretary"}'
```

#### Frontend Testing

1. **As Super Admin (President/VP)**
   - Navigate to `/admin/office-bearers`
   - Assign roles
   - Update existing roles
   - Remove roles

2. **As Secretary**
   - Should see limited menu items
   - Cannot access `/admin/office-bearers` (403 error)
   - Can access "People", "Projects", "Meetings"

3. **As Student**
   - Should see minimal menu
   - Cannot access `/admin/office-bearers` (403 error)
   - Can access "Events", "Teams", "Announcements"

### Step 6: Add Permission Checks to Existing Routes

For each sensitive endpoint, add permission validation:

```javascript
// Example 1: Finance routes
router.get('/finance', 
  requireAuth, 
  requirePermission('finance', 'view'),
  financialController
);

router.post('/finance', 
  requireAuth, 
  requirePermission('finance', 'create'),
  financialController
);

// Example 2: People management
router.get('/people', 
  requireAuth, 
  requirePermission('people', 'view'),
  peopleController
);

router.post('/people', 
  requireAuth, 
  requirePermission('people', 'create'),
  peopleController
);
```

### Step 7: Audit Trail (Optional)

Enable activity logging in your route handlers:

```javascript
// After a successful action
await RoleService.logActivity(
  req.user.id,
  'action_name',
  'entity_type',
  entity_id,
  beforeValue,
  afterValue,
  req.ip
);
```

---

## Usage Examples

### Frontend: Check Permissions

```typescript
import useRole from '@/hooks/useRole';

function MyComponent() {
  const { canViewFeature, canEditFeature, role, isSuperAdmin } = useRole();

  return (
    <>
      {canViewFeature('finance') && <FinancePanel />}
      
      {canEditFeature('projects') && (
        <button onClick={handleCreateProject}>Create Project</button>
      )}
      
      {isSuperAdmin() && <AdminPanel />}
      
      <p>Your role: {role}</p>
    </>
  );
}
```

### Backend: Protect Routes

```javascript
// All sensitive routes MUST have permission check
router.delete('/admin/users/:id',
  requireAuth,
  requirePermission('users', 'delete'),  // ← Permission required
  async (req, res) => {
    // Safe to proceed
    const result = await deleteUser(req.params.id);
    res.json(result);
  }
);
```

---

## Architecture Summary

### Permission Flow

```
User Login
    ↓
Token issued (role=office_bearer or student)
    ↓
Request to API endpoint
    ↓
Middleware: attachEffectiveRole()
  - Queries office_bearers table
  - Sets req.effectiveRole = 'Secretary' (or similar)
    ↓
Middleware: requirePermission('feature', 'action')
  - Queries role_permissions table
  - Checks if effectiveRole has permission
  - Returns 403 if denied
    ↓
Endpoint executes (safe)
```

### Roles Hierarchy

```
President/Vice President (Super Admin)
├── Full access to all features
└── Can manage other office bearers

Secretary
├── Can view: People, Projects, Meetings, Teams
└── Can edit: Projects, Meetings

Joint Secretary
├── Can view: People, Meetings, Events, Teams
└── No creation/edit rights

Treasurer
├── Can view: Finance, Reports, Billing
└── Can edit: Finance entries

Joint Treasurer
├── Can view: Finance, Reports, Announcements
└── No creation/edit rights

Student (Default)
├── Can view: Events, Teams, Announcements, Attendance
└── Can edit: Personal profile only
```

---

## Troubleshooting

### Issue: "You do not have permission" on valid operation

**Solution:**
1. Check `role_permissions` table has entry for the role/feature combo
2. Verify `office_bearers` table shows user as active
3. Check backend logs for permission denial details

### Issue: Frontend not reflecting role changes

**Solution:**
- Dispatch `window.dispatchEvent(new Event('roleUpdated'))` from backend after role change
- Or call `useRole().refreshRole()` manually

### Issue: User still has access after role removal

**Solution:**
- Clear browser cache/localStorage
- Refresh token (logout/login)
- Check `is_active` flag in `office_bearers` table

### Issue: Two users assigned to same position

**Solution:**
- Database has UNIQUE constraint on position
- If this happened, check migration was applied
- Run: `ALTER TABLE office_bearers ADD CONSTRAINT uk_position UNIQUE (position);`

---

## Security Checklist

- [ ] All sensitive endpoints have `requirePermission` middleware
- [ ] Permission checks are in BACKEND (not just frontend UI)
- [ ] Unique constraint on `office_bearers.position` is enforced
- [ ] Activity logs are enabled for audit trail
- [ ] Tokens expire regularly (users re-authenticate)
- [ ] Role changes require re-fetching permissions on frontend
- [ ] URL access attempts are logged to `activity_logs`
- [ ] Super admin actions are logged with IP address

---

## Performance Optimization

### Cache Effective Role (Optional)

If you have many requests and permission checks are slow:

```javascript
// Add Redis cache
const redis = require('redis');
const client = redis.createClient();

static async getEffectiveRole(userId) {
  const cached = await client.get(`role:${userId}`);
  if (cached) return cached;
  
  const role = await this.queryDatabase(userId);
  await client.setex(`role:${userId}`, 3600, role); // 1 hour cache
  return role;
}

// Invalidate on role change
static async assignRole(userId, position) {
  // ... assign logic ...
  await client.del(`role:${userId}`); // Clear cache
}
```

---

## Support & Next Steps

1. **Run Integration Tests** - Test all role combinations
2. **Monitor Logs** - Watch for permission denial attempts
3. **Gradual Rollout** - Deploy to 10% users first, then 50%, then 100%
4. **Gather Feedback** - Ask users about role accuracy and access
5. **Document Manual** - Create user documentation for role assignments

---

**Version:** 1.0  
**Last Updated:** 2026-04-06  
**Status:** Ready for Integration
