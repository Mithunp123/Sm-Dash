# SM Volunteers Dashboard - Complete API Reference

## Overview

This document contains the complete API analysis for the SM Volunteers Dashboard application, including all backend endpoints and their corresponding frontend integrations.

## Configuration

### Backend (.env)
```env
PORT=3000
DB_TYPE=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=smvdb
JWT_SECRET=your_jwt_secret
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000/api
```

---

## API Endpoints Reference

### 1. Authentication (`/api/auth`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/login` | No | User login with email/password |
| POST | `/get-role-by-email` | No | Get user role by email |
| GET | `/google` | No | Start Google OAuth flow |
| GET | `/google/callback` | No | Google OAuth callback |
| POST | `/change-password` | Yes | Change user password |
| POST | `/forgot-password` | No | Request password reset |
| POST | `/verify-otp` | No | Verify OTP for password reset |
| POST | `/reset-password` | No | Reset password with token |
| GET | `/test-admin` | No | Dev only - test admin access |

---

### 2. Users (`/api/users`)

| Method | Endpoint | Auth Required | Role | Description |
|--------|----------|---------------|------|-------------|
| GET | `/` | Yes | Admin | Get all users |
| GET | `/me` | Yes | Any | Get current user |
| GET | `/students` | Yes | Admin/OB | Get students (scoped) |
| GET | `/:id` | Yes | Permission | Get user by ID |
| POST | `/` | Yes | Admin | Create new user |
| PUT | `/:id` | Yes | Permission | Update user |
| DELETE | `/:id` | Yes | Admin | Delete user |
| POST | `/:id/photo` | Yes | Any | Upload user photo |
| PUT | `/profile/:id` | Yes | Any | Update user profile |

---

### 3. Events (`/api/events`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/public` | No | Get public events |
| GET | `/` | Yes | Get all events |
| GET | `/active` | Yes | Get active events |
| GET | `/:id` | Yes | Get event by ID |
| POST | `/` | Yes (Permission) | Create event |
| PUT | `/:id` | Yes (Permission) | Update event |
| DELETE | `/:id` | Yes (Permission) | Delete event |
| GET | `/:id/members` | Yes | Get event members |
| POST | `/:id/members` | Yes (Permission) | Add event members |
| DELETE | `/:id/members/:userId` | Yes (Permission) | Remove member |
| POST | `/image` | Yes | Upload event image |

---

### 4. Finance (`/api/finance`)

| Method | Endpoint | Auth Required | Role | Description |
|--------|----------|---------------|------|-------------|
| GET | `/categories/event/:eventId` | Yes | Finance | Get expense categories |
| POST | `/categories` | Yes | Finance | Create category |
| DELETE | `/categories/:categoryId` | Yes | Admin | Delete category |
| GET | `/expenses` | Yes | Finance | Get expenses |
| POST | `/expenses` | Yes | Finance | Create expense |
| PUT | `/expenses/:expenseId` | Yes | Finance | Update expense |
| DELETE | `/expenses/:expenseId` | Yes | Admin | Delete expense |
| GET | `/collections` | Yes | Finance | Get fund collections |
| POST | `/collections` | Yes | Finance | Create collection |
| DELETE | `/collections/:collectionId` | Yes | Admin | Delete collection |
| GET | `/event-summary/:eventId` | Yes | Finance | Get event financial summary |
| GET | `/summary` | Yes | Finance | Get overall summary |
| GET | `/settings` | Yes | Admin | Get finance settings |
| PUT | `/settings` | Yes | Admin | Update settings |
| POST | `/settings/fundraising/toggle` | Yes | Admin | Toggle fundraising |
| POST | `/settings/qrcode/upload` | Yes | Admin | Upload QR code |
| POST | `/settings/qrcode/delete` | Yes | Admin | Delete QR code |
| GET | `/summary/:eventId` | Yes | Finance | Get event summary |
| GET | `/analytics/monthly` | Yes | Finance | Monthly analytics |
| GET | `/analytics/sources` | Yes | Finance | Source analytics |

---

### 5. Fundraising (`/api/fundraising`)

