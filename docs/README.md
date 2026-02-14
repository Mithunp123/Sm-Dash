# SM Volunteers Dashboard - Documentation Index

> **Complete documentation for the SM Volunteers Dashboard project**  
> **Last Updated**: February 14, 2026

---

## 📚 Documentation Structure

```
docs/
├── README.md                           # This file - Documentation index
├── PROJECT_ANALYSIS.md                 # Complete project analysis
├── FILE_STRUCTURE.md                   # Detailed file structure
├── SERVER_ANALYSIS.md                  # Server.js & MySQL credential analysis
└── backend/                            # Backend-specific documentation
    ├── MIGRATION_GUIDE.md              # SQLite to MySQL migration guide
    ├── MIGRATION_SUMMARY.md            # Quick migration reference
    ├── MIGRATION_COMPLETE.md           # Migration completion checklist
    └── STATUS.md                       # Project status documentation
```

---

## 🎯 Quick Navigation

### Getting Started

| Document | Description | When to Read |
|----------|-------------|--------------|
| [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) | Complete project overview, tech stack, setup guide | **Start here** - First time setup |
| [FILE_STRUCTURE.md](FILE_STRUCTURE.md) | Detailed directory tree and file organization | Understanding project structure |
| [../.env.example](../.env.example) | Environment configuration template | Setting up environment variables |

### Server & Configuration

| Document | Description | When to Read |
|----------|-------------|--------------|
| [SERVER_ANALYSIS.md](SERVER_ANALYSIS.md) | Server.js analysis & MySQL credentials | Understanding server configuration |
| [../.env.example](../.env.example) | Complete environment variables with MySQL usage | Configuring the application |

### Database & Migration

| Document | Description | When to Read |
|----------|-------------|--------------|
| [backend/MIGRATION_GUIDE.md](backend/MIGRATION_GUIDE.md) | Complete SQLite to MySQL migration | Planning database migration |
| [backend/MIGRATION_SUMMARY.md](backend/MIGRATION_SUMMARY.md) | Quick migration reference | Quick migration steps |
| [backend/MIGRATION_COMPLETE.md](backend/MIGRATION_COMPLETE.md) | Post-migration checklist | After completing migration |
| [backend/STATUS.md](backend/STATUS.md) | Project status and notes | Checking project status |

---

## 📖 Documentation Overview

### 1. PROJECT_ANALYSIS.md
**Size**: ~800 lines  
**Purpose**: Comprehensive project analysis

**Contains**:
- ✅ Executive summary and project overview
- ✅ Complete technology stack breakdown
- ✅ Architecture diagrams and design patterns
- ✅ All 18 feature modules documented
- ✅ Database architecture (40+ tables)
- ✅ Authentication & authorization flows
- ✅ Complete setup & installation guide
- ✅ How to run the project
- ✅ API endpoints reference
- ✅ Deployment considerations
- ✅ Troubleshooting guide

**Best For**:
- New developers joining the project
- Understanding the full system architecture
- Setting up development environment
- API documentation reference

---

### 2. FILE_STRUCTURE.md
**Size**: ~600 lines  
**Purpose**: Complete file structure documentation

**Contains**:
- ✅ Visual directory tree
- ✅ File statistics and counts
- ✅ Detailed file descriptions
- ✅ Organization principles
- ✅ Naming conventions
- ✅ Quick reference guide

**Best For**:
- Finding specific files
- Understanding project organization
- Learning where to add new features
- File naming standards

---

### 3. SERVER_ANALYSIS.md
**Size**: ~500 lines  
**Purpose**: Deep analysis of server.js and MySQL configuration

**Contains**:
- ✅ Complete server.js code analysis
- ✅ MySQL credentials usage documentation
- ✅ All files that use DB credentials
- ✅ Environment variables reference
- ✅ Database configuration flow
- ✅ Server architecture breakdown
- ✅ Security considerations
- ✅ Performance tuning

