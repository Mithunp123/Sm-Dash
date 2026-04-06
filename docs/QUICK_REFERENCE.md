# Office Bearer RBAC System - Quick Reference

## 📦 Deliverables Summary

### ✅ Backend
1. **Database Migration** (`backend/migrations/04_office_bearers_system.sql`)
   - Creates `office_bearers` table
   - Creates `role_permissions` table  
   - Creates `activity_logs` table
   - Seeds all default role permissions

2. **Role Service** (`backend/services/roleService.js`)
   - `getEffectiveRole(userId)` - Get user's role
   - `assignRole(userId, position)` - Assign role with validation
   - `hasPermission(userId, feature, action)` - Check permissions
   - `getAllOfficeBearers()` - List all assignments

3. **RBAC Middleware** (`backend/middleware/roleMiddleware.js`)
   - `attachEffectiveRole` - Middleware to fetch role
   - `requirePermission(feature, action)` - Permission guard
   - `requireSuperAdmin` - Super admin only
   - `requireRole(...roles)` - Specific roles only

4. **API Routes** (`backend/routes/officeBearer.js`)
   - `GET /api/office-bearers` - List all
   - `POST /api/office-bearers` - Assign role
   - `PUT /api/office-bearers/:id` - Update role
   - `DELETE /api/office-bearers/:id` - Remove role
   - `GET /api/user/:userId/role` - Get user role
   - `GET /api/permissions/:userId` - Get permissions

### ✅ Frontend
1. **Role Hook** (`frontend/hooks/useRole.ts`)
   - `hasPermission(feature, action)` - Check permission
   - `canViewFeature(feature)` - Can view?
   - `canEditFeature(feature)` - Can edit?
   - `isSuperAdmin()` - Super admin?
   - `isSecretary()` - Secretary role?
   - `role` - Current role name
   - `refreshRole()` - Manually refresh

2. **Office Bearer Management** (`frontend/src/pages/ManageOfficeBearers.tsx`)
   - Assign new roles with validation
   - Update existing role assignments
   - Remove roles
   - List all assignments with users
   - Shows unassigned positions

### ✅ Documentation
1. **Architecture Document** - Complete system design
2. **Implementation Guide** - Step-by-step integration
3. **Quick Reference** - This file

---

## 🚀 Quick Start (5 Steps)

### Step 1: Run Database Migration
```bash
mysql -u root -p database < backend/migrations/04_office_bearers_system.sql
```

### Step 2: Update Backend Routes
```javascript
// server.js
const { attachEffectiveRole, requirePermission } = require('./middleware/roleMiddleware');
const officeBearerRoutes = require('./routes/officeBearer');

app.use(attachEffectiveRole);
app.use('/api', officeBearerRoutes);

// Add to sensitive routes
app.get('/api/finance', requireAuth, requirePermission('finance', 'view'), handler);
```

### Step 3: Update Frontend Routes
```typescript
// App.tsx
import ManageOfficeBearers from '@/pages/ManageOfficeBearers';

// In routes array
{ path: '/admin/office-bearers', element: <ManageOfficeBearers /> }
```

### Step 4: Use Role Hook in Components
```typescript
import useRole from '@/hooks/useRole';

function Component() {
  const { canViewFeature, isSuperAdmin } = useRole();
  
  return (
    {canViewFeature('finance') && <Finance />}
    {isSuperAdmin() && <AdminPanel />}
  );
}
```

### Step 5: Test
- Login as President/VP - should see everything
- Login as Secretary - should see limited menu
- Login as Student - should see minimal menu
- Try accessing `/admin/office-bearers` as non-admin - should get 403

---

## 🔐 Role Permissions Map

| Role | Dashboard | Finance | People | Projects | Meetings | Reports |
|------|-----------|---------|--------|----------|----------|---------|
| President | ✅ Edit | ✅ Edit | ✅ Edit | ✅ Edit | ✅ Edit | ✅ Edit |
| Vice Pres | ✅ Edit | ✅ Edit | ✅ Edit | ✅ Edit | ✅ Edit | ✅ Edit |
| Secretary | ✅ View | ❌ | ✅ Edit | ✅ Edit | ✅ Edit | ✅ View |
| J-Secretary | ✅ View | ❌ | ✅ View | ❌ | ✅ View | ❌ |
| Treasurer | ✅ View | ✅ Edit | ❌ | ❌ | ❌ | ✅ Edit |
| J-Treasurer | ✅ View | ✅ View | ❌ | ❌ | ❌ | ✅ View |
| Student | ✅ View | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 📝 Common Code Patterns