| Method | Endpoint | Auth Required | Role | Description |
|--------|----------|---------------|------|-------------|
| GET | `/status` | Yes | Finance | Get fundraising status |
| POST | `/add` | Yes | Finance | Add fund collection |
| GET | `/list/:eventId` | Yes | Finance | Get collections for event |
| GET | `/summary/:eventId` | Yes | Finance | Get event fundraising summary |
| GET | `/user-contribution/:eventId` | Yes | Finance | Get user contributions |
| PUT | `/:id` | Yes | Admin | Update collection |
| DELETE | `/:id` | Yes | Admin | Delete collection |

---

### 6. Expenses (`/api/expenses`)

| Method | Endpoint | Auth Required | Role | Description |
|--------|----------|---------------|------|-------------|
| POST | `/folder/add` | Yes | Finance | Create bill folder |
| GET | `/folders/:eventId` | Yes | Finance | Get folders for event |
| GET | `/folder/:folderId` | Yes | Finance | Get folder with expenses |
| POST | `/add` | Yes | Finance | Add expense |
| GET | `/list/:eventId` | Yes | Finance | Get expenses for event |
| PUT | `/:id` | Yes | Finance | Update expense |
| DELETE | `/:id` | Yes | Admin | Delete expense |

---

### 7. Teams (`/api/teams`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | Yes (Permission) | Get all teams |
| GET | `/my-teams` | Yes | Get user's teams |
| GET | `/available` | Yes | Get available teams |
| GET | `/my-requests` | Yes | Get user's team requests |
| GET | `/my-assignments` | Yes | Get user's assignments |
| POST | `/:id/request` | Yes | Request to join team |
| GET | `/requests/all` | Yes (Permission) | Get all requests |
| PUT | `/requests/:id` | Yes (Permission) | Approve/reject request |
| GET | `/:id` | Yes (Permission) | Get team by ID |
| POST | `/` | Yes | Create team |
| PUT | `/:id` | Yes (Permission) | Update team |
| DELETE | `/:id` | Yes (Permission) | Delete team |
| POST | `/:id/members` | Yes (Permission) | Add member |
| DELETE | `/:id/members/:userId` | Yes (Permission) | Remove member |
| POST | `/:id/assignments` | Yes (Permission) | Create assignment |
| PUT | `/:id/assignments/:assignmentId` | Yes | Update assignment |
| POST | `/:id/assignments/:assignmentId/complete` | Yes | Complete assignment |
| GET | `/:id/assignments/:assignmentId/tracking` | Yes | Get assignment tracking |
| DELETE | `/:id/assignments/:assignmentId` | Yes (Permission) | Delete assignment |

---

### 8. Projects (`/api/projects`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | Yes (Permission) | Get all projects |
| GET | `/:id` | Yes (Permission) | Get project by ID |
| POST | `/` | Yes (Permission) | Create project |
| PUT | `/:id` | Yes (Permission) | Update project |
| DELETE | `/:id` | Yes (Permission) | Delete project |
| GET | `/:id/students` | Yes (Permission) | Get project students |
| POST | `/:id/members` | Yes (Permission) | Add member |
| DELETE | `/:id/members/:userId` | Yes (Permission) | Remove member |
| GET | `/:projectId/mentees` | Yes (Permission) | Get mentees |
| POST | `/:projectId/mentees` | Yes (Permission) | Add mentee |
| PUT | `/:projectId/mentees/:assignmentId` | Yes | Update mentee |
| DELETE | `/:projectId/mentees/:assignmentId` | Yes (Permission) | Remove mentee |
| PUT | `/:projectId/mentees/bulk-expected-classes` | Yes (Permission) | Bulk update |
| PUT | `/mentees/bulk-expected-classes-all` | Yes (Permission) | Bulk update all |
| POST | `/:projectId/mentees/bulk-upload` | Yes (Permission) | Bulk upload mentees |

---

