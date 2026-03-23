# SM Volunteers Dashboard - Complete File Structure

> **Project**: Student Management Volunteers Dashboard  
> **Last Updated**: February 14, 2026  
> **Version**: 2.0.0 (Monorepo Structure)

---

## 📂 Directory Tree

```
sm-dash/
│
├── 📄 Root Configuration
│   ├── package.json                 # Monorepo scripts (install:all, dev:all)
│   ├── .env.example                 # Environment variables template
│   ├── README.md                    # Project documentation
│   └── smvdb.mwb                    # MySQL Workbench database model
│
├── 📁 frontend/                     # React Frontend Application
│   │
│   ├── 📄 Configuration Files
│   │   ├── package.json             # Frontend dependencies & scripts
│   │   ├── bun.lockb                # Bun lock file
│   │   ├── vite.config.ts           # Vite bundler configuration (PORT 9000)
│   │   ├── tsconfig.json            # TypeScript base configuration
│   │   ├── tsconfig.app.json        # TypeScript app configuration
│   │   ├── tsconfig.node.json       # TypeScript node configuration
│   │   ├── tailwind.config.ts       # Tailwind CSS configuration
│   │   ├── postcss.config.js        # PostCSS configuration
│   │   ├── eslint.config.js         # ESLint linting rules
│   │   ├── components.json          # shadcn/ui component configuration
│   │   └── index.html               # HTML entry point
│   │
├── 📁 backend/                      # Backend API Server
│   │
│   ├── 📄 Configuration & Entry
│   │   ├── package.json             # Backend dependencies
│   │   ├── server.js                # Express server entry point (PORT 3000)
│   │   ├── nodemon.json             # Nodemon hot-reload config
│   │   └── .env (not in repo)      # Environment variables
│   │
│   ├── 📁 database/                 # Database Layer
│   │   ├── init.js                  # Database initialization & schema (1518 lines)
│   │   │                            # - Creates 40+ tables
│   │   │                            # - MySQL compatibility layer
│   │   │                            # - Handles AUTOINCREMENT → AUTO_INCREMENT
│   │   │                            # - Query translation
│   │   └── (SQLite database file removed after migration)
│   │
│   ├── 📁 routes/                   # API Route Handlers
│   │   ├── auth.js                  # Authentication endpoints
│   │   │                            # - POST /api/auth/login
│   │   │                            # - POST /api/auth/register
│   │   │                            # - POST /api/auth/google
│   │   │                            # - GET /auth/google (OAuth redirect)
│   │   │                            # - POST /api/auth/verify-otp
│   │   │
│   │   ├── users.js                 # User management
│   │   │                            # - CRUD operations for users
│   │   │                            # - Role management
│   │   │
│   │   ├── students.js              # Student management
│   │   │                            # - Student CRUD
│   │   │                            # - Bulk upload via Excel
│   │   │                            # - Photo upload
│   │   │                            # - Search & filter
│   │   │
│   │   ├── interviews.js            # Interview tracking
│   │   │                            # - Schedule interviews
│   │   │                            # - Track interview status
│   │   │
│   │   ├── projects.js              # Project management
│   │   │                            # - Project CRUD
│   │   │                            # - Assign students to projects
│   │   │                            # - Project status tracking
│   │   │
│   │   ├── attendance.js            # Attendance system
│   │   │                            # - Mark attendance
│   │   │                            # - View attendance records
│   │   │                            # - Attendance reports
│   │   │
│   │   ├── meetings.js              # Meeting management
│   │   │                            # - Schedule meetings
│   │   │                            # - Meeting attendance
│   │   │                            # - Meeting minutes
│   │   │
│   │   ├── events.js                # Event management
│   │   │                            # - Create/manage events
│   │   │                            # - Event attendance
│   │   │                            # - Event photos
│   │   │
│   │   ├── awards.js                # Awards system
│   │   │                            # - Award management
│   │   │                            # - Student award tracking
│   │   │
│   │   ├── bills.js                 # Financial management
│   │   │                            # - Bill submission
│   │   │                            # - Approval workflow
│   │   │                            # - Bill tracking
│   │   │
│   │   ├── resources.js             # Resource sharing
│   │   │                            # - Upload documents
│   │   │                            # - Resource categorization
│   │   │                            # - Download tracking
│   │   │
│   │   ├── feedback.js              # Feedback system
│   │   │                            # - Create feedback forms
│   │   │                            # - Question management
│   │   │                            # - Submit responses
│   │   │                            # - View reports
│   │   │
│   │   ├── teams.js                 # Team management
│   │   │                            # - Create/manage teams
│   │   │                            # - Team member assignment
│   │   │
│   │   ├── announcements.js         # Announcement system
│   │   │                            # - Broadcast announcements
│   │   │                            # - Role-based announcements
│   │   │
│   │   ├── messages.js              # Messaging system
│   │   │                            # - Internal messaging
│   │   │                            # - Message threads
│   │   │
│   │   ├── activity.js              # Activity logging
│   │   │                            # - Audit trail
│   │   │                            # - User action tracking
│   │   │
│   │   ├── phoneMentoring.js        # Mentoring system
│   │   │                            # - Track mentoring sessions
│   │   │                            # - Mentee assignment
│   │   │                            # - Progress tracking
│   │   │
│   │   ├── spoc.js                  # SPOC management
│   │   │                            # - Single Point of Contact records
│   │   │
│   │   ├── office_bearers.js        # Office bearer operations
│   │   │                            # - Leadership positions
│   │   │                            # - Office bearer management
│   │   │
│   │   ├── settings.js              # System settings
│   │   │                            # - Application configuration
│   │   │                            # - User preferences
│   │   │
│   │   ├── time.js                  # Time tracking
│   │   │                            # - Time management utilities
│   │   │
│   │   ├── ngo.js                   # NGO management
│   │   │                            # - NGO-related operations
│   │   │
│   │   └── upload.js                # File upload handler
│   │                                # - Multer configuration
│   │                                # - File validation
│   │                                # - Storage management
│   │
│   ├── 📁 middleware/               # Express Middleware
│   │   └── auth.js                  # JWT authentication middleware
│   │                                # - Token verification
│   │                                # - User extraction from token
│   │                                # - Protected route handling
│   │
│   ├── 📁 utils/                    # Utility Functions
│   │   ├── email.js                 # Email service (Nodemailer)
│   │   │                            # - Send emails
│   │   │                            # - OTP emails
│   │   │                            # - Notification emails
│   │   │
│   │   ├── otp.js                   # OTP management
│   │   │                            # - Generate OTP
│   │   │                            # - Verify OTP
│   │   │                            # - OTP expiration
│   │   │
│   │   └── logger.js                # Logging utility
│   │                                # - Application logging
│   │                                # - Error logging
│   │
│   ├── 📁 scripts/                  # Database & Utility Scripts
│   │   ├── init-db.js               # Initialize database schema
│   │   │                            # - Create all tables
│   │   │                            # - Create default admin user
│   │   │
│   │   ├── migrate-sqlite-to-mysql.js   # (removed - legacy)
│   │   │                                # - Backup MySQL or existing data
│   │   │                                # - Transfer data to MySQL
│   │   │                                # - Progress tracking
│   │   │                                # - Data verification
│   │   │
│   │   ├── verify-migration.js      # Verify migration integrity
│   │   │                            # - Compare row counts
│   │   │                            # - Validate data integrity
│   │   │
│   │   ├── test-mysql-connection.js # Test MySQL connectivity
│   │   │                            # - Test connection
│   │   │                            # - Test queries
│   │   │                            # - Troubleshooting guidance
│   │   │
│   │   ├── init-mysql-basic.js      # Basic MySQL table creation test
│   │   │
│   │   ├── check-schema.js          # Database schema validation
│   │   │
│   │   ├── check_connection.js      # Database connection check
│   │   │
│   │   ├── check_event_attendance.js    # Event attendance verification
│   │   │
│   │   ├── check-attendance-ids.js  # Attendance ID validation
│   │   │
│   │   ├── cleanup_test_user.js     # Remove test users
│   │   │
│   │   ├── fix_announcements_db.js  # Fix announcements table
│   │   │
│   │   ├── fix_resource_titles.js   # Fix resource titles
│   │   │
│   │   ├── free-port.js             # Free up occupied ports
│   │   │
│   │   ├── insert_sample_event_attendance.js    # Sample data
│   │   │
│   │   ├── create-phone-mentoring-test-data.js  # Test data creation
│   │   │
│   │   ├── insert-phone-mentoring-test-data.js  # Insert test data
│   │   │
│   │   ├── test-phone-mentoring-api.js      # API testing
│   │   │
│   │   ├── test-phone-mentoring-data.js     # Data validation
│   │   │
│   │   ├── verify-phone-mentoring-data.js   # Data verification
│   │   │
│   │   ├── test_import.js           # Test ES module imports
│   │   │
│   │   ├── test_sqlite.js           # (removed - legacy)
│   │   │
│   │   └── debug_init.js            # Debug initialization
│   │
│   ├── 📁 public/                   # Static File Storage
│   │   └── uploads/                 # User-uploaded files
│   │       ├── students/            # Student photos
│   │       ├── resources/           # Resource documents
│   │       ├── events/              # Event images
│   │       └── [other uploads]
│   │
│   └── 📄 Documentation
│       ├── MIGRATION_GUIDE.md       # Complete migration guide
│       │                            # - Step-by-step instructions
│       │                            # - Troubleshooting
│       │                            # - Rollback procedures
│       │
│       ├── MIGRATION_SUMMARY.md     # Quick migration reference
│       │                            # - Quick start guide
│       │                            # - Common issues
│       │
│       ├── MIGRATION_COMPLETE.md    # Migration completion checklist
│       │
│       └── STATUS.md                # Project status documentation
│
│   ├── 📁 src/                      # React Frontend Source
│   │   │
│   │   ├── 📄 Entry Points
│   │   │   ├── main.tsx             # React application entry
│   │   │   │                        # - ReactDOM.render()
│   │   │   │                        # - Provider wrapping
│   │   │   │
│   │   │   ├── App.tsx              # Root component (144 lines)
│   │   │   │                        # - React Router setup
│   │   │   │                        # - Route definitions (50+ routes)
│   │   │   │                        # - Layout wrapping
│   │   │   │
│   │   │   ├── index.css            # Global styles & Tailwind
│   │   │   │                        # - Tailwind directives
│   │   │   │                        # - CSS variables
│   │   │   │                        # - Global resets
│   │   │   │
│   │   │   ├── App.css              # Component-specific styles
│   │   │   │
│   │   │   └── vite-env.d.ts        # Vite TypeScript declarations
│   │   │
│   │   ├── 📁 pages/                # Page Components (50+ pages)
│   │   │   │
│   │   │   ├── 🏠 Landing & Auth
│   │   │   │   ├── LandingPage.tsx      # Public landing page
│   │   │   │   ├── Login.tsx            # Login page
│   │   │   │   └── Index.tsx            # Home/index page
│   │   │   │
│   │   │   ├── 👤 Dashboard Pages
│   │   │   │   ├── AdminDashboard.tsx           # Admin overview
│   │   │   │   ├── OfficeBearerDashboard.tsx    # Office bearer overview
│   │   │   │   └── StudentDashboard.tsx         # Student overview
│   │   │   │
│   │   │   ├── 👥 User Management
│   │   │   │   ├── ManageUsers.tsx              # User CRUD operations
│   │   │   │   ├── ManageOfficeBearers.tsx      # Office bearer management
│   │   │   │   ├── ManageVolunteers.tsx         # Volunteer management
│   │   │   │   ├── VolunteerRegistration.tsx    # Public registration
│   │   │   │   ├── OfficeBearerProfile.tsx      # Office bearer profile
│   │   │   │   └── StudentProfile.tsx           # Student profile
│   │   │   │
│   │   │   ├── 🎓 Student Management
│   │   │   │   ├── ManageStudents.tsx           # Student list & operations
│   │   │   │   ├── ManageStudentDatabase.tsx    # Student database management
│   │   │   │   ├── StudentDetails.tsx           # Individual student view
│   │   │   │   └── ManageInterviews.tsx         # Interview scheduling
│   │   │   │
│   │   │   ├── 📊 Project Management
│   │   │   │   ├── ManageProjects.tsx           # Project CRUD
│   │   │   │   ├── ProjectDetails.tsx           # Project detail view
│   │   │   │   ├── AssignProjectStudents.tsx    # Student assignment
│   │   │   │   └── StudentProjects.tsx          # Student project view
│   │   │   │
│   │   │   ├── ✅ Attendance Management
│   │   │   │   ├── ManageAttendance.tsx         # Attendance overview
│   │   │   │   ├── AttendanceDetails.tsx        # Detailed attendance
│   │   │   │   ├── AttendanceProjects.tsx       # Project attendance
│   │   │   │   ├── AttendanceMeetings.tsx       # Meeting attendance
│   │   │   ├── AttendanceEvents.tsx         # Event attendance
│   │   │   └── StudentAttendance.tsx        # Student attendance view
│   │   │
│   │   ├── 🎉 Event Management
│   │   │   ├── ManageEvents.tsx             # Event CRUD
│   │   │   ├── EventDetails.tsx             # Event detail view
│   │   │   └── StudentEvents.tsx            # Student event view
│   │   │
│   │   ├── 🏆 Awards & Recognition
│   │   │   └── ManageAwards.tsx             # Award management
│   │   │
│   │   ├── 💰 Financial Management
│   │   │   ├── ManageBills.tsx              # Bill management
│   │   │   └── StudentBills.tsx             # Student bill view
│   │   │
│   │   ├── 📅 Meeting Management
│   │   │   └── ManageMeetings.tsx           # Meeting CRUD
│   │   │
│   │   ├── 👥 Team Management
│   │   │   ├── ManageTeams.tsx              # Team CRUD
│   │   │   └── StudentTeams.tsx             # Student team view
│   │   │
│   │   ├── 📚 Resource Management
│   │   │   ├── AdminResources.tsx           # Admin resource management
│   │   │   └── Resources.tsx                # Resource viewing
│   │   │
│   │   ├── 💬 Feedback System
│   │   │   ├── ManageQuestions.tsx          # Question management
│   │   │   ├── StudentFeedback.tsx          # Student feedback form
│   │   │   └── ViewFeedbackReports.tsx      # Feedback reports
│   │   │
│   │   ├── 📧 Communication
│   │   │   ├── AdminMessages.tsx            # Admin messaging
│   │   │   ├── StudentMessages.tsx          # Student messaging
│   │   │   └── Announcements.tsx            # System announcements
│   │   │
│   │   ├── 📞 Mentoring
│   │   │   ├── MentorManagement.tsx         # Mentor management
│   │   │   ├── PhoneMentoringUpdate.tsx     # Mentoring updates
│   │   │   └── MenteeDetails.tsx            # Mentee details
│   │   │
│   │   ├── 📈 Analytics & Reports
│   │   │   ├── Analytics.tsx                # Analytics dashboard
│   │   │   ├── Reports.tsx                  # Report generation
│   │   │   └── StudentReports.tsx           # Student reports
│   │   │
│   │   │   └── 🚫 Error Pages
│   │   │       └── NotFound.tsx                 # 404 page
│   │   │
│   │   ├── 📁 components/               # Reusable Components
│   │   │   │
│   │   │   ├── 📁 ui/                   # shadcn/ui Components (30+ components)
│   │   │   │   ├── button.tsx           # Button component
│   │   │   │   ├── card.tsx             # Card component
│   │   │   │   ├── dialog.tsx           # Dialog/modal component
│   │   │   │   ├── dropdown-menu.tsx    # Dropdown menu
│   │   │   │   ├── input.tsx            # Input field
│   │   │   │   ├── label.tsx            # Form label
│   │   │   │   ├── table.tsx            # Table component
│   │   │   │   ├── tabs.tsx             # Tabs component
│   │   │   │   ├── toast.tsx            # Toast notification
│   │   │   │   ├── tooltip.tsx          # Tooltip component
│   │   │   │   ├── select.tsx           # Select dropdown
│   │   │   │   ├── checkbox.tsx         # Checkbox input
│   │   │   │   ├── radio-group.tsx      # Radio button group
│   │   │   │   ├── switch.tsx           # Toggle switch
│   │   │   │   ├── slider.tsx           # Slider input
│   │   │   │   ├── progress.tsx         # Progress bar
│   │   │   │   ├── separator.tsx        # Visual separator
│   │   │   │   ├── avatar.tsx           # User avatar
│   │   │   │   ├── badge.tsx            # Badge/tag component
│   │   │   │   ├── alert.tsx            # Alert component
│   │   │   │   ├── alert-dialog.tsx     # Confirmation dialog
│   │   │   │   ├── popover.tsx          # Popover component
│   │   │   │   ├── hover-card.tsx       # Hover card
│   │   │   │   ├── context-menu.tsx     # Context menu
│   │   │   │   ├── menubar.tsx          # Menu bar
│   │   │   │   ├── navigation-menu.tsx  # Navigation menu
│   │   │   │   ├── scroll-area.tsx      # Scroll area
│   │   │   │   ├── accordion.tsx        # Accordion component
│   │   │   │   ├── collapsible.tsx      # Collapsible section
│   │   │   │   ├── aspect-ratio.tsx     # Aspect ratio container
│   │   │   │   ├── sonner.tsx           # Sonner toast
│   │   │   │   └── toaster.tsx          # Toaster container
│   │   │   │
│   │   │   ├── 📁 layout/               # Layout Components
│   │   │   │   └── MainLayout.tsx       # Main layout wrapper
│   │   │   │                            # - Header
│   │   │   │                            # - Sidebar
│   │   │   │                            # - Footer
│   │   │   │                            # - Content area
│   │   │   │
│   │   │   ├── 📁 landing/              # Landing Page Components
│   │   │   │   └── [landing components] # Hero, features, etc.
│   │   │   │
│   │   │   ├── Header.tsx               # Application header
│   │   │   │                            # - Logo
│   │   │   │                            # - Navigation
│   │   │   │                            # - User menu
│   │   │   │
│   │   │   ├── Sidebar.tsx              # Sidebar navigation
│   │   │   │                            # - Menu items
│   │   │   │                            # - Role-based visibility
│   │   │   │
│   │   │   ├── Footer.tsx               # Application footer
│   │   │   │                            # - Links
│   │   │   │                            # - Copyright
│   │   │   │
│   │   │   ├── ProtectedRoute.tsx       # Route protection HOC
│   │   │   │                            # - Authentication check
│   │   │   │                            # - Role-based access
│   │   │   │
│   │   │   ├── ErrorBoundary.tsx        # Error boundary component
│   │   │   │                            # - Catch React errors
│   │   │   │                            # - Display fallback UI
│   │   │   │
│   │   │   ├── NotificationBell.tsx     # Notification system
│   │   │   │
│   │   │   ├── BackButton.tsx           # Navigation back button
│   │   │   │
│   │   │   ├── DeveloperCredit.tsx      # Developer attribution
│   │   │   │
│   │   │   ├── CalendarMonth.tsx        # Calendar component
│   │   │   │
│   │   │   ├── PDFViewer.tsx            # PDF viewing component
│   │   │   │
│   │   │   ├── BulkUploadModal.tsx      # Bulk upload modal
│   │   │   │                            # - Excel upload
│   │   │   │                            # - CSV upload
│   │   │   │
│   │   │   ├── AttendanceDetailsModal.tsx   # Attendance detail modal
│   │   │   │
│   │   │   ├── ViewFullStudentModal.tsx     # Student detail modal
│   │   │   │
│   │   │   └── StudentMessagesTab.tsx       # Student messaging tab
│   │   │
│   │   ├── 📁 lib/                      # Core Utilities & Services
│   │   │   ├── api.ts                   # API client (1362 lines)
│   │   │   │                            # - Axios/Fetch wrapper
│   │   │   │                            # - Request interceptors
│   │   │   │                            # - Response handling
│   │   │   │                            # - Error handling
│   │   │   │                            # - All API methods
│   │   │   │
│   │   │   ├── auth.ts                  # Authentication utilities
│   │   │   │                            # - Login/logout
│   │   │   │                            # - Token management
│   │   │   │                            # - User info
│   │   │   │                            # - Role checks
│   │   │   │
│   │   │   ├── permissions.ts           # Permission utilities
│   │   │   │                            # - Role-based checks
│   │   │   │                            # - Feature flags
│   │   │   │
│   │   │   └── utils.ts                 # Helper functions
│   │   │                                # - Date formatting
│   │   │                                # - String manipulation
│   │   │                                # - Validation helpers
│   │   │                                # - cn() for className merging
│   │   │
│   │   ├── 📁 hooks/                    # Custom React Hooks
│   │   │   ├── use-toast.ts             # Toast notification hook
│   │   │   │                            # - Show success/error messages
│   │   │   │
│   │   │   ├── use-mobile.tsx           # Mobile detection hook
│   │   │   │                            # - Responsive breakpoint detection
│   │   │   │
│   │   │   └── usePermissions.ts        # Permission checking hook
│   │   │                                # - Check user permissions
│   │   │                                # - Role-based access
│   │   │
│   │   ├── 📁 styles/                   # Additional Style Files
│   │   │   └── [style files]
│   │   │
│   │   └── 📁 integrations/             # Third-party Integrations
│   │       └── supabase/                # Supabase integration (optional)
│   │           └── [supabase files]
│   │
│   ├── 📁 public/                       # Frontend Public Assets
│   │   ├── index.html                   # Alternative HTML entry
│   │   ├── 404.html                     # 404 error page
│   │   ├── robots.txt                   # SEO robots file
│   │   └── images/                      # Public images
│   │
│   └── 📄 README.md                     # Frontend documentation
│
├── 📁 docs/                         # Project Documentation
│   ├── README.md                    # Documentation index
│   ├── PROJECT_ANALYSIS.md          # Comprehensive analysis document
│   ├── FILE_STRUCTURE.md            # This file structure document
│   └── backend/                     # Backend-specific documentation
│       ├── MIGRATION_GUIDE.md       # Database migration guide
│       ├── MIGRATION_SUMMARY.md     # Quick migration reference
│       ├── MIGRATION_COMPLETE.md    # Migration completion checklist
│       └── STATUS.md                # Project status documentation
│
├── 📁 Images/                       # Project Images
│   └── [project images]             # Logos, branding, etc.
│
└── 📄 Root README Files
    ├── README.md                    # Main project documentation
    └── .env.example                 # Environment variables template
```

