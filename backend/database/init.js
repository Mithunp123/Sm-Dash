import sqlite3 from 'sqlite3';
import mysql from 'mysql2/promise';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/sm_volunteers.db');

let db;

export const getDatabase = () => {
  if (db) return db;

  if (process.env.DB_TYPE === 'mysql') {
    db = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Attach SQLite-compatible wrappers to the MySQL pool
    db.run = async function (query, params, callback) {
      const actualParams = typeof params === 'function' ? [] : (params || []);
      const actualCallback = typeof params === 'function' ? params : callback;
      try {
        const result = await run(this, query, actualParams);
        if (actualCallback) actualCallback.call({ lastID: result.lastID, changes: result.changes }, null);
        return result;
      } catch (err) {
        if (actualCallback) actualCallback(err);
        else throw err;
      }
    };

    db.get = async function (query, params, callback) {
      const actualParams = typeof params === 'function' ? [] : (params || []);
      const actualCallback = typeof params === 'function' ? params : callback;
      try {
        const result = await get(this, query, actualParams);
        if (actualCallback) actualCallback(null, result);
        return result;
      } catch (err) {
        if (actualCallback) actualCallback(err);
        else throw err;
      }
    };

    db.all = async function (query, params, callback) {
      const actualParams = typeof params === 'function' ? [] : (params || []);
      const actualCallback = typeof params === 'function' ? params : callback;
      try {
        const result = await all(this, query, actualParams);
        if (actualCallback) actualCallback(null, result);
        return result;
      } catch (err) {
        if (actualCallback) actualCallback(err);
        else throw err;
      }
    };

    // Test connection
    db.getConnection()
      .then(conn => {
        console.log('✅ Connected to MySQL database');
        conn.release();
      })
      .catch(err => {
        console.error('❌ Error connecting to MySQL database:', err);
      });
  } else {
    // SQLite Fallback
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('✅ Connected to SQLite database');
        // Enable WAL mode for better performance and concurrency
        db.run('PRAGMA journal_mode = WAL;', (err) => {
          if (err) console.error('Error enabling WAL mode:', err);
          else console.log('✅ SQLite WAL mode enabled');
        });
        db.run('PRAGMA synchronous = NORMAL;'); // Faster writes, still safe enough for most apps
        db.run('PRAGMA foreign_keys = ON;'); // Enforce foreign key constraints
      }
    });
  }
  return db;
};

const translateQueryToMySQL = (query) => {
  let mysqlQuery = query.replace(/AUTOINCREMENT/g, 'AUTO_INCREMENT');
  mysqlQuery = mysqlQuery.replace(/INSERT OR IGNORE/ig, 'INSERT IGNORE');
  mysqlQuery = mysqlQuery.replace(/COLLATE NOCASE/ig, '');

  // Handle common reserved keywords in SQLite queries that clash with MySQL identifiers
  // Only include strictly reserved words that are likely to be used as identifiers
  const keywords = ['order', 'group', 'user'];
  keywords.forEach(keyword => {
    // Escape keywords with backticks, but only if:
    // 1. Not followed by ' BY' (to avoid breaking ORDER BY / GROUP BY)
    // 2. Not followed by a bracket (function call)
    // 3. Not already quoted with backticks, single quotes or double quotes.
    const regex = new RegExp(`\\b${keyword}\\b(?!(\\s+by|\\s*\\(|\\s*[\\x60'"]|[\\x60'"]))`, 'ig');
    mysqlQuery = mysqlQuery.replace(regex, `\`${keyword}\``);
  });

  // Handle strftime to MySQL
  mysqlQuery = mysqlQuery.replace(/strftime\('%Y',\s*(.*?)\)/ig, 'YEAR($1)');
  mysqlQuery = mysqlQuery.replace(/strftime\("%Y",\s*(.*?)\)/ig, 'YEAR($1)');
  mysqlQuery = mysqlQuery.replace(/strftime\('%m',\s*(.*?)\)/ig, 'DATE_FORMAT($1, "%m")');
  mysqlQuery = mysqlQuery.replace(/strftime\("%m",\s*(.*?)\)/ig, 'DATE_FORMAT($1, "%m")');
  mysqlQuery = mysqlQuery.replace(/strftime\('%d',\s*(.*?)\)/ig, 'DATE_FORMAT($1, "%d")');
  mysqlQuery = mysqlQuery.replace(/strftime\("%d",\s*(.*?)\)/ig, 'DATE_FORMAT($1, "%d")');

  // Handle other SQLite functions
  mysqlQuery = mysqlQuery.replace(/date\('now'\)/ig, 'CURDATE()');
  mysqlQuery = mysqlQuery.replace(/datetime\('now'\)/ig, 'NOW()');

  // Handle types
  mysqlQuery = mysqlQuery.replace(/INTEGER PRIMARY KEY AUTO_INCREMENT/g, 'INT PRIMARY KEY AUTO_INCREMENT');
  mysqlQuery = mysqlQuery.replace(/INTEGER PRIMARY KEY/g, 'INT PRIMARY KEY');
  mysqlQuery = mysqlQuery.replace(/INTEGER DEFAULT/g, 'INT DEFAULT');
  mysqlQuery = mysqlQuery.replace(/INTEGER NOT NULL/g, 'INT NOT NULL');
  mysqlQuery = mysqlQuery.replace(/INTEGER\s+REFERENCES/ig, 'INT REFERENCES');
  mysqlQuery = mysqlQuery.replace(/INTEGER,/g, 'INT,');
  mysqlQuery = mysqlQuery.replace(/INTEGER\)/g, 'INT)');

  // Handle TEXT columns - convert to VARCHAR(255) for constrained fields
  mysqlQuery = mysqlQuery.replace(/TEXT PRIMARY KEY/g, 'VARCHAR(255) PRIMARY KEY');
  mysqlQuery = mysqlQuery.replace(/TEXT UNIQUE/g, 'VARCHAR(255) UNIQUE');
  mysqlQuery = mysqlQuery.replace(/TEXT NOT NULL DEFAULT/g, 'VARCHAR(255) NOT NULL DEFAULT');
  mysqlQuery = mysqlQuery.replace(/TEXT DEFAULT/g, 'VARCHAR(255) DEFAULT');
  mysqlQuery = mysqlQuery.replace(/TEXT NOT NULL CHECK/g, 'VARCHAR(255) NOT NULL CHECK');
  mysqlQuery = mysqlQuery.replace(/TEXT CHECK/g, 'VARCHAR(255) CHECK');
  // Only replace TEXT NOT NULL if it looks like a column definition (preceded by column name and space)
  // This is a bit risky but usually okay in schema definitions
  mysqlQuery = mysqlQuery.replace(/(\w+)\s+TEXT NOT NULL/g, '$1 VARCHAR(255) NOT NULL');

  // Handle DATETIME defaults
  mysqlQuery = mysqlQuery.replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  return mysqlQuery;
};