### 9. Attendance (`/api/attendance`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | Yes (Permission) | Get all attendance |
| POST | `/` | Yes (Permission) | Mark attendance |
| PUT | `/:id` | Yes (Permission) | Update attendance |
| DELETE | `/:id` | Yes (Permission) | Delete attendance |
| GET | `/student/projects/:userId` | Yes | Get student project attendance |
| GET | `/project/:projectId/user/:userId` | Yes | Get project attendance for user |
| POST | `/project/:projectId/mark` | Yes (Permission) | Mark project attendance |
| GET | `/project/:projectId/records` | Yes (Permission) | Get project records |
| PUT | `/project/records/:id` | Yes (Permission) | Update project record |
| DELETE | `/project/records/:id` | Yes (Permission) | Delete project record |
| GET | `/student/events/:userId` | Yes | Get student event attendance |
| GET | `/event/:eventId/user/:userId` | Yes | Get event attendance for user |
| POST | `/event/:eventId/mark` | Yes (Permission) | Mark event attendance |
| GET | `/event/:eventId/records` | Yes (Permission) | Get event records |
| GET | `/meeting/:meetingId/records` | Yes (Permission) | Get meeting records |
| GET | `/project/:projectId/dates` | Yes (Permission) | Get project dates |
| GET | `/meeting/:meetingId/dates` | Yes (Permission) | Get meeting dates |
| GET | `/event/:eventId/dates` | Yes (Permission) | Get event dates |
| GET | `/student/:studentId/details` | Yes | Get student details |
| GET | `/student/:studentId/project/:projectId/details` | Yes | Get student project details |
| GET | `/student/:studentId/meeting/:meetingId/details` | Yes | Get student meeting details |
| GET | `/student/:studentId/event/:eventId/details` | Yes | Get student event details |
| GET | `/best-performers` | Yes | Get best performers |

---

### 10. Meetings (`/api/meetings`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | Yes (Permission) | Get all meetings |
| GET | `/:id` | Yes (Permission) | Get meeting by ID |
| POST | `/` | Yes (Permission) | Create meeting |
| PUT | `/:id` | Yes (Permission) | Update meeting |
| DELETE | `/:id` | Yes (Permission) | Delete meeting |

---

### 11. Interviews (`/api/interviews`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | Yes (Admin/Manager) | Get all interviews |
| GET | `/interviewers` | Yes (Admin/Manager) | Get interviewers |
| POST | `/bulk-upload` | Yes (Admin/Manager) | Bulk upload interviews |
| POST | `/add` | Yes (Admin/Manager) | Add interview |
| PUT | `/:id` | Yes (Admin/Manager) | Update interview |
| GET | `/my-status` | Yes | Get my interview status |
| GET | `/my-candidates` | Yes | Get my candidates |
| POST | `/:id/submit-marks` | Yes | Submit marks |

---

### 12. Phone Mentoring (`/api/phone-mentoring`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/my-assignment` | Yes | Get my assignment |
| GET | `/my-mentees` | Yes | Get my mentees |
| POST | `/` | Yes | Create mentoring record |
| POST | `/mentees/:assignmentId/attendance` | Yes | Add mentee attendance |
| PUT | `/mentees/:assignmentId/attendance/:attendanceId` | Yes | Update attendance |
| DELETE | `/mentees/:assignmentId/attendance/:attendanceId` | Yes | Delete attendance |
| GET | `/mentees/:assignmentId/attendance` | Yes | Get attendance |
| GET | `/mentees/:assignmentId/updates` | Yes | Get updates |
| GET | `/attendance` | Yes (Admin) | Get all attendance |
| GET | `/updates` | Yes (Admin) | Get all updates |

---

### 13. Announcements (`/api/announcements`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/` | No | Get all announcements |
| POST | `/` | Yes | Create announcement |
| PUT | `/:id` | Yes | Update announcement |
| DELETE | `/:id` | Yes | Delete announcement |

---

### 14. Resources (`/api/resources`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/folders` | Yes (Permission) | Get resource folders |
| POST | `/folders` | Yes (Permission) | Create folder |
| DELETE | `/folders/:id` | Yes (Permission) | Delete folder |
| GET | `/` | Yes (Permission) | Get all resources |
| POST | `/` | Yes (Permission) | Upload resource |
| PUT | `/:id` | Yes (Permission) | Update resource |
| DELETE | `/:id` | Yes (Permission) | Delete resource |

---

### 15. Feedback (`/api/feedback`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/questions` | Yes | Get feedback questions |
| POST | `/questions` | Yes (Permission) | Create question |
| PUT | `/questions/:id` | Yes (Permission) | Update question |
| PATCH | `/questions/:id/toggle` | Yes (Permission) | Toggle question |
| DELETE | `/questions/:id` | Yes (Permission) | Delete question |
| POST | `/responses` | Yes (Student) | Submit response |
| GET | `/responses` | Yes (Permission) | Get all responses |
| GET | `/responses/question/:questionId` | Yes (Permission) | Get responses for question |