**Best For**:
- Understanding server configuration
- Setting up MySQL database
- Environment variable configuration
- Server troubleshooting

---

### 4. Backend Documentation (`backend/` folder)

#### MIGRATION_GUIDE.md
**Size**: ~400+ lines  
**Purpose**: Complete step-by-step migration from SQLite to MySQL

**Contains**:
- ✅ Prerequisites and requirements
- ✅ Detailed migration steps
- ✅ Testing procedures
- ✅ Rollback instructions
- ✅ Troubleshooting section
- ✅ File storage explanation

**Best For**:
- Migrating from development (SQLite) to production (MySQL)
- Understanding database differences
- Troubleshooting migration issues

#### MIGRATION_SUMMARY.md
**Size**: ~250 lines  
**Purpose**: Quick reference for migration

**Contains**:
- ✅ Quick start guide
- ✅ Essential commands
- ✅ Common issues and solutions
- ✅ Configuration checklist

**Best For**:
- Quick migration reference
- Experienced users who need a refresher

#### MIGRATION_COMPLETE.md
**Size**: ~200 lines  
**Purpose**: Post-migration verification

**Contains**:
- ✅ Completion checklist
- ✅ Verification steps
- ✅ Post-migration testing

**Best For**:
- Verifying successful migration
- Ensuring no data loss

#### STATUS.md
**Purpose**: Project status and current state

**Contains**:
- ✅ Current project status
- ✅ Known issues
- ✅ Development notes

**Best For**:
- Checking current project state
- Understanding ongoing work

---

## 🚀 Quick Start Paths

### Path 1: First Time Setup (Development)

1. Read [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) → Setup & Installation section
2. Copy [../.env.example](../.env.example) to `.env` in root directory
3. Use default SQLite configuration (no MySQL needed)
4. Run installation commands
5. Start developing!

**Commands**:
```bash
# Install dependencies
npm install
cd backend && npm install && cd ..

# Run development servers
npm run dev:all

# Access at http://localhost:9000
```

---

### Path 2: Production Setup (MySQL)

1. Read [SERVER_ANALYSIS.md](SERVER_ANALYSIS.md) → MySQL Configuration section
2. Read [backend/MIGRATION_GUIDE.md](backend/MIGRATION_GUIDE.md)
3. Install and configure MySQL
4. Update `.env` with MySQL credentials
5. Run migration or fresh setup
6. Deploy!

**Commands**:
```bash
# Test MySQL connection
cd backend
node scripts/test-mysql-connection.js

# Initialize MySQL database
node scripts/init-db.js

# Start production server
npm start
```

---

### Path 3: Understanding the Codebase

1. Read [FILE_STRUCTURE.md](FILE_STRUCTURE.md) → Get familiar with organization
2. Read [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) → Architecture section
3. Read [SERVER_ANALYSIS.md](SERVER_ANALYSIS.md) → Server architecture
4. Explore the code with this knowledge

---

### Path 4: Database Migration

1. Read [backend/MIGRATION_SUMMARY.md](backend/MIGRATION_SUMMARY.md) → Quick overview
2. Read [backend/MIGRATION_GUIDE.md](backend/MIGRATION_GUIDE.md) → Detailed steps
3. Follow the migration process
4. Use [backend/MIGRATION_COMPLETE.md](backend/MIGRATION_COMPLETE.md) → Verify completion

---

## 📝 Environment Configuration

### Configuration File: `.env`

**Location**: Project root directory  
**Template**: [../.env.example](../.env.example)

**Key Variables**:

```env
# Database (Choose SQLite or MySQL)
DB_TYPE=sqlite                    # or 'mysql'
DB_PATH=./backend/database/sm_volunteers.db

# MySQL (if DB_TYPE=mysql)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=sm_volunteers

# Server
PORT=3000
NODE_ENV=development

# Authentication
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Detailed Configuration**: See [../.env.example](../.env.example) for complete documentation

---

## 🔍 Finding Information

### Common Questions & Where to Look

| Question | Document | Section |
|----------|----------|---------|
| How do I install the project? | [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) | Setup & Installation |
| What technologies are used? | [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) | Technology Stack |
| Where is a specific file? | [FILE_STRUCTURE.md](FILE_STRUCTURE.md) | Directory Tree |
| How do I configure MySQL? | [SERVER_ANALYSIS.md](SERVER_ANALYSIS.md) | MySQL Configuration |
| Where are MySQL credentials used? | [SERVER_ANALYSIS.md](SERVER_ANALYSIS.md) | MySQL Credentials Usage |
| How do I migrate to MySQL? | [backend/MIGRATION_GUIDE.md](backend/MIGRATION_GUIDE.md) | Complete guide |
| What are all the API endpoints? | [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) | API Endpoints |
| How do I deploy to production? | [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) | Deployment |
| What environment variables exist? | [../.env.example](../.env.example) | Complete list |
| How does authentication work? | [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) | Authentication & Authorization |

---

## 🛠️ Development Resources

### Code Organization

- **Frontend**: `src/` folder
  - Pages: `src/pages/` (52 page components)
  - Components: `src/components/` (15+ custom components)
  - UI Components: `src/components/ui/` (30+ shadcn components)
  - API Client: `src/lib/api.ts`
  - Utilities: `src/lib/`

- **Backend**: `backend/` folder
  - Routes: `backend/routes/` (23 route files)
  - Database: `backend/database/init.js`
  - Middleware: `backend/middleware/`
  - Utilities: `backend/utils/`
  - Scripts: `backend/scripts/`

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `backend/server.js` | Express server entry point | 180 |
| `backend/database/init.js` | Database initialization & schema | 1518 |
| `src/App.tsx` | React router & app structure | 144 |
| `src/lib/api.ts` | API client & all endpoints | 1362 |

---

## 📊 Project Statistics

- **Total Files**: ~160+ files
- **Lines of Code**: ~25,000+ lines
- **Frontend Pages**: 52 pages
- **API Routes**: 23 route modules
- **Database Tables**: 40+ tables
- **UI Components**: 30+ components

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

## 📞 Additional Resources

### Project Files

- **Root Directory**: `d:\Project-Mainfiles\Client-Project\SM\sm-dash`
- **Configuration**: `.env` (create from `.env.example`)
- **Backend**: `backend/` folder
- **Frontend**: `src/` folder

### Scripts

```bash
# Development
npm run dev              # Frontend only (port 9000)
npm run dev:backend      # Backend only (port 3000)
npm run dev:all          # Both servers

# Build
npm run build            # Production build
npm run preview          # Preview production build

# Backend Scripts
cd backend
npm run dev              # Start backend with nodemon
npm run init-db          # Initialize database
node scripts/test-mysql-connection.js  # Test MySQL
```

---

## 📄 Document Maintenance

### Last Updated
- **PROJECT_ANALYSIS.md**: February 14, 2026
- **FILE_STRUCTURE.md**: February 14, 2026
- **SERVER_ANALYSIS.md**: February 14, 2026
- **Backend Documentation**: Various dates

### Version
- **Documentation Version**: 1.0.0
- **Project Version**: 1.0.0

---

## 🤝 Contributing

When adding new features or making changes:

1. ✅ Update relevant documentation files
2. ✅ Add new environment variables to `.env.example`
3. ✅ Update API endpoints in PROJECT_ANALYSIS.md
4. ✅ Update file structure if adding new directories
5. ✅ Update this README if new documents are added

---

## 📌 Notes

- All markdown files use GitHub-flavored markdown
- Code examples are syntax-highlighted
- File paths use forward slashes (cross-platform)
- Line numbers reference source code locations
- Documentation follows the actual code structure

---

**Project**: SM Volunteers Dashboard  
**Institution**: K.S.Rangasamy College of Technology  
**Documentation Maintained By**: Development Team  
**Last Review**: February 14, 2026