---

## 📊 File Statistics

### Backend

| Category | Count | Description |
|----------|-------|-------------|
| **Route Files** | 23 | API endpoint handlers |
| **Middleware** | 1 | Authentication middleware |
| **Utility Files** | 3 | Email, OTP, Logger |
| **Database Files** | 1 | Schema & initialization (1518 lines) |
| **Script Files** | 20+ | Migration, testing, maintenance |
| **Documentation** | 4 | Migration guides, status |

**Total Backend Files**: ~50 files

### Frontend

| Category | Count | Description |
|----------|-------|-------------|
| **Page Components** | 52 | Route-level page components |
| **UI Components** | 30+ | shadcn/ui reusable components |
| **Custom Components** | 15+ | App-specific components |
| **Library Files** | 4 | API, auth, permissions, utils |
| **Hooks** | 3 | Custom React hooks |
| **Config Files** | 8 | TypeScript, Vite, Tailwind, ESLint |

**Total Frontend Files**: ~110 files

### Overall Project

- **Total Files**: ~160+ files (excluding node_modules, build outputs)
- **Lines of Code**: ~25,000+ lines (estimated)
- **Languages**: TypeScript (70%), JavaScript (25%), JSON (3%), CSS (2%)

---

## 📦 Key File Descriptions

### Root Configuration Files

