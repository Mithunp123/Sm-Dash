# SM Volunteers Dashboard - Deep Dive Analysis

> **Project**: Student Management Volunteers Dashboard for K.S.Rangasamy College of Technology  
> **Type**: Full-Stack Web Application  
> **Architecture**: Monorepo with separate Frontend and Backend  
> **Last Updated**: February 14, 2026

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Features & Modules](#features--modules)
5. [Database Architecture](#database-architecture)
6. [Authentication & Authorization](#authentication--authorization)
7. [Project Structure](#project-structure)
8. [Setup & Installation](#setup--installation)
9. [Running the Project](#running-the-project)
10. [Development Workflow](#development-workflow)
11. [API Endpoints](#api-endpoints)
12. [Database Migration](#database-migration)
13. [Deployment Considerations](#deployment-considerations)

---

## 🎯 Executive Summary

**SM Volunteers Dashboard** is a comprehensive student volunteer management system designed for educational institutions. It provides role-based access control for different user types (Admins, Office Bearers, Students) to manage volunteers, projects, attendance, events, resources, and more.

### Key Capabilities:
- **User Management**: Multi-role authentication (Admin, Office Bearer, Student)
- **Student Database**: Comprehensive student profiles with photo management
- **Project Management**: Track volunteer projects and assign students
- **Attendance Tracking**: Monitor attendance for projects, meetings, and events
- **Event Management**: Create and manage volunteer events
- **Resource Sharing**: Upload and share documents/resources
- **Phone Mentoring**: Track mentoring sessions and updates
- **Feedback System**: Collect and analyze feedback
- **Awards & Recognition**: Manage volunteer awards and achievements
- **Analytics Dashboard**: Data visualization and reporting
- **Team Management**: Organize volunteers into teams
- **Announcements**: Broadcast updates to users
- **Activity Logs**: Comprehensive audit trail

---

## 🛠️ Technology Stack

### Frontend Stack

#### Core Framework
- **React 18.3.1** - UI library with modern hooks and concurrent features
- **TypeScript 5.8.3** - Type-safe development
- **Vite 5.4.19** - Fast build tool and dev server (runs on port **9000**)

#### UI & Styling
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **shadcn/ui** - High-quality React components built on Radix UI
- **Radix UI** - Unstyled, accessible component primitives:
  - Dialog, Dropdown, Popover, Select, Tabs, Toast, Tooltip, etc.
- **Framer Motion 12.29.2** - Animation library
- **Lucide React** - Icon library
- **next-themes** - Dark mode support

#### State Management & Data Fetching
- **TanStack Query (React Query) 5.83.0** - Server state management
- **React Hook Form 7.61.1** - Form state management
- **Zod 3.25.76** - Schema validation

#### Routing
- **React Router DOM 6.30.1** - Client-side routing

#### Additional Libraries
- **date-fns 3.6.0** - Date manipulation
- **recharts 2.15.4** - Data visualization/charts
- **jsPDF** - PDF generation
- **xlsx 0.18.5** - Excel file handling
- **Embla Carousel** - Carousel/slider functionality

### Backend Stack

#### Runtime & Framework
- **Node.js (ES Modules)** - Runtime environment
- **Express 4.18.2** - Web application framework (runs on port **3000**)

#### Database
- **SQLite3 5.1.6** - Default development database
- **MySQL2 3.16.2** - Production database (with migration support)
- **Dual Database Support**: Compatibility layer for both SQLite and MySQL

#### Authentication & Security
- **JWT (jsonwebtoken 9.0.2)** - Token-based authentication
- **bcryptjs 2.4.3** - Password hashing
- **Google OAuth** (google-auth-library 10.5.0) - Social authentication
- **express-validator 7.0.1** - Input validation

#### File Handling
- **Multer 2.0.2** - File upload middleware
- **File Storage**: Local filesystem (`public/uploads/`)

#### Email & Communication
- **Nodemailer 6.10.1** - Email service (OTP, notifications)

#### Development Tools
- **Nodemon 3.0.2** - Auto-restart on file changes
- **dotenv 16.3.1** - Environment variable management

#### Additional Backend Libraries
- **cors 2.8.5** - Cross-Origin Resource Sharing
- **compression 1.8.1** - Response compression
- **xlsx** - Excel file processing

### Build Tools & DevOps

- **ESLint 9.32.0** - Code linting
- **PostCSS** - CSS processing
- **Concurrently** - Run multiple commands simultaneously
- **TypeScript ESLint** - TypeScript linting

---

## 🏗️ Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                        │
│                   (Port 9000)                            │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP/HTTPS
                     │
┌────────────────────▼────────────────────────────────────┐
│              VITE DEV SERVER                             │
│          React + TypeScript Frontend                     │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Components (shadcn/ui + Custom)                 │   │
│  │  Pages (Dashboard, Management Modules)           │   │
│  │  State Management (React Query)                  │   │
│  │  Routing (React Router)                          │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ REST API Calls
                     │ (axios/fetch)
                     │
┌────────────────────▼────────────────────────────────────┐
│           EXPRESS SERVER (Port 3000)                     │
│              Node.js Backend                             │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Routes (API Endpoints)                          │   │
│  │  Middleware (Auth, Validation, CORS)             │   │
│  │  Controllers (Business Logic)                    │   │
│  │  Utils (Email, Logger, OTP)                      │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ SQL Queries
                     │
┌────────────────────▼────────────────────────────────────┐
│              DATABASE LAYER                              │
│                                                           │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │   SQLite (Dev)   │  OR  │   MySQL (Prod)    │        │
│  │  sm_volunteers.db│      │  sm_volunteers    │        │
│  └──────────────────┘      └──────────────────┘        │
│                                                           │
│  Compatibility Layer (Automatic Query Translation)       │
└───────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────┐
│              FILE STORAGE                                 │
│          backend/public/uploads/                          │
│  - Student Photos                                         │
│  - Resource Documents (PDF, DOCX, etc.)                   │
│  - Event Images                                           │
└───────────────────────────────────────────────────────────┘
```

### Design Patterns

1. **Monorepo Structure**: Frontend and backend in same repository
2. **API-First Design**: RESTful API with clear separation
3. **Component-Based Architecture**: Reusable React components
4. **Middleware Pattern**: Express middleware for auth, validation, logging
5. **Repository Pattern**: Database abstraction layer
6. **Role-Based Access Control (RBAC)**: Permission-based features
7. **Server-Side Validation**: Express-validator for input sanitization
8. **Client-Side Validation**: React Hook Form + Zod schema validation

---

## ✨ Features & Modules

### 1. **Authentication & Authorization**
- Email/Password authentication
- Google OAuth integration
- JWT-based sessions
- Role-based access control (Admin, Office Bearer, Student)
- OTP verification system
- Session management (sessionStorage)

### 2. **User Management**
- Create, read, update, delete users
- Role assignment and permissions
- Profile management
- User search and filtering

### 3. **Student Management**
- Comprehensive student database
- Student profiles with photos
- Bulk upload via Excel
- Search and filter capabilities
- Student details view
- Profile field customization
- Interview tracking

### 4. **Project Management**
- Create and manage volunteer projects
- Assign students to projects
- Project details and documentation
- Project status tracking
- Project-specific attendance

### 5. **Attendance System**
- Track attendance for:
  - Projects
  - Meetings
  - Events
- Attendance reports
- Bulk attendance marking
- Attendance analytics

### 6. **Event Management**
- Create and schedule events
- Event registration
- Event attendance tracking
- Event details and descriptions
- Event photo gallery

### 7. **Resource Management**
- Upload documents (PDF, DOCX, PPT, etc.)
- Resource categorization
- Resource sharing
- Download tracking
- Admin resource management

### 8. **Phone Mentoring**
- Track mentoring sessions
- Mentee assignment
- Mentoring updates
- Mentoring history
- Progress tracking

### 9. **Feedback System**
- Create feedback forms
- Custom question management
- Collect student feedback
- View feedback reports
- Analytics and insights

### 10. **Awards & Recognition**
- Award management
- Student award tracking
- Certificate generation
- Award categories

### 11. **Team Management**
- Create and manage teams
- Team member assignment
- Team hierarchy
- Team activities

### 12. **Bills & Finance**
- Bill submission
- Approval workflow
- Bill tracking
- Financial reports

### 13. **Meetings**
- Schedule meetings
- Meeting attendance
- Meeting minutes
- Participant management

### 14. **Analytics Dashboard**
- Visual data representation (Recharts)
- Key performance indicators
- Attendance trends
- Project statistics
- User activity insights

### 15. **Announcements**
- Broadcast announcements
- Role-based announcements
- Announcement history
- Priority levels

### 16. **Activity Logs**
- Comprehensive audit trail
- User action tracking
- System event logging
- Security monitoring

### 17. **Messages**
- Internal messaging system
- Student-admin communication
- Message threads
- Notifications

### 18. **Settings**
- System configuration
- User preferences
- Profile settings
- Application settings

---

## 🗄️ Database Architecture

### Database Options

The application supports **dual database configuration**:

1. **SQLite** (Development/Default)
   - File-based database: `backend/database/sm_volunteers.db`
   - Zero configuration
   - Automatic setup on first run

2. **MySQL** (Production/Optional)
   - Better performance for large datasets
   - Concurrent user support
   - Migration scripts provided

### Key Tables (40+ tables)

#### Core Tables
- **users** - User accounts and authentication
- **students** - Student profiles and information
- **interviews** - Interview records
- **projects** - Volunteer projects
- **attendance** - Attendance records
- **meetings** - Meeting information
- **events** - Event management
- **event_attendance** - Event participation

#### Management Tables
- **bills** - Financial records
- **awards** - Recognition and awards
- **teams** - Team organization
- **office_bearers** - Leadership positions
- **resources** - Shared documents
- **announcements** - System announcements
- **feedback_questions** - Survey questions
- **feedback_responses** - Survey responses

#### Supporting Tables
- **phone_mentoring** - Mentoring sessions
- **spoc** - Single Point of Contact records
- **activity_logs** - Audit trail
- **messages** - Communication records
- **settings** - System configuration

### Database Features
- Automatic schema creation
- Foreign key relationships
- Index optimization
- Transaction support
- Data migration utilities

---

## 🔐 Authentication & Authorization

### Authentication Flow

```
1. User enters credentials (Login Page)
   ↓
2. POST /api/auth/login
   ↓
3. Backend validates credentials (bcrypt)
   ↓
4. Generate JWT token (includes user_id, email, role)
   ↓
5. Return token to client
   ↓
6. Client stores token in sessionStorage
   ↓
7. Subsequent API calls include token in Authorization header
   ↓
8. Middleware validates token on each request
   ↓
9. Route handler accesses req.user
```

### Google OAuth Flow

```
1. User clicks "Sign in with Google"
   ↓
2. Redirect to Google OAuth consent screen
   ↓
3. User authorizes application
   ↓
4. Google returns authorization code
   ↓
5. Backend exchanges code for tokens
   ↓
6. Verify Google token and extract user info
   ↓
7. Create/update user in database
   ↓
8. Generate JWT token
   ↓
9. Redirect to dashboard with token
```

### Role-Based Access Control (RBAC)

#### Roles:
1. **Admin** - Full system access
2. **Office Bearer** - Management permissions
3. **Student** - Limited access to own data

#### Permission Hierarchy:
```
Admin
 ├── Manage all users
 ├── Manage all students
 ├── Manage all projects
 ├── View all analytics
 ├── System settings
 └── All permissions

Office Bearer
 ├── Manage assigned projects
 ├── View student data
 ├── Take attendance
 ├── View reports
 └── Limited management

Student
 ├── View own profile
 ├── Mark own attendance
 ├── Submit feedback
 ├── View assigned projects
 └── View resources
```

### Protected Routes

Frontend uses `ProtectedRoute` component:
```typescript
<Route element={<ProtectedRoute allowedRoles={['admin', 'office_bearer']} />}>
  <Route path="/manage-students" element={<ManageStudents />} />
</Route>
```

Backend uses `authenticateToken` middleware:
```javascript
router.get('/protected', authenticateToken, (req, res) => {
  // Access req.user (decoded token)
});
```

### Environment Variables for Auth

```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## 📁 Project Structure

### Root Level
```
sm-dash/
├── backend/              # Backend API server
├── src/                  # React frontend source
├── public/               # Static public assets
├── Images/               # Image assets
├── package.json          # Frontend dependencies
├── vite.config.ts        # Vite configuration
├── tailwind.config.ts    # Tailwind CSS config
├── tsconfig.json         # TypeScript config
├── components.json       # shadcn/ui config
└── eslint.config.js      # ESLint rules
```

### Backend Structure (`/backend/`)
```
backend/
├── server.js             # Express server entry point
├── package.json          # Backend dependencies
├── nodemon.json          # Nodemon configuration
├── database/
│   ├── init.js           # Database initialization & schema
│   └── sm_volunteers.db  # SQLite database file (gitignored)
├── routes/               # API route handlers
│   ├── auth.js           # Authentication endpoints
│   ├── users.js          # User management
│   ├── students.js       # Student operations
│   ├── projects.js       # Project management
│   ├── attendance.js     # Attendance tracking
│   ├── events.js         # Event management
│   ├── resources.js      # Resource sharing
│   ├── feedback.js       # Feedback system
│   ├── meetings.js       # Meeting management
│   ├── teams.js          # Team operations
│   ├── awards.js         # Awards management
│   ├── bills.js          # Bill management
│   ├── announcements.js  # Announcement system
│   ├── messages.js       # Messaging system
│   ├── activity.js       # Activity logging
│   ├── phoneMentoring.js # Mentoring tracking
│   ├── spoc.js           # SPOC management
│   ├── office_bearers.js # Office bearer operations
│   ├── settings.js       # System settings
│   ├── time.js           # Time tracking
│   ├── ngo.js            # NGO management
│   └── upload.js         # File upload handling
├── middleware/
│   └── auth.js           # JWT authentication middleware
├── utils/
│   ├── email.js          # Email service (Nodemailer)
│   ├── otp.js            # OTP generation/verification
│   └── logger.js         # Logging utility
├── scripts/              # Database & utility scripts
│   ├── init-db.js        # Initialize database schema
│   ├── migrate-sqlite-to-mysql.js  # DB migration
│   ├── verify-migration.js         # Verify migration
│   ├── test-mysql-connection.js    # Test MySQL connection
│   └── [other scripts]
└── public/
    └── uploads/          # Uploaded files storage
        ├── students/     # Student photos
        ├── resources/    # Resource documents
        └── events/       # Event images
```

### Frontend Structure (`/src/`)
```
src/
├── main.tsx              # Application entry point
├── App.tsx               # Root component with routing
├── index.css             # Global styles & Tailwind
├── App.css               # Component styles
├── pages/                # Page components (50+ pages)
│   ├── LandingPage.tsx
│   ├── Login.tsx
│   ├── AdminDashboard.tsx
│   ├── OfficeBearerDashboard.tsx
│   ├── StudentDashboard.tsx
│   ├── ManageStudents.tsx
│   ├── ManageProjects.tsx
│   ├── ManageAttendance.tsx
│   ├── ManageEvents.tsx
│   ├── Analytics.tsx
│   └── [40+ more pages]
├── components/           # Reusable components
│   ├── ui/               # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── table.tsx
│   │   └── [30+ UI components]
│   ├── layout/           # Layout components
│   │   └── MainLayout.tsx
│   ├── landing/          # Landing page components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   ├── Footer.tsx
│   ├── ProtectedRoute.tsx
│   ├── ErrorBoundary.tsx
│   └── [other components]
├── lib/                  # Core utilities
│   ├── api.ts            # API client (fetch wrapper)
│   ├── auth.ts           # Auth utilities
│   ├── permissions.ts    # Permission checks
│   └── utils.ts          # Helper functions
├── hooks/                # Custom React hooks
│   ├── use-toast.ts
│   ├── use-mobile.tsx
│   └── usePermissions.ts
├── styles/               # Additional styles
└── integrations/
    └── supabase/         # Supabase integration (optional)
```

---

## 🚀 Setup & Installation

### Prerequisites

1. **Node.js** (v16 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **npm** or **bun** (Package manager)
   - npm comes with Node.js
   - bun: https://bun.sh/ (optional, faster alternative)
   - Verify: `npm --version` or `bun --version`

3. **MySQL** (Optional, for production)
   - Download: https://dev.mysql.com/downloads/mysql/
   - SQLite is used by default (no installation needed)

### Installation Steps

#### 1. Clone/Extract the Project

```powershell
# Navigate to project directory
cd "d:\Project-Mainfiles\Client-Project\SM\sm-dash"
```

#### 2. Install Frontend Dependencies

```powershell
# Using npm
npm install

# OR using bun (faster)
bun install
```

#### 3. Install Backend Dependencies

```powershell
# Navigate to backend folder
cd backend

# Using npm
npm install

# OR using bun
bun install

# Return to root
cd ..
```

#### 4. Environment Configuration

Create a `.env` file in the **root directory**:

```env
# Database Configuration
DB_TYPE=sqlite
# For MySQL: DB_TYPE=mysql

# MySQL Configuration (if using MySQL)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=sm_volunteers

# SQLite Configuration (default)
DB_PATH=./backend/database/sm_volunteers.db

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-please

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Email Configuration (for OTP and notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-email-app-password
EMAIL_FROM=SM Volunteers <noreply@smvolunteers.edu>

# Frontend URL (for CORS and redirects)
FRONTEND_URL=http://localhost:9000
```

Create a `.env` file in the **frontend root** (optional):

```env
# Backend API URL
VITE_API_URL=http://localhost:3000/api
```

#### 5. Initialize Database

```powershell
cd backend

# Initialize SQLite database with schema
npm run init-db

# OR
node scripts/init-db.js
```

---

## ▶️ Running the Project

### Development Mode

#### Option 1: Run Both Frontend & Backend Together (Recommended)

```powershell
# From root directory
npm run dev:all
```

This command uses `concurrently` to run:
- Frontend dev server (port 9000)
- Backend API server (port 3000)

#### Option 2: Run Separately

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
# Server will run on http://localhost:3000
```

**Terminal 2 - Frontend:**
```powershell
# From root directory
npm run dev
# Frontend will run on http://localhost:9000
```

### Accessing the Application

1. **Frontend UI**: http://localhost:9000
2. **Backend API**: http://localhost:3000
3. **API Health Check**: http://localhost:3000/api/health

### Default Login Credentials

After initialization, the default admin user is created:

```
Email: admin@example.com
Password: admin123
Role: Admin
```

**⚠️ Change this password immediately after first login!**

### Production Build

```powershell
# Build frontend for production
npm run build

# Output will be in `dist/` folder

# Preview production build
npm run preview
```

---

## 🔧 Development Workflow

### File Watching

- **Frontend**: Vite HMR automatically reloads on file changes
- **Backend**: Nodemon automatically restarts server on file changes

### Code Linting

```powershell
# Lint frontend code
npm run lint
```

### Database Migrations

If you need to switch from SQLite to MySQL:

```powershell
cd backend

# 1. Test MySQL connection
node scripts/test-mysql-connection.js

# 2. Run migration
node scripts/migrate-sqlite-to-mysql.js

# 3. Verify migration
node scripts/verify-migration.js

# 4. Update .env
# Change DB_TYPE=sqlite to DB_TYPE=mysql
```

Detailed migration guide: `backend/MIGRATION_GUIDE.md`

### Adding New Features

1. **Frontend Component**:
   ```bash
   # Add shadcn component
   npx shadcn-ui@latest add [component-name]
   ```

2. **Backend Route**:
   - Create route file in `backend/routes/`
   - Import and register in `backend/server.js`
   - Add middleware if needed

3. **Database Table**:
   - Add table creation in `backend/database/init.js`
   - Run `npm run init-db` in backend folder

---

## 🌐 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/google` | Google OAuth login |
| POST | `/api/auth/verify-otp` | Verify OTP |
| POST | `/api/auth/resend-otp` | Resend OTP |
| GET | `/api/auth/me` | Get current user |
| GET | `/auth/google` | Initiate Google OAuth |

### Users (`/api/users`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | Get all users |
| GET | `/api/users/:id` | Get user by ID |
| POST | `/api/users` | Create new user |
| PUT | `/api/users/:id` | Update user |
| DELETE | `/api/users/:id` | Delete user |

### Students (`/api/students`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students` | Get all students |
| GET | `/api/students/:id` | Get student details |
| POST | `/api/students` | Create student |
| PUT | `/api/students/:id` | Update student |
| DELETE | `/api/students/:id` | Delete student |
| POST | `/api/students/bulk-upload` | Bulk upload via Excel |

### Projects (`/api/projects`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | Get all projects |
| GET | `/api/projects/:id` | Get project details |
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/students` | Assign students |

### Attendance (`/api/attendance`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/attendance` | Get attendance records |
| POST | `/api/attendance` | Mark attendance |
| PUT | `/api/attendance/:id` | Update attendance |
| GET | `/api/attendance/student/:id` | Student attendance |

### Events (`/api/events`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | Get all events |
| GET | `/api/events/:id` | Get event details |
| POST | `/api/events` | Create event |
| PUT | `/api/events/:id` | Update event |
| DELETE | `/api/events/:id` | Delete event |
| POST | `/api/events/:id/attendance` | Mark event attendance |

### Resources (`/api/resources`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resources` | Get all resources |
| GET | `/api/resources/:id` | Get resource |
| POST | `/api/resources` | Upload resource |
| DELETE | `/api/resources/:id` | Delete resource |
| GET | `/uploads/:filename` | Download file |

### Feedback (`/api/feedback`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feedback/questions` | Get feedback questions |
| POST | `/api/feedback/questions` | Create question |
| POST | `/api/feedback/responses` | Submit feedback |
| GET | `/api/feedback/reports` | View feedback reports |

### Other Endpoints

- `/api/meetings` - Meeting management
- `/api/teams` - Team operations
- `/api/awards` - Awards management
- `/api/bills` - Bill management
- `/api/announcements` - System announcements
- `/api/messages` - Messaging system
- `/api/activity` - Activity logs
- `/api/phone-mentoring` - Mentoring tracking
- `/api/spoc` - SPOC management
- `/api/office-bearers` - Office bearer operations
- `/api/settings` - System settings
- `/api/upload` - File upload handling

### Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* Response data */ }
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error (dev mode only)"
}
```

---

## 🔄 Database Migration

### SQLite to MySQL Migration

The project includes a comprehensive migration system to move from SQLite to MySQL.

#### Why Migrate?

- **Scalability**: Better performance with many concurrent users
- **Reliability**: ACID compliance and better data integrity
- **Features**: Advanced query optimization and indexing
- **Production Ready**: Industry-standard for web applications

#### Migration Steps

1. **Ensure MySQL is Installed & Running**
   ```powershell
   # Check MySQL service
   Get-Service -Name MySQL*
   
   # Start MySQL if not running
   Start-Service -Name MySQL80
   ```

2. **Create MySQL Database**
   ```sql
   mysql -u root -p
   CREATE DATABASE sm_volunteers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   EXIT;
   ```

3. **Test MySQL Connection**
   ```powershell
   cd backend
   node scripts/test-mysql-connection.js
   ```

4. **Run Migration Script**
   ```powershell
   node scripts/migrate-sqlite-to-mysql.js
   ```

   This script will:
   - Create automatic backup of SQLite database
   - Read all data from SQLite
   - Create MySQL tables
   - Transfer data in batches
   - Verify data integrity
   - Provide detailed statistics

5. **Verify Migration**
   ```powershell
   node scripts/verify-migration.js
   ```

6. **Update Environment**
   ```env
   # Change in .env file
   DB_TYPE=mysql
   ```

7. **Restart Backend Server**

#### Rollback (if needed)

```powershell
# Restore from backup
cd backend/database/backups
# Copy the timestamped .db file back to sm_volunteers.db

# Change .env back to
DB_TYPE=sqlite
```

Detailed guide: `backend/MIGRATION_GUIDE.md`

---

## 🚢 Deployment Considerations

### Frontend Deployment

#### Build for Production

```powershell
npm run build
```

The `dist/` folder contains optimized static files ready for deployment.

#### Deployment Options

1. **Vercel** (Recommended for Vite + React)
   ```powershell
   npm i -g vercel
   vercel
   ```

2. **Netlify**
   - Connect GitHub repository
   - Build command: `npm run build`
   - Publish directory: `dist`

3. **Static Hosting** (AWS S3, Cloudflare Pages, etc.)
   - Upload contents of `dist/` folder
   - Configure routing for SPA

### Backend Deployment

#### Deployment Options

1. **VPS** (DigitalOcean, Linode, AWS EC2)
   ```bash
   # Install Node.js
   # Clone repository
   # Install dependencies
   npm install --production
   
   # Use PM2 for process management
   npm install -g pm2
   pm2 start backend/server.js --name sm-volunteers
   pm2 startup
   pm2 save
   ```

2. **Heroku**
   ```bash
   # Add Procfile
   echo "web: node backend/server.js" > Procfile
   
   # Deploy
   heroku create sm-volunteers
   git push heroku main
   ```

3. **Docker**
   ```dockerfile
   # Create Dockerfile
   FROM node:18
   WORKDIR /app
   COPY package*.json ./
   RUN npm install --production
   COPY . .
   EXPOSE 3000
   CMD ["node", "backend/server.js"]
   ```

### Production Checklist

- [ ] Set strong `JWT_SECRET` in environment variables
- [ ] Configure production database (MySQL)
- [ ] Set up SSL/HTTPS certificates
- [ ] Configure CORS for production domains
- [ ] Set `NODE_ENV=production`
- [ ] Enable rate limiting
- [ ] Set up monitoring (PM2, New Relic, etc.)
- [ ] Configure backup strategy for database
- [ ] Set up CDN for static assets
- [ ] Configure email service (SMTP)
- [ ] Set up logging (Winston, Papertrail)
- [ ] Enable compression middleware
- [ ] Configure file upload limits
- [ ] Set up error tracking (Sentry)
- [ ] Document API with Swagger/OpenAPI

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
DB_TYPE=mysql
DB_HOST=your-mysql-host
DB_USER=your-mysql-user
DB_PASSWORD=strong-password-here
DB_NAME=sm_volunteers
JWT_SECRET=very-strong-random-secret-key
FRONTEND_URL=https://your-frontend-domain.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@domain.com
EMAIL_PASSWORD=your-app-password
```

---

## 📊 Performance Considerations

### Frontend Optimization

- **Code Splitting**: React Router lazy loading
- **Image Optimization**: Compress images before upload
- **Bundle Analysis**: Use `vite-plugin-visualizer`
- **Caching**: Browser caching headers
- **CDN**: Serve static assets from CDN

### Backend Optimization

- **Database Indexing**: Properly indexed queries
- **Connection Pooling**: MySQL connection pool (max 10)
- **Compression**: Gzip compression enabled
- **Caching**: Consider Redis for session/cache
- **Rate Limiting**: Prevent API abuse

### Database Optimization

- **Indexes**: Primary keys, foreign keys, frequently queried fields
- **Query Optimization**: Avoid N+1 queries
- **Pagination**: Limit result sets
- **Connection Management**: Close unused connections

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use

```powershell
# Backend (Port 3000)
node backend/scripts/free-port.js

# Frontend (Port 9000)
# Change port in vite.config.ts
```

#### 2. Database Connection Error

```powershell
# For SQLite: Ensure backend/database/ folder exists
mkdir backend/database

# For MySQL: Test connection
node backend/scripts/test-mysql-connection.js
```

#### 3. Module Not Found

```powershell
# Delete node_modules and reinstall
rm -rf node_modules
npm install

# In backend
cd backend
rm -rf node_modules
npm install
```

#### 4. CORS Error

- Ensure backend is running on port 3000
- Check `VITE_API_URL` environment variable
- Verify CORS is enabled in `backend/server.js`

#### 5. JWT Token Invalid

- Token expires after session
- Clear sessionStorage: `sessionStorage.clear()`
- Login again

---

## 📚 Additional Documentation

- **Migration Guide**: `backend/MIGRATION_GUIDE.md`
- **Migration Summary**: `backend/MIGRATION_SUMMARY.md`
- **Migration Complete**: `backend/MIGRATION_COMPLETE.md`
- **Status**: `backend/STATUS.md`

---

## 🤝 Development Team

This project was developed for **K.S.Rangasamy College of Technology** to manage student volunteer activities efficiently.

---

## 📄 License

This is a private project for educational institutional use.

---

## 📞 Support

For issues or questions:
1. Check troubleshooting section above
2. Review migration guides in `backend/` folder
3. Check application logs for error details

---

## 🎓 Tech Stack Summary

```
Frontend:  React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
Backend:   Node.js + Express + JWT
Database:  SQLite (dev) / MySQL (prod)
Auth:      JWT + Google OAuth
UI:        Radix UI + Framer Motion + Recharts
State:     React Query + React Hook Form
Tools:     ESLint + PostCSS + Nodemon
```

---

**Last Updated**: February 14, 2026  
**Version**: 1.0.0  
**Project Status**: Active Development
