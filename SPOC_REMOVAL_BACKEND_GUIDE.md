# SPOC Role Removal - Backend Migration Guide

## Overview
The SPOC (Single Point of Contact) role has been completely removed from the SM Volunteers application. The system now operates with only three roles: **Admin**, **Office Bearer**, and **Student**.

## Database Changes Required

### 1. Remove SPOC Role from Users Table
```sql
-- Update existing SPOC users to Student role
UPDATE users 
SET role = 'student' 
WHERE role = 'spoc';

-- Remove SPOC from role enum (if using enum type)
ALTER TYPE user_role RENAME TO user_role_old;
CREATE TYPE user_role AS ENUM ('admin', 'office_bearer', 'student', 'alumni');
ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::text::user_role;
DROP TYPE user_role_old;
```

### 2. Drop SPOC-Related Tables
```sql
-- Drop SPOC assignments table
DROP TABLE IF EXISTS spoc_assignments CASCADE;

-- Drop any SPOC-related junction tables
DROP TABLE IF EXISTS spoc_projects CASCADE;
DROP TABLE IF EXISTS spoc_events CASCADE;
```

### 3. Remove SPOC-Related Columns
```sql
-- Remove coordinator_id from projects if it was SPOC-specific
-- (Keep if used for Office Bearers)
-- ALTER TABLE projects DROP COLUMN IF EXISTS spoc_id;

-- Remove any SPOC-specific foreign keys
-- ALTER TABLE events DROP COLUMN IF EXISTS assigned_spoc_id;
```

## API Endpoints to Remove

### SPOC Management Endpoints
- `POST /api/spoc/assign` - Assign SPOC to project/event
- `GET /api/spoc/assignments` - Get all SPOC assignments
- `GET /api/spoc/my-assignments` - Get current user's SPOC assignments
- `DELETE /api/spoc/assignments/:id` - Remove SPOC assignment
- `GET /api/spoc/list` - Get list of all SPOCs

### Authentication/Authorization Updates
- Remove `'spoc'` from role validation middleware
- Update role-based access control to only allow: `admin`, `office_bearer`, `student`, `alumni`

## New Assignment-Based Access Model

### Student Module Assignment System

Students should only see certain modules (Projects, Bills, Reports, Attendance) if they are **explicitly assigned** to them by Admin or Office Bearer.

#### Recommended Database Schema

```sql
-- Student module assignments table
CREATE TABLE student_module_assignments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_type VARCHAR(50) NOT NULL, -- 'project', 'bill', 'report', 'attendance'
    resource_id INTEGER, -- ID of the specific project/event/etc
    can_view BOOLEAN DEFAULT true,
    can_edit BOOLEAN DEFAULT false,
    can_upload BOOLEAN DEFAULT false,
    assigned_by INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, module_type, resource_id)
);

-- Index for faster lookups
CREATE INDEX idx_student_assignments ON student_module_assignments(student_id, module_type);
```

#### Required API Endpoints

```typescript
// Admin/Office Bearer assigns module access to student
POST /api/students/:studentId/assignments
Body: {
  module_type: 'project' | 'bill' | 'report' | 'attendance',
  resource_id?: number,
  can_view: boolean,
  can_edit: boolean,
  can_upload: boolean
}

// Get student's module assignments
GET /api/students/:studentId/assignments
Response: {
  assignments: [
    {
      module_type: string,
      resource_id: number,
      can_view: boolean,
      can_edit: boolean,
      can_upload: boolean
    }
  ]
}

// Remove student's module assignment
DELETE /api/students/:studentId/assignments/:assignmentId

// Get current student's own assignments (for sidebar display)
GET /api/my-assignments
Response: {
  projects: number[], // IDs of assigned projects
  bills: number[],
  reports: number[],
  attendance: number[]
}
```

## Authorization Logic Changes

### Before (SPOC-based)
```javascript
// Old: SPOC had special access
if (user.role === 'spoc') {
  // Show SPOC-specific modules
  return getSPOCProjects(user.id);
}
```

### After (Assignment-based)
```javascript
// New: Students get access via assignments
if (user.role === 'student') {
  const assignments = await getStudentAssignments(user.id);
  return {
    projects: assignments.filter(a => a.module_type === 'project'),
    bills: assignments.filter(a => a.module_type === 'bill'),
    // etc.
  };
}
```

## Frontend Changes Already Completed

### Files Deleted
- ✅ `src/pages/SPOCBills.tsx`
- ✅ `src/pages/SPOCDashboard.tsx`
- ✅ `src/pages/SPOCEventDetails.tsx`
- ✅ `src/pages/SPOCEvents.tsx`
- ✅ `src/pages/SPOCReports.tsx`
- ✅ `src/pages/ManageSPOCAssignments.tsx`

### Code Updated
- ✅ `App.tsx` - Removed all SPOC routes
- ✅ `Sidebar.tsx` - Removed SPOC menu items
- ✅ `StudentDashboard.tsx` - Removed SPOC role checks
- ✅ `StudentEvents.tsx` - Removed SPOC-specific logic
- ✅ `ManageUsers.tsx` - Removed SPOC from role selection
- ✅ `ProjectDetails.tsx` - Updated to use Admin/Office Bearer instead of SPOC
- ✅ `ManageAttendance.tsx` - Removed SPOC filtering
- ✅ `api.ts` - Removed SPOC management methods

## Migration Checklist

### Backend Tasks
- [ ] Update database schema (remove SPOC role, add assignment tables)
- [ ] Remove SPOC-related API endpoints
- [ ] Implement student assignment endpoints
- [ ] Update authentication middleware (remove SPOC role)
- [ ] Update authorization checks across all endpoints
- [ ] Migrate existing SPOC users to Student role
- [ ] Create assignment records for existing SPOC-project relationships

### Testing Requirements
- [ ] Verify Admin can assign modules to students
- [ ] Verify Office Bearer can assign modules to students
- [ ] Verify students only see assigned modules
- [ ] Verify students cannot access unassigned modules
- [ ] Verify role-based access for Admin/Office Bearer/Student
- [ ] Test module permissions (view/edit/upload)

## Security Considerations

1. **Strict Authorization**: Students must NEVER see modules they aren't assigned to
2. **Assignment Validation**: Only Admin and Office Bearer can create assignments
3. **Cascade Deletion**: When a student is deleted, their assignments should be removed
4. **Audit Trail**: Track who assigned what to whom and when

## Default Student Access

All students should have access to these modules by default (no assignment needed):
- ✅ Dashboard
- ✅ Calendar
- ✅ Profile
- ✅ Events (view and register)
- ✅ Messages
- ✅ Feedback
- ✅ Teams
- ✅ Resources

## Assignment-Based Modules

These modules require explicit assignment:
- 🔒 Projects (view/manage specific projects)
- 🔒 Bills (view/upload bills for assigned projects/events)
- 🔒 Reports (view/upload reports for assigned projects/events)
- 🔒 Attendance (mark attendance for assigned projects/events)

## Example Assignment Flow

1. Admin creates a new project
2. Admin assigns Student A to the project
3. Student A's sidebar now shows "Projects" link
4. Student A can only see/manage the assigned project
5. Student B (not assigned) does not see "Projects" in sidebar

## Notes for Backend Team

- The frontend now expects assignment-based access control
- Students will call `GET /api/my-assignments` on login to determine sidebar visibility
- Each module page will verify assignment before displaying data
- Consider caching assignments for performance
- Implement proper error messages for unauthorized access attempts

---

**Migration Priority**: HIGH
**Breaking Changes**: YES - Requires database migration and API updates
**Backward Compatibility**: NO - SPOC role completely removed