#### `package.json` (Root - Monorepo Coordinator)
```json
{
  "name": "sm-volunteers-dashboard",
  "scripts": {
    "install:all": "npm install --prefix frontend && npm install --prefix backend",
    "dev:frontend": "npm run dev --prefix frontend",
    "dev:backend": "npm run dev --prefix backend",
    "dev:all": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "build": "npm run build --prefix frontend"
  }
}
```

### Frontend Configuration Files

#### `frontend/package.json`
```json
{
  "name": "vite_react_shadcn_ts",
  "scripts": {
    "dev": "vite",                    // Start frontend (port 9000)
    "build": "vite build",            // Production build
    "lint": "eslint .",               // Lint code
    "preview": "vite preview"         // Preview production build
  }
}
```

#### `frontend/vite.config.ts`
- Vite configuration
- Port: **9000**
- HMR (Hot Module Replacement) configuration
- Path aliases (`@` → `./src`)
- React plugin with SWC compiler
- Backend proxy: `http://localhost:3000`

#### `frontend/tailwind.config.ts`
- Design system integration
- Custom color schemes
- Typography configuration
- Spacing system (4px grid)
- Custom border radius
- Font families

#### `frontend/tsconfig.json`
- TypeScript compiler options
- Path mappings (`@/*` → `./src/*`)
- Strict type checking disabled (for flexibility)
- Allow JavaScript files

