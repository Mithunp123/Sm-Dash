# SQLite to MySQL Migration Guide

## Overview

This guide will help you migrate your SM Volunteers application from SQLite3 to MySQL **without changing any application behavior, routes, or frontend code**.

## ✅ What This Migration Does

- ✅ Migrates all data from SQLite to MySQL
- ✅ Preserves all primary keys, foreign keys, and relationships
- ✅ Maintains all file paths (images/PDFs stored in folders)
- ✅ Auto-creates tables on startup if they don't exist
- ✅ Keeps all routes, APIs, and endpoints unchanged
- ✅ No frontend code changes required
- ✅ Production-safe with automatic backup

## ❌ What This Migration Does NOT Change

- ❌ No route/endpoint changes
- ❌ No API request/response structure changes
- ❌ No frontend code changes
- ❌ No business logic changes
- ❌ No file upload/storage location changes

---

## Prerequisites

### 1. Install MySQL Server

If you haven't already installed MySQL:

**Windows:**
```powershell
# Download MySQL Installer from: https://dev.mysql.com/downloads/installer/
# Or use Chocolatey:
choco install mysql
```

**Verify MySQL is running:**
```powershell
# Check if MySQL service is running
Get-Service -Name MySQL*

# Or start MySQL service
Start-Service -Name MySQL80
```

### 2. Add MySQL to PATH (Windows)

The MySQL command-line tools need to be in your system PATH:

```powershell
# Add to PATH for current session
$env:Path += ";C:\Program Files\MySQL\MySQL Server 8.0\bin"

# Add permanently (run as Administrator)
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "Machine") + ";C:\Program Files\MySQL\MySQL Server 8.0\bin",
    "Machine"
)
```

### 3. Create MySQL Database

```powershell
# Connect to MySQL
mysql -u root -p

# In MySQL shell:
CREATE DATABASE smvdb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES;
EXIT;
```

---

## Migration Steps

### Step 1: Backup Current Data

```powershell
cd d:\sm-dash-main\backend

# The migration script will automatically create a backup, but you can manually backup too:
Copy-Item database\sm_volunteers.db database\sm_volunteers_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').db
```

### Step 2: Configure Environment

Update your `.env` file in the root directory (`d:\sm-dash-main\.env`):

```env
# Database Configuration
DB_TYPE=mysql
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=smvdb
```

**IMPORTANT:** Keep `DB_TYPE=sqlite` for now. We'll change it after migration.

### Step 3: Initialize MySQL Tables

```powershell
cd d:\sm-dash-main\backend

# Temporarily set DB_TYPE to mysql in .env
# Then run the init script to create all tables in MySQL
node scripts\init-db.js
```

This will create all 40+ tables in MySQL with the correct schema.

### Step 4: Run Migration Script

```powershell
cd d:\sm-dash-main\backend

# Run the migration
node scripts\migrate-sqlite-to-mysql.js
```

The script will:
1. Create a backup of your SQLite database
2. Read all tables and data from SQLite
3. Insert data into MySQL (preserving all IDs and relationships)
4. Show progress and statistics
5. Verify critical tables

**Expected Output:**
```
🚀 Starting SQLite to MySQL Migration
═══════════════════════════════════════════════════════════

📦 Step 1: Creating backup of SQLite database...
✅ Backup created: d:\sm-dash-main\backend\database\sm_volunteers_backup.db

📂 Step 2: Connecting to SQLite database...
✅ Connected to SQLite

🔌 Step 3: Connecting to MySQL database...
✅ Connected to MySQL

📋 Step 4: Reading SQLite tables...
✅ Found 42 tables to migrate:
   - users
   - profiles
   - projects
   - attendance_records
   ... (and more)

🔄 Step 5: Migrating data...
   📊 Migrating table: users
      Found 150 rows
      Progress: 150/150 rows
      ✅ Migrated 150/150 rows
   ...

📊 Migration Summary:
═══════════════════════════════════════════════════════════
Total Tables: 42
Total Rows Migrated: 5,432

✅ Migration completed successfully!
```

### Step 5: Update Environment to Use MySQL

Now update `.env` to use MySQL:

```env
DB_TYPE=mysql
```

### Step 6: Restart Application

```powershell
cd d:\sm-dash-main\backend

# Stop any running instances (Ctrl+C)
# Then restart
npm run dev
```

You should see:
```
✅ Connected to MySQL database
✅ Database tables initialized successfully
🚀 SM Volunteers API server running on port 3000
```

### Step 7: Verify Migration

1. **Check Database Connection:**
   ```powershell
   node backend\check_connection.js
   ```

2. **Verify Data:**
   ```sql
   mysql -u root -p smvdb
   
   -- Check user count
   SELECT COUNT(*) FROM users;
   
   -- Check projects
   SELECT COUNT(*) FROM projects;
   
   -- Check attendance records
   SELECT COUNT(*) FROM attendance_records;
   
   -- Verify file paths are intact
   SELECT id, photo_url FROM profiles WHERE photo_url IS NOT NULL LIMIT 5;
   ```

