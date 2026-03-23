# ✅ MySQL Setup Checklist

## Pre-Migration Status
- ✅ `.env` file updated: `DB_TYPE=mysql`
- ✅ All code supports MySQL (no changes needed)
- ✅ Migration scripts ready in `backend/scripts/`

## What You Need to Do

### ☑️ Step 1: Install MySQL
- [ ] Download MySQL from https://dev.mysql.com/downloads/mysql/
- [ ] Install MySQL Server
- [ ] Remember your root password (you'll need it!)
- [ ] Verify MySQL is running

### ☑️ Step 2: Create Database
- [ ] Open MySQL Command Line or MySQL Workbench
- [ ] Run: `CREATE DATABASE sm_volunteers;`
- [ ] Verify: `SHOW DATABASES;` (should see sm_volunteers)

### ☑️ Step 3: Update Password
- [ ] Open `.env` file in project root
- [ ] Change `DB_PASSWORD=YOUR_ACTUAL_PASSWORD`
- [ ] Save the file

> 🔒 **Note:** The project now uses **MySQL exclusively**. All SQLite-related scripts and files have been removed.

### ☑️ Step 4: Initialize Database Schema
```bash
cd backend
npm run init-db
```
- [ ] Run the above command
- [ ] Should see "✅ Database initialized successfully!"
- [ ] Should create 40+ tables

### ☑️ Step 5: (Optional) Migrate Existing Data
**Skip this if you don't have existing SQLite data**

```bash
cd backend
node scripts/migrate-sqlite-to-mysql.js
```
- [ ] Run if you have existing data in SQLite
- [ ] Verify data was migrated

### ☑️ Step 6: Start Backend Server
```bash
cd backend
npm run dev
```
- [ ] Should see "✅ Connected to MySQL database"
- [ ] Should see "Server running on port 3000"

### ☑️ Step 7: Start Frontend
```bash
cd frontend
npm run dev
```
- [ ] Should start on port 9000
- [ ] Open http://localhost:9000
- [ ] Try logging in

### ☑️ Step 8: Verify Everything Works
- [ ] Can login successfully
- [ ] Can view dashboard
- [ ] Can navigate pages
- [ ] No console errors

## Troubleshooting

### ❌ "Access denied for user 'root'@'localhost'"
**Fix**: Wrong password in `.env` file
```
1. Check your MySQL root password
2. Update DB_PASSWORD in .env
3. Restart backend server
```

### ❌ "Unknown database 'sm_volunteers'"
**Fix**: Database not created
```sql
CREATE DATABASE sm_volunteers;
```

### ❌ "connect ECONNREFUSED 127.0.0.1:3306"
**Fix**: MySQL server not running
```
1. Start MySQL service
   Windows: Services → MySQL → Start
   Mac: mysql.server start
   Linux: sudo systemctl start mysql
```

### ❌ "Client does not support authentication protocol"
**Fix**: Update MySQL authentication
```sql
ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;
```

### ❌ "No default engine was specified"
**Fix**: Missing node modules
```bash
cd backend
npm install
```

## Success Indicators

✅ Backend starts with: "✅ Connected to MySQL database"  
✅ Frontend loads at http://localhost:9000  
✅ Can login with admin@example.com / admin123  
✅ Dashboard displays correctly  
✅ No errors in browser console  

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `.env` | DB_TYPE=mysql | ✅ Updated |
| All backend files | Auto-detect database type | ✅ No changes needed |
| All frontend files | No database dependency | ✅ No changes needed |

## Database Comparison

| Feature | SQLite (Old) | MySQL (New) |
|---------|--------------|-------------|
| Installation | None | Required |
| Setup | Automatic | Manual |
| Performance | Good | Excellent |
| Concurrent Users | Limited | Unlimited |
| Data Size | < 1GB recommended | Unlimited |
| Best For | Development | Production |

## Quick Commands Reference

```bash
# Install dependencies
npm run install:all

# Initialize MySQL database
cd backend && npm run init-db

# Migrate SQLite data (if needed)
cd backend && node scripts/migrate-sqlite-to-mysql.js

# Start both servers
npm run dev:all

# Start backend only
cd backend && npm run dev

# Start frontend only
cd frontend && npm run dev
```

---

**Current Status**: ✅ Configured for MySQL  
**Next Step**: Update DB_PASSWORD in .env and run init-db  
**Help**: See MYSQL_MIGRATION_STEPS.md for detailed guide