### Backend Files

#### `backend/server.js`
**Main Express Server** (180 lines)
- Port: **3000**
- CORS configuration
- Middleware setup
- Route registration (23 routes)
- Database initialization
- Error handling
- Graceful shutdown
- Health check endpoint

#### `backend/database/init.js`
**Database Layer** (1518 lines)
- Creates 40+ tables
- MySQL/SQLite compatibility
- Query translation
- Connection pooling
- CRUD helper methods
- Transaction support
- Index creation

#### `backend/middleware/auth.js`
**Authentication Middleware**
- JWT token verification
- Extract user from token
- Attach `req.user`
- Protected route handling

#### `backend/routes/*.js`
**API Route Handlers** (23 files)
- RESTful endpoints
- Input validation (express-validator)
- Business logic
- Database queries
- Response formatting
- Error handling

### Frontend Files

#### `frontend/src/main.tsx`
**Application Entry Point**
- ReactDOM rendering
- React Query setup
- Tooltip provider
- Toast notifications
- Browser router

#### `frontend/src/App.tsx`
**Root Component** (144 lines)
- React Router configuration
- 50+ route definitions
- Layout wrapping
- Protected route setup
- Role-based routing

#### `frontend/src/lib/api.ts`
**API Client** (1362 lines)
- Centralized API communication
- Token management
- Request/response interceptors
- Error handling
- Type-safe API methods
- All CRUD operations for:
  - Users
  - Students
  - Projects
  - Attendance
  - Events
  - Resources
  - Feedback
  - Teams
  - Awards
  - Bills
  - Meetings
  - Messages
  - Announcements
  - And more...

