# MySQL Migration Guide

## ✅ Step 1: Install MySQL Server

1. **Download MySQL**: https://dev.mysql.com/downloads/mysql/
2. **Install MySQL Server** (Choose "Server only" or "Developer Default")
3. **Set root password** during installation

## ✅ Step 2: Create Database

Open MySQL command line or MySQL Workbench and run:

```sql
CREATE DATABASE sm_volunteers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## ✅ Step 3: Update Environment Variables

Your `.env` file has been updated to:

```env
DB_TYPE=mysql
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=sm_volunteers
```

**⚠️ IMPORTANT**: Update `DB_PASSWORD` with your actual MySQL root password!

## ✅ Step 4: Initialize Database Schema

Run this command to create all tables:

```bash
cd backend
node scripts/init-db.js
```

This will create 40+ tables in your MySQL database.

## ✅ Step 5: (Optional) Migrate Existing Data from SQLite

If you have existing data in SQLite that you want to migrate:

```bash
cd backend
node scripts/migrate-sqlite-to-mysql.js
```

This script will:
- Backup your SQLite database
- Transfer all data to MySQL
- Verify data integrity
- Show progress for each table

## ✅ Step 6: Start the Backend Server

```bash
cd backend
npm run dev
```

You should see:
```
✅ Connected to MySQL database
Server running on port 3000
```

## 🔧 Troubleshooting

### Error: "Access denied for user 'root'@'localhost'"
**Solution**: Update `DB_PASSWORD` in `.env` with correct password

### Error: "Unknown database 'sm_volunteers'"
**Solution**: Create database using Step 2

### Error: "Client does not support authentication protocol"
**Solution**: Run this in MySQL:
```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;
```

### Error: "connect ECONNREFUSED 127.0.0.1:3306"
**Solution**: Make sure MySQL server is running

## 📊 Verify Migration

Check tables were created:

```sql
USE sm_volunteers;
SHOW TABLES;
```

You should see 40+ tables including:
- users
- students
- projects
- events
- attendance
- meetings
- resources
- etc.

## 🔄 Switching Back to SQLite

If needed, change `.env`:

```env
DB_TYPE=sqlite
```

## 📝 Database Configuration Details

| Setting | SQLite | MySQL |
|---------|--------|-------|
| **DB_TYPE** | sqlite | mysql |
| **Data Location** | ./backend/database/sm_volunteers.db | MySQL Server |
| **Installation** | None required | MySQL Server required |
| **Best For** | Development, Testing | Production, Multi-user |
| **Concurrent Users** | Limited | High |
| **Performance** | Good for small data | Excellent for large data |

---

**Current Status**: ✅ Configured for MySQL  
**Next Action**: Update DB_PASSWORD in .env and run init-db.js