### Backend: Add Permission to Route
```javascript
router.post('/api/finance', 
  requireAuth,
  requirePermission('finance', 'create'),  // ← Add this line
  financialController
);
```

### Backend: Check Permission Manually
```javascript
const hasAccess = await RoleService.hasPermission(
  userId,
  'finance',
  'edit'
);
if (!hasAccess) {
  return res.status(403).json({ error: 'Access denied' });
}
```

### Frontend: Conditional Render
```typescript
const { canViewFeature, canEditFeature } = useRole();

return (
  <>
    {canViewFeature('finance') && <div>...</div>}
    {canEditFeature('finance') && <EditButton />}
  </>
);
```

### Frontend: Manual Role Check
```typescript
const { role, isSecretary, isSuperAdmin } = useRole();

if (role === 'President') {
  // Show president UI
}

if (isSecretary()) {
  // Show secretary UI
}

if (isSuperAdmin()) {
  // Show admin UI
}
```

---

## 🔗 Api Endpoints

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | `/api/office-bearers` | view office-bearers | List all |
| GET | `/api/office-bearers/:id` | view office-bearers | Get one |
| POST | `/api/office-bearers` | create office-bearers | Assign role |
| PUT | `/api/office-bearers/:id` | edit office-bearers | Update role |
| DELETE | `/api/office-bearers/:id` | delete office-bearers | Remove role |
| GET | `/api/user/:id/role` | auth required | Get user role |
| GET | `/api/permissions/:id` | auth required | Get permissions |
| GET | `/api/roles` | auth required | List positions |

---

## 🛠️ Debugging Tips

### Check User's Effective Role
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/user/5/role
# Response: { "effective_role": "Secretary", ... }
```

### Check User's Permissions
```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/permissions/5
# Response: { "permissions": [...features...], ... }
```

### Database Query: View All Roles
```sql
SELECT ob.*, u.name, u.email 
FROM office_bearers ob
LEFT JOIN users u ON ob.user_id = u.id
WHERE ob.is_active = 1;
```

### Database Query: Check Permissions
```sql
SELECT * FROM role_permissions 
WHERE position = 'Secretary' 
ORDER BY feature;
```

### Frontend: Enable Console Logging
```typescript
// In useRole() hook
logger.debug(`[useRole] Fetched role: ${data.effective_role}`);
```

---

## ✅ Integration Checklist

- [ ] Database migration applied
- [ ] `role_permissions` table has been seeded
- [ ] Backend routes registered in `server.js`
- [ ] Frontend routes added to routing
- [ ] `useRole` hook tested in components
- [ ] `ManageOfficeBearers` page accessible at `/admin/office-bearers`
- [ ] Permission middleware added to sensitive routes
- [ ] Test President/VP can access everything
- [ ] Test Secretary has correct access
- [ ] Test Student has minimal access
- [ ] Permission denial (403) returns correct error
- [ ] Role changes reflected immediately after refresh
- [ ] Activity logs capturing role changes
- [ ] Documentation shared with team

---

## 🚨 Important Security Notes

1. **Backend is Authority** - Frontend UI hiding features is NOT security
2. **Every Request Validated** - Role is re-checked on every API call
3. **Deny By Default** - Missing permission = access denied
4. **Unique Positions** - Only one user per role enforced in database
5. **URL Bypass Prevention** - Direct API access without permission returns 403

---

## 📞 Support

For issues or questions, refer to:
1. `ARCHITECTURE_REFACTOR_OFFICE_BEARERS.md` - Full design doc
2. `IMPLEMENTATION_GUIDE.md` - Step-by-step integration
3. Backend console logs - Permission check results
4. Browser console - Role hook debug messages
5. `activity_logs` table - All attempted actions

---

**Last Updated:** 2026-04-06  
**Status:** ✅ Complete & Ready for Integration