#### `frontend/src/pages/*.tsx`
**Page Components** (52 files)
- React functional components
- React hooks (useState, useEffect, etc.)
- React Query for data fetching
- React Hook Form for forms
- Zod for validation
- Role-based rendering

#### `frontend/src/components/ui/*.tsx`
**UI Components** (30+ files)
- shadcn/ui components
- Built on Radix UI primitives
- Fully accessible (ARIA)
- Keyboard navigation
- Dark mode support
- Customizable with Tailwind

---

## 🗂️ File Organization Principles

### Backend

1. **Separation of Concerns**
   - Routes handle HTTP
   - Database handles data
   - Middleware handles cross-cutting concerns
   - Utils handle shared logic

2. **RESTful Convention**
   - `/api/<resource>` - Collection
   - `/api/<resource>/:id` - Individual resource
   - HTTP methods: GET, POST, PUT, DELETE

3. **Modular Routes**
   - One file per resource type
   - Clear naming convention
   - Easy to maintain

### Frontend

1. **Feature-Based Organization**
   - Pages represent routes
   - Components are reusable
   - Lib contains business logic
   - Hooks encapsulate stateful logic

2. **Component Hierarchy**
   - **Pages**: Route-level components
   - **Layouts**: Structural components
   - **Components**: Reusable pieces
   - **UI**: Primitive components