3. **Test Application:**
   - Login to the application
   - View user profiles (check if photos load)
   - Check projects and attendance
   - Upload a test file
   - Verify all features work as before

---

## Auto-Table Creation

The system now automatically creates tables on startup if they don't exist. This works for:

### Existing Modules
All 40+ existing tables are created automatically when you run `initDatabase()` in `database/init.js`.

### Future Modules
When you add a new feature:

1. Add the table creation SQL to `database/init.js` in the `initDatabase()` function:

```javascript
// Example: Adding a new "notifications" table
await run(database, `
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
```

2. The table will be created automatically on next server restart
3. Works for both SQLite and MySQL (query translation is automatic)

---

## Rollback Plan

If something goes wrong, you can rollback to SQLite:

```powershell
# 1. Stop the application

# 2. Update .env
DB_TYPE=sqlite

# 3. Restore backup if needed
Copy-Item database\sm_volunteers_backup.db database\sm_volunteers.db -Force

# 4. Restart application
npm run dev
```

---

## File Storage

### Images and PDFs
- **Location:** `backend/public/uploads/`
- **Storage:** Files remain in folders (not in database)
- **Database:** Only file paths are stored
- **Migration Impact:** None - paths remain unchanged

### Folder Structure
```
backend/public/uploads/
├── photos/           # User profile photos
├── signatures/       # Volunteer signatures
├── resources/        # Uploaded documents
├── bills/           # Bill attachments
├── assignments/     # Team assignment proofs
└── mentoring/       # Phone mentoring attachments
```

**No changes needed** - all paths work exactly the same after migration.

---

## Troubleshooting

### MySQL Command Not Found

**Error:**
```
mysql : The term 'mysql' is not recognized...
```

**Fix:**
```powershell
# Add MySQL to PATH
$env:Path += ";C:\Program Files\MySQL\MySQL Server 8.0\bin"

# Verify
mysql --version
```

### Connection Refused

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```

**Fix:**
```powershell
# Start MySQL service
Start-Service -Name MySQL80

# Or check if it's running
Get-Service -Name MySQL*
```

### Access Denied

**Error:**
```
Error: Access denied for user 'root'@'localhost'
```

**Fix:**
- Verify password in `.env` matches your MySQL root password
- Try resetting MySQL password if forgotten

### Table Already Exists

**Error:**
```
Error: Table 'users' already exists
```

**Fix:**
This is normal - the script uses `CREATE TABLE IF NOT EXISTS`. The error is caught and ignored.

### Data Not Migrated

**Issue:** Some tables show 0 rows after migration

**Fix:**
1. Check migration output for errors
2. Verify SQLite database has data:
   ```powershell
   sqlite3 database\sm_volunteers.db "SELECT COUNT(*) FROM users;"
   ```
3. Re-run migration script (it uses `INSERT IGNORE` so won't duplicate)

---

## Performance Considerations

### MySQL vs SQLite

**MySQL Advantages:**
- Better concurrency (multiple simultaneous writes)
- Better performance for large datasets (>100K rows)
- Better for production deployments
- Supports replication and clustering

**SQLite Advantages:**
- Simpler setup (no server required)
- Better for development/testing
- Portable (single file)

### Optimization Tips

1. **Indexes:** Already created via PRIMARY KEY and UNIQUE constraints
2. **Connection Pooling:** Already configured (10 connections)
3. **Query Optimization:** Use EXPLAIN to analyze slow queries

---

## Maintenance

### Regular Backups

```powershell
# MySQL backup
mysqldump -u root -p smvdb > backup_$(Get-Date -Format 'yyyyMMdd').sql

# Restore from backup
mysql -u root -p smvdb < backup_20260203.sql
```

### Monitoring

```sql
-- Check database size
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'smvdb'
GROUP BY table_schema;

-- Check table sizes
SELECT 
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.tables
WHERE table_schema = 'smvdb'
ORDER BY (data_length + index_length) DESC;
```

---

## Support

If you encounter issues:

1. Check the migration output for specific errors
2. Verify MySQL is running and accessible
3. Check `.env` configuration
4. Review application logs
5. Test with SQLite first to isolate database-specific issues

---

## Summary Checklist

- [ ] MySQL Server installed and running
- [ ] MySQL added to system PATH
- [ ] Database created (`smvdb`)
- [ ] `.env` configured with MySQL credentials
- [ ] Backup of SQLite database created
- [ ] Tables initialized in MySQL (`node scripts/init-db.js`)
- [ ] Data migrated (`node scripts/migrate-sqlite-to-mysql.js`)
- [ ] `.env` updated to `DB_TYPE=mysql`
- [ ] Application restarted
- [ ] Data verified in MySQL
- [ ] Application tested (login, profiles, uploads, etc.)
- [ ] File paths verified (images/PDFs loading correctly)

**Migration Complete! 🎉**