---

### 16. Awards (`/api/awards`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/public` | No | Get public awards |
| GET | `/` | Yes (Admin/OB) | Get all awards |
| GET | `/:id` | Yes (Admin/OB) | Get award by ID |
| POST | `/` | Yes (Admin/OB) | Create award |
| PUT | `/:id` | Yes (Admin/OB) | Update award |
| DELETE | `/:id` | Yes (Admin/OB) | Delete award |

---

### 17. Messages (`/api/messages`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/conversations` | Yes | Get conversations |
| GET | `/history/:contactId` | Yes | Get message history |
| POST | `/send` | Yes | Send message |
| DELETE | `/:messageId` | Yes | Delete message |

---

### 18. Mail (`/api/mail`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/health` | No | Check mail service health |
| GET | `/users` | Yes | Get users for mailing |
| POST | `/send-bulk` | Yes (Admin) | Send bulk email |
| GET | `/templates` | Yes | Get email templates |

---

### 19. Minutes of Meeting (`/api/mom`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/create` | Yes (Admin) | Create MOM |
| GET | `/:id` | Yes | Get MOM by ID |
| PUT | `/update/:id` | Yes (Admin) | Update MOM |
| DELETE | `/delete/:id` | Yes (Admin) | Delete MOM |
| GET | `/download/docx/:id` | Yes | Download as DOCX |
| GET | `/download/pdf/:id` | Yes | Download as PDF |
| GET | `/download/sm-logo` | No | Get SM logo |
| GET | `/download/ksrct-logo` | No | Get KSRCT logo |

---

### 20. Settings (`/api/settings`)

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| GET | `/profile-fields` | Yes | Get profile fields |
| PUT | `/profile-fields` | Yes (Admin) | Update profile fields |
| POST | `/profile-fields` | Yes (Admin) | Create profile field |
| DELETE | `/profile-fields/:field_name` | Yes (Admin) | Delete profile field |
| GET | `/role-profile-fields` | Yes (Permission) | Get role profile fields |
| PUT | `/role-profile-fields` | Yes (Admin) | Update role profile fields |
| GET | `/backup/export` | Yes (Admin) | Export backup |
| POST | `/backup/restore` | Yes (Admin) | Restore backup |

---

### 21. Other APIs

| Route | Description |
|-------|-------------|
| `/api/activity` | Activity logs (Admin/OB) |
| `/api/office-bearers` | Office bearer management |
| `/api/ngo` | NGO management |
| `/api/spoc` | SPOC assignments |
| `/api/time` | Time allotments |
| `/api/upload` | File uploads |

---

## Database Schema

### Core Tables
- `users` - User accounts and profiles
- `events` - Event management
- `projects` - Project management
- `teams` - Team management
- `meetings` - Meeting management

### Finance Tables
- `fund_collections` - Fundraising collections
- `expenses` - Expense records
- `bill_folders` - Bill folder organization
- `expense_categories` - Expense categories
- `finance_settings` - Finance configuration

### Attendance Tables
- `attendance` - General attendance
- `event_attendance` - Event attendance
- `project_attendance` - Project attendance

### Other Tables
- `interviews` - Interview records
- `phone_mentoring_attendance` - Phone mentoring
- `announcements` - Announcements
- `resources` - Resource files
- `feedback_questions` - Feedback system
- `feedback_responses` - Feedback responses
- `messages` - Chat messages
- `mom` - Minutes of meeting

---

## Authentication

### Token Storage
- Frontend uses `sessionStorage` for auth tokens
- Token is passed via `Authorization: Bearer <token>` header

### Roles
- `admin` - Full system access
- `office_bearer` - Limited admin functions
- `student` - Student access
- `mentor` - Mentor access

---

## Error Handling

All API responses follow this format:
```json
{
  "success": true|false,
  "message": "Description",
  "data": {...} // Optional data payload
}
```

HTTP Status Codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Server Error

---

## Health Check

```
GET /api/health
Response: { "status": "ok", "message": "SM Volunteers API is running" }
```