3. **Co-location**
   - Related files near each other
   - Easy to find and modify
   - Clear dependencies

---

## 📝 File Naming Conventions

### Backend (JavaScript)

- **Routes**: `<resource>.js` (lowercase, plural)
  - Example: `students.js`, `projects.js`

- **Utilities**: `<utility>.js` (lowercase, singular)
  - Example: `email.js`, `logger.js`

- **Scripts**: `<action>-<resource>.js` (kebab-case)
  - Example: `init-db.js`, `migrate-sqlite-to-mysql.js`

### Frontend (TypeScript)

- **Pages**: `<PageName>.tsx` (PascalCase)
  - Example: `AdminDashboard.tsx`, `ManageStudents.tsx`

- **Components**: `<ComponentName>.tsx` (PascalCase)
  - Example: `Header.tsx`, `ProtectedRoute.tsx`

- **UI Components**: `<component-name>.tsx` (kebab-case)
  - Example: `button.tsx`, `dropdown-menu.tsx`

- **Utilities**: `<utility>.ts` (camelCase)
  - Example: `api.ts`, `auth.ts`

- **Hooks**: `use<HookName>.ts` (camelCase with 'use' prefix)
  - Example: `useToast.ts`, `usePermissions.ts`

---

## 🔍 Important File Locations

