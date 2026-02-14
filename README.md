# 🎓 SM Volunteers Dashboard

> A comprehensive Student Management System for volunteer coordination at K.S.Rangasamy College of Technology

[![React](https://img.shields.io/badge/React-18.3-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-black?logo=express)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-Private-red)]()

---

## 📋 Overview

SM Volunteers Dashboard is a full-stack web application designed to manage student volunteer activities, projects, attendance, events, and resources. Built with modern technologies and best practices.

### Key Features

- 👥 **User Management** - Multi-role authentication (Admin, Office Bearer, Student)
- 🎓 **Student Database** - Comprehensive student profiles with photo management
- 📊 **Project Management** - Track volunteer projects and assignments
- ✅ **Attendance Tracking** - Monitor attendance for projects, meetings, and events
- 🎉 **Event Management** - Create and manage volunteer events
- 📚 **Resource Sharing** - Upload and share documents/resources
- 📞 **Phone Mentoring** - Track mentoring sessions
- 💬 **Messaging System** - Internal communication
- 🏆 **Awards & Recognition** - Manage volunteer achievements
- 📈 **Analytics Dashboard** - Data visualization and reporting

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **bun** package manager
- **MySQL Server** (v5.7 or higher) - Required for current configuration
  - Download: https://dev.mysql.com/downloads/mysql/
  - Alternative: Use SQLite by changing `DB_TYPE=sqlite` in `.env`

### Installation

```bash
# Clone or extract the project
cd sm-dash

# Install dependencies for both frontend and backend
npm run install:all

# Or install separately:
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

# Copy environment configuration
cp .env.example .env

# Start development servers (both frontend & backend)
npm run dev:all
```

### Access the Application

- **Frontend**: http://localhost:9000
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

### Default Login

```
Email: admin@example.com
Password: admin123
```

**⚠️ Change this password immediately after first login!**

---

## 🐬 MySQL Migration

### Switching from SQLite to MySQL

The project is **now configured for MySQL**. Follow these steps:

#### 1️⃣ Install MySQL Server

Download and install MySQL: https://dev.mysql.com/downloads/mysql/

#### 2️⃣ Create Database

```sql
CREATE DATABASE sm_volunteers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 3️⃣ Update `.env` File

```env
DB_TYPE=mysql
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_ACTUAL_MYSQL_PASSWORD  # ⚠️ Update this!
DB_NAME=sm_volunteers
```

#### 4️⃣ Initialize Database Tables

```bash
cd backend
npm run init-db
```

This creates all 40+ tables automatically.

#### 5️⃣ (Optional) Migrate Existing SQLite Data

If you have existing SQLite data:

```bash
cd backend
node scripts/migrate-sqlite-to-mysql.js
```

#### 6️⃣ Start the Backend

```bash
cd backend
npm run dev
```

✅ You should see: **"✅ Connected to MySQL database"**

### 📘 Detailed Migration Guide

See **[MYSQL_MIGRATION_STEPS.md](MYSQL_MIGRATION_STEPS.md)** for:
- Complete step-by-step instructions
- Troubleshooting common issues
- Verification steps
- How to switch back to SQLite

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **React Query** - Server state management
- **React Router** - Navigation

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **JWT** - Authentication
- **MySQL** - Primary database (SQLite also supported)
- **Nodemailer** - Email service

---

## 📚 Documentation

### 📖 Complete Documentation Available in `/docs` folder

| Document | Description |
|----------|-------------|
| **[docs/README.md](docs/README.md)** | 📑 Documentation index & navigation |
| **[docs/PROJECT_ANALYSIS.md](docs/PROJECT_ANALYSIS.md)** | 📊 Complete project analysis |
| **[docs/FILE_STRUCTURE.md](docs/FILE_STRUCTURE.md)** | 📁 Detailed file structure |
| **[docs/SERVER_ANALYSIS.md](docs/SERVER_ANALYSIS.md)** | 🖥️ Server & MySQL configuration |
| **[docs/backend/](docs/backend/)** | 🗄️ Database migration guides |

### Quick Links

- **Setup Guide**: [docs/PROJECT_ANALYSIS.md](docs/PROJECT_ANALYSIS.md#setup--installation)
- **Environment Config**: [.env.example](.env.example)
- **API Documentation**: [docs/PROJECT_ANALYSIS.md](docs/PROJECT_ANALYSIS.md#api-endpoints)
- **MySQL Setup**: [docs/SERVER_ANALYSIS.md](docs/SERVER_ANALYSIS.md#mysql-credentials-usage)
- **Migration Guide**: [docs/backend/MIGRATION_GUIDE.md](docs/backend/MIGRATION_GUIDE.md)

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration - CURRENTLY CONFIGURED FOR MYSQL
DB_TYPE=mysql                     # 'sqlite' or 'mysql'
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password   # ⚠️ REQUIRED: Update with your MySQL password!
DB_NAME=sm_volunteers

# SQLite (not used when DB_TYPE=mysql)
# DB_PATH=./backend/database/sm_volunteers.db

# Server
PORT=3000
NODE_ENV=development

# Authentication
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**⚠️ IMPORTANT**: Update `DB_PASSWORD` with your actual MySQL root password!

**See [.env.example](.env.example) for complete configuration with detailed comments**

---

## 🏃 Running the Project

### Development Mode

```bash
# Run both frontend and backend
npm run dev:all

# Or run separately:
npm run dev              # Frontend only (port 9000)
npm run dev:backend      # Backend only (port 3000)
```

### Production Build

```bash
# Build frontend
npm run build

# Start backend
cd backend
npm start
```

---

## 📂 Project Structure

```
sm-dash/
├── docs/                 # 📚 Complete documentation
├── frontend/             # ⚛️ React frontend application
│   ├── src/             # React source code
│   │   ├── pages/       # 📄 Page components (52 pages)
│   │   ├── components/  # 🧩 Reusable components
│   │   ├── lib/         # 🛠️ Utilities & API client
│   │   └── hooks/       # 🎣 Custom React hooks
│   ├── public/          # 🌐 Static assets
│   └── [config files]   # Vite, Tailwind, TypeScript configs
├── backend/              # 🖥️ Express backend server
│   ├── routes/          # 🛣️ API routes (23 modules)
│   ├── database/        # 🗄️ Database layer
│   ├── middleware/      # 🔐 Auth middleware
│   ├── utils/           # 🔧 Utilities
│   └── scripts/         # 📜 Database scripts
├── Images/               # 🖼️ Project images
└── .env.example          # ⚙️ Environment template
```

**See [docs/FILE_STRUCTURE.md](docs/FILE_STRUCTURE.md) for detailed structure**

---

## 🗄️ Database

### Development (Default)
- **SQLite** - File-based database
- Zero configuration required
- Automatic setup on first run
- Database file: `backend/database/sm_volunteers.db`

### Production
- **MySQL** - Server database
- Better performance and scalability
- Migration tools provided
- See [docs/backend/MIGRATION_GUIDE.md](docs/backend/MIGRATION_GUIDE.md)

---

## 🔐 Authentication

- **JWT-based** authentication
- **Google OAuth** integration (optional)
- **Role-based access control** (Admin, Office Bearer, Student)
- **Session management** with sessionStorage
- **OTP verification** via email

---

## 🌐 API Endpoints

### Main API Routes

- `/api/auth` - Authentication & registration
- `/api/users` - User management
- `/api/students` - Student operations
- `/api/projects` - Project management
- `/api/attendance` - Attendance tracking
- `/api/events` - Event management
- `/api/resources` - Resource sharing
- `/api/feedback` - Feedback system
- *...and 15 more modules*

**See [docs/PROJECT_ANALYSIS.md](docs/PROJECT_ANALYSIS.md#api-endpoints) for complete API reference**

---

## 📊 Features Overview

| Feature | Admin | Office Bearer | Student |
|---------|-------|---------------|---------|
| Dashboard | ✅ | ✅ | ✅ |
| Manage Users | ✅ | ❌ | ❌ |
| Manage Students | ✅ | ✅ | ❌ |
| Manage Projects | ✅ | ✅ | View Only |
| Take Attendance | ✅ | ✅ | Mark Own |
| Manage Events | ✅ | ✅ | View Only |
| View Analytics | ✅ | ✅ | Limited |
| Upload Resources | ✅ | ✅ | ❌ |
| Send Messages | ✅ | ✅ | ✅ |
| Manage Awards | ✅ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ |

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill process using port 3000
cd backend
node scripts/free-port.js
```

### Database Connection Error

```bash
# Test database connection
cd backend
node scripts/check-connection.js
```

### MySQL Connection Issues

```bash
# Test MySQL connection
cd backend
node scripts/test-mysql-connection.js
```

**See [docs/PROJECT_ANALYSIS.md](docs/PROJECT_ANALYSIS.md#troubleshooting) for more solutions**

---

## 🧪 Development Scripts

### Root Scripts (from project root)

```bash
npm run dev:all          # Start both frontend & backend
npm run dev:frontend     # Start frontend only (port 9000)
npm run dev:backend      # Start backend only (port 3000)
npm run install:all      # Install all dependencies
npm run build            # Build frontend for production
```

### Frontend Scripts (from /frontend)

```bash
cd frontend
npm run dev              # Start dev server (port 9000)
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # Lint code
```

### Backend Scripts (from /backend)

```bash
cd backend
npm run dev              # Start with nodemon
npm run start            # Production start
npm run init-db          # Initialize database
```

### Database Scripts (from /backend)

```bash
cd backend
node scripts/init-db.js                    # Initialize database
node scripts/test-mysql-connection.js      # Test MySQL
node scripts/migrate-sqlite-to-mysql.js    # Migrate to MySQL
node scripts/verify-migration.js           # Verify migration
```

---

## 📦 Installation & Deployment

### Development Setup

1. **Install dependencies**: `npm run install:all` (both frontend and backend)
2. **Configure environment**: Copy `.env.example` to `.env`
3. **Start servers**: `npm run dev:all`
4. **Access**: http://localhost:9000

### Production Deployment

1. **Build frontend**: `npm run build`
2. **Configure MySQL**: Update `.env` with MySQL credentials
3. **Initialize database**: `node backend/scripts/init-db.js`
4. **Start server**: `cd backend && npm start`
5. **Serve frontend**: Deploy `dist/` folder to web server

**See [docs/PROJECT_ANALYSIS.md](docs/PROJECT_ANALYSIS.md#deployment-considerations) for complete deployment guide**

---

## 📈 Project Statistics

- **Total Files**: ~160+ files
- **Lines of Code**: ~25,000+ lines
- **Frontend Pages**: 52 pages
- **API Routes**: 23 modules
- **Database Tables**: 40+ tables
- **UI Components**: 30+ components

---

## 🔒 Security

- ✅ JWT authentication with secure hashing
- ✅ Password hashing with bcrypt
- ✅ Environment variable protection
- ✅ CORS configuration
- ✅ Input validation & sanitization
- ✅ SQL injection prevention
- ✅ XSS protection

---

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Update documentation
5. Submit for review

---

## 📄 License

This project is private and proprietary. For educational institutional use only.

---

## 👥 Team

Developed for **K.S.Rangasamy College of Technology**

---

## 📞 Support

For issues or questions:
1. Check [docs/PROJECT_ANALYSIS.md](docs/PROJECT_ANALYSIS.md#troubleshooting)
2. Review [docs/README.md](docs/README.md) for documentation
3. Check application logs for errors

---

## 🎓 Learning Resources

- **React Documentation**: https://react.dev/
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Express.js Guide**: https://expressjs.com/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **shadcn/ui Components**: https://ui.shadcn.com/

---

## 📝 Version

- **Version**: 1.0.0
- **Last Updated**: February 14, 2026
- **Node Version**: 16+
- **React Version**: 18.3.1

---

## 🌟 Quick Command Reference

```bash
# Setup
npm run install:all                          # Install all dependencies

# Development
npm run dev:all                              # Both servers
npm run dev:frontend                         # Frontend only (port 9000)
npm run dev:backend                          # Backend only (port 3000)

# Or run from specific folders
cd frontend && npm run dev                   # Frontend
cd backend && npm run dev                    # Backend

# Database
cd backend
node scripts/init-db.js                      # Initialize
node scripts/test-mysql-connection.js        # Test MySQL
node scripts/migrate-sqlite-to-mysql.js      # Migrate

# Production
npm run build                                # Build frontend
cd backend && npm start                      # Start backend
```

---

**🚀 Ready to get started? Run `npm run dev:all` and visit http://localhost:9000**

For complete documentation, see the **[docs/](docs/)** folder or visit **[docs/README.md](docs/README.md)**
