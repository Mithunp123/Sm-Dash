# Server.js Analysis & MySQL Configuration Guide

> **File**: `backend/server.js`  
> **Purpose**: Express server entry point and configuration  
> **Lines of Code**: 180 lines  
> **Last Analyzed**: February 14, 2026

---

## 📋 Table of Contents

1. [Server.js Overview](#serverjs-overview)
2. [MySQL Credentials Usage](#mysql-credentials-usage)
3. [Environment Variables Reference](#environment-variables-reference)
4. [Database Configuration Flow](#database-configuration-flow)
5. [Server Architecture](#server-architecture)
6. [Complete Code Analysis](#complete-code-analysis)

---

## 🖥️ Server.js Overview

### Purpose
`backend/server.js` is the main Express application server that:
- Initializes the Express framework
- Configures middleware (CORS, JSON parsing, etc.)
- Registers all API routes
- Initializes the database connection
- Starts the HTTP server on port 3000
- Handles graceful shutdown

### Key Features
- ✅ **MySQL-only**: The application now runs exclusively on MySQL; SQLite support has been removed.
- ✅ **Hot Reload**: Works with nodemon for automatic restart on file changes
- ✅ **Error Handling**: Comprehensive error handling middleware
- ✅ **CORS Enabled**: Cross-Origin Resource Sharing for frontend communication
- ✅ **Health Check**: `/api/health` endpoint for monitoring
- ✅ **Static File Serving**: Serves uploaded files from `public/uploads/`
- ✅ **Port Conflict Detection**: Detects and reports if port is already in use

---

## 🔐 MySQL Credentials Usage

### Where MySQL Credentials Are Used

MySQL credentials (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) are **NOT directly used in server.js**. Instead, they are passed through to the database initialization layer.

### Configuration Flow

```
.env file
    ↓
server.js (loads environment variables)
    ↓
database/init.js (uses MySQL credentials)
    ↓
MySQL Connection Pool Created
```

### Files That Use MySQL Credentials

#### 1. **`backend/database/init.js`** (PRIMARY USAGE)
**Lines: 21-26**

```javascript
if (process.env.DB_TYPE === 'mysql') {
  db = mysql.createPool({
    host: process.env.DB_HOST,        // MySQL server address
    user: process.env.DB_USER,        // MySQL username
    password: process.env.DB_PASSWORD, // MySQL password
    database: process.env.DB_NAME,    // Database name
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}
```

**Purpose**: Creates MySQL connection pool for all database operations throughout the application.

#### 2. **`backend/scripts/test-mysql-connection.js`**
**Lines: 27-28**

```javascript
const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    // ... other config
});
```

**Purpose**: Command-line script to test MySQL connectivity and validate credentials.

**Usage**:
```bash
cd backend
node scripts/test-mysql-connection.js
```

#### 3. **`backend/scripts/verify-migration.js`**
**Lines: 19-22**

```javascript
const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'smvdb'
});
```

**Purpose**: Verifies data integrity after migrating from SQLite to MySQL.

**Usage**:
```bash
cd backend
node scripts/verify-migration.js
```

#### 4. **`backend/scripts/init-mysql-basic.js`**
**Lines: 20-23**

```javascript
connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'smvdb'
});
```

**Purpose**: Basic test to create MySQL tables and validate setup.

**Usage**:
```bash
cd backend
node scripts/init-mysql-basic.js
```

#### 5. **`backend/scripts/migrate-sqlite-to-mysql.js`**

```javascript
const mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'smvdb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
```

**Purpose**: Migrates all data from SQLite to MySQL database.

**Usage**:
```bash
cd backend
node scripts/migrate-sqlite-to-mysql.js
```

### DB_TYPE Usage

The `DB_TYPE` environment variable used to determine database type; it is now permanently `mysql` and other values are ignored.

**Used in**:
- `backend/database/init.js` (line 21) - Main database initialization
- `backend/routes/interviews.js` (lines 30, 42, 54) - Query compatibility
- `backend/routes/students.js` (lines 31, 44) - Query compatibility
- `backend/routes/messages.js` (lines 10, 20, 30) - Query compatibility

**Values**:
- `sqlite` (default) - Uses SQLite file database
- `mysql` - Uses MySQL server connection

---

## 🛠️ Environment Variables Reference

### Complete List of Environment Variables

| Variable | Used In | Line(s) | Purpose | Default |
|----------|---------|---------|---------|---------|
| **Database** |
| `DB_TYPE` | database/init.js | 21 | Database type (mysql only) | `mysql` |
| `DB_PATH` | database/init.js | 14 | SQLite database file path | `./backend/database/sm_volunteers.db` |
| `DB_HOST` | database/init.js | 23 | MySQL server address | `localhost` |
| `DB_USER` | database/init.js | 24 | MySQL username | `root` |
| `DB_PASSWORD` | database/init.js | 25 | MySQL password | - |
| `DB_NAME` | database/init.js | 26 | MySQL database name | `sm_volunteers` |
| **Server** |
| `PORT` | server.js | 41 | Server port number | `3000` |
| `NODE_ENV` | server.js, routes/* | - | Environment (dev/prod) | `development` |
| **Authentication** |
| `JWT_SECRET` | routes/auth.js, middleware/auth.js | 157, 330, 25 | JWT signing key | - |
| `JWT_EXPIRES_IN` | routes/auth.js | 158, 331 | Token expiration | `7d` |
| **Google OAuth** |
| `GOOGLE_CLIENT_ID` | routes/auth.js | 224, 259, 298 | Google OAuth Client ID | - |
| `GOOGLE_CLIENT_SECRET` | routes/auth.js | 225, 258 | Google OAuth Secret | - |
| `SERVER_URL` | routes/auth.js | 226, 261 | Backend server URL | `http://localhost:3000` |
| `FRONTEND_URL` | routes/auth.js | 273 | Frontend app URL | `http://localhost:9000` |
| **Email (SMTP)** |
| `SMTP_HOST` | utils/email.js | 7, 12 | SMTP server address | - |
| `SMTP_PORT` | utils/email.js | 13 | SMTP port | `587` |
| `SMTP_SECURE` | utils/email.js | 14 | Use TLS/SSL | `false` |
| `SMTP_USER` | utils/email.js | 7, 16, 44 | SMTP username | - |
| `SMTP_PASS` | utils/email.js | 7, 17 | SMTP password | - |
| `SMTP_FROM` | utils/email.js | 44 | Email sender | - |
| **File Upload** |
| `PUBLIC_APP_URL` | routes/resources.js | 53 | Public app URL | - |
| `PUBLIC_UPLOAD_BASE_URL` | routes/resources.js | 53 | Upload base URL | - |
| `API_BASE_URL` | routes/resources.js | 53 | API base URL | - |

---

## 🔄 Database Configuration Flow

### Development (SQLite - Default)

```
1. Ensure DB_TYPE is set to mysql in .env (required)
   ↓
2. Server starts → server.js loads dotenv
   ↓
3. initDatabase() called → database/init.js
   ↓
4. (SQLite path logic removed; always uses MySQL)
   ↓
5. SQLite database file created at:
   backend/database/sm_volunteers.db
   ↓
6. Database initialized with 40+ tables
   ↓
7. Server ready on http://localhost:3000
```

### Production (MySQL)

```
1. Install MySQL Server
   ↓
2. Create database: CREATE DATABASE sm_volunteers;
   ↓
3. Configure .env file:
   DB_TYPE=mysql
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=sm_volunteers
   ↓
4. Test connection:
   node backend/scripts/test-mysql-connection.js
   ↓
5. Option A: Fresh MySQL setup
   → Run: node backend/scripts/init-db.js
   
   Option B: Migrate from SQLite
   → Run: node backend/scripts/migrate-sqlite-to-mysql.js
   ↓
6. Server starts → Creates MySQL connection pool
   ↓
7. Server ready on http://localhost:3000
```

---

## 🏗️ Server Architecture

### Server.js Structure

```javascript
// 1. IMPORTS (Lines 1-34)
├── Express framework
├── Middleware (cors, dotenv, etc.)
├── Route modules (23 route files)
└── Database initialization

// 2. CONFIGURATION (Lines 36-42)
├── Load environment variables (.env)
├── Initialize Express app
└── Set PORT from environment

// 3. MIDDLEWARE SETUP (Lines 44-56)
├── CORS configuration
├── JSON body parser
├── URL-encoded body parser
└── Debug logging middleware

// 4. STATIC FILE SERVING (Lines 58-103)
├── Serve /uploads for user-uploaded files
├── Serve favicon.ico
└── Serve favicon.png

// 5. ROUTE REGISTRATION (Lines 105-132)
├── /api/auth → Authentication
├── /api/users → User management
├── /api/students → Student operations
├── /api/projects → Project management
├── /api/attendance → Attendance tracking
├── /api/events → Event management
├── /api/resources → Resource sharing
├── ... (23 total route groups)
└── /api/health → Health check endpoint

// 6. ERROR HANDLING (Lines 136-142)
└── Global error handler middleware

// 7. SERVER INITIALIZATION (Lines 144-166)
├── Async startServer() function
├── Initialize database (SQLite or MySQL)
├── Start HTTP server
├── Handle port conflicts
└── Error handling

// 8. GRACEFUL SHUTDOWN (Lines 168-177)
└── SIGTERM signal handler
```

### Request Flow

```
Client Request (e.g., GET /api/students)
    ↓
1. CORS Middleware
    ↓
2. JSON Parser Middleware
    ↓
3. Debug Logger (if DELETE request)
    ↓
4. Route Matcher (/api/students)
    ↓
5. Authentication Middleware (if protected)
    ↓
6. Route Handler (routes/students.js)
    ↓
7. Database Query (SQLite or MySQL)
    ↓
8. Response Formatting
    ↓
9. Send JSON Response
    ↓
Client Receives Response
```

---

## 📝 Complete Code Analysis

### Import Section (Lines 1-34)

```javascript
import express from 'express';           // Web framework
import cors from 'cors';                 // Cross-origin resource sharing
import dotenv from 'dotenv';            // Environment variables
import path from 'path';                 // File path utilities
import fs from 'fs';                     // File system operations
import { fileURLToPath } from 'url';     // ES module path resolution

// Import all route modules
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
// ... 21 more route imports

import { initDatabase } from './database/init.js';
```

**Purpose**: Loads all dependencies and route modules.

### Configuration Section (Lines 36-42)

```javascript
// Load .env from backend directory first, then fallback to root
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
let server;
```

**Key Points**:
- Loads `.env` from both backend folder and root folder
- Falls back to port 3000 if `PORT` not set
- Creates Express application instance

### Middleware Setup (Lines 44-56)

```javascript
// Middleware
app.use(cors());                           // Enable CORS
app.use(express.json());                   // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Debug middleware - log DELETE requests
app.use((req, res, next) => {
  if (req.method === 'DELETE') {
    console.log(`[SERVER DEBUG] Incoming DELETE request - ${req.method} ${req.path}`);
  }
  next();
});
```

**Purpose**:
- Enables cross-origin requests from frontend (port 9000)
- Parses incoming JSON and form data
- Logs DELETE requests for debugging

### Static File Serving (Lines 58-103)

```javascript
// Serve uploaded files from public/uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Serve favicon files
app.get('/favicon.ico', (req, res) => {
  // Attempts to serve SM Volunteers logo as favicon
  // Falls back to favicon.ico if logo not found
});

app.get('/favicon.png', (req, res) => {
  // Similar to favicon.ico handler
});
```

**Purpose**:
- Makes uploaded files accessible via HTTP
- Serves custom favicon for browser tabs

### Route Registration (Lines 105-132)

```javascript
// Register all API routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);          // Duplicate for OAuth redirects
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
// ... 20 more route registrations

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SM Volunteers API is running' });
});
```

**Key Points**:
- Maps URL paths to route handlers
- Auth routes registered at both `/api/auth` and `/auth`
- Health check for monitoring and load balancers

### Error Handling (Lines 136-142)

```javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});
```

**Purpose**:
- Catches all unhandled errors
- Logs error stack trace
- Returns JSON error response
- Hides error details in production

### Server Initialization (Lines 144-166)

```javascript
const startServer = async () => {
  try {
    // Initialize database (SQLite or MySQL depending on DB_TYPE)
    await initDatabase();

    // Start HTTP server
    server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error('   Please stop the existing server or change the PORT in .env');
        process.exit(1);
      } else {
        console.error('❌ Server startup error:', err);
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }
};

startServer();
```

**Key Points**:
- Async function for proper error handling
- Database initialized before server starts
- Port conflict detection with helpful error message
- Exits process on fatal errors

### Graceful Shutdown (Lines 168-177)

```javascript
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
});
```

**Purpose**:
- Handles termination signals (Ctrl+C, server restart)
- Closes server gracefully to finish pending requests
- Important for deployment environments

---

## 🔒 Security Considerations

### Current Security Features

1. **CORS Enabled**: Allows frontend access while preventing other origins
2. **JWT Authentication**: Token-based auth via middleware
3. **Environment Variables**: Sensitive data not hardcoded
4. **Error Message Hiding**: Production mode hides error details
5. **Password Hashing**: bcrypt for password storage

### Production Security Checklist

- [ ] Set strong `JWT_SECRET` (minimum 32 characters)
- [ ] Use HTTPS/TLS certificates
- [ ] Restrict CORS to specific domains
- [ ] Enable rate limiting (express-rate-limit)
- [ ] Add helmet.js for security headers
- [ ] Validate all user input
- [ ] Use prepared statements (already done)
- [ ] Set secure MySQL password
- [ ] Enable MySQL SSL connection
- [ ] Implement request logging
- [ ] Add API authentication for all routes
- [ ] Set up firewall rules
- [ ] Keep dependencies updated

---

## 🚀 Quick Start Guide

### Using SQLite (Development)

```bash
# 1. Navigate to project
cd d:\Project-Mainfiles\Client-Project\SM\sm-dash

# 2. Create .env file (optional, SQLite is default)
cp .env.example .env

# 3. Install dependencies
cd backend
npm install

# 4. Start server
npm run dev

# Server will be running at http://localhost:3000
```

### Using MySQL (Production)

```bash
# 1. Install MySQL and create database
mysql -u root -p
CREATE DATABASE sm_volunteers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# 2. Configure .env file
DB_TYPE=mysql
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=sm_volunteers
JWT_SECRET=your-super-secret-key-at-least-32-chars
PORT=3000

# 3. Test MySQL connection
cd backend
node scripts/test-mysql-connection.js

# 4. Initialize database
node scripts/init-db.js

# 5. Start server
npm start
```

---

## 📊 Server Performance

### Connection Pooling

MySQL connection pool settings (database/init.js):
- **Connection Limit**: 10 concurrent connections
- **Wait for Connections**: true (queues new requests)
- **Queue Limit**: 0 (unlimited queue)

### SQLite Optimizations

- **WAL Mode**: Write-Ahead Logging for better concurrency
- **Synchronous**: NORMAL mode for faster writes
- **Foreign Keys**: Enabled for data integrity

---

## 🐛 Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Kill process using port 3000
cd backend
node scripts/free-port.js
```

#### MySQL Connection Failed

```bash
# Test MySQL connection
cd backend
node scripts/test-mysql-connection.js

# Common issues:
# - MySQL service not running
# - Wrong credentials in .env
# - Database doesn't exist
# - Firewall blocking connection
```

#### Database Not Initialized

```bash
# Re-initialize database
cd backend
node scripts/init-db.js
```

---

## 📚 Related Documentation

- **Complete Project Analysis**: `docs/PROJECT_ANALYSIS.md`
- **File Structure Guide**: `docs/FILE_STRUCTURE.md`
- **Migration Guide**: `backend/MIGRATION_GUIDE.md`
- **Environment Configuration**: `.env.example`

---

**Last Updated**: February 14, 2026  
**Analyzed By**: Deep Code Analysis  
**Version**: 1.0.0
