import sqlite3 from 'sqlite3';
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
  if (!db) {
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

const run = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const all = (db, query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const initDatabase = async () => {
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

    // Users table
    await run(database, `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'office_bearer', 'student', 'alumni', 'spoc')),
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

    // Unified profiles table (stores common profile fields for students, office bearers, alumni and SPOCs)
    await run(database, `
      CREATE TABLE IF NOT EXISTS profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('student','office_bearer','alumni','spoc')),
        dept TEXT,
        year TEXT,
        phone TEXT,
        blood_group TEXT,
        gender TEXT,
        dob TEXT,
        address TEXT,
        photo_url TEXT,
        custom_fields TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      )
    `);

    // Add missing columns if they don't exist (migration for existing databases)
    try {
      const profileColumns = await all(database, "PRAGMA table_info(profiles)");
      const columnNames = profileColumns.map((col) => col.name);

      if (!columnNames.includes('photo_url')) {
        await run(database, `ALTER TABLE profiles ADD COLUMN photo_url TEXT`);
        console.log('✅ Added photo_url column to profiles table');
      }
      if (!columnNames.includes('register_no')) {
        await run(database, `ALTER TABLE profiles ADD COLUMN register_no TEXT`);
        console.log('✅ Added register_no column to profiles table');
      }
      if (!columnNames.includes('academic_year')) {
        await run(database, `ALTER TABLE profiles ADD COLUMN academic_year TEXT`);
        console.log('✅ Added academic_year column to profiles table');
      }
      if (!columnNames.includes('father_number')) {
        await run(database, `ALTER TABLE profiles ADD COLUMN father_number TEXT`);
        console.log('✅ Added father_number column to profiles table');
      }
      if (!columnNames.includes('hosteller_dayscholar')) {
        await run(database, `ALTER TABLE profiles ADD COLUMN hosteller_dayscholar TEXT`);
        console.log('✅ Added hosteller_dayscholar column to profiles table');
      }
    } catch (e) {
      console.warn('⚠️  Could not check/add columns:', e.message);
    }

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

        // Legacy spoc_profiles are intentionally skipped (SPOC role removed)

        // For alumni, ensure there is a profiles row (alumni table has extra fields which we keep)
        try {
          const alums = await all(database, 'SELECT * FROM alumni');
          for (const a of alums) {
            await run(database, `INSERT OR IGNORE INTO profiles (user_id, role, dept, year, phone, blood_group, gender, dob, address, custom_fields) VALUES (?, 'alumni', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)`, [a.user_id]);
          }
        } catch (e) { }
      }
    } catch (e) {
      // ignore migration errors
    }

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
    try {
      await run(database, `ALTER TABLE projects ADD COLUMN image_url TEXT`);
    } catch (e) {
      // Column might already exist, that's okay
    }
    try {
      await run(database, `ALTER TABLE projects ADD COLUMN required_calls INTEGER DEFAULT 0`);
    } catch (e) {
      // Column might already exist, that's okay
    }

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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (submitted_by) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )
    `);

    // Bill items table - stores itemized categories for bills (e.g., transport, food, stationary, refreshment, fuel)
    await run(database, `
      CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('transport','food','stationary','refreshment','fuel','other')),
        description TEXT,
        amount REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      )
    `);
    // Ensure we have from/to columns for transport items (added later to support transport item details)
    try {
      await run(database, `ALTER TABLE bill_items ADD COLUMN from_loc TEXT`);
    } catch (e) {
      // ignore if column already exists
    }
    try {
      await run(database, `ALTER TABLE bill_items ADD COLUMN to_loc TEXT`);
    } catch (e) {
      // ignore if column already exists
    }

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
        can_manage_alumni INTEGER DEFAULT 0,
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
      'can_manage_alumni',
      'can_manage_feedback_questions',
      'can_manage_feedback_reports',
      'can_manage_permissions_module',
      'can_manage_settings',
      'can_view_analytics',
      'can_view_reports'
    ];

    for (const key of moduleKeys) {
      try {
        // add base column if missing (idempotent)
        await run(database, `ALTER TABLE permissions ADD COLUMN ${key} INTEGER DEFAULT 0`);
      } catch (err) {
        // ignore if exists
      }
      // add view/edit variants
      try {
        await run(database, `ALTER TABLE permissions ADD COLUMN ${key}_view INTEGER DEFAULT 0`);
      } catch (err) { }
      try {
        await run(database, `ALTER TABLE permissions ADD COLUMN ${key}_edit INTEGER DEFAULT 0`);
      } catch (err) { }
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
    try {
      await run(database, `ALTER TABLE time_requests ADD COLUMN deadline DATE`);
    } catch (e) {
      // Column already exists, ignore
    }

    // Alumni table
    await run(database, `
      CREATE TABLE IF NOT EXISTS alumni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        graduation_year INTEGER,
        current_position TEXT,
        company TEXT,
        achievements TEXT,
        contact_email TEXT,
        linkedin_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

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
    try {
      await run(database, `ALTER TABLE resources ADD COLUMN title TEXT`);
    } catch (e) { }
    try {
      await run(database, `ALTER TABLE resources ADD COLUMN resource_type TEXT`);
    } catch (e) { }
    try {
      await run(database, `ALTER TABLE resources ADD COLUMN category TEXT`);
    } catch (e) { }
    try {
      await run(database, `ALTER TABLE resources ADD COLUMN folder_id INTEGER`);
    } catch (e) { }
    try {
      await run(database, `ALTER TABLE resources ADD COLUMN description TEXT`);
    } catch (e) { }
    try {
      await run(database, `ALTER TABLE resources ADD COLUMN upload_date DATE`);
    } catch (e) { }
    try {
      await run(database, `ALTER TABLE resources ADD COLUMN upload_time TIME`);
    } catch (e) { }

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

    // Migration: Add resource_type column if it doesn't exist
    try {
      await run(database, `ALTER TABLE resource_folders ADD COLUMN resource_type TEXT`);
      console.log('✅ Added resource_type column to resource_folders');
    } catch (e) {
      // Column might already exist, that's okay
      if (!e.message.includes('duplicate column')) {
        console.log('ℹ️ resource_type column may already exist in resource_folders');
      }
    }

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
    try {
      await run(database, `ALTER TABLE team_assignments ADD COLUMN proof_file_path TEXT`);
    } catch (e) {
      // Column might already exist, that's okay
    }

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

    // Add image_url column if it doesn't exist (migration for existing databases)
    try {
      await run(database, `ALTER TABLE events ADD COLUMN image_url TEXT`);
    } catch (e) {
      // Column might already exist, that's okay
    }

    // Add volunteer registration limit and deadline columns (migration for existing databases)
    try {
      await run(database, `ALTER TABLE events ADD COLUMN max_volunteers INTEGER`);
    } catch (e) {
      // Column might already exist, that's okay
    }
    try {
      await run(database, `ALTER TABLE events ADD COLUMN volunteer_registration_deadline DATETIME`);
    } catch (e) {
      // Column might already exist, that's okay
    }

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
    try {
      const mentoringAssignmentCols = await all(database, "PRAGMA table_info(phone_mentoring_assignments)");
      const assignmentColNames = mentoringAssignmentCols.map((col) => col.name);
      const columnMap = [
        ['project_id', `ALTER TABLE phone_mentoring_assignments ADD COLUMN project_id INTEGER REFERENCES projects(id)`],
        ['mentee_register_no', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_register_no TEXT`],
        ['mentee_department', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_department TEXT`],
        ['mentee_year', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_year TEXT`],
        ['mentee_gender', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_gender TEXT`],
        ['mentee_school', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_school TEXT`],
        ['mentee_address', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_address TEXT`],
        ['mentee_district', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_district TEXT`],
        ['mentee_parent_contact', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_parent_contact TEXT`],
        ['mentee_status', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_status TEXT DEFAULT 'active'`],
        ['mentee_notes', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_notes TEXT`],
        ['created_by', `ALTER TABLE phone_mentoring_assignments ADD COLUMN created_by INTEGER REFERENCES users(id)`],
        ['mentee_user_id', `ALTER TABLE phone_mentoring_assignments ADD COLUMN mentee_user_id INTEGER REFERENCES users(id)`],
        ['expected_classes', `ALTER TABLE phone_mentoring_assignments ADD COLUMN expected_classes INTEGER`]
      ];

      for (const [colName, statement] of columnMap) {
        if (!assignmentColNames.includes(colName)) {
          await run(database, statement);
        }
      }
    } catch (mentoringAssignmentErr) {
      console.warn('⚠️  Could not ensure columns on phone_mentoring_assignments:', mentoringAssignmentErr.message);
    }

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
    try {
      const mentoringUpdateCols = await all(database, "PRAGMA table_info(phone_mentoring_updates)");
      const updateColNames = mentoringUpdateCols.map((col) => col.name);
      if (!updateColNames.includes('assignment_id')) {
        await run(database, `ALTER TABLE phone_mentoring_updates ADD COLUMN assignment_id INTEGER REFERENCES phone_mentoring_assignments(id)`);
      }
      if (!updateColNames.includes('project_id')) {
        await run(database, `ALTER TABLE phone_mentoring_updates ADD COLUMN project_id INTEGER REFERENCES projects(id)`);
      }
    } catch (mentoringUpdateErr) {
      console.warn('⚠️  Could not ensure columns on phone_mentoring_updates:', mentoringUpdateErr.message);
    }

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
    try {
      const attendanceCols = await all(database, "PRAGMA table_info(phone_mentoring_attendance)");
      const attendanceColNames = attendanceCols.map((col) => col.name);
      if (!attendanceColNames.includes('call_recording_path')) {
        await run(database, `ALTER TABLE phone_mentoring_attendance ADD COLUMN call_recording_path TEXT`);
      }
    } catch (attendanceErr) {
      console.warn('⚠️  Could not ensure call_recording_path column on phone_mentoring_attendance:', attendanceErr.message);
    }

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
  } catch (e) { }

  try {
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

    // SPOC Project/Event Assignments - Links SPOCs to projects/events they manage
    await run(database, `
      CREATE TABLE IF NOT EXISTS spoc_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        spoc_id INTEGER NOT NULL,
        project_id INTEGER,
        event_id INTEGER,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assigned_by INTEGER,
        FOREIGN KEY (spoc_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
        CHECK((project_id IS NOT NULL AND event_id IS NULL) OR (project_id IS NULL AND event_id IS NOT NULL))
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
    const allUsers = await new Promise((resolve, reject) => {
      database.all('SELECT id, email FROM users', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

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

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
};

