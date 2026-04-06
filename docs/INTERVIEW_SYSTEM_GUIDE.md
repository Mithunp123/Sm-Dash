# 📋 Interview Management System - User Guide

## Overview
The Interview Management System allows admins to manage interview candidates and assign interviewers from existing users. Interviewers can then conduct interviews and submit marks.

---

## 🔐 Access Control

### Admin Access
- **Route**: `/admin/interviews`
- **Requirement**: Admin role
- **Permissions**: Full control (Add, Edit, Delete, Assign, Grade)

### Interviewer Access
- **Route**: `/interviewer/dashboard`
- **Requirement**: Assigned to at least one candidate
- **Permissions**: View assigned candidates, submit marks & attendance

---

## 👨‍💼 Admin Panel (`/admin/interviews`)

### Dashboard Stats
Four quick stats cards show:
- **Total**: All candidates
- **Pending**: Waiting for interviewer assignment
- **Assigned**: With assigned interviewer
- **Selected**: Marks ≥ 7
- **Rejected**: Marks < 4

### Add New Candidate
1. Click **"+ Add Candidate"** button
2. Fill in details:
   - Name (required)
   - Email (required)
   - Phone (required)
   - Department (required)
3. Click **"Add Candidate"**

### Bulk Upload CSV
1. Click **"Upload"** button
2. Select CSV file with format:
   ```
   name,email,phone,department
   John Doe,john@example.com,8765432109,IT
   Jane Smith,jane@example.com,9876543210,CSE
   ```
3. Upload file
4. System shows: Added count, Skipped count, Failed count

### Assign Interviewer
1. Find candidate with **"Pending"** status
2. Click **"Assign"** button in Interviewer column
3. Select from existing users dropdown
   - Shows: Name and Email
4. Click **"Assign"**
5. Status changes to **"Assigned"**

### Submit Marks & Attendance
1. Click **"Add Marks"** in candidate row
2. Enter **Marks** (0-10)
3. Select **Attendance** (Present/Absent)
4. See result preview before submit
5. Click **"Submit Marks"**

### View Results
Results auto-calculate:
- **Marks ≥ 7** → **Selected** ✅
- **Marks 4-6** → **Waitlisted** ⚠️
- **Marks < 4** → **Rejected** ❌

### Edit Candidate
1. Click **Edit icon** (pencil)
2. Modify details
3. Click **"Update"**

### Delete Candidate
1. Click **Delete icon** (trash)
2. Confirm deletion
3. Candidate removed from system

### Search & Filter
- **Search**: Type name or email (real-time)
- **Status Filter**: Select from dropdown
  - All Status
  - Pending
  - Assigned
  - Selected
  - Waitlisted
  - Rejected
- **Pagination**: Navigate pages at bottom

---

## 👨‍🏫 Interviewer Dashboard (`/interviewer/dashboard`)

### View Assigned Candidates
See only candidates assigned to you with:
- Name
- Email
- Department
- Scheduled Date (after submission)
- Scheduled Time (after submission)
- Attendance status
- Marks (0-10)
- Final Result

### Submit Interview
1. Find candidate with **"Pending"** status
2. Click **"Send"** (Submit) button
3. Fill dialog:
   - **Attendance**: Select "Present" or "Absent"
   - **Marks**: Enter 0-10
4. See **Result Preview**:
   - Red: < 4 (Rejected)
   - Purple: 4-6 (Waitlisted)
   - Green: ≥ 7 (Selected)
5. Click **"Submit Interview"**
6. Record locked (readonly)

### After Submission
- Status shows: **"Submitted"** (checkmark)
- Date & Time auto-filled with current date/time
- Cannot edit or resubmit
- Admin will see your marks and calculate final result

---

## 📊 Result Calculation

Results are **auto-calculated** based on marks:

| Marks | Result | Color |
|-------|--------|-------|
| ≥ 7 | Selected | 🟢 Green |
| 4-6 | Waitlisted | 🟣 Purple |
| < 4 | Rejected | 🔴 Red |

---

## 🔍 Features

### Dark Theme
- Comfortable on eyes
- Glassmorphism cards
- Color-coded status badges
- Icons for quick reference

### Responsive Design
- Works on desktop
- Mobile-friendly layout
- Adaptive tables

### Real-time Updates
- Add/Edit/Delete reflects immediately
- Search filters dynamically
- Status updates in real-time

### Data Security
- Role-based access (Admin only)
- Interviewer can't see other interviewers
- Interviewer can't see final results
- Locked submissions prevent tampering

---

## 📋 CSV Upload Format

### Required Columns
```
name,email,phone,department
```

### Example
```csv
name,email,phone,department
Arjun Kumar,arjun.kumar@example.com,9876543210,IT
Priya Singh,priya.singh@example.com,8765432109,CSE
Rahul Patel,rahul.patel@example.com,9123456789,ECE
Sneha Gupta,sneha.gupta@example.com,8912345678,IT
Vivek Sharma,vivek.sharma@example.com,9845671230,CSE
```

### Supported Formats
- CSV (.csv)
- XLSX (.xlsx)

---

## ⚡ Quick Tips

✅ **Best Practices:**
- Review candidate list before assigning
- Assign all candidates to interviewers before interview dates
- Ensure interviewers submit marks on time
- Keep phone numbers and emails updated

❌ **Things to Avoid:**
- Don't delete candidates after assigning
- Don't reassign candidates during interviews
- Don't edit marks after interviewer submits

---

## 🆘 Troubleshooting

### Can't Access `/admin/interviews`
- ❌ Not an admin
- ✅ Login as admin user
- ✅ Check your role in settings

### Can't See Interviewer Dashboard
- ❌ No candidates assigned to you
- ✅ Ask admin to assign candidates
- ✅ Admin selects you from user list

### Bulk Upload Failed
- ❌ Wrong CSV format
- ✅ Use: name,email,phone,department
- ✅ Check for extra spaces/commas
- ✅ Verify email format

### Can't Submit Marks
- ❌ Marks outside 0-10 range
- ✅ Enter number between 0 and 10
- ✅ Select attendance option

---

## 📱 Screen Navigation

```
Dashboard
├── Admin Routes
│   └── /admin/interviews (Admin Panel)
│       ├── Add Candidate
│       ├── Bulk Upload
│       ├── Assign Interviewer
│       ├── Submit Marks
│       ├── Edit Candidate
│       └── Delete Candidate
│
└── Interviewer Routes
    └── /interviewer/dashboard (Interviewer Panel)
        └── Submit Interview
            ├── Attendance
            └── Marks (0-10)
```

---

## 🎯 Interview Process Flow

```
1. Admin adds candidates
   ↓
2. Admin assigns interviewers from existing users
   ↓
3. Status: Pending → Assigned
   ↓
4. Interviewer logs in, views dashboard
   ↓
5. Interviewer submits marks & attendance
   ↓
6. Status auto-updates based on marks
   ↓
7. Admin views final results
   ↓
✅ Interview Complete
```

---

## 💾 Data Fields

Each candidate record contains:
- **Name**: Candidate full name
- **Email**: Contact email
- **Phone**: Contact phone number
- **Department**: IT, CSE, ECE, etc.
- **Status**: Pending/Assigned/Selected/Waitlisted/Rejected
- **Interviewer**: Assigned user name
- **Marks**: 0-10 score
- **Attendance**: Present/Absent
- **Interview Date**: Auto-filled after submission
- **Interview Time**: Auto-filled after submission
- **Result**: Calculated based on marks

---

**Last Updated**: April 2026
**Version**: 1.0