### Environment Variables
```
/.env                    # Root environment variables
/backend/.env            # Backend environment variables (optional)
```

### Database
```
/backend/database/sm_volunteers.db      # SQLite database
```

### Uploaded Files
```
/backend/public/uploads/
├── students/            # Student photos
├── resources/           # Resource documents
└── events/              # Event images
```

### Build Outputs
```
/frontend/dist/          # Frontend production build (gitignored)
/frontend/node_modules/  # Frontend dependencies (gitignored)
/backend/node_modules/   # Backend dependencies (gitignored)
```

### Documentation
```
/docs/                           # All project documentation
/docs/README.md                  # Documentation index
/docs/PROJECT_ANALYSIS.md        # Comprehensive analysis
/docs/FILE_STRUCTURE.md          # This file
/docs/backend/                   # Backend-specific documentation
/docs/backend/MIGRATION_GUIDE.md # Database migration guide
/README.md                       # Main project README
/.env.example                    # Environment template
```

---

## 🚀 Quick File Reference

### Need to...

**Start the servers?**
→ Root: `npm run dev:all` (both servers)
→ Frontend: `npm run dev --prefix frontend`
→ Backend: `npm run dev --prefix backend`

**Add a new API endpoint?**
→ Create/edit file in `backend/routes/`
→ Register in `backend/server.js`