const run = async (db, query, params = []) => {
  if (process.env.DB_TYPE === 'mysql') {
    try {
      let mysqlQuery = translateQueryToMySQL(query);

      // Format date parameters for MySQL
      const mysqlParams = params.map(p => {
        if (p instanceof Date) return p.toISOString().slice(0, 19).replace('T', ' ');
        if (typeof p === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(p)) return p.slice(0, 19).replace('T', ' ');
        return p;
      });

      const [result] = await db.execute(mysqlQuery, mysqlParams);
      return { lastID: result.insertId, changes: result.affectedRows };
    } catch (err) {
      if (err.errno === 1060 || err.errno === 1061 || err.errno === 1062) return { lastID: null, changes: 0 };
      console.error('MySQL Run Error:', err.message, query);
      throw err;
    }
  } else {
    return new Promise((resolve, reject) => {
      db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
};

const get = async (db, query, params = []) => {
  if (process.env.DB_TYPE === 'mysql') {
    try {
      let mysqlQuery = translateQueryToMySQL(query);

      // Handle SQLite table existence check
      const tableCheckMatch = mysqlQuery.match(/SELECT name FROM sqlite_master WHERE type='table' AND name='(.*?)'/i);
      if (tableCheckMatch) {
        mysqlQuery = `SELECT table_name as name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '${tableCheckMatch[1]}'`;
      }

      const [rows] = await db.execute(mysqlQuery, params);
      return rows[0];
    } catch (err) {
      console.error('MySQL Get Error:', err.message, query);
      throw err;
    }
  } else {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
};

const all = async (db, query, params = []) => {
  if (process.env.DB_TYPE === 'mysql') {
    try {
      let mysqlQuery = translateQueryToMySQL(query);
      let isTableInfo = false;
      let isShowCreate = false;

      const tableInfoMatch = mysqlQuery.match(/PRAGMA table_info\((.*?)\)/i);
      if (tableInfoMatch) {
        const tableName = tableInfoMatch[1].replace(/['"]/g, '');
        mysqlQuery = `SHOW COLUMNS FROM ${tableName}`;
        isTableInfo = true;
      }

      const schemaMatch = mysqlQuery.match(/SELECT sql FROM sqlite_master WHERE type='table' AND name='(.*?)'/i);
      if (schemaMatch) {
        mysqlQuery = `SHOW CREATE TABLE ${schemaMatch[1]}`;
        isShowCreate = true;
      }

      const [rows] = await db.execute(mysqlQuery, params);

      if (isTableInfo) return rows.map(r => ({ ...r, name: r.Field }));
      if (isShowCreate) return rows.map(r => ({ sql: r['Create Table'] }));
      return rows;
    } catch (err) {
      console.error('MySQL All Error:', err.message, query);
      throw err;
    }
  } else {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

const columnExists = async (db, tableName, columnName) => {
  if (process.env.DB_TYPE === 'mysql') {
    const query = `
      SELECT COUNT(*) as count 
      FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
      AND table_name = ? 
      AND column_name = ?
    `;
    const result = await get(db, query, [tableName, columnName]);
    return result && result.count > 0;
  } else {
    // SQLite
    const cols = await all(db, `PRAGMA table_info(${tableName})`);
    return cols.some(col => col.name === columnName);
  }
};

const addColumnSafe = async (db, tableName, columnName, columnDef) => {
  try {
    const exists = await columnExists(db, tableName, columnName);
    if (!exists) {
      // In MySQL 8.0+, ADD COLUMN IF NOT EXISTS is supported, but simple ADD COLUMN is safer across versions if we check first
      await run(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      // console.log(`   ✅ Added column: ${tableName}.${columnName}`); // Keep logs clean as requested
    }
  } catch (err) {
    // Silent fail if table doesn't exist or other non-critical error
    // console.warn(`   ⚠️ Warning adding column ${tableName}.${columnName}: ${err.message}`);
  }
};

let isInitialized = false;

export const initDatabase = async () => {
  if (isInitialized) return;
  isInitialized = true;

  const database = getDatabase();

  try {
    // Optional migration: only drop feedback tables if explicitly requested
    if (process.env.RESET_FEEDBACK_TABLES === 'true') {
      try {
        await run(database, `DROP TABLE IF EXISTS feedback_responses`);
        await run(database, `DROP TABLE IF EXISTS feedback_questions`);
        console.log('✅ Dropped old feedback tables (RESET_FEEDBACK_TABLES enabled)');
      } catch (e) {
        // Table might not exist, that's okay
      }
    }

    // console.log('Creating: users');
    // Users table
    await run(database, `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'office_bearer', 'student')),
        must_change_password INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Password resets table
    await run(database, `
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        otp TEXT NOT NULL,
        token TEXT,
        used INTEGER DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Student profiles table
    await run(database, `
      CREATE TABLE IF NOT EXISTS student_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        dept TEXT,
        year TEXT,
        phone TEXT,
        blood_group TEXT,
        gender TEXT,
        dob TEXT,
        address TEXT,
        photo_url TEXT,
        custom_fields TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Office Bearer profiles table
    await run(database, `
      CREATE TABLE IF NOT EXISTS office_bearer_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        dept TEXT,
        year TEXT,
        phone TEXT,
        blood_group TEXT,
        gender TEXT,
        dob TEXT,
        address TEXT,
        photo_url TEXT,
        custom_fields TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Unified profiles table (stores common profile fields for students and office bearers)
    await run(database, `
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'student','office_bearer')),
        dept TEXT,
        year TEXT,
        phone TEXT,
        blood_group TEXT,
        gender TEXT,
        dob TEXT,
        address TEXT,
        photo_url TEXT,
        register_no TEXT,
        academic_year TEXT,
        father_number TEXT,
        hosteller_dayscholar TEXT,
        position TEXT,
        custom_fields TEXT,
        interview_status TEXT DEFAULT 'Pending' CHECK(interview_status IN ('Pending', 'Selected', 'Rejected')),
        interview_marks INTEGER DEFAULT NULL,
        mentor_id INTEGER DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (mentor_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(user_id)
      )
    `);

    // Add missing columns if they don't exist (migration for existing databases)
    await addColumnSafe(database, 'profiles', 'photo_url', 'TEXT');
    await addColumnSafe(database, 'profiles', 'register_no', 'TEXT');
    await addColumnSafe(database, 'profiles', 'academic_year', 'TEXT');
    await addColumnSafe(database, 'profiles', 'father_number', 'TEXT');
    await addColumnSafe(database, 'profiles', 'hosteller_dayscholar', 'TEXT');
    await addColumnSafe(database, 'profiles', 'position', 'TEXT');
    // Interview related columns
    await addColumnSafe(database, 'profiles', 'interview_status', "TEXT DEFAULT 'Pending'");
    await addColumnSafe(database, 'profiles', 'interview_marks', 'INTEGER DEFAULT NULL');
    await addColumnSafe(database, 'profiles', 'mentor_id', 'INTEGER DEFAULT NULL');

    // Migrate existing role-specific profile data into unified profiles table if profiles is empty
    try {
      const existingProfiles = await get(database, 'SELECT COUNT(1) as cnt FROM profiles');
      if (existingProfiles && existingProfiles.cnt === 0) {
        // Copy from student_profiles
        try {
          const students = await all(database, 'SELECT * FROM student_profiles');
          for (const s of students) {
            await run(database, `INSERT OR IGNORE INTO profiles (user_id, role, dept, year, phone, blood_group, gender, dob, address, custom_fields) VALUES (?, 'student', ?, ?, ?, ?, ?, ?, ?, ?)`, [s.user_id, s.dept, s.year, s.phone, s.blood_group, s.gender, s.dob, s.address, s.custom_fields]);
          }
        } catch (e) {
          // Table may not exist - ignore
        }

        // Copy from office_bearer_profiles
        try {
          const obs = await all(database, 'SELECT * FROM office_bearer_profiles');
          for (const o of obs) {
            await run(database, `INSERT OR IGNORE INTO profiles (user_id, role, dept, year, phone, blood_group, gender, dob, address, custom_fields) VALUES (?, 'office_bearer', ?, ?, ?, ?, ?, ?, ?, ?)`, [o.user_id, o.dept, o.year, o.phone, o.blood_group, o.gender, o.dob, o.address, o.custom_fields]);
          }
        } catch (e) { }

        // Legacy spoc and alumni profiles are intentionally skipped (roles removed)
      }
    } catch (e) {
      // ignore migration errors
    }

    // console.log('Creating: meetings');
    // Meetings table
    await run(database, `
      CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        date DATETIME NOT NULL,
        location TEXT,
        organizer_id INTEGER,
        status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'completed', 'cancelled')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organizer_id) REFERENCES users(id)
      )
    `);

    // Attendance table
    await run(database, `
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'present' CHECK(status IN ('present', 'absent', 'late')),
        notes TEXT,
        marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(meeting_id, user_id)
      )
    `);

    // Projects table
    await run(database, `
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        ngo_name TEXT,
        start_date DATE,
        end_date DATE,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
        coordinator_id INTEGER,
        image_url TEXT,
        required_calls INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (coordinator_id) REFERENCES users(id)
      )
    `);

    // Add image_url and required_calls columns if they don't exist (for existing databases)
    await addColumnSafe(database, 'projects', 'image_url', 'TEXT');
    await addColumnSafe(database, 'projects', 'required_calls', 'INTEGER DEFAULT 0');

    // Project members table (students assigned to projects)
    await run(database, `
      CREATE TABLE IF NOT EXISTS project_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(project_id, user_id)
      )
    `);

    // Attendance records with date (linked to projects)
    await run(database, `
      CREATE TABLE IF NOT EXISTS attendance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        attendance_date DATE NOT NULL,
        status TEXT DEFAULT 'present' CHECK(status IN ('present', 'absent', 'late')),
        notes TEXT,
        marked_by INTEGER,
        marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (marked_by) REFERENCES users(id),
        UNIQUE(project_id, user_id, attendance_date)
      )
    `);

    // MOM (Minutes of Meeting) tables
    await run(database, `
      CREATE TABLE IF NOT EXISTS mom_meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        date DATETIME,
        time TEXT,
        venue TEXT,
        organizer_id INTEGER,
        status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'final')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organizer_id) REFERENCES users(id)
      )
    `);

    await run(database, `
      CREATE TABLE IF NOT EXISTS mom_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mom_id INTEGER NOT NULL,
        user_id INTEGER,
        serial INTEGER,
        name TEXT,
        designation TEXT,
        department TEXT,
        year TEXT,
        signature TEXT,
        FOREIGN KEY (mom_id) REFERENCES mom_meetings(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    // ensure year and user_id columns exist even on older DBs
    try {
      await run(database, `ALTER TABLE mom_attendance ADD COLUMN year TEXT`);
    } catch (e) {
      // ignore if already exists
    }
    try {
      await run(database, `ALTER TABLE mom_attendance ADD COLUMN user_id INTEGER`);
    } catch (e) {
      // ignore if already exists
    }

    await run(database, `
      CREATE TABLE IF NOT EXISTS mom_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mom_id INTEGER NOT NULL,
        point_no INTEGER,
        title TEXT,
        discussion TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mom_id) REFERENCES mom_meetings(id) ON DELETE CASCADE
      )
    `);

    // Bill folders table
    await run(database, `
      CREATE TABLE IF NOT EXISTS bill_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_by INTEGER,
        parent_folder_id INTEGER DEFAULT NULL,
        is_file BOOLEAN DEFAULT 0,
        file_path TEXT DEFAULT NULL,
        file_size INTEGER DEFAULT NULL,
        file_type TEXT DEFAULT NULL,
        file_name TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Bills table
    await run(database, `
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        bill_date DATE,
        bill_type TEXT,
        drive_link TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        submitted_by INTEGER,
        approved_by INTEGER,
        folder_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (submitted_by) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id),
        FOREIGN KEY (folder_id) REFERENCES bill_folders(id)
      )
    `);

    // Bill items table - stores itemized categories for bills (e.g., transport, food, stationary, refreshment, fuel)
    await run(database, `
      CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        amount REAL NOT NULL DEFAULT 0,
        from_loc TEXT,
        to_loc TEXT,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      )
    `);

    // Bill images table
    await run(database, `
      CREATE TABLE IF NOT EXISTS bill_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        folder_name TEXT NOT NULL,
        image_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      )
    `);

    // Ensure we have all necessary columns (Migrations)
    await addColumnSafe(database, 'bills', 'folder_id', 'INTEGER');
    await addColumnSafe(database, 'bills', 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
    await addColumnSafe(database, 'bill_items', 'from_loc', 'TEXT');
    await addColumnSafe(database, 'bill_items', 'to_loc', 'TEXT');

    // Permissions table
    await run(database, `
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        can_manage_users INTEGER DEFAULT 0,
        can_manage_student_db INTEGER DEFAULT 0,
        can_manage_profile_fields INTEGER DEFAULT 0,
        can_manage_meetings INTEGER DEFAULT 0,
        can_manage_events INTEGER DEFAULT 0,
        can_manage_attendance INTEGER DEFAULT 0,
        can_manage_bills INTEGER DEFAULT 0,
        can_manage_projects INTEGER DEFAULT 0,
        can_manage_resources INTEGER DEFAULT 0,
        can_manage_volunteers INTEGER DEFAULT 0,
        can_manage_messages INTEGER DEFAULT 0,
        can_manage_students INTEGER DEFAULT 0,

        can_manage_feedback_questions INTEGER DEFAULT 0,
        can_manage_feedback_reports INTEGER DEFAULT 0,
        can_manage_permissions_module INTEGER DEFAULT 0,
        can_manage_settings INTEGER DEFAULT 0,
        can_view_analytics INTEGER DEFAULT 0,
        can_view_reports INTEGER DEFAULT 0,
        can_manage_time_requests INTEGER DEFAULT 0,
        can_approve_time_extensions INTEGER DEFAULT 0,
        can_reject_time_extensions INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      )
    `);
    // Ensure legacy DBs get new columns. Add *_view and *_edit columns for each module so view/edit can be stored separately
    const moduleKeys = [
      'can_manage_users',
      'can_manage_student_db',
      'can_manage_profile_fields',
      'can_manage_meetings',
      'can_manage_events',
      'can_manage_attendance',
      'can_manage_bills',
      'can_manage_projects',
      'can_manage_resources',
      'can_manage_volunteers',
      'can_manage_messages',
      'can_manage_students',

      'can_manage_feedback_questions',
      'can_manage_feedback_reports',
      'can_manage_permissions_module',
      'can_manage_settings',
      'can_view_analytics',
      'can_view_reports'
    ];

    for (const key of moduleKeys) {
      await addColumnSafe(database, 'permissions', key, 'INTEGER DEFAULT 0');
      await addColumnSafe(database, 'permissions', `${key}_view`, 'INTEGER DEFAULT 0');
      await addColumnSafe(database, 'permissions', `${key}_edit`, 'INTEGER DEFAULT 0');
    }

    // Profile field settings - controls whether students can edit specific profile fields
    await run(database, `
      CREATE TABLE IF NOT EXISTS profile_field_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        field_name TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        field_type TEXT DEFAULT 'text',
        editable_by_student INTEGER DEFAULT 1,
        visible INTEGER DEFAULT 1,
        is_custom INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Seed default profile field settings if not present
    const defaultFields = [
      { field: 'dept', label: 'Department', type: 'text' },
      { field: 'year', label: 'Year', type: 'text' },
      { field: 'phone', label: 'Phone', type: 'text' },
      { field: 'blood_group', label: 'Blood Group', type: 'text' },
      { field: 'gender', label: 'Gender', type: 'text' },
      { field: 'dob', label: 'DOB', type: 'date' },
      { field: 'address', label: 'Address', type: 'textarea' }
    ];

    for (const f of defaultFields) {
      const exists = await get(database, 'SELECT id FROM profile_field_settings WHERE field_name = ?', [f.field]);
      if (!exists) {
        await run(database, 'INSERT INTO profile_field_settings (field_name, label, field_type, editable_by_student, visible, is_custom) VALUES (?, ?, ?, ?, ?, ?)', [f.field, f.label, f.type, 1, 1, 0]);
      }
    }

    // Role-level profile field permissions (per role, per field: can_view, can_edit)
    await run(database, `
      CREATE TABLE IF NOT EXISTS role_profile_field_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        field_name TEXT NOT NULL,
        can_view INTEGER DEFAULT 1,
        can_edit INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role, field_name)
      )
    `);

    // Seed defaults for roles (student, office_bearer)
    const roles = ['student', 'office_bearer'];
    for (const r of roles) {
      for (const f of defaultFields) {
        const existsRole = await get(database, 'SELECT id FROM role_profile_field_settings WHERE role = ? AND field_name = ?', [r, f.field]);
        if (!existsRole) {
          // For students: can view and edit their own profile fields (based on field settings)
          // For office_bearer: no profile field permissions (they don't manage student profiles)
          let canView = 0;
          let canEdit = 0;

          if (r === 'student') {
            // Get the field settings from profile_field_settings table
            const fieldSettings = await get(database, 'SELECT visible, editable_by_student FROM profile_field_settings WHERE field_name = ?', [f.field]);
            if (fieldSettings) {
              canView = fieldSettings.visible === 1 ? 1 : 0;
              canEdit = fieldSettings.editable_by_student === 1 ? 1 : 0;
            }
          }
          // office_bearer: canView=0, canEdit=0 (defaults above)

          await run(database, 'INSERT INTO role_profile_field_settings (role, field_name, can_view, can_edit) VALUES (?, ?, ?, ?)', [r, f.field, canView, canEdit]);
        }
      }
    }

    // Time allotments table
    await run(database, `
      CREATE TABLE IF NOT EXISTS time_allotments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER,
        hours INTEGER NOT NULL,
        date DATE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Time requests table
    await run(database, `
      CREATE TABLE IF NOT EXISTS time_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        project_id INTEGER,
        hours INTEGER NOT NULL,
        date DATE NOT NULL,
        deadline DATE,
        description TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        approved_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )
    `);

    // Add deadline column if it doesn't exist (migration for existing databases)
    // Add deadline column if it doesn't exist (migration for existing databases)
    await addColumnSafe(database, 'time_requests', 'deadline', 'DATE');

    // Activity logs table
    await run(database, `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        actor_id INTEGER,
        actor_role TEXT,
        action_type TEXT,
        module_name TEXT,
        action TEXT NOT NULL,
        action_description TEXT,
        details TEXT,
        reference_id TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Migration for missing columns
    await addColumnSafe(database, 'activity_logs', 'actor_id', 'INTEGER');
    await addColumnSafe(database, 'activity_logs', 'actor_role', 'TEXT');
    await addColumnSafe(database, 'activity_logs', 'action_type', 'TEXT');
    await addColumnSafe(database, 'activity_logs', 'module_name', 'TEXT');
    await addColumnSafe(database, 'activity_logs', 'action_description', 'TEXT');
    await addColumnSafe(database, 'activity_logs', 'reference_id', 'TEXT');

    // Interview Candidates table
    await run(database, `
      CREATE TABLE IF NOT EXISTS interview_candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        dept TEXT,
        year TEXT,
        register_no TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'interviewed', 'selected', 'rejected', 'completed')),
        marks INTEGER DEFAULT 0,
        interviewer TEXT,
        interviewer_email TEXT,
        mentor_id INTEGER,
        interview_date DATE,
        interview_time TIME,
        remarks TEXT,
        decision TEXT,
        email_sent INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await addColumnSafe(database, 'interview_candidates', 'email_sent', 'INTEGER DEFAULT 0');
    await addColumnSafe(database, 'interview_candidates', 'interviewer', 'TEXT');
    await addColumnSafe(database, 'interview_candidates', 'interviewer_email', 'TEXT');
    await addColumnSafe(database, 'interview_candidates', 'mentor_id', 'INTEGER');
    await addColumnSafe(database, 'interview_candidates', 'interview_date', 'DATE');
    await addColumnSafe(database, 'interview_candidates', 'interview_time', 'TIME');
    await addColumnSafe(database, 'interview_candidates', 'remarks', 'TEXT');
    await addColumnSafe(database, 'interview_candidates', 'decision', 'TEXT');
    await addColumnSafe(database, 'interview_candidates', 'role', "TEXT DEFAULT 'volunteer'");
    await addColumnSafe(database, 'interview_candidates', 'attendance', "TEXT DEFAULT 'present'");

    // Add is_interviewer flag to users table
    await addColumnSafe(database, 'users', 'is_interviewer', 'INTEGER DEFAULT 0');

    // Check and correct status constraint if legacy schema
    if (process.env.DB_TYPE === 'mysql') {
      // Drop existing check if present then add updated constraint
      try {
        await run(database, "ALTER TABLE interview_candidates DROP CHECK interview_candidates_chk_1");
      } catch (e) {
        // may fail if constraint doesn't exist, ignore
      }
      await run(database, "ALTER TABLE interview_candidates ADD CONSTRAINT interview_candidates_chk_1 CHECK(status IN ('pending','assigned','interviewed','selected','rejected','completed'))");
    } else {
      // SQLite - detect if the create SQL includes the new values
      const row = await get(database, "SELECT sql FROM sqlite_master WHERE type='table' AND name='interview_candidates'");
      if (row && row.sql && !row.sql.includes("'assigned'")) {
        console.log('Rebuilding interview_candidates table to update status constraint');
        // rename old table
        await run(database, "ALTER TABLE interview_candidates RENAME TO _interview_candidates_old");
        // recreate with correct schema
        await run(database, `
      CREATE TABLE interview_candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        dept TEXT,
        year TEXT,
        register_no TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'assigned', 'interviewed', 'selected', 'rejected', 'completed')),
        marks INTEGER DEFAULT 0,
        interviewer TEXT,
        interviewer_email TEXT,
        mentor_id INTEGER,
        interview_date DATE,
        interview_time TIME,
        remarks TEXT,
        email_sent INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
            `);
        // copy data
        await run(database, `
      INSERT INTO interview_candidates (id,name,email,phone,dept,year,register_no,status,marks,interviewer,interviewer_email,mentor_id,interview_date,interview_time,remarks,email_sent,created_at)
      SELECT id,name,email,phone,dept,year,register_no,status,marks,interviewer,interviewer_email,mentor_id,interview_date,interview_time,remarks,email_sent,created_at
      FROM _interview_candidates_old
            `);
        // drop old table
        await run(database, "DROP TABLE _interview_candidates_old");
      }
    }

    // console.log('Creating: feedback_questions');
    // Feedback questions table
    await run(database, `
      CREATE TABLE IF NOT EXISTS feedback_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_text TEXT NOT NULL,
        question_type TEXT DEFAULT 'rating' CHECK(question_type IN ('rating', 'text')),
        event_id INTEGER,
          is_enabled INTEGER DEFAULT 1,
          created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        FOREIGN KEY (event_id) REFERENCES meetings(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Feedback responses table
    await run(database, `
      CREATE TABLE IF NOT EXISTS feedback_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        feedback_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (question_id) REFERENCES feedback_questions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Volunteer submissions table (pending volunteer registrations)
    await run(database, `
      CREATE TABLE IF NOT EXISTS volunteer_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        year TEXT,
        department TEXT,
        category TEXT,
        registration_date TEXT,
        signature_file_path TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'approved', 'rejected')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Approved volunteers table (volunteers added to the system)
    await run(database, `
      CREATE TABLE IF NOT EXISTS volunteers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        year TEXT,
        department TEXT,
        category TEXT,
        signature_file_path TEXT,
        hours_contributed INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Admin messages table (Contact Us messages from landing page)
    await run(database, `
      CREATE TABLE IF NOT EXISTS admin_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        responded_by INTEGER,
        response_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Chat messages table for internal messaging (WhatsApp-style)
    await run(database, `
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        reply_to_id INTEGER DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id) ON DELETE SET NULL
      )
    `);

    // Permission requests table - stores requests from office bearers to gain edit/view permissions
    await run(database, `
        CREATE TABLE IF NOT EXISTS permission_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          permission_key TEXT NOT NULL,
          message TEXT,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
          processed_by INTEGER,
          processed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

    // Resources table - stores uploaded documents for students (pdf/docx)
    await run(database, `
      CREATE TABLE IF NOT EXISTS resources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT,
        path TEXT NOT NULL,
        title TEXT,
        description TEXT,
        resource_type TEXT,
        category TEXT,
        folder_id INTEGER,
        uploaded_by INTEGER,
        upload_date DATE,
        upload_time TIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    // Ensure legacy databases get the new columns if they don't exist
    // Ensure legacy databases get the new columns if they don't exist
    await addColumnSafe(database, 'resources', 'title', 'TEXT');
    await addColumnSafe(database, 'resources', 'resource_type', 'TEXT');
    await addColumnSafe(database, 'resources', 'category', 'TEXT');
    await addColumnSafe(database, 'resources', 'folder_id', 'INTEGER');
    await addColumnSafe(database, 'resources', 'description', 'TEXT');
    await addColumnSafe(database, 'resources', 'upload_date', 'DATE');
    await addColumnSafe(database, 'resources', 'upload_time', 'TIME');

    // Resource folders table
    await run(database, `
      CREATE TABLE IF NOT EXISTS resource_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        parent_id INTEGER,
        created_by INTEGER,
        resource_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES resource_folders(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // console.log('Finished main tables');
    // Migration: Add resource_type column if it doesn't exist
    // Migration: Add resource_type column if it doesn't exist
    await addColumnSafe(database, 'resource_folders', 'resource_type', 'TEXT');

    // Teams table
    await run(database, `
      CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Team members table
    await run(database, `
      CREATE TABLE IF NOT EXISTS team_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member' CHECK(role IN ('leader', 'member')),
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(team_id, user_id)
      )
    `);

    // Team assignments table
    await run(database, `
      CREATE TABLE IF NOT EXISTS team_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to INTEGER,
        assigned_by INTEGER,
        due_date TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'cancelled')),
        priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
        proof_file_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Add proof_file_path column if it doesn't exist
    // Add proof_file_path column if it doesn't exist
    await addColumnSafe(database, 'team_assignments', 'proof_file_path', 'TEXT');

    // Team assignment tracking table
    await run(database, `
      CREATE TABLE IF NOT EXISTS team_assignment_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('created', 'assigned', 'started', 'updated', 'completed', 'cancelled', 'commented')),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assignment_id) REFERENCES team_assignments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Team requests table
    await run(database, `
      CREATE TABLE IF NOT EXISTS team_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
        reviewed_by INTEGER,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Events table (for special events, functions, etc.)
    await run(database, `
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        year TEXT NOT NULL,
        is_special_day INTEGER DEFAULT 0,
        image_url TEXT,
        max_volunteers INTEGER,
        volunteer_registration_deadline DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Awards table
    await run(database, `
      CREATE TABLE IF NOT EXISTS awards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        recipient_name TEXT,
        recipient_id INTEGER,
        award_date DATE,
        year TEXT,
        category TEXT,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // NGO info table (multiple NGO support)
    await run(database, `
      CREATE TABLE IF NOT EXISTS ngo_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        about TEXT,
        work TEXT,
        projects TEXT,
        events TEXT,
        profile TEXT,
        logo_url TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        address TEXT,
        website TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure image_url column exists (migration for existing databases)
    await addColumnSafe(database, 'events', 'image_url', 'TEXT');
    await addColumnSafe(database, 'events', 'max_volunteers', 'INTEGER');
    await addColumnSafe(database, 'events', 'volunteer_registration_deadline', 'DATETIME');

    // Optional mapping of volunteers to their assigned mentees (used to auto-fill mentee name)
    await run(database, `
      CREATE TABLE IF NOT EXISTS phone_mentoring_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        volunteer_id INTEGER,
        project_id INTEGER,
        mentee_name TEXT NOT NULL,
        mentee_phone TEXT,
        mentee_register_no TEXT,
        mentee_department TEXT,
        mentee_year TEXT,
        mentee_gender TEXT,
        mentee_school TEXT,
        mentee_address TEXT,
        mentee_district TEXT,
        mentee_parent_contact TEXT,
        mentee_status TEXT DEFAULT 'active',
        mentee_notes TEXT,
        expected_classes INTEGER,
        created_by INTEGER,
        mentee_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Ensure existing databases have the new assignment columns
    // Ensure existing databases have the new assignment columns
    await addColumnSafe(database, 'phone_mentoring_assignments', 'project_id', 'INTEGER REFERENCES projects(id)');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_register_no', 'TEXT');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_department', 'TEXT');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_year', 'TEXT');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_gender', 'TEXT');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_school', 'TEXT');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_address', 'TEXT');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_district', 'TEXT');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_parent_contact', 'TEXT');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_status', "TEXT DEFAULT 'active'");
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_notes', 'TEXT');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'created_by', 'INTEGER REFERENCES users(id)');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'mentee_user_id', 'INTEGER REFERENCES users(id)');
    await addColumnSafe(database, 'phone_mentoring_assignments', 'expected_classes', 'INTEGER');

    // Migration: Remove UNIQUE constraint on volunteer_id to allow multiple mentees per mentor
    // SQLite doesn't support DROP CONSTRAINT, so we need to recreate the table
    try {
      const tableInfo = await all(database, "SELECT sql FROM sqlite_master WHERE type='table' AND name='phone_mentoring_assignments'");
      if (tableInfo && tableInfo.length > 0) {
        const createSql = (tableInfo[0] || {}).sql || '';
        if (createSql.includes('UNIQUE(volunteer_id)')) {
          console.log('🔄 Migrating phone_mentoring_assignments: Removing UNIQUE constraint on volunteer_id...');

          // Create new table without UNIQUE constraint
          await run(database, `
            CREATE TABLE IF NOT EXISTS phone_mentoring_assignments_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              volunteer_id INTEGER,
              project_id INTEGER,
              mentee_name TEXT NOT NULL,
              mentee_phone TEXT,
              mentee_register_no TEXT,
              mentee_department TEXT,
              mentee_year TEXT,
              mentee_gender TEXT,
              mentee_school TEXT,
              mentee_address TEXT,
              mentee_district TEXT,
              mentee_parent_contact TEXT,
              mentee_status TEXT DEFAULT 'active',
              mentee_notes TEXT,
              expected_classes INTEGER,
              created_by INTEGER,
              mentee_user_id INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
              FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            )
          `);

          // Copy data from old table to new table
          await run(database, `
            INSERT INTO phone_mentoring_assignments_new 
            SELECT * FROM phone_mentoring_assignments
          `);

          // Drop old table
          await run(database, `DROP TABLE phone_mentoring_assignments`);

          // Rename new table
          await run(database, `ALTER TABLE phone_mentoring_assignments_new RENAME TO phone_mentoring_assignments`);

          console.log('✅ Migration completed: UNIQUE constraint on volunteer_id removed');
        }
      }
    } catch (migrationErr) {
      console.warn('⚠️  Could not migrate phone_mentoring_assignments table:', migrationErr);
      // Continue - the application will handle NULL volunteer_id
    }

    // Phone mentoring daily updates - records volunteer phone mentoring calls with mentees
    await run(database, `
      CREATE TABLE IF NOT EXISTS phone_mentoring_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        volunteer_id INTEGER NOT NULL,
        volunteer_name TEXT NOT NULL,
        mentee_name TEXT NOT NULL,
        assignment_id INTEGER,
        project_id INTEGER,
        update_date DATE NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('CALL_DONE', 'NOT_CALLED', 'STUDENT_NOT_PICKED', 'CALL_PENDING')),
        explanation TEXT,
        attempts INTEGER,
        attachment_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (volunteer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assignment_id) REFERENCES phone_mentoring_assignments(id) ON DELETE SET NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `);

    // Ensure existing databases have the new mentoring update columns
    // Ensure existing databases have the new mentoring update columns
    await addColumnSafe(database, 'phone_mentoring_updates', 'assignment_id', 'INTEGER REFERENCES phone_mentoring_assignments(id)');
    await addColumnSafe(database, 'phone_mentoring_updates', 'project_id', 'INTEGER REFERENCES projects(id)');

    // Phone mentoring attendance table - tracks mentee attendance per assignment
    await run(database, `
      CREATE TABLE IF NOT EXISTS phone_mentoring_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER NOT NULL,
        project_id INTEGER,
        mentee_name TEXT,
        attendance_date DATE NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('PRESENT', 'ABSENT', 'FOLLOW_UP', 'NOT_REACHABLE')),
        notes TEXT,
        call_recording_path TEXT,
        recorded_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(assignment_id, attendance_date),
        FOREIGN KEY (assignment_id) REFERENCES phone_mentoring_assignments(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Ensure existing databases have call_recording_path column
    // Ensure existing databases have call_recording_path column
    await addColumnSafe(database, 'phone_mentoring_attendance', 'call_recording_path', 'TEXT');

    // Event OD (On Duty) marking table - ensure support for 'permission' status and migrate if needed
    // If an existing table exists with an older CHECK, attempt a safe migration preserving data.
    const eventOdExists = await get(database, "SELECT name FROM sqlite_master WHERE type='table' AND name='event_od'");
    if (eventOdExists) {
      try {
        // Create new table with permission included
        await run(database, `
          CREATE TABLE IF NOT EXISTS event_od_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('od', 'absent', 'permission')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(event_id, user_id)
          )
        `);

        // Copy existing rows (only allowed statuses) into new table
        await run(database, `
          INSERT OR IGNORE INTO event_od_new (event_id, user_id, status, created_at, updated_at)
          SELECT event_id, user_id, status, created_at, updated_at FROM event_od
          WHERE status IN ('od','absent')
        `);

        // Drop existing backup table if it exists to avoid rename conflicts
        await run(database, `DROP TABLE IF EXISTS event_od_old`);

        // Drop old table and rename new
        await run(database, `ALTER TABLE event_od RENAME TO event_od_old`);
        await run(database, `ALTER TABLE event_od_new RENAME TO event_od`);
        await run(database, `DROP TABLE IF EXISTS event_od_old`);
        console.log('✅ Migrated event_od to include permission status');
      } catch (mErr) {
        if (mErr.message && mErr.message.includes('already exists')) {
          // If we hit a race condition or already migrated, just clean up
          await run(database, `DROP TABLE IF EXISTS event_od_new`);
        } else {
          console.error('⚠️  Failed to migrate event_od table, leaving existing table in place:', mErr.message || mErr);
        }
        // If migration failed, ensure table exists with original definition (fallback)
        await run(database, `
          CREATE TABLE IF NOT EXISTS event_od (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('od', 'absent')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(event_id, user_id)
          )
        `);
      }
    } else {
      // Table doesn't exist - create with permission support
      await run(database, `
        CREATE TABLE IF NOT EXISTS event_od (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('od', 'absent', 'permission')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(event_id, user_id)
        )
      `);
    }

    // Event members (students assigned to events)
    await run(database, `
      CREATE TABLE IF NOT EXISTS event_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(event_id, user_id)
      )
    `);

    // Event attendance records table
    await run(database, `
      CREATE TABLE IF NOT EXISTS event_volunteers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        department TEXT,
        year TEXT,
        phone TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )
    `);

    await run(database, `
      CREATE TABLE IF NOT EXISTS event_attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late')),
        marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        marked_by INTEGER,
        notes TEXT,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Student Event Registrations - Links students to events they registered for
    await run(database, `
      CREATE TABLE IF NOT EXISTS event_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        registration_type TEXT DEFAULT 'volunteer' CHECK(registration_type IN ('volunteer', 'participant')),
        status TEXT DEFAULT 'registered' CHECK(status IN ('registered', 'confirmed', 'cancelled')),
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(event_id, user_id)
      )
    `);



    // Volunteer Assignments - Links registered students as volunteers to events
    await run(database, `
      CREATE TABLE IF NOT EXISTS volunteer_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        assigned_by INTEGER,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'assigned' CHECK(status IN ('assigned', 'confirmed', 'completed', 'cancelled')),
        notes TEXT,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(event_id, user_id)
      )
    `);

    // Create default admin user if not exists (email in lowercase)
    const adminEmail = 'smvolunteers@ksrct.ac.in'.toLowerCase().trim();

    // Check if admin exists (case-insensitive)
    const allUsers = await all(database, 'SELECT id, email FROM users', []);

    const adminExists = allUsers.find(u => u.email.toLowerCase().trim() === adminEmail);

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('12345', 10);
      const result = await run(database, `
        INSERT INTO users (name, email, password, role, must_change_password)
        VALUES (?, ?, ?, ?, ?)
      `, ['Admin User', adminEmail, hashedPassword, 'admin', 0]);

      console.log('✅ Default admin user created');
      console.log('   Email: smvolunteers@ksrct.ac.in');
      console.log('   Password: 12345');
      console.log('   User ID:', result.lastID);
    } else {
      console.log('ℹ️  Admin user already exists');
      console.log('   Email:', adminExists.email);
      console.log('   User ID:', adminExists.id);
      console.log('   Password preserved (not reset)');
      // Removed password reset logic - password changes will persist across restarts
    }

    // Office Bearers table - stores student office bearers for each year
    await run(database, `
      CREATE TABLE IF NOT EXISTS office_bearers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        contact TEXT,
        email TEXT,
        department TEXT,
        student_year TEXT,
        photo_url TEXT,
        academic_year TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure newer columns exist for older databases
    await addColumnSafe(database, 'office_bearers', 'department', 'TEXT');
    await addColumnSafe(database, 'office_bearers', 'student_year', 'TEXT');

    // Announcements table
    await run(database, `
      CREATE TABLE IF NOT EXISTS announcements(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK(priority IN('normal', 'important')),
    link_url TEXT,
    image_url TEXT,
    send_email INTEGER DEFAULT 0,
    target TEXT DEFAULT 'all',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME,
    FOREIGN KEY(created_by) REFERENCES users(id)
  )
  `);

    // Ensure link_url and image_url columns exist (Migration)
    await addColumnSafe(database, 'announcements', 'link_url', 'TEXT');
    await addColumnSafe(database, 'announcements', 'image_url', 'TEXT');
    await addColumnSafe(database, 'announcements', 'deadline', 'DATETIME');

    // Add can_manage_announcements to permissions if missing
    await addColumnSafe(database, 'permissions', 'can_manage_announcements', 'INTEGER DEFAULT 0');
    await addColumnSafe(database, 'permissions', 'can_manage_announcements_view', 'INTEGER DEFAULT 0');
    await addColumnSafe(database, 'permissions', 'can_manage_announcements_edit', 'INTEGER DEFAULT 0');

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