**Add a new page?**
→ Create file in `frontend/src/pages/`
→ Add route in `frontend/src/App.tsx`

**Add a new UI component?**
→ `cd frontend && npx shadcn-ui@latest add <component-name>`
→ Or create in `frontend/src/components/`

**Modify database schema?**
→ Edit `backend/database/init.js`
→ Run `npm run init-db` in backend

**Change API base URL?**
→ Edit `VITE_API_URL` in `.env`
→ Or modify `frontend/src/lib/api.ts`

**Configure authentication?**
→ Edit `backend/middleware/auth.js`
→ Edit `frontend/src/lib/auth.ts`

**Add email functionality?**
→ Edit `backend/utils/email.js`
→ Configure email settings in `.env`

**Customize styling?**
→ Edit `frontend/tailwind.config.ts`
→ Modify `frontend/src/index.css`

---

## 📚 Related Documentation

- **Main README**: See `/README.md`
- **Documentation Index**: See `/docs/README.md`
- **Setup Guide**: See `/docs/PROJECT_ANALYSIS.md` → Setup & Installation
- **Migration Guide**: See `/docs/backend/MIGRATION_GUIDE.md`
- **API Documentation**: See `/docs/PROJECT_ANALYSIS.md` → API Endpoints
- **Tech Stack**: See `/docs/PROJECT_ANALYSIS.md` → Technology Stack
- **Frontend README**: See `/frontend/README.md`

---

**Last Updated**: February 14, 2026  
**Version**: 2.0.0 (Monorepo Structure)
